from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AuditEvent, User

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("")
def list_audit_events(
    entity_type: str | None = Query(default=None, max_length=80),
    action: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, max_length=120),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    statement = select(AuditEvent, User.full_name).outerjoin(User, User.id == AuditEvent.user_id).where(AuditEvent.company_id == user.company_id)
    if entity_type:
        statement = statement.where(AuditEvent.entity_type == entity_type)
    if action:
        statement = statement.where(AuditEvent.action == action)
    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(AuditEvent.description.ilike(term))
    if date_from:
        statement = statement.where(AuditEvent.created_at >= date_from)
    if date_to:
        statement = statement.where(AuditEvent.created_at <= date_to)
    rows = db.execute(statement.order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    return [{"id": str(event.id), "action": event.action, "entity_type": event.entity_type, "entity_id": str(event.entity_id) if event.entity_id else None, "description": event.description, "actor": actor or "System", "created_at": event.created_at} for event, actor in rows]
