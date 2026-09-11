from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Document, Project, ProjectContractor, User
from app.schemas.domain import ContractorDetailResponse, ContractorProjectResponse, ContractorResponse, ContractorUpdate, ProjectContractorCreate, ProjectContractorResponse
from app.services.audit import record_audit

router = APIRouter(prefix="/api", tags=["contractor-management"])


def contractor_or_404(db: Session, contractor_id: UUID, company_id: UUID) -> Contractor:
    contractor = db.scalar(select(Contractor).where(Contractor.id == contractor_id, Contractor.company_id == company_id))
    if not contractor: raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor


@router.get("/contractors/{contractor_id}", response_model=ContractorDetailResponse)
def contractor_detail(contractor_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contractor = contractor_or_404(db, contractor_id, user.company_id)
    documents = db.scalars(select(Document).where(Document.company_id == user.company_id, Document.contractor_id == contractor.id).order_by(Document.created_at.desc())).all()
    assignments = db.scalars(select(ProjectContractor).where(ProjectContractor.contractor_id == contractor.id).order_by(ProjectContractor.created_at.desc())).all()
    project_ids = [assignment.project_id for assignment in assignments]
    projects = db.scalars(select(Project).where(Project.company_id == user.company_id, Project.id.in_(project_ids)).order_by(Project.name.asc())).all() if project_ids else []
    project_responses = []
    for project in projects:
        check = db.scalar(select(ComplianceCheck).where(ComplianceCheck.company_id == user.company_id, ComplianceCheck.contractor_id == contractor.id, ComplianceCheck.project_id == project.id).order_by(ComplianceCheck.checked_at.desc()).limit(1))
        project_responses.append(ContractorProjectResponse(id=project.id, name=project.name, status=project.status, readiness={"score": check.score, "status": check.status.value, "checked_at": check.checked_at, "explanation": check.explanation} if check else None))
    return ContractorDetailResponse(contractor=contractor, documents=documents, projects=project_responses)


@router.put("/contractors/{contractor_id}", response_model=ContractorResponse)
def update_contractor(contractor_id: UUID, payload: ContractorUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    contractor = contractor_or_404(db, contractor_id, user.company_id)
    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items(): setattr(contractor, key, value)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="update", entity_type="contractor", entity_id=contractor.id, description=f"Updated contractor {contractor.name}.")
    db.commit(); db.refresh(contractor)
    return contractor


@router.post("/projects/{project_id}/contractors", response_model=ProjectContractorResponse, status_code=201)
def assign_contractor(project_id: UUID, payload: ProjectContractorCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.scalar(select(Project).where(Project.id == project_id, Project.company_id == user.company_id))
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    contractor = contractor_or_404(db, payload.contractor_id, user.company_id)
    existing = db.scalar(select(ProjectContractor).where(ProjectContractor.project_id == project.id, ProjectContractor.contractor_id == contractor.id))
    if existing: raise HTTPException(status_code=409, detail="Contractor is already assigned to this project")
    assignment = ProjectContractor(project_id=project.id, contractor_id=contractor.id)
    db.add(assignment)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="assign", entity_type="project_contractor", entity_id=assignment.id, description=f"Assigned {contractor.name} to {project.name}.")
    db.commit(); db.refresh(assignment)
    return assignment


@router.get("/projects/{project_id}/contractors", response_model=list[ContractorProjectResponse])
def list_project_contractors(project_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.scalar(select(Project).where(Project.id == project_id, Project.company_id == user.company_id))
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    contractors = db.scalars(select(Contractor).join(ProjectContractor, ProjectContractor.contractor_id == Contractor.id).where(ProjectContractor.project_id == project.id, Contractor.company_id == user.company_id).order_by(Contractor.name.asc())).all()
    return [ContractorProjectResponse(id=contractor.id, name=contractor.name, status=contractor.status) for contractor in contractors]


@router.delete("/projects/{project_id}/contractors/{contractor_id}", status_code=204)
def remove_contractor_from_project(project_id: UUID, contractor_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.scalar(select(Project).where(Project.id == project_id, Project.company_id == user.company_id))
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    assignment = db.scalar(select(ProjectContractor).join(Contractor).where(ProjectContractor.project_id == project.id, ProjectContractor.contractor_id == contractor_id, Contractor.company_id == user.company_id))
    if not assignment: raise HTTPException(status_code=404, detail="Contractor assignment not found")
    contractor = contractor_or_404(db, contractor_id, user.company_id)
    db.delete(assignment)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="remove", entity_type="project_contractor", entity_id=assignment.id, description=f"Removed {contractor.name} from {project.name}.")
    db.commit()
