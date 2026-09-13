from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Contractor, Project, ProjectContractor, User
from app.models.readiness_decision import ReadinessDecision, ReadinessDecisionStatus
from app.services.audit import record_audit
from app.services.rbac import require_permission
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api/readiness", tags=["readiness-decisions"])


class DecisionRequest(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=4000)


class DecisionResponse(BaseModel):
    id: UUID
    project_id: UUID
    contractor_id: UUID
    status: str
    decided_by_user_id: UUID | None
    decided_at: datetime | None
    reason: str | None


def _assignment(db: Session, project_id: UUID, contractor_id: UUID, company_id: UUID):
    return db.scalar(
        select(ProjectContractor)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
            Project.company_id == company_id,
            Contractor.company_id == company_id,
        )
    )


def _decision(db: Session, project_id: UUID, contractor_id: UUID, company_id: UUID) -> ReadinessDecision:
    item = db.scalar(
        select(ReadinessDecision).where(
            ReadinessDecision.project_id == project_id,
            ReadinessDecision.contractor_id == contractor_id,
            ReadinessDecision.company_id == company_id,
        )
    )
    if item is None:
        item = ReadinessDecision(
            company_id=company_id,
            project_id=project_id,
            contractor_id=contractor_id,
        )
        db.add(item)
        db.flush()
    return item


@router.get("/projects/{project_id}/contractors/{contractor_id}/decision", response_model=DecisionResponse)
def get_decision(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    if _assignment(db, project_id, contractor_id, user.company_id) is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    item = _decision(db, project_id, contractor_id, user.company_id)
    db.commit()
    db.refresh(item)
    return item


@router.post("/projects/{project_id}/contractors/{contractor_id}/decision", response_model=DecisionResponse)
def set_decision(
    project_id: UUID,
    contractor_id: UUID,
    payload: DecisionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.approve")),
):
    if _assignment(db, project_id, contractor_id, user.company_id) is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    try:
        status = ReadinessDecisionStatus(payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Decision must be pending, approved, or rejected") from exc

    reason = (payload.reason or "").strip() or None
    if status == ReadinessDecisionStatus.REJECTED and not reason:
        raise HTTPException(status_code=422, detail="A reason is required when readiness is rejected")

    readiness = calculate_readiness(db, user.company_id, project_id, contractor_id)
    if status == ReadinessDecisionStatus.APPROVED and readiness["status"] != "ready":
        raise HTTPException(status_code=409, detail="Readiness must be Ready before it can be approved")

    item = _decision(db, project_id, contractor_id, user.company_id)
    previous = item.status.value
    item.status = status
    item.reason = reason
    item.decided_by_user_id = user.id if status != ReadinessDecisionStatus.PENDING else None
    item.decided_at = datetime.now(timezone.utc) if status != ReadinessDecisionStatus.PENDING else None

    record_audit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="readiness.decision.updated",
        entity_type="readiness_decision",
        entity_id=item.id,
        description=f"Readiness decision changed from {previous} to {status.value} for project {project_id} and contractor {contractor_id}.",
    )
    db.commit()
    db.refresh(item)
    return item
