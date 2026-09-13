from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ProjectContractor, ProjectRequirement, ReadinessStatus, Requirement, User
from app.models.readiness_decision import ReadinessDecision
from app.models.remediation import RemediationPriority, RemediationStatus, RemediationTask
from app.schemas.domain import ReadinessItemResponse, ReadinessResponse
from app.services.audit import record_audit
from app.services.rbac import require_permission
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


def _sync_remediation_tasks(db: Session, company_id: UUID, user_id: UUID, project_id: UUID, contractor_id: UUID, result: dict) -> None:
    missing_names = set(result.get("missing_requirements") or [])
    requirements = db.scalars(
        select(Requirement)
        .join(ProjectRequirement, ProjectRequirement.requirement_id == Requirement.id)
        .where(ProjectRequirement.project_id == project_id, Requirement.company_id == company_id)
    ).all()
    requirement_by_name = {requirement.name: requirement for requirement in requirements}
    active_tasks = db.scalars(
        select(RemediationTask).where(
            RemediationTask.company_id == company_id,
            RemediationTask.project_id == project_id,
            RemediationTask.contractor_id == contractor_id,
            RemediationTask.status.in_([RemediationStatus.OPEN.value, RemediationStatus.IN_PROGRESS.value]),
        )
    ).all()
    active_by_source = {item.source_key: item for item in active_tasks}

    if result["status"] == "ready":
        for item in active_tasks:
            if item.source_key.startswith(f"readiness:{project_id}:{contractor_id}:"):
                item.status = RemediationStatus.COMPLETED.value
        return

    for name in missing_names:
        requirement = requirement_by_name.get(name)
        requirement_id = requirement.id if requirement else None
        source_key = f"readiness:{project_id}:{contractor_id}:{requirement_id or name}"
        if source_key in active_by_source:
            continue
        priority = RemediationPriority.CRITICAL.value if result["status"] == "not_ready" else RemediationPriority.HIGH.value
        task = RemediationTask(
            company_id=company_id,
            project_id=project_id,
            contractor_id=contractor_id,
            requirement_id=requirement_id,
            title=f"Resolve readiness gap: {name}",
            description=f"Address the evidence gap for {name} so this contractor can be reassessed for project readiness.",
            priority=priority,
            status=RemediationStatus.OPEN.value,
            source_key=source_key,
        )
        db.add(task)
        record_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            action="remediation.created",
            entity_type="remediation_task",
            entity_id=task.id,
            description=f"Created remediation task from readiness gap: {name}.",
        )


@router.get("/readiness", response_model=list[ReadinessItemResponse])
def list_readiness(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
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

    decisions = db.scalars(
        select(ReadinessDecision).where(
            ReadinessDecision.company_id == user.company_id,
            ReadinessDecision.project_id.in_(project_ids),
            ReadinessDecision.contractor_id.in_(contractor_ids),
        )
    ).all()
    decision_by_assignment = {(item.project_id, item.contractor_id): item for item in decisions}

    response: list[ReadinessItemResponse] = []
    for assignment in assignments:
        project = projects.get(assignment.project_id)
        contractor = contractors.get(assignment.contractor_id)
        if not project or not contractor:
            continue
        key = (assignment.project_id, assignment.contractor_id)
        check = latest_checks.get(key)
        decision = decision_by_assignment.get(key)
        current = calculate_readiness(db, user.company_id, assignment.project_id, assignment.contractor_id)
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
                decision_status=decision.status.value if decision else None,
                decision_reason=decision.reason if decision else None,
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
    user: User = Depends(require_permission("readiness.evaluate")),
):
    _assignment_or_404(db, project_id, contractor_id, user.company_id)
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
    _sync_remediation_tasks(db, user.company_id, user.id, project_id, contractor_id, result)
    record_audit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="evaluate",
        entity_type="readiness",
        entity_id=check.id,
        description=f"Readiness evaluated for project {project_id} and contractor {contractor_id}: {result['status'].replace('_', ' ')} ({result['score']}%).",
    )
    db.commit()
    return result
