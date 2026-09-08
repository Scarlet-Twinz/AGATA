from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    Contractor,
    Document,
    DocumentRequirementMatch,
    Project,
    ProjectRequirement,
    Requirement,
    User,
)
from app.schemas.domain import (
    ContractorCreate,
    ContractorResponse,
    DocumentCreate,
    DocumentRequirementMatchResponse,
    DocumentResponse,
    ProjectCreate,
    ProjectRequirementCreate,
    ProjectRequirementResponse,
    ProjectResponse,
    ReadinessResponse,
    RequirementCreate,
    RequirementResponse,
)
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["resources"])


def company_record_or_404(db: Session, model, record_id: UUID, company_id: UUID):
    record = db.scalar(select(model).where(model.id == record_id, model.company_id == company_id))
    if not record:
        raise HTTPException(status_code=404, detail="Resource not found")
    return record


@router.get("/contractors", response_model=list[ContractorResponse])
def list_contractors(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Contractor).where(Contractor.company_id == user.company_id).order_by(Contractor.created_at.desc())).all()


@router.post("/contractors", response_model=ContractorResponse, status_code=201)
def create_contractor(payload: ContractorCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contractor = Contractor(company_id=user.company_id, **payload.model_dump())
    db.add(contractor)
    db.commit()
    db.refresh(contractor)
    return contractor


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Project).where(Project.company_id == user.company_id).order_by(Project.id.desc())).all()


@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = Project(company_id=user.company_id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/requirements", response_model=list[RequirementResponse])
def list_requirements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Requirement).where(Requirement.company_id == user.company_id).order_by(Requirement.name.asc())).all()


@router.post("/requirements", response_model=RequirementResponse, status_code=201)
def create_requirement(payload: RequirementCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    requirement = Requirement(company_id=user.company_id, **payload.model_dump())
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return requirement


@router.get("/projects/{project_id}/requirements", response_model=list[RequirementResponse])
def list_project_requirements(project_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_record_or_404(db, Project, project_id, user.company_id)
    statement = (
        select(Requirement)
        .join(ProjectRequirement, ProjectRequirement.requirement_id == Requirement.id)
        .where(ProjectRequirement.project_id == project_id, Requirement.company_id == user.company_id)
        .order_by(Requirement.name.asc())
    )
    return db.scalars(statement).all()


@router.post("/projects/{project_id}/requirements", response_model=ProjectRequirementResponse, status_code=201)
def attach_requirement_to_project(
    project_id: UUID,
    payload: ProjectRequirementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company_record_or_404(db, Project, project_id, user.company_id)
    company_record_or_404(db, Requirement, payload.requirement_id, user.company_id)
    existing = db.scalar(
        select(ProjectRequirement).where(
            ProjectRequirement.project_id == project_id,
            ProjectRequirement.requirement_id == payload.requirement_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Requirement is already attached to this project")
    link = ProjectRequirement(project_id=project_id, requirement_id=payload.requirement_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/documents", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Document).where(Document.company_id == user.company_id).order_by(Document.created_at.desc())).all()


@router.post("/documents", response_model=DocumentResponse, status_code=201)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.contractor_id:
        company_record_or_404(db, Contractor, payload.contractor_id, user.company_id)
    document = Document(company_id=user.company_id, **payload.model_dump())
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.post("/documents/{document_id}/requirements/{requirement_id}", response_model=DocumentRequirementMatchResponse, status_code=201)
def match_document_to_requirement(
    document_id: UUID,
    requirement_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = company_record_or_404(db, Document, document_id, user.company_id)
    company_record_or_404(db, Requirement, requirement_id, user.company_id)
    existing = db.scalar(
        select(DocumentRequirementMatch).where(
            DocumentRequirementMatch.document_id == document_id,
            DocumentRequirementMatch.requirement_id == requirement_id,
        )
    )
    if existing:
        return existing
    match = DocumentRequirementMatch(document_id=document.id, requirement_id=requirement_id)
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


@router.get("/projects/{project_id}/contractors/{contractor_id}/readiness", response_model=ReadinessResponse)
def readiness(project_id: UUID, contractor_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_record_or_404(db, Project, project_id, user.company_id)
    company_record_or_404(db, Contractor, contractor_id, user.company_id)
    return calculate_readiness(db, user.company_id, project_id, contractor_id)
