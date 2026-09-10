from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ProjectContractor, User
from app.schemas.domain import ReadinessItemResponse, ReadinessResponse
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["readiness-management"])


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


@router.get("/readiness", response_model=list[ReadinessItemResponse])
def list_readiness(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assignments = db.scalars(
        select(ProjectContractor)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            Project.company_id == user.company_id,
            Contractor.company_id == user.company_id,
        )
        .order_by(ProjectContractor.created_at.desc())
    ).all()

    if not assignments:
        return []

    project_ids = {item.project_id for item in assignments}
    contractor_ids = {item.contractor_id for item in assignments}
    projects = {
        item.id: item
        for item in db.scalars(
            select(Project).where(
                Project.company_id == user.company_id,
                Project.id.in_(project_ids),
            )
        ).all()
    }
    contractors = {
        item.id: item
        for item in db.scalars(
            select(Contractor).where(
                Contractor.company_id == user.company_id,
                Contractor.id.in_(contractor_ids),
            )
        ).all()
    }

    latest_subquery = (
        select(
            ComplianceCheck.project_id.label("project_id"),
            ComplianceCheck.contractor_id.label("contractor_id"),
            ComplianceCheck.checked_at.label("checked_at"),
        )
        .where(
            ComplianceCheck.company_id == user.company_id,
            ComplianceCheck.project_id.in_(project_ids),
            ComplianceCheck.contractor_id.in_(contractor_ids),
        )
        .order_by(ComplianceCheck.checked_at.desc())
        .subquery()
    )

    checks = db.scalars(
        select(ComplianceCheck)
        .where(
            ComplianceCheck.company_id == user.company_id,
            ComplianceCheck.project_id.in_(project_ids),
            ComplianceCheck.contractor_id.in_(contractor_ids),
        )
        .order_by(ComplianceCheck.checked_at.desc())
    ).all()
    latest_checks: dict[tuple[UUID, UUID], ComplianceCheck] = {}
    for check in checks:
        latest_checks.setdefault((check.project_id, check.contractor_id), check)

    response: list[ReadinessItemResponse] = []
    for assignment in assignments:
        project = projects.get(assignment.project_id)
        contractor = contractors.get(assignment.contractor_id)
        if not project or not contractor:
            continue
        key = (assignment.project_id, assignment.contractor_id)
        check = latest_checks.get(key)
        current = calculate_readiness(
            db,
            user.company_id,
            assignment.project_id,
            assignment.contractor_id,
        )
        response.append(
            ReadinessItemResponse(
                project_id=project.id,
                project_name=project.name,
                contractor_id=contractor.id,
                contractor_name=contractor.name,
                contractor_status=contractor.status,
                evaluated=check is not None,
                score=check.score if check else None,
                status=check.status.value if check else None,
                explanation=check.explanation if check else None,
                missing_requirements=current["missing_requirements"] if check else [],
                checked_at=check.checked_at if check else None,
            )
        )
    return response


@router.post(
    "/readiness/projects/{project_id}/contractors/{contractor_id}",
    response_model=ReadinessResponse,
)
def evaluate_readiness(
    project_id: UUID,
    contractor_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assignment_or_404(db, project_id, contractor_id, user.company_id)
    result = calculate_readiness(db, user.company_id, project_id, contractor_id)
    from app.models.entities import ReadinessStatus

    check = ComplianceCheck(
        company_id=user.company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        score=result["score"],
        status=ReadinessStatus(result["status"]),
        explanation=result["explanation"],
    )
    db.add(check)
    db.commit()
    return result
