from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Contractor, Document, Project, User
from app.schemas.domain import ContractorCreate, ContractorResponse, DocumentCreate, DocumentResponse, ProjectCreate, ProjectResponse, ReadinessResponse
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


@router.get("/projects/{project_id}/contractors/{contractor_id}/readiness", response_model=ReadinessResponse)
def readiness(project_id: UUID, contractor_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_record_or_404(db, Project, project_id, user.company_id)
    company_record_or_404(db, Contractor, contractor_id, user.company_id)
    return calculate_readiness(db, user.company_id, project_id, contractor_id)
