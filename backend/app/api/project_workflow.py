from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ProjectContractor, ReadinessStatus, User
from app.schemas.domain import ReadinessResponse
from app.services.audit import record_audit
from app.services.rbac import require_permission
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["project-workflow"])


def _company_record_or_404(db: Session, model, record_id: UUID, company_id: UUID):
    record = db.query(model).filter(model.id == record_id, model.company_id == company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Resource not found")
    return record


def _assignment_or_404(db: Session, project_id: UUID, contractor_id: UUID, company_id: UUID) -> ProjectContractor:
    assignment = db.scalar(
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
    if not assignment:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    return assignment


@router.post("/projects/{project_id}/contractors/{contractor_id}/readiness", response_model=ReadinessResponse)
def evaluate_project_contractor(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.evaluate")),
):
    project = _company_record_or_404(db, Project, project_id, user.company_id)
    contractor = _company_record_or_404(db, Contractor, contractor_id, user.company_id)
    _assignment_or_404(db, project_id, contractor_id, user.company_id)
    result = calculate_readiness(db, user.company_id, project_id, contractor_id)
    check = ComplianceCheck(
        company_id=user.company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        score=result["score"],
        status=ReadinessStatus(result["status"]) if result["status"] in {item.value for item in ReadinessStatus} else ReadinessStatus.NOT_READY,
        explanation=result["explanation"],
    )
    db.add(check)
    record_audit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="evaluate",
        entity_type="readiness",
        entity_id=check.id,
        description=f"Readiness evaluated for {contractor.name} on {project.name}: {result['status'].replace('_', ' ')} ({result['score']}%).",
    )
    db.commit()
    return result
