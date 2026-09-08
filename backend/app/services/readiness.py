from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    Document,
    DocumentRequirementMatch,
    ProjectRequirement,
    ReadinessStatus,
    Requirement,
)


def calculate_readiness(db: Session, company_id: UUID, project_id: UUID, contractor_id: UUID) -> dict:
    links = db.scalars(select(ProjectRequirement).where(ProjectRequirement.project_id == project_id)).all()
    requirement_ids = [link.requirement_id for link in links]
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
        )
    ).all()
    document_ids = [document.id for document in documents]
    explicit_matches = (
        db.scalars(
            select(DocumentRequirementMatch).where(
                DocumentRequirementMatch.document_id.in_(document_ids),
                DocumentRequirementMatch.requirement_id.in_(requirement_ids),
            )
        ).all()
        if document_ids and requirement_ids
        else []
    )
    matched_pairs = {(match.document_id, match.requirement_id) for match in explicit_matches}

    now = datetime.now(timezone.utc)
    missing: list[str] = []
    satisfied = 0
    for requirement in requirements:
        valid_documents = [
            document
            for document in documents
            if document.expires_at is None or document.expires_at > now
        ]
        explicitly_matched = any(
            (document.id, requirement.id) in matched_pairs for document in valid_documents
        )
        legacy_name_match = any(
            document.document_type.lower() == requirement.name.lower()
            for document in valid_documents
        )
        if explicitly_matched or legacy_name_match:
            satisfied += 1
        else:
            missing.append(requirement.name)

    total = len(requirements)
    if total == 0:
        status = "not_configured"
        score = 0
        explanation = "No requirements have been configured for this project."
    else:
        score = round((satisfied / total) * 100)
        status = (
            ReadinessStatus.READY
            if score == 100
            else ReadinessStatus.ATTENTION
            if score >= 60
            else ReadinessStatus.NOT_READY
        )
        explanation = (
            "All required evidence is valid."
            if not missing
            else f"Missing or invalid evidence: {', '.join(missing)}."
        )

    return {
        "project_id": project_id,
        "contractor_id": contractor_id,
        "score": score,
        "status": status.value if isinstance(status, ReadinessStatus) else status,
        "explanation": explanation,
        "missing_requirements": missing,
    }
