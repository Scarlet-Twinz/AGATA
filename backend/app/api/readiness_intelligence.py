from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ProjectContractor, User
from app.models.readiness_trace import ReadinessTrace
from app.services.audit import record_audit
from app.services.rbac import require_permission
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
    current["latest_trace"] = None
    current["previous_trace"] = None
    if traces:
        latest = traces[0]
        current["latest_trace"] = {
            "id": latest.id,
            "created_at": latest.created_at,
            "fingerprint": latest.fingerprint,
            "engine_version": latest.engine_version,
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


@router.post(
    "/projects/{project_id}/contractors/{contractor_id}/simulate",
    response_model=ReadinessScenarioResponse,
)
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
    result = simulate_readiness(
        db,
        user.company_id,
        project_id,
        contractor_id,
        payload.repair_evidence_ids,
        payload.provide_requirement_ids,
    )
    return result


def create_trace(
    db: Session,
    *,
    company_id: UUID,
    project_id: UUID,
    contractor_id: UUID,
    compliance_check_id: UUID,
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
