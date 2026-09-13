from collections import Counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ProjectContractor, User
from app.models.readiness_decision import ReadinessDecision, ReadinessDecisionStatus
from app.services.rbac import require_permission
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api/readiness", tags=["project-readiness"])


class ProjectIssue(BaseModel):
    requirement: str
    affected_contractors: int


class ProjectReadinessSummary(BaseModel):
    project_id: UUID
    project_name: str
    contractor_count: int
    ready_count: int
    attention_count: int
    not_ready_count: int
    not_evaluated_count: int
    average_score: int | None
    decision_pending_count: int
    decision_approved_count: int
    decision_rejected_count: int
    issues: list[ProjectIssue]


@router.get("/projects/{project_id}/summary", response_model=ProjectReadinessSummary)
def project_readiness_summary(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    project = db.scalar(select(Project).where(Project.id == project_id, Project.company_id == user.company_id))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    assignments = db.scalars(
        select(ProjectContractor)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            ProjectContractor.project_id == project_id,
            Contractor.company_id == user.company_id,
        )
    ).all()

    latest_checks: dict[UUID, ComplianceCheck] = {}
    if assignments:
        contractor_ids = [item.contractor_id for item in assignments]
        checks = db.scalars(
            select(ComplianceCheck)
            .where(
                ComplianceCheck.company_id == user.company_id,
                ComplianceCheck.project_id == project_id,
                ComplianceCheck.contractor_id.in_(contractor_ids),
            )
            .order_by(ComplianceCheck.checked_at.desc())
        ).all()
        for check in checks:
            latest_checks.setdefault(check.contractor_id, check)

    statuses = Counter()
    scores: list[int] = []
    issue_counts: Counter[str] = Counter()
    for assignment in assignments:
        check = latest_checks.get(assignment.contractor_id)
        if check is None:
            current = calculate_readiness(db, user.company_id, project_id, assignment.contractor_id)
            statuses["not_evaluated"] += 1
            for requirement in current.get("missing_requirements", []):
                issue_counts[requirement] += 1
            continue
        statuses[check.status.value] += 1
        scores.append(check.score)
        current = calculate_readiness(db, user.company_id, project_id, assignment.contractor_id)
        for requirement in current.get("missing_requirements", []):
            issue_counts[requirement] += 1

    decisions = db.scalars(
        select(ReadinessDecision).where(
            ReadinessDecision.company_id == user.company_id,
            ReadinessDecision.project_id == project_id,
        )
    ).all()
    decision_counts = Counter(item.status.value if isinstance(item.status, ReadinessDecisionStatus) else str(item.status) for item in decisions)

    return ProjectReadinessSummary(
        project_id=project.id,
        project_name=project.name,
        contractor_count=len(assignments),
        ready_count=statuses["ready"],
        attention_count=statuses["attention"],
        not_ready_count=statuses["not_ready"],
        not_evaluated_count=statuses["not_evaluated"],
        average_score=round(sum(scores) / len(scores)) if scores else None,
        decision_pending_count=decision_counts["pending"],
        decision_approved_count=decision_counts["approved"],
        decision_rejected_count=decision_counts["rejected"],
        issues=[ProjectIssue(requirement=name, affected_contractors=count) for name, count in issue_counts.most_common(10)],
    )
