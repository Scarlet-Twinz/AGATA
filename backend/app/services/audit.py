from uuid import UUID

from sqlalchemy.orm import Session

from app.models.entities import AuditEvent


def record_audit(
    db: Session,
    *,
    company_id: UUID,
    user_id: UUID,
    action: str,
    entity_type: str,
    entity_id: UUID | None = None,
    summary: str,
    metadata: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        company_id=company_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        metadata_json=metadata or {},
    )
    db.add(event)
    return event
