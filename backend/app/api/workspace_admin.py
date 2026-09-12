from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import verify_password
from app.db.session import get_db
from app.models.entities import Company, Contractor, Document, Project, Requirement, User
from app.models.workspace import WorkspaceInvitation
from app.services.audit import record_audit

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


class WorkspaceProfileUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=160)
    full_name: str | None = Field(default=None, min_length=1, max_length=160)

    @field_validator("company_name", "full_name")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be empty")
        return value


class AccountProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    email: str | None = Field(default=None, min_length=5, max_length=255)
    current_password: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
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
    record_audit(db, company_id=user.company_id, user_id=user.id, action="invitation.created", entity_type="invitation", entity_id=item.id, description=f"Created a {payload.role} workspace invitation for {payload.email}.")
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
    record_audit(db, company_id=user.company_id, user_id=user.id, action="invitation.revoked", entity_type="invitation", entity_id=item.id, description=f"Revoked the workspace invitation for {item.email}.")
    db.commit()
    return {"id": str(item.id), "status": item.status}


@router.get("/profile")
def workspace_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    return {"company": {"id": str(company.id), "name": company.name} if company else None, "user": {"id": str(user.id), "name": user.full_name, "email": user.email}}


@router.patch("/profile")
def update_workspace_profile(payload: WorkspaceProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    if not company:
        raise HTTPException(status_code=404, detail="Workspace not found")

    changed: list[str] = []
    if payload.company_name is not None and payload.company_name != company.name:
        company.name = payload.company_name
        changed.append("workspace name")
    if payload.full_name is not None and payload.full_name != user.full_name:
        user.full_name = payload.full_name
        changed.append("profile name")

    if changed:
        record_audit(db, company_id=user.company_id, user_id=user.id, action="settings.updated", entity_type="settings", description=f"Updated {', '.join(changed)}.")

    db.commit()
    db.refresh(company)
    db.refresh(user)
    return {"company": {"id": str(company.id), "name": company.name}, "user": {"id": str(user.id), "name": user.full_name, "email": user.email}}


@router.patch("/account")
def update_account_profile(payload: AccountProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    changed: list[str] = []

    if payload.full_name is not None and payload.full_name != user.full_name:
        user.full_name = payload.full_name
        changed.append("profile name")

    if payload.email is not None and payload.email != user.email:
        if not payload.current_password or not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Your current password is required to change your sign-in email")

        existing = db.scalar(select(User).where(User.email == payload.email, User.id != user.id))
        if existing:
            raise HTTPException(status_code=409, detail="That email address is already in use")

        old_email = user.email
        user.email = payload.email
        changed.append("sign-in email")
        record_audit(db, company_id=user.company_id, user_id=user.id, action="account.email_changed", entity_type="user", entity_id=user.id, description=f"Changed sign-in email from {old_email} to {payload.email}.")

    if changed and "sign-in email" not in changed:
        record_audit(db, company_id=user.company_id, user_id=user.id, action="account.updated", entity_type="user", entity_id=user.id, description=f"Updated {', '.join(changed)}.")

    db.commit()
    db.refresh(user)
    return {"user": {"id": str(user.id), "name": user.full_name, "email": user.email}}
