from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    Contractor,
    Document,
    DocumentRequirementMatch,
    Project,
    ProjectRequirement,
    Requirement,
)
from app.models.evidence_intelligence import EvidenceIntelligence

ENGINE_VERSION = "readiness-v2"


def _evidence_state(document: Document, intelligence: EvidenceIntelligence | None) -> str:
    if document.status != "active":
        return "inactive"
    if intelligence is None:
        return "legacy"
    if intelligence.verification_status == "rejected":
        return "rejected"
    if intelligence.verification_status != "verified":
        return "unverified"
    now = datetime.now(timezone.utc)
    if document.expires_at is not None:
        if document.expires_at <= now:
            return "expired"
        if document.expires_at <= now.replace(microsecond=0):
            return "expiring"
    if intelligence.review_status != "approved":
        return "requires_review"
    return "valid"


def _is_valid_for_readiness(state: str) -> bool:
    return state in {"valid", "legacy"}


def _reason(state: str) -> str:
    return {
        "inactive": "Evidence is inactive.",
        "rejected": "Evidence was rejected during verification.",
        "unverified": "Evidence has not been verified.",
        "expired": "Evidence has expired.",
        "expiring": "Evidence is approaching expiry.",
        "requires_review": "Evidence is verified but still requires review approval.",
        "legacy": "Evidence predates Evidence Intelligence and remains compatible with the legacy readiness model.",
    }.get(state, "Evidence does not currently satisfy this requirement.")


def _requirement_documents(
    requirement_id: UUID,
    documents: list[Document],
    matches: set[tuple[UUID, UUID]],
) -> list[Document]:
    return [
        document
        for document in documents
        if (document.id, requirement_id) in matches or document.document_type.lower() == ""
    ]


def _jsonable(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _fingerprint(payload: dict[str, Any]) -> str:
    canonical = json.dumps(_jsonable(payload), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_readiness_intelligence(db: Session, company_id: UUID, project_id: UUID, contractor_id: UUID) -> dict[str, Any]:
    project = db.scalar(select(Project).where(Project.id == project_id, Project.company_id == company_id))
    contractor = db.scalar(select(Contractor).where(Contractor.id == contractor_id, Contractor.company_id == company_id))
    if project is None or contractor is None:
        raise ValueError("Project or contractor not found")

    requirement_links = db.scalars(select(ProjectRequirement).where(ProjectRequirement.project_id == project_id)).all()
    requirement_ids = [link.requirement_id for link in requirement_links]
    requirements = (
        db.scalars(
            select(Requirement).where(
                Requirement.id.in_(requirement_ids),
                Requirement.company_id == company_id,
            )
        ).all()
        if requirement_ids
        else []
    )
    documents = db.scalars(
        select(Document).where(
            Document.company_id == company_id,
            Document.contractor_id == contractor_id,
        ).order_by(Document.created_at.desc())
    ).all()
    document_ids = [document.id for document in documents]
    matches = (
        db.scalars(
            select(DocumentRequirementMatch).where(
                DocumentRequirementMatch.document_id.in_(document_ids),
                DocumentRequirementMatch.requirement_id.in_(requirement_ids),
            )
        ).all()
        if document_ids and requirement_ids
        else []
    )
    matched_pairs = {(match.document_id, match.requirement_id) for match in matches}
    intelligence_rows = (
        db.scalars(select(EvidenceIntelligence).where(EvidenceIntelligence.document_id.in_(document_ids))).all()
        if document_ids
        else []
    )
    intelligence_by_document = {row.document_id: row for row in intelligence_rows}

    evidence_state: dict[UUID, str] = {
        document.id: _evidence_state(document, intelligence_by_document.get(document.id))
        for document in documents
    }

    requirement_rows: list[dict[str, Any]] = []
    blockers: list[dict[str, Any]] = []
    satisfied = 0

    for requirement in requirements:
        candidates = [
            document
            for document in documents
            if (document.id, requirement.id) in matched_pairs
            or document.document_type.strip().lower() == requirement.name.strip().lower()
        ]
        valid = [document for document in candidates if _is_valid_for_readiness(evidence_state[document.id])]
        if valid:
            satisfied += 1
            requirement_rows.append({
                "requirement_id": str(requirement.id),
                "requirement_name": requirement.name,
                "status": "satisfied",
                "reason": "A valid evidence record satisfies this requirement.",
                "evidence": [
                    {"document_id": str(document.id), "document_name": document.name, "state": evidence_state[document.id]}
                    for document in valid
                ],
            })
            continue

        candidate_rows = [
            {"document_id": str(document.id), "document_name": document.name, "state": evidence_state[document.id], "reason": _reason(evidence_state[document.id])}
            for document in candidates
        ]
        if candidates:
            action = "Repair or replace the listed evidence."
            reason = candidate_rows[0]["reason"] if len(candidate_rows) == 1 else "Available evidence does not currently satisfy this requirement."
        else:
            action = "Provide evidence for this requirement."
            reason = "No matching evidence is currently attached to this requirement."
        row = {
            "requirement_id": str(requirement.id),
            "requirement_name": requirement.name,
            "status": "blocked",
            "reason": reason,
            "action": action,
            "evidence": candidate_rows,
        }
        requirement_rows.append(row)
        blockers.append(row)

    total = len(requirements)
    score = round((satisfied / total) * 100) if total else 0
    status = "not_configured" if total == 0 else "ready" if score == 100 else "attention" if score >= 60 else "not_ready"
    explanation = "No requirements have been configured for this project." if total == 0 else (
        "All required evidence is valid."
        if not blockers
        else f"{len(blockers)} of {total} requirements are blocking readiness."
    )

    missing_ids = {UUID(row["requirement_id"]) for row in blockers}
    candidate_actions: list[dict[str, Any]] = []
    for document in documents:
        if evidence_state[document.id] in {"valid", "legacy", "inactive"}:
            continue
        affected = [
            requirement.name
            for requirement in requirements
            if requirement.id in missing_ids and (document.id, requirement.id) in matched_pairs
        ]
        if affected:
            candidate_actions.append({
                "action_type": "repair_evidence",
                "document_id": str(document.id),
                "document_name": document.name,
                "current_state": evidence_state[document.id],
                "resolves_requirements": affected,
            })

    covered: set[str] = set()
    change_set: list[dict[str, Any]] = []
    # Deterministic greedy set cover: prefer one evidence repair that resolves the most blockers.
    for candidate in sorted(candidate_actions, key=lambda item: (-len(item["resolves_requirements"]), item["document_name"])):
        new = [name for name in candidate["resolves_requirements"] if name not in covered]
        if not new:
            continue
        covered.update(new)
        change_set.append({**candidate, "resolves_requirements": new})

    for blocker in blockers:
        if blocker["requirement_name"] not in covered:
            change_set.append({
                "action_type": "provide_evidence",
                "requirement_id": blocker["requirement_id"],
                "requirement_name": blocker["requirement_name"],
                "action": "Provide and verify evidence for this requirement.",
            })

    evidence_rows: list[dict[str, Any]] = []
    for document in documents:
        affected_requirements = [
            requirement.name
            for requirement in requirements
            if (document.id, requirement.id) in matched_pairs
            or document.document_type.strip().lower() == requirement.name.strip().lower()
        ]
        if not affected_requirements:
            continue
        resolves_now = [name for name in affected_requirements if any(
            row["requirement_name"] == name and row["status"] == "blocked" for row in blockers
        )]
        evidence_rows.append({
            "document_id": str(document.id),
            "document_name": document.name,
            "state": evidence_state[document.id],
            "affected_requirements": affected_requirements,
            "blocked_requirements_it_could_resolve_if_repaired": resolves_now,
        })

    result = {
        "engine_version": ENGINE_VERSION,
        "project_id": str(project.id),
        "project_name": project.name,
        "contractor_id": str(contractor.id),
        "contractor_name": contractor.name,
        "score": score,
        "status": status,
        "explanation": explanation,
        "requirements": requirement_rows,
        "blockers": blockers,
        "evidence": evidence_rows,
        "minimum_change_set": change_set,
    }
    result["fingerprint"] = _fingerprint(result)
    return result


def simulate_readiness(
    db: Session,
    company_id: UUID,
    project_id: UUID,
    contractor_id: UUID,
    repair_evidence_ids: list[UUID],
    provide_requirement_ids: list[UUID],
) -> dict[str, Any]:
    current = build_readiness_intelligence(db, company_id, project_id, contractor_id)
    repair_ids = {str(item) for item in repair_evidence_ids}
    provided_ids = {str(item) for item in provide_requirement_ids}
    resolved: set[str] = set(provided_ids)
    for evidence in current["evidence"]:
        if evidence["document_id"] in repair_ids:
            resolved.update(evidence["blocked_requirements_it_could_resolve_if_repaired"])

    remaining = [
        blocker for blocker in current["blockers"]
        if blocker["requirement_id"] not in resolved
    ]
    total = len(current["requirements"])
    satisfied = total - len(remaining)
    score = round((satisfied / total) * 100) if total else 0
    status = "not_configured" if total == 0 else "ready" if score == 100 else "attention" if score >= 60 else "not_ready"
    return {
        "project_id": current["project_id"],
        "contractor_id": current["contractor_id"],
        "current_score": current["score"],
        "projected_score": score,
        "score_delta": score - current["score"],
        "current_status": current["status"],
        "projected_status": status,
        "resolved_requirements": [
            blocker["requirement_name"] for blocker in current["blockers"] if blocker["requirement_id"] in resolved
        ],
        "remaining_blockers": [blocker["requirement_name"] for blocker in remaining],
        "selected_repair_evidence_ids": sorted(repair_ids),
        "selected_new_requirement_ids": sorted(provided_ids),
    }
