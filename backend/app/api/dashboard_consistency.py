from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.resources import dashboard as base_dashboard
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Project, ProjectContractor, User
from app.schemas.domain import DashboardActivity, DashboardAttention, DashboardProject, DashboardResponse, DashboardTrendPoint

router = APIRouter(prefix="/api", tags=["dashboard"])


def _latest_assigned_checks(db: Session, company_id):
    assignments = db.scalars(
        select(ProjectContractor)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            Project.company_id == company_id,
            Contractor.company_id == company_id,
        )
    ).all()
    assignment_keys = {(item.project_id, item.contractor_id) for item in assignments}

    checks = db.scalars(
        select(ComplianceCheck)
        .where(ComplianceCheck.company_id == company_id)
        .order_by(ComplianceCheck.checked_at.desc())
    ).all()
    latest = {}
    for check in checks:
        key = (check.project_id, check.contractor_id)
        if key in assignment_keys and key not in latest:
            latest[key] = check
    return assignments, latest


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = base_dashboard(db, user)
    assignments, latest = _latest_assigned_checks(db, user.company_id)

    ready_count = sum(check.status.value == "ready" for check in latest.values())
    attention_count = sum(check.status.value == "attention" for check in latest.values())
    not_ready_count = sum(check.status.value == "not_ready" for check in latest.values())
    readiness_score = round(sum(check.score for check in latest.values()) / len(latest)) if latest else None

    assignment_counts: dict = {}
    for item in assignments:
        assignment_counts[item.project_id] = assignment_counts.get(item.project_id, 0) + 1

    corrected_projects: list[DashboardProject] = []
    for project in data.projects:
        project_checks = [check for check in latest.values() if check.project_id == project.id]
        project_score = round(sum(check.score for check in project_checks) / len(project_checks)) if project_checks else None
        if project_checks:
            if all(check.status.value == "ready" for check in project_checks):
                project_status = "ready"
            elif any(check.status.value == "not_ready" for check in project_checks):
                project_status = "not_ready"
            else:
                project_status = "attention"
            updated_at = max(check.checked_at for check in project_checks)
        else:
            project_status = None
            updated_at = None
        corrected_projects.append(
            DashboardProject(
                id=project.id,
                name=project.name,
                contractor_count=assignment_counts.get(project.id, 0),
                requirement_count=project.requirement_count,
                readiness_score=project_score,
                readiness_status=project_status,
                updated_at=updated_at,
            )
        )

    project_names = {project.id: project.name for project in db.scalars(select(Project).where(Project.company_id == user.company_id)).all()}
    contractor_names = {contractor.id: contractor.name for contractor in db.scalars(select(Contractor).where(Contractor.company_id == user.company_id)).all()}

    readiness_activity = [
        DashboardActivity(
            type="readiness",
            title="Readiness recalculated",
            description=f"{project_names.get(check.project_id, 'Project')} · {contractor_names.get(check.contractor_id, 'Contractor')} · {check.score}% {check.status.value.replace('_', ' ')}",
            created_at=check.checked_at,
        )
        for check in sorted(latest.values(), key=lambda item: item.checked_at, reverse=True)[:5]
    ]
    document_activity = [item for item in data.recent_activity if item.type != "readiness"]
    recent_activity = sorted(readiness_activity + document_activity, key=lambda item: item.created_at, reverse=True)[:5]

    attention_items = [item for item in data.attention_items if item.kind != "readiness"]
    if not_ready_count:
        attention_items.insert(0, DashboardAttention(kind="readiness", title=f"{not_ready_count} contractor{'s' if not_ready_count != 1 else ''} not ready", description="Review readiness checks", severity="high", href="/readiness"))
    if attention_count:
        attention_items.insert(0, DashboardAttention(kind="readiness", title=f"{attention_count} readiness check{'s' if attention_count != 1 else ''} need review", description="Resolve flagged compliance checks", severity="medium", href="/readiness"))

    trend_checks = db.scalars(
        select(ComplianceCheck)
        .join(
            ProjectContractor,
            (ProjectContractor.project_id == ComplianceCheck.project_id)
            & (ProjectContractor.contractor_id == ComplianceCheck.contractor_id),
        )
        .where(ComplianceCheck.company_id == user.company_id)
        .order_by(ComplianceCheck.checked_at.asc())
    ).all()
    now = datetime.now(timezone.utc)
    current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_index = current_month.year * 12 + current_month.month - 1
    trend_buckets: dict[str, list[int]] = {}
    for check in trend_checks:
        check_month = check.checked_at.year * 12 + check.checked_at.month - 1
        if month_index - check_month <= 5:
            key = check.checked_at.strftime("%Y-%m")
            trend_buckets.setdefault(key, []).append(check.score)

    readiness_trend = []
    for offset in range(-5, 1):
        index = month_index + offset
        year, month_zero = divmod(index, 12)
        month = month_zero + 1
        key = f"{year:04d}-{month:02d}"
        if key in trend_buckets:
            readiness_trend.append(DashboardTrendPoint(month=datetime(year, month, 1).strftime("%b"), score=round(sum(trend_buckets[key]) / len(trend_buckets[key]))))

    return data.model_copy(update={
        "readiness_score": readiness_score,
        "ready_count": ready_count,
        "attention_count": attention_count,
        "not_ready_count": not_ready_count,
        "projects": corrected_projects,
        "recent_activity": recent_activity,
        "attention_items": attention_items,
        "readiness_trend": readiness_trend,
    })
