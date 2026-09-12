from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Document, DocumentRequirementMatch, Project, ProjectContractor, ProjectRequirement, Requirement, User

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("")
def insights(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_id = user.company_id
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)

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

    checks = db.scalars(select(ComplianceCheck).where(ComplianceCheck.company_id == company_id)).all()
    latest = {}
    for check in sorted(checks, key=lambda x: x.checked_at):
        key = (check.project_id, check.contractor_id)
        if key in assignment_keys:
            latest[key] = check

    distribution = {"ready": 0, "attention": 0, "not_ready": 0}
    for check in latest.values():
        distribution[check.status.value] = distribution.get(check.status.value, 0) + 1
    scores = [check.score for check in latest.values()]
    average_score = round(sum(scores) / len(scores)) if scores else None
    recent_checks = [check for check in latest.values() if check.checked_at >= cutoff]
    recent_average = round(sum(c.score for c in recent_checks) / len(recent_checks)) if recent_checks else None

    evidence_total = db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id)) or 0
    active_evidence = db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id, Document.status == "active")) or 0
    mapped_evidence = db.scalar(select(func.count(func.distinct(DocumentRequirementMatch.document_id))).join(Document, Document.id == DocumentRequirementMatch.document_id).where(Document.company_id == company_id)) or 0
    expiring = db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id, Document.status == "active", Document.expires_at != None, Document.expires_at > now, Document.expires_at <= now + timedelta(days=30))) or 0
    expired = db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id, Document.status == "active", Document.expires_at != None, Document.expires_at <= now)) or 0
    total_requirements = db.scalar(select(func.count(Requirement.id)).where(Requirement.company_id == company_id)) or 0
    project_requirements = db.scalar(select(func.count(ProjectRequirement.id)).join(Project, Project.id == ProjectRequirement.project_id).where(Project.company_id == company_id)) or 0
    contractors = db.scalar(select(func.count(Contractor.id)).where(Contractor.company_id == company_id)) or 0
    projects = db.scalar(select(func.count(Project.id)).where(Project.company_id == company_id)) or 0

    project_risk = []
    project_rows = db.scalars(select(Project).where(Project.company_id == company_id).order_by(Project.name.asc())).all()
    for project in project_rows:
        project_checks = [c for c in latest.values() if c.project_id == project.id]
        score = round(sum(c.score for c in project_checks) / len(project_checks)) if project_checks else None
        risk = "unassessed" if score is None else ("high" if score < 60 else "medium" if score < 80 else "low")
        project_risk.append({"id": str(project.id), "name": project.name, "score": score, "risk": risk, "checks": len(project_checks)})

    return {
        "generated_at": now,
        "overview": {"average_readiness": average_score, "recent_average_readiness": recent_average, "readiness_change": recent_average - average_score if recent_average is not None and average_score is not None else None, "projects": projects, "contractors": contractors, "requirements": total_requirements, "project_requirements": project_requirements, "evidence": evidence_total, "active_evidence": active_evidence, "mapped_evidence": mapped_evidence, "expiring_evidence": expiring, "expired_evidence": expired},
        "readiness_distribution": distribution,
        "project_risk": project_risk,
        "signals": [
            {"key": "evidence_coverage", "label": "Evidence mapping", "value": round(mapped_evidence / evidence_total * 100) if evidence_total else 0, "description": "Evidence items mapped to requirements."},
            {"key": "renewal_pressure", "label": "Renewal pressure", "value": round((expiring + expired) / active_evidence * 100) if active_evidence else 0, "description": "Active evidence expiring within 30 days or already expired."},
            {"key": "evaluation_coverage", "label": "Evaluation coverage", "value": round(len(latest) / max(len(assignments), 1) * 100), "description": "Assigned project-contractor pairs with a recorded readiness decision."},
        ],
    }
