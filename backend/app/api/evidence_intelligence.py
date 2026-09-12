from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    AuditEvent,
    Contractor,
    Document,
    DocumentRequirementMatch,
    Project,
    ProjectContractor,
    ProjectRequirement,
    Requirement,
    User,
)
from app.models.evidence_intelligence import EvidenceIntelligence
from app.services.readiness import calculate_readiness

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


class EvidenceRequirementImpact(BaseModel):
    requirement_id: UUID
    requirement_name: str
    project_count: int
    project_ids: list[UUID]


class EvidenceProjectImpact(BaseModel):
    project_id: UUID
    project_name: str
    contractor_id: UUID
    contractor_name: str
    readiness_score: int
    readiness_status: str
    counts_for_readiness: bool
    affected_requirement_ids: list[UUID]
    affected_requirement_names: list[str]


class EvidenceImpactResponse(BaseModel):
    document_id: UUID
    document_name: str
    computed_state: str
    requirement_impacts: list[EvidenceRequirementImpact]
    project_impacts: list[EvidenceProjectImpact]


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
    now = datetime.now(timezone.utc)
    if document.expires_at is not None:
        if document.expires_at <= now:
            return "expired"
        if document.expires_at <= now + timedelta(days=30):
            return "expiring"
    if not mapped:
        return "unmapped"
    if intelligence.review_status != "approved":
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


@router.get("/{document_id}/impact", response_model=EvidenceImpactResponse)
def get_evidence_impact(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = _document(db, document_id, user.company_id)
    intelligence = _record(db, document.id)
    db.commit()
    db.refresh(intelligence)

    matches = db.scalars(
        select(DocumentRequirementMatch)
        .join(Requirement, Requirement.id == DocumentRequirementMatch.requirement_id)
        .where(
            DocumentRequirementMatch.document_id == document.id,
            Requirement.company_id == user.company_id,
        )
    ).all()
    requirement_ids = [match.requirement_id for match in matches]
    requirements = (
        db.scalars(select(Requirement).where(Requirement.id.in_(requirement_ids), Requirement.company_id == user.company_id)).all()
        if requirement_ids
        else []
    )
    requirements_by_id = {item.id: item for item in requirements}

    project_links = (
        db.scalars(select(ProjectRequirement).where(ProjectRequirement.requirement_id.in_(requirement_ids))).all()
        if requirement_ids
        else []
    )
    project_ids = {link.project_id for link in project_links}
    projects = (
        db.scalars(select(Project).where(Project.id.in_(project_ids), Project.company_id == user.company_id)).all()
        if project_ids
        else []
    )
    projects_by_id = {project.id: project for project in projects}

    requirement_projects: dict[UUID, set[UUID]] = {}
    for link in project_links:
        if link.project_id in projects_by_id and link.requirement_id in requirements_by_id:
            requirement_projects.setdefault(link.requirement_id, set()).add(link.project_id)

    requirement_impacts = [
        EvidenceRequirementImpact(
            requirement_id=requirement.id,
            requirement_name=requirement.name,
            project_count=len(requirement_projects.get(requirement.id, set())),
            project_ids=sorted(requirement_projects.get(requirement.id, set()), key=str),
        )
        for requirement in requirements
    ]

    project_impacts: list[EvidenceProjectImpact] = []
    if document.contractor_id is not None and project_ids:
        assignments = db.scalars(
            select(ProjectContractor).where(
                ProjectContractor.project_id.in_(project_ids),
                ProjectContractor.contractor_id == document.contractor_id,
            )
        ).all()
        contractor = db.scalar(
            select(Contractor).where(
                Contractor.id == document.contractor_id,
                Contractor.company_id == user.company_id,
            )
        )
        if contractor is not None:
            for assignment in assignments:
                project = projects_by_id.get(assignment.project_id)
                if project is None:
                    continue
                affected_requirements = [
                    requirement
                    for requirement in requirements
                    if project.id in requirement_projects.get(requirement.id, set())
                ]
                readiness = calculate_readiness(
                    db,
                    user.company_id,
                    project.id,
                    document.contractor_id,
                )
                project_impacts.append(
                    EvidenceProjectImpact(
                        project_id=project.id,
                        project_name=project.name,
                        contractor_id=contractor.id,
                        contractor_name=contractor.name,
                        readiness_score=readiness["score"],
                        readiness_status=readiness["status"],
                        counts_for_readiness=(
                            _computed_state(document, intelligence, mapped=True) == "valid"
                        ),
                        affected_requirement_ids=[item.id for item in affected_requirements],
                        affected_requirement_names=[item.name for item in affected_requirements],
                    )
                )

    return EvidenceImpactResponse(
        document_id=document.id,
        document_name=document.name,
        computed_state=_computed_state(document, intelligence, bool(matches)),
        requirement_impacts=requirement_impacts,
        project_impacts=project_impacts,
    )


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
    mapped = db.scalar(select(DocumentRequirementMatch.id).where(DocumentRequirementMatch.document_id == document.id)) is not None
    old_state = _computed_state(document, intelligence, mapped)
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
