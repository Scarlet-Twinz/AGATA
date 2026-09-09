from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    ComplianceCheck,
    Company,
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
    DashboardProject,
    DashboardResponse,
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


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_id = user.company_id
    company_name = db.scalar(select(Company.name).where(Company.id == company_id)) or "Workspace"

    project_count = db.scalar(select(func.count(Project.id)).where(Project.company_id == company_id)) or 0
    contractor_count = db.scalar(select(func.count(Contractor.id)).where(Contractor.company_id == company_id)) or 0
    requirement_count = db.scalar(select(func.count(Requirement.id)).where(Requirement.company_id == company_id)) or 0
    evidence_count = db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id)) or 0

    latest_check_subquery = (
        select(
            ComplianceCheck.project_id.label("project_id"),
            ComplianceCheck.contractor_id.label("contractor_id"),
            func.max(ComplianceCheck.checked_at).label("latest_checked_at"),
        )
        .where(ComplianceCheck.company_id == company_id)
        .group_by(ComplianceCheck.project_id, ComplianceCheck.contractor_id)
        .subquery()
    )
    latest_checks = db.scalars(
        select(ComplianceCheck)
        .join(
            latest_check_subquery,
            (ComplianceCheck.project_id == latest_check_subquery.c.project_id)
            & (ComplianceCheck.contractor_id == latest_check_subquery.c.contractor_id)
            & (ComplianceCheck.checked_at == latest_check_subquery.c.latest_checked_at),
        )
        .where(ComplianceCheck.company_id == company_id)
    ).all()

    ready_count = sum(check.status.value == "ready" for check in latest_checks)
    attention_count = sum(check.status.value == "attention" for check in latest_checks)
    not_ready_count = sum(check.status.value == "not_ready" for check in latest_checks)
    readiness_score = round(sum(check.score for check in latest_checks) / len(latest_checks)) if latest_checks else None

    now = datetime.now(timezone.utc)
    expiring_cutoff = now + timedelta(days=30)
    expiring_count = db.scalar(
        select(func.count(Document.id)).where(
            Document.company_id == company_id,
            Document.expires_at > now,
            Document.expires_at <= expiring_cutoff,
            Document.status == "active",
        )
    ) or 0
    expired_count = db.scalar(
        select(func.count(Document.id)).where(
            Document.company_id == company_id,
            Document.expires_at <= now,
            Document.status == "active",
        )
    ) or 0

    mapped_count = db.scalar(
        select(func.count(func.distinct(DocumentRequirementMatch.document_id)))
        .join(Document, Document.id == DocumentRequirementMatch.document_id)
        .where(Document.company_id == company_id)
    ) or 0
    unmapped_count = max(evidence_count - mapped_count, 0)

    total_project_requirements = db.scalar(
        select(func.count(ProjectRequirement.id))
        .join(Project, Project.id == ProjectRequirement.project_id)
        .where(Project.company_id == company_id)
    ) or 0
    covered_requirement_count = db.scalar(
        select(func.count(func.distinct(ProjectRequirement.id)))
        .join(Project, Project.id == ProjectRequirement.project_id)
        .join(DocumentRequirementMatch, DocumentRequirementMatch.requirement_id == ProjectRequirement.requirement_id)
        .join(Document, Document.id == DocumentRequirementMatch.document_id)
        .where(Project.company_id == company_id, Document.company_id == company_id, Document.status == "active")
    ) or 0

    project_requirement_counts = dict(
        db.execute(
            select(ProjectRequirement.project_id, func.count(ProjectRequirement.id))
            .join(Project, Project.id == ProjectRequirement.project_id)
            .where(Project.company_id == company_id)
            .group_by(ProjectRequirement.project_id)
        ).all()
    )

    projects = db.scalars(select(Project).where(Project.company_id == company_id).order_by(Project.id.desc())).all()
    dashboard_projects: list[DashboardProject] = []
    for project in projects:
        project_checks = [check for check in latest_checks if check.project_id == project.id]
        project_score = round(sum(check.score for check in project_checks) / len(project_checks)) if project_checks else None
        if project_checks:
            if all(check.status.value == "ready" for check in project_checks):
                project_status = "ready"
            elif any(check.status.value == "not_ready" for check in project_checks):
                project_status = "not_ready"
            else:
                project_status = "attention"
        else:
            project_status = None
        dashboard_projects.append(
            DashboardProject(
                id=project.id,
                name=project.name,
                contractor_count=len({check.contractor_id for check in project_checks}),
                requirement_count=int(project_requirement_counts.get(project.id, 0)),
                readiness_score=project_score,
                readiness_status=project_status,
            )
        )

    recent_checks = db.scalars(
        select(ComplianceCheck).where(ComplianceCheck.company_id == company_id).order_by(ComplianceCheck.checked_at.desc()).limit(3)
    ).all()
    recent_documents = db.scalars(
        select(Document).where(Document.company_id == company_id).order_by(Document.created_at.desc()).limit(3)
    ).all()
    activity_events: list[tuple[datetime, str]] = []
    for check in recent_checks:
        activity_events.append((check.checked_at, f"Readiness evaluated: {check.status.value.replace('_', ' ')} ({check.score}%)."))
    for document in recent_documents:
        activity_events.append((document.created_at, f"Evidence added: {document.name}."))
    activity_events.sort(key=lambda item: item[0], reverse=True)

    return DashboardResponse(
        company_name=company_name,
        project_count=project_count,
        contractor_count=contractor_count,
        requirement_count=requirement_count,
        evidence_count=evidence_count,
        readiness_score=readiness_score,
        ready_count=ready_count,
        attention_count=attention_count,
        not_ready_count=not_ready_count,
        expiring_count=expiring_count,
        expired_count=expired_count,
        unmapped_count=unmapped_count,
        covered_requirement_count=covered_requirement_count,
        total_project_requirements=total_project_requirements,
        projects=dashboard_projects,
        recent_activity=[message for _, message in activity_events[:5]],
    )


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
