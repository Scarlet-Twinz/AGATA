from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Contractor, Document, DocumentRequirementMatch, Requirement, User
from app.schemas.domain import DocumentDetailResponse, DocumentRequirementMatchResponse, DocumentResponse, DocumentUpdate

router = APIRouter(prefix="/api", tags=["evidence-management"])


def document_or_404(db: Session, document_id: UUID, company_id: UUID) -> Document:
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.company_id == company_id,
        )
    )
    if not document:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return document


def requirement_or_404(db: Session, requirement_id: UUID, company_id: UUID) -> Requirement:
    requirement = db.scalar(
        select(Requirement).where(
            Requirement.id == requirement_id,
            Requirement.company_id == company_id,
        )
    )
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return requirement


@router.get("/documents/{document_id}/detail", response_model=DocumentDetailResponse)
def document_detail(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = document_or_404(db, document_id, user.company_id)
    contractor = None
    if document.contractor_id:
        contractor = db.scalar(
            select(Contractor).where(
                Contractor.id == document.contractor_id,
                Contractor.company_id == user.company_id,
            )
        )

    matches = db.scalars(
        select(DocumentRequirementMatch).join(
            Requirement, Requirement.id == DocumentRequirementMatch.requirement_id
        ).where(
            DocumentRequirementMatch.document_id == document.id,
            Requirement.company_id == user.company_id,
        )
    ).all()
    return DocumentDetailResponse(
        document=document,
        contractor_id=contractor.id if contractor else None,
        contractor_name=contractor.name if contractor else None,
        matches=[DocumentRequirementMatchResponse.model_validate(match) for match in matches],
    )


@router.put("/documents/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = document_or_404(db, document_id, user.company_id)
    values = payload.model_dump(exclude_unset=True)

    if "contractor_id" in values and values["contractor_id"] is not None:
        contractor = db.scalar(
            select(Contractor).where(
                Contractor.id == values["contractor_id"],
                Contractor.company_id == user.company_id,
            )
        )
        if not contractor:
            raise HTTPException(status_code=404, detail="Contractor not found")

    for key, value in values.items():
        setattr(document, key, value)
    db.commit()
    db.refresh(document)
    return document


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = document_or_404(db, document_id, user.company_id)
    db.delete(document)
    db.commit()


@router.post(
    "/documents/{document_id}/requirements/{requirement_id}",
    response_model=DocumentRequirementMatchResponse,
    status_code=201,
)
def map_document_requirement(
    document_id: UUID,
    requirement_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = document_or_404(db, document_id, user.company_id)
    requirement = requirement_or_404(db, requirement_id, user.company_id)

    if document.contractor_id is None:
        raise HTTPException(status_code=422, detail="Evidence must belong to a contractor before it can be mapped")

    existing = db.scalar(
        select(DocumentRequirementMatch).where(
            DocumentRequirementMatch.document_id == document.id,
            DocumentRequirementMatch.requirement_id == requirement.id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Evidence is already mapped to this requirement")

    match = DocumentRequirementMatch(document_id=document.id, requirement_id=requirement.id)
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.delete("/documents/{document_id}/requirements/{requirement_id}", status_code=204)
def unmap_document_requirement(
    document_id: UUID,
    requirement_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = document_or_404(db, document_id, user.company_id)
    requirement = requirement_or_404(db, requirement_id, user.company_id)
    match = db.scalar(
        select(DocumentRequirementMatch).where(
            DocumentRequirementMatch.document_id == document.id,
            DocumentRequirementMatch.requirement_id == requirement.id,
        )
    )
    if not match:
        raise HTTPException(status_code=404, detail="Evidence mapping not found")
    db.delete(match)
    db.commit()
