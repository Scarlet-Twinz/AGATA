from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ReadinessStatus, User
from app.schemas.domain import ReadinessResponse
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["project-workflow"])


def _company_record_or_404(db: Session, model, record_id: UUID, company_id: UUID):
    record = db.query(model).filter(model.id == record_id, model.company_id == company_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Resource not found")
    return record


@router.post(
    "/projects/{project_id}/contractors/{contractor_id}/readiness",
    response_model=ReadinessResponse,
)
def evaluate_project_contractor(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _company_record_or_404(db, Project, project_id, user.company_id)
    _company_record_or_404(db, Contractor, contractor_id, user.company_id)

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
    db.commit()

    return result
