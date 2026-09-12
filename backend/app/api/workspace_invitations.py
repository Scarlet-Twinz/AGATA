from datetime import datetime, timezone
import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.auth_security import UserSecurity
from app.models.entities import Company, User
from app.models.workspace import WorkspaceInvitation, WorkspaceMembership, WorkspaceRole
from app.services.audit import record_audit

router = APIRouter(prefix="/api/workspace/invitations", tags=["workspace invitations"])


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)


def _find_invitation(db: Session, token: str) -> WorkspaceInvitation | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.token_hash == token_hash))
    if item is None:
        item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.token == token))
    return item


def _validate(item: WorkspaceInvitation | None) -> WorkspaceInvitation:
    if item is None or item.status != "pending" or (item.expires_at is not None and item.expires_at <= datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="This invitation is invalid or has expired")
    return item


@router.get("/preview")
def preview_invitation(token: str, db: Session = Depends(get_db)):
    item = _validate(_find_invitation(db, token))
    company = db.scalar(select(Company).where(Company.id == item.company_id))
    role_name = db.scalar(select(WorkspaceRole.name).where(WorkspaceRole.company_id == item.company_id, WorkspaceRole.key == item.role)) or item.role
    return {"email": item.email, "role": item.role, "role_name": role_name, "company_name": company.name if company else "AGATA workspace", "expires_at": item.expires_at}


@router.post("/accept")
def accept_invitation(payload: InvitationAccept, db: Session = Depends(get_db)):
    item = _validate(_find_invitation(db, payload.token))
    email = item.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An AGATA account already exists for this email. Sign in, then accept the invitation from the invitation link.")

    role = db.scalar(select(WorkspaceRole).where(WorkspaceRole.company_id == item.company_id, WorkspaceRole.key == item.role))
    if role is None:
        raise HTTPException(status_code=500, detail="The invitation role is no longer available")

    user = User(company_id=item.company_id, email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    db.add(UserSecurity(user_id=user.id, email_verified_at=datetime.now(timezone.utc)))
    db.add(WorkspaceMembership(company_id=item.company_id, user_id=user.id, role_id=role.id, status="active"))
    item.status = "accepted"
    item.accepted_at = datetime.now(timezone.utc)
    item.token = None
    item.token_hash = None
    record_audit(db, company_id=item.company_id, user_id=user.id, action="invitation.accepted", entity_type="invitation", entity_id=item.id, description=f"Accepted workspace invitation for {email} as {role.name}.")
    db.commit()
    return {"message": "Invitation accepted. You can now sign in to AGATA.", "email": email}


@router.post("/accept-authenticated")
def accept_invitation_authenticated(token: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = _validate(_find_invitation(db, token))
    if user.email.lower() != item.email.lower():
        raise HTTPException(status_code=403, detail="This invitation belongs to a different email address")
    if user.company_id == item.company_id:
        raise HTTPException(status_code=409, detail="You already belong to this workspace")

    role = db.scalar(select(WorkspaceRole).where(WorkspaceRole.company_id == item.company_id, WorkspaceRole.key == item.role))
    if role is None:
        raise HTTPException(status_code=500, detail="The invitation role is no longer available")

    existing = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.company_id == item.company_id, WorkspaceMembership.user_id == user.id))
    if existing:
        existing.role_id = role.id
        existing.status = "active"
    else:
        db.add(WorkspaceMembership(company_id=item.company_id, user_id=user.id, role_id=role.id, status="active"))
    item.status = "accepted"
    item.accepted_at = datetime.now(timezone.utc)
    item.token = None
    item.token_hash = None
    record_audit(db, company_id=item.company_id, user_id=user.id, action="invitation.accepted", entity_type="invitation", entity_id=item.id, description=f"Accepted workspace invitation as {role.name}.")
    db.commit()
    return {"message": "Invitation accepted. Workspace access is now active."}
