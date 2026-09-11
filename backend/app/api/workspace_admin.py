from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Company, Contractor, Document, Project, Requirement, User
from app.models.workspace import WorkspaceInvitation

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


class InvitationCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    role: str = Field(default="member", pattern="^(member|admin)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


@router.get("/summary")
def workspace_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company_id = user.company_id
    company = db.scalar(select(Company).where(Company.id == company_id))
    return {"company": {"id": str(company.id), "name": company.name} if company else None, "counts": {
        "projects": db.scalar(select(func.count()).select_from(Project).where(Project.company_id == company_id)) or 0,
        "contractors": db.scalar(select(func.count()).select_from(Contractor).where(Contractor.company_id == company_id)) or 0,
        "requirements": db.scalar(select(func.count()).select_from(Requirement).where(Requirement.company_id == company_id)) or 0,
        "evidence": db.scalar(select(func.count()).select_from(Document).where(Document.company_id == company_id)) or 0,
        "users": db.scalar(select(func.count()).select_from(User).where(User.company_id == company_id)) or 0,
    }}


@router.get("/team")
def workspace_team(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    users = db.scalars(select(User).where(User.company_id == user.company_id).order_by(User.full_name.asc())).all()
    return [{"id": str(item.id), "name": item.full_name, "email": item.email, "joined_at": item.created_at, "status": "active"} for item in users]


@router.get("/invitations")
def list_invitations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(WorkspaceInvitation).where(WorkspaceInvitation.company_id == user.company_id).order_by(WorkspaceInvitation.created_at.desc())).all()
    return [{"id": str(x.id), "email": x.email, "role": x.role, "status": x.status, "created_at": x.created_at} for x in rows]


@router.post("/invitations", status_code=201)
def create_invitation(payload: InvitationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing_user = db.scalar(select(User).where(User.company_id == user.company_id, User.email == payload.email))
    if existing_user:
        raise HTTPException(status_code=409, detail="That email already has access to this workspace")
    pending = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.company_id == user.company_id, WorkspaceInvitation.email == payload.email, WorkspaceInvitation.status == "pending"))
    if pending:
        raise HTTPException(status_code=409, detail="An invitation is already pending for that email")
    item = WorkspaceInvitation(company_id=user.company_id, email=payload.email, role=payload.role, token=str(uuid4()), status="pending")
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": str(item.id), "email": item.email, "role": item.role, "status": item.status, "created_at": item.created_at}


@router.post("/invitations/{invitation_id}/revoke")
def revoke_invitation(invitation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.id == invitation_id, WorkspaceInvitation.company_id == user.company_id))
    if not item:
        raise HTTPException(status_code=404, detail="Invitation not found")
    item.status = "revoked"
    item.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": str(item.id), "status": item.status}


@router.get("/profile")
def workspace_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    return {"company": {"id": str(company.id), "name": company.name} if company else None, "user": {"id": str(user.id), "name": user.full_name, "email": user.email}}
