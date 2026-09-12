from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AuditEvent, Document, DocumentRequirementMatch, User
from app.models.evidence_intelligence import EvidenceIntelligence

router = APIRouter(prefix="/api/evidence", tags=["evidence-intelligence"])

VERIFICATION_STATUSES = {"unverified", "verified", "rejected"}
REVIEW_STATUSES = {"pending", "in_review", "approved", "rejected"}
SOURCE_TYPES = {"manual", "upload", "import", "integration"}


class EvidenceIntelligenceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner_user_id: UUID | None = None
    verification_status: str | None = None
    review_status: str | None = None
    source_type: str | None = None
    confidence: int | None = Field(default=None, ge=0, le=100)
    issue_date: datetime | None = None
    rejection_reason: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def validate_rejection(self):
        if self.verification_status == "rejected" and not (self.rejection_reason or "").strip():
            raise ValueError("A rejection reason is required when verification is rejected")
        return self


class EvidenceIntelligenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    owner_user_id: UUID | None
    verification_status: str
    review_status: str
    source_type: str
    confidence: int | None
    issue_date: datetime | None
    rejection_reason: str | None
    reviewed_by_user_id: UUID | None
    reviewed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    mapping_status: str
    computed_state: str


def _document(db: Session, document_id: UUID, company_id: UUID) -> Document:
    item = db.scalar(select(Document).where(Document.id == document_id, Document.company_id == company_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return item


def _record(db: Session, document_id: UUID) -> EvidenceIntelligence:
    item = db.scalar(select(EvidenceIntelligence).where(EvidenceIntelligence.document_id == document_id))
    if item is None:
        item = EvidenceIntelligence(document_id=document_id)
        db.add(item)
        db.flush()
    return item


def _computed_state(document: Document, intelligence: EvidenceIntelligence, mapped: bool) -> str:
    if document.status != "active":
        return "inactive"
    if intelligence.verification_status == "rejected":
        return "rejected"
    if intelligence.verification_status != "verified":
        return "unverified"
    if document.expires_at is not None:
        now = datetime.now(timezone.utc)
        if document.expires_at <= now:
            return "expired"
        if document.expires_at <= now.replace() + __import__("datetime").timedelta(days=30):
            return "expiring"
    if not mapped:
        return "unmapped"
    if intelligence.review_status not in {"approved"}:
        return "requires_review"
    return "valid"


def _response(db: Session, document: Document, intelligence: EvidenceIntelligence) -> EvidenceIntelligenceResponse:
    mapped = db.scalar(
        select(DocumentRequirementMatch.id).where(DocumentRequirementMatch.document_id == document.id)
    ) is not None
    return EvidenceIntelligenceResponse(
        **{column.name: getattr(intelligence, column.name) for column in EvidenceIntelligence.__table__.columns},
        mapping_status="mapped" if mapped else "unmapped",
        computed_state=_computed_state(document, intelligence, mapped),
    )


@router.get("/{document_id}/intelligence", response_model=EvidenceIntelligenceResponse)
def get_evidence_intelligence(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = _document(db, document_id, user.company_id)
    intelligence = _record(db, document.id)
    db.commit()
    db.refresh(intelligence)
    return _response(db, document, intelligence)


@router.patch("/{document_id}/intelligence", response_model=EvidenceIntelligenceResponse)
def update_evidence_intelligence(
    document_id: UUID,
    payload: EvidenceIntelligenceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = _document(db, document_id, user.company_id)
    values = payload.model_dump(exclude_unset=True)
    if "verification_status" in values and values["verification_status"] not in VERIFICATION_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid verification status")
    if "review_status" in values and values["review_status"] not in REVIEW_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid review status")
    if "source_type" in values and values["source_type"] not in SOURCE_TYPES:
        raise HTTPException(status_code=422, detail="Invalid evidence source type")
    if "owner_user_id" in values and values["owner_user_id"] is not None:
        owner = db.scalar(select(User).where(User.id == values["owner_user_id"], User.company_id == user.company_id))
        if owner is None:
            raise HTTPException(status_code=404, detail="Evidence owner not found in this workspace")

    intelligence = _record(db, document.id)
    old_state = _computed_state(document, intelligence, db.scalar(select(DocumentRequirementMatch.id).where(DocumentRequirementMatch.document_id == document.id)) is not None)
    for key, value in values.items():
        if key == "rejection_reason" and isinstance(value, str):
            value = value.strip() or None
        setattr(intelligence, key, value)

    if "verification_status" in values or "review_status" in values:
        intelligence.reviewed_by_user_id = user.id
        intelligence.reviewed_at = datetime.now(timezone.utc)
    if intelligence.verification_status != "rejected":
        intelligence.rejection_reason = None

    db.add(AuditEvent(
        company_id=user.company_id,
        user_id=user.id,
        action="evidence.intelligence.updated",
        entity_type="document",
        entity_id=document.id,
        description=f"Updated evidence intelligence for {document.name}; previous state {old_state}.",
    ))
    db.commit()
    db.refresh(intelligence)
    return _response(db, document, intelligence)
