from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    ComplianceCheck,
    Contractor,
    Document,
    DocumentRequirementMatch,
    Notification,
    Project,
    ProjectContractor,
    User,
)
from app.schemas.domain import NotificationResponse, NotificationUnreadCount
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["notifications"])


def _days_until(value: datetime | None) -> int | None:
    if value is None:
        return None
    current = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return (current - datetime.now(timezone.utc)).days


def _sync_notifications(db: Session, user: User) -> None:
    current: dict[str, dict] = {}
    documents = db.scalars(select(Document).where(Document.company_id == user.company_id).order_by(Document.created_at.desc())).all()
    contractor_ids = {document.contractor_id for document in documents if document.contractor_id}
    contractors = {
        contractor.id: contractor.name
        for contractor in db.scalars(select(Contractor).where(Contractor.company_id == user.company_id, Contractor.id.in_(contractor_ids) if contractor_ids else False)).all()
    }
    mapped_ids = {
        match.document_id
        for match in db.scalars(select(DocumentRequirementMatch).where(DocumentRequirementMatch.document_id.in_([document.id for document in documents]) if documents else False)).all()
    }

    for document in documents:
        if document.status != "active":
            continue
        days = _days_until(document.expires_at)
        contractor_name = contractors.get(document.contractor_id, "Unassigned")
        if days is not None and days < 0:
            current[f"evidence:{document.id}:expiry"] = {"kind": "evidence_expired", "severity": "critical", "title": f"Evidence expired: {document.name}", "description": f"{contractor_name}'s {document.document_type} evidence expired. Update or replace it before relying on this evidence for readiness.", "href": "/evidence"}
        elif days is not None and days <= 30:
            current[f"evidence:{document.id}:expiry"] = {"kind": "evidence_expiring", "severity": "warning", "title": f"Evidence expiring soon: {document.name}", "description": f"{contractor_name}'s {document.document_type} evidence expires in {max(days, 0)} day(s). Review it before it becomes invalid.", "href": "/evidence"}
        if document.id not in mapped_ids:
            current[f"evidence:{document.id}:mapping"] = {"kind": "evidence_unmapped", "severity": "info", "title": f"Evidence needs mapping: {document.name}", "description": f"{document.name} is active but is not mapped to a requirement, so it cannot contribute to a readiness decision.", "href": "/evidence"}

    assignments = db.scalars(select(ProjectContractor).join(Project, Project.id == ProjectContractor.project_id).join(Contractor, Contractor.id == ProjectContractor.contractor_id).where(Project.company_id == user.company_id, Contractor.company_id == user.company_id)).all()
    check_rows = db.scalars(select(ComplianceCheck).where(ComplianceCheck.company_id == user.company_id).order_by(ComplianceCheck.checked_at.desc())).all()
    latest_checks: dict[tuple[UUID, UUID], ComplianceCheck] = {}
    for check in check_rows:
        latest_checks.setdefault((check.project_id, check.contractor_id), check)
    project_map = {project.id: project.name for project in db.scalars(select(Project).where(Project.company_id == user.company_id)).all()}
    contractor_map = {contractor.id: contractor.name for contractor in db.scalars(select(Contractor).where(Contractor.company_id == user.company_id)).all()}

    for assignment in assignments:
        project_name = project_map.get(assignment.project_id, "Project")
        contractor_name = contractor_map.get(assignment.contractor_id, "Contractor")
        key = (assignment.project_id, assignment.contractor_id)
        check = latest_checks.get(key)
        source_key = f"readiness:{assignment.project_id}:{assignment.contractor_id}"
        if check is None:
            current[source_key] = {"kind": "readiness_unevaluated", "severity": "info", "title": f"Readiness check needed: {contractor_name}", "description": f"{contractor_name} is assigned to {project_name}, but readiness has not been evaluated yet.", "href": "/readiness"}
            continue
        result = calculate_readiness(db, user.company_id, assignment.project_id, assignment.contractor_id)
        if result["status"] == "not_ready":
            missing = result.get("missing_requirements") or []
            detail = ", ".join(missing[:3]) if missing else "required evidence"
            current[source_key] = {"kind": "readiness_not_ready", "severity": "critical", "title": f"Contractor not ready: {contractor_name}", "description": f"{contractor_name} is not ready for {project_name}. Missing or invalid evidence: {detail}.", "href": "/readiness"}
        elif result["status"] == "attention":
            current[source_key] = {"kind": "readiness_attention", "severity": "warning", "title": f"Readiness needs attention: {contractor_name}", "description": f"{contractor_name} needs attention before being considered fully ready for {project_name}.", "href": "/readiness"}

    existing = db.scalars(select(Notification).where(Notification.company_id == user.company_id)).all()
    existing_by_key = {item.source_key: item for item in existing}
    for source_key, payload in current.items():
        item = existing_by_key.get(source_key)
        if item is None:
            db.add(Notification(company_id=user.company_id, source_key=source_key, **payload))
            continue
        previous_kind = item.kind
        item.kind = payload["kind"]
        item.severity = payload["severity"]
        item.title = payload["title"]
        item.description = payload["description"]
        item.href = payload["href"]
        item.status = "active"
        if item.read_at is not None and previous_kind != payload["kind"]:
            item.read_at = None
    for item in existing:
        if item.source_key not in current and item.status == "active":
            item.status = "resolved"
    db.commit()


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(status: str = Query(default="active", pattern="^(active|all)$"), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _sync_notifications(db, user)
    statement = select(Notification).where(Notification.company_id == user.company_id)
    if status == "active":
        statement = statement.where(Notification.status == "active")
    return db.scalars(statement.order_by(Notification.created_at.desc())).all()


@router.get("/notifications/unread-count", response_model=NotificationUnreadCount)
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _sync_notifications(db, user)
    count = len(db.scalars(select(Notification).where(Notification.company_id == user.company_id, Notification.status == "active", Notification.read_at.is_(None))).all())
    return NotificationUnreadCount(unread_count=count)


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_read(notification_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.company_id == user.company_id))
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    item.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


@router.post("/notifications/read-all", response_model=NotificationUnreadCount)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _sync_notifications(db, user)
    items = db.scalars(select(Notification).where(Notification.company_id == user.company_id, Notification.status == "active", Notification.read_at.is_(None))).all()
    now = datetime.now(timezone.utc)
    for item in items:
        item.read_at = now
    db.commit()
    return NotificationUnreadCount(unread_count=0)
