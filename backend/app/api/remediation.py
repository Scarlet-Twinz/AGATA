from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AuditEvent, Contractor, Project, ProjectContractor, Requirement, User
from app.models.remediation import RemediationPriority, RemediationStatus, RemediationTask
from app.services.rbac import require_permission

router = APIRouter(prefix="/api/remediation", tags=["remediation"])


class RemediationResponse(BaseModel):
    id: UUID
    project_id: UUID
    contractor_id: UUID
    requirement_id: UUID | None
    assigned_to_user_id: UUID | None
    project_name: str
    contractor_name: str
    requirement_name: str | None
    title: str
    description: str
    priority: str
    status: str
    source_key: str
    due_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class RemediationCreate(BaseModel):
    project_id: UUID
    contractor_id: UUID
    requirement_id: UUID | None = None
    assigned_to_user_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    due_at: datetime | None = None


class RemediationUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(open|in_progress|completed|cancelled)$")
    priority: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    assigned_to_user_id: UUID | None = None
    due_at: datetime | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)


def _assignment_or_404(db: Session, project_id: UUID, contractor_id: UUID, company_id: UUID) -> ProjectContractor:
    assignment = db.scalar(
        select(ProjectContractor)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
            Project.company_id == company_id,
            Contractor.company_id == company_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")
    return assignment


def _response(db: Session, item: RemediationTask) -> RemediationResponse:
    project = db.get(Project, item.project_id)
    contractor = db.get(Contractor, item.contractor_id)
    requirement = db.get(Requirement, item.requirement_id) if item.requirement_id else None
    return RemediationResponse(
        id=item.id,
        project_id=item.project_id,
        contractor_id=item.contractor_id,
        requirement_id=item.requirement_id,
        assigned_to_user_id=item.assigned_to_user_id,
        project_name=project.name if project else "Project",
        contractor_name=contractor.name if contractor else "Contractor",
        requirement_name=requirement.name if requirement else None,
        title=item.title,
        description=item.description,
        priority=item.priority,
        status=item.status,
        source_key=item.source_key,
        due_at=item.due_at,
        completed_at=item.completed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[RemediationResponse])
def list_remediation(
    status: str = Query(default="open", pattern="^(open|in_progress|completed|cancelled|all)$"),
    project_id: UUID | None = None,
    contractor_id: UUID | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    statement = select(RemediationTask).where(RemediationTask.company_id == user.company_id)
    if status != "all":
        statement = statement.where(RemediationTask.status == status)
    if project_id is not None:
        statement = statement.where(RemediationTask.project_id == project_id)
    if contractor_id is not None:
        statement = statement.where(RemediationTask.contractor_id == contractor_id)
    items = db.scalars(statement.order_by(RemediationTask.updated_at.desc())).all()
    return [_response(db, item) for item in items]


@router.post("", response_model=RemediationResponse, status_code=201)
def create_remediation(
    payload: RemediationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.evaluate")),
):
    _assignment_or_404(db, payload.project_id, payload.contractor_id, user.company_id)
    if payload.requirement_id is not None:
        requirement = db.scalar(select(Requirement).where(Requirement.id == payload.requirement_id, Requirement.company_id == user.company_id))
        if requirement is None:
            raise HTTPException(status_code=404, detail="Requirement not found")
    if payload.assigned_to_user_id is not None:
        member = db.scalar(select(User).where(User.id == payload.assigned_to_user_id, User.company_id == user.company_id))
        if member is None:
            raise HTTPException(status_code=404, detail="Assigned user not found")
    source_key = f"manual:{payload.project_id}:{payload.contractor_id}:{payload.requirement_id or payload.title.strip().lower()}"
    existing = db.scalar(select(RemediationTask).where(RemediationTask.company_id == user.company_id, RemediationTask.source_key == source_key, RemediationTask.status.in_([RemediationStatus.OPEN.value, RemediationStatus.IN_PROGRESS.value])))
    if existing:
        raise HTTPException(status_code=409, detail="An active remediation task already exists for this issue")
    item = RemediationTask(company_id=user.company_id, project_id=payload.project_id, contractor_id=payload.contractor_id, requirement_id=payload.requirement_id, assigned_to_user_id=payload.assigned_to_user_id, title=payload.title.strip(), description=payload.description.strip(), priority=payload.priority, source_key=source_key, due_at=payload.due_at)
    db.add(item)
    db.add(AuditEvent(company_id=user.company_id, user_id=user.id, action="remediation.created", entity_type="remediation_task", entity_id=item.id, description=f"Created remediation task: {item.title}."))
    db.commit(); db.refresh(item)
    return _response(db, item)


@router.patch("/{task_id}", response_model=RemediationResponse)
def update_remediation(
    task_id: UUID,
    payload: RemediationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.evaluate")),
):
    item = db.scalar(select(RemediationTask).where(RemediationTask.id == task_id, RemediationTask.company_id == user.company_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Remediation task not found")
    values = payload.model_dump(exclude_unset=True)
    if "assigned_to_user_id" in values and values["assigned_to_user_id"] is not None:
        member = db.scalar(select(User).where(User.id == values["assigned_to_user_id"], User.company_id == user.company_id))
        if member is None:
            raise HTTPException(status_code=404, detail="Assigned user not found")
    previous_status = item.status
    for key, value in values.items():
        setattr(item, key, value)
    if item.status == RemediationStatus.COMPLETED.value and previous_status != RemediationStatus.COMPLETED.value:
        item.completed_at = datetime.now(timezone.utc)
    elif item.status != RemediationStatus.COMPLETED.value:
        item.completed_at = None
    db.add(AuditEvent(company_id=user.company_id, user_id=user.id, action="remediation.updated", entity_type="remediation_task", entity_id=item.id, description=f"Updated remediation task: {item.title}."))
    db.commit(); db.refresh(item)
    return _response(db, item)
