from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ComplianceCheck, ProjectContractor, ReadinessStatus, User
from app.models.readiness_trace import ReadinessTrace
from app.services.audit import record_audit
from app.services.rbac import require_permission
from app.services.readiness import calculate_readiness
from app.services.readiness_intelligence import build_readiness_intelligence, simulate_readiness

router = APIRouter(prefix="/api/readiness", tags=["readiness-intelligence"])


class ReadinessScenarioRequest(BaseModel):
    repair_evidence_ids: list[UUID] = Field(default_factory=list, max_length=50)
    provide_requirement_ids: list[UUID] = Field(default_factory=list, max_length=50)


class ReadinessScenarioResponse(BaseModel):
    project_id: UUID
    contractor_id: UUID
    current_score: int
    projected_score: int
    score_delta: int
    current_status: str
    projected_status: str
    resolved_requirements: list[str]
    remaining_blockers: list[str]
    selected_repair_evidence_ids: list[str]
    selected_new_requirement_ids: list[str]


def _blocker_names(snapshot: list | None) -> set[str]:
    return {str(item.get("requirement_name")) for item in (snapshot or []) if item.get("requirement_name")}


def _trace_timeline_item(trace: ReadinessTrace, previous: ReadinessTrace | None) -> dict:
    current_blockers = _blocker_names(trace.blockers_snapshot)
    previous_blockers = _blocker_names(previous.blockers_snapshot if previous else None)
    return {
        "id": trace.id,
        "created_at": trace.created_at,
        "score": trace.score,
        "status": trace.status,
        "explanation": trace.explanation,
        "fingerprint": trace.fingerprint,
        "requirement_count": len(trace.requirements_snapshot or []),
        "evidence_count": len(trace.evidence_snapshot or []),
        "blocker_count": len(trace.blockers_snapshot or []),
        "change_set_count": len(trace.change_set_snapshot or []),
        "score_delta": trace.score - previous.score if previous else None,
        "status_changed": bool(previous and trace.status != previous.status),
        "blockers_added": sorted(current_blockers - previous_blockers) if previous else [],
        "blockers_resolved": sorted(previous_blockers - current_blockers) if previous else [],
    }


def _ensure_current_trace(db: Session, user: User, project_id: UUID, contractor_id: UUID) -> list[ReadinessTrace]:
    current = build_readiness_intelligence(db, user.company_id, project_id, contractor_id)
    traces = db.scalars(
        select(ReadinessTrace)
        .where(
            ReadinessTrace.company_id == user.company_id,
            ReadinessTrace.project_id == project_id,
            ReadinessTrace.contractor_id == contractor_id,
        )
        .order_by(ReadinessTrace.created_at.desc())
        .limit(12)
    ).all()
    if not traces or traces[0].fingerprint != current["fingerprint"]:
        trace = create_trace(
            db,
            company_id=user.company_id,
            project_id=project_id,
            contractor_id=contractor_id,
            compliance_check_id=None,
            intelligence=current,
        )
        db.commit()
        db.refresh(trace)
        traces = [trace, *traces]
    return traces[:12]


@router.get("/projects/{project_id}/contractors/{contractor_id}/intelligence")
def readiness_intelligence(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    assignment = db.scalar(
        select(ProjectContractor).where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")

    current = build_readiness_intelligence(db, user.company_id, project_id, contractor_id)
    traces = db.scalars(
        select(ReadinessTrace)
        .where(
            ReadinessTrace.company_id == user.company_id,
            ReadinessTrace.project_id == project_id,
            ReadinessTrace.contractor_id == contractor_id,
        )
        .order_by(ReadinessTrace.created_at.desc())
        .limit(2)
    ).all()
    if not traces or traces[0].fingerprint != current["fingerprint"]:
        trace = create_trace(
            db,
            company_id=user.company_id,
            project_id=project_id,
            contractor_id=contractor_id,
            compliance_check_id=None,
            intelligence=current,
        )
        db.commit()
        db.refresh(trace)
        traces = [trace, *traces][:2]

    current["latest_trace"] = None
    current["previous_trace"] = None
    if traces:
        latest = traces[0]
        current["latest_trace"] = {
            "id": latest.id,
            "created_at": latest.created_at,
            "fingerprint": latest.fingerprint,
        }
    if len(traces) > 1:
        previous = traces[1]
        current["previous_trace"] = {
            "id": previous.id,
            "created_at": previous.created_at,
            "fingerprint": previous.fingerprint,
            "score": previous.score,
            "status": previous.status,
        }
        current["since_previous"] = {
            "score_delta": current["score"] - previous.score,
            "status_changed": current["status"] != previous.status,
        }
    return current


@router.get("/projects/{project_id}/contractors/{contractor_id}/timeline")
def readiness_timeline(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    assignment = db.scalar(
        select(ProjectContractor).where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")

    traces = _ensure_current_trace(db, user, project_id, contractor_id)
    return {
        "project_id": project_id,
        "contractor_id": contractor_id,
        "count": len(traces),
        "items": [
            _trace_timeline_item(trace, traces[index + 1] if index + 1 < len(traces) else None)
            for index, trace in enumerate(traces)
        ],
    }


@router.post("/projects/{project_id}/contractors/{contractor_id}/evaluate-intelligence")
def evaluate_with_trace(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.evaluate")),
):
    assignment = db.scalar(
        select(ProjectContractor).where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    result = calculate_readiness(db, user.company_id, project_id, contractor_id)
    check = ComplianceCheck(
        company_id=user.company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        score=result["score"],
        status=ReadinessStatus(result["status"]),
        explanation=result["explanation"],
    )
    db.add(check)
    db.flush()
    intelligence = build_readiness_intelligence(db, user.company_id, project_id, contractor_id)
    create_trace(
        db,
        company_id=user.company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        compliance_check_id=check.id,
        intelligence=intelligence,
    )
    record_audit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="evaluate",
        entity_type="readiness",
        entity_id=check.id,
        description=f"Readiness intelligence evaluated for project {project_id} and contractor {contractor_id}: {result['status'].replace('_', ' ')} ({result['score']}%).",
    )
    db.commit()
    return intelligence


@router.post("/projects/{project_id}/contractors/{contractor_id}/simulate", response_model=ReadinessScenarioResponse)
def simulate(
    project_id: UUID,
    contractor_id: UUID,
    payload: ReadinessScenarioRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.evaluate")),
):
    assignment = db.scalar(
        select(ProjectContractor).where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    return simulate_readiness(
        db,
        user.company_id,
        project_id,
        contractor_id,
        payload.repair_evidence_ids,
        payload.provide_requirement_ids,
    )


def create_trace(
    db: Session,
    *,
    company_id: UUID,
    project_id: UUID,
    contractor_id: UUID,
    compliance_check_id: UUID | None,
    intelligence: dict,
) -> ReadinessTrace:
    trace = ReadinessTrace(
        company_id=company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        compliance_check_id=compliance_check_id,
        engine_version=intelligence["engine_version"],
        score=intelligence["score"],
        status=intelligence["status"],
        explanation=intelligence["explanation"],
        requirements_snapshot=intelligence["requirements"],
        evidence_snapshot=intelligence["evidence"],
        blockers_snapshot=intelligence["blockers"],
        change_set_snapshot=intelligence["minimum_change_set"],
        fingerprint=intelligence["fingerprint"],
    )
    db.add(trace)
    return trace


__all__ = ["create_trace", "router"]
