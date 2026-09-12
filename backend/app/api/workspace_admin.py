from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import verify_password
from app.db.session import get_db
from app.models.entities import Company, Contractor, Document, Project, Requirement, User
from app.models.workspace import WorkspaceInvitation, WorkspaceMembership, WorkspacePermission, WorkspaceRole, WorkspaceRolePermission
from app.services.audit import record_audit
from app.services.email import EmailDeliveryError
from app.services.invitations import issue_invitation, send_invitation_email
from app.services.rbac import get_membership, require_permission

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


class InvitationCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    role: str = Field(default="member", pattern="^(member|admin|compliance_manager|project_manager|reviewer)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|compliance_manager|project_manager|reviewer|member)$")


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
def workspace_summary(db: Session = Depends(get_db), user: User = Depends(require_permission("workspace.view"))):
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
def workspace_team(db: Session = Depends(get_db), user: User = Depends(require_permission("team.view"))):
    users = db.scalars(select(User).where(User.company_id == user.company_id).order_by(User.full_name.asc())).all()
    result = []
    for item in users:
        membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.company_id == user.company_id, WorkspaceMembership.user_id == item.id))
        if membership is None:
            membership = get_membership(db, item)
        role = db.get(WorkspaceRole, membership.role_id)
        result.append({"id": str(item.id), "name": item.full_name, "email": item.email, "joined_at": item.created_at, "status": membership.status, "role": role.key if role else "unknown", "role_name": role.name if role else "Unknown"})
    return result


@router.get("/roles")
def workspace_roles(db: Session = Depends(get_db), user: User = Depends(require_permission("team.view"))):
    get_membership(db, user)
    roles = db.scalars(select(WorkspaceRole).where(WorkspaceRole.company_id == user.company_id).order_by(WorkspaceRole.key.asc())).all()
    return [{"key": role.key, "name": role.name, "description": role.description, "is_system": role.is_system} for role in roles]


@router.get("/access")
def workspace_access(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    membership = get_membership(db, user)
    role = db.get(WorkspaceRole, membership.role_id)
    permissions = db.scalars(select(WorkspacePermission.key).join(WorkspaceRolePermission, WorkspaceRolePermission.permission_id == WorkspacePermission.id).where(WorkspaceRolePermission.role_id == membership.role_id).order_by(WorkspacePermission.key.asc())).all()
    return {"role": role.key if role else "unknown", "role_name": role.name if role else "Unknown", "status": membership.status, "permissions": permissions}


@router.get("/invitations")
def list_invitations(db: Session = Depends(get_db), user: User = Depends(require_permission("team.view"))):
    rows = db.scalars(select(WorkspaceInvitation).where(WorkspaceInvitation.company_id == user.company_id).order_by(WorkspaceInvitation.created_at.desc())).all()
    return [{"id": str(x.id), "email": x.email, "role": x.role, "status": x.status, "created_at": x.created_at, "expires_at": x.expires_at, "accepted_at": x.accepted_at} for x in rows]


@router.post("/invitations", status_code=201)
async def create_invitation(payload: InvitationCreate, db: Session = Depends(get_db), user: User = Depends(require_permission("team.invite"))):
    existing_user = db.scalar(select(User).where(User.company_id == user.company_id, User.email == payload.email))
    if existing_user:
        raise HTTPException(status_code=409, detail="That email already has access to this workspace")
    pending = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.company_id == user.company_id, WorkspaceInvitation.email == payload.email, WorkspaceInvitation.status == "pending"))
    if pending:
        raise HTTPException(status_code=409, detail="An invitation is already pending for that email")

    company = db.scalar(select(Company).where(Company.id == user.company_id))
    item, raw_token = issue_invitation(db, company_id=user.company_id, email=payload.email, role=payload.role)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="invitation.created", entity_type="invitation", entity_id=item.id, description=f"Created a {payload.role} workspace invitation for {payload.email}.")
    db.commit()
    db.refresh(item)

    try:
        await send_invitation_email(email=item.email, role=item.role, company_name=company.name if company else "your AGATA workspace", raw_token=raw_token)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="Invitation created, but AGATA could not deliver the invitation email. You can retry with Resend once email delivery is configured.") from exc

    return {"id": str(item.id), "email": item.email, "role": item.role, "status": item.status, "created_at": item.created_at, "expires_at": item.expires_at}


@router.post("/invitations/{invitation_id}/resend")
async def resend_invitation(invitation_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("team.manage"))):
    item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.id == invitation_id, WorkspaceInvitation.company_id == user.company_id))
    if not item:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if item.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending invitations can be resent")

    company = db.scalar(select(Company).where(Company.id == user.company_id))
    _, raw_token = issue_invitation(db, company_id=user.company_id, email=item.email, role=item.role)
    item.status = "pending"
    item.revoked_at = None
    record_audit(db, company_id=user.company_id, user_id=user.id, action="invitation.resent", entity_type="invitation", entity_id=item.id, description=f"Resent the workspace invitation to {item.email}.")
    db.commit()

    try:
        await send_invitation_email(email=item.email, role=item.role, company_name=company.name if company else "your AGATA workspace", raw_token=raw_token)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="AGATA could not deliver the invitation email right now.") from exc

    db.refresh(item)
    return {"id": str(item.id), "status": item.status, "expires_at": item.expires_at}


@router.post("/invitations/{invitation_id}/revoke")
def revoke_invitation(invitation_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("team.manage"))):
    item = db.scalar(select(WorkspaceInvitation).where(WorkspaceInvitation.id == invitation_id, WorkspaceInvitation.company_id == user.company_id))
    if not item:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if item.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending invitations can be revoked")
    item.status = "revoked"
    item.revoked_at = datetime.now(timezone.utc)
    item.token = None
    item.token_hash = None
    record_audit(db, company_id=user.company_id, user_id=user.id, action="invitation.revoked", entity_type="invitation", entity_id=item.id, description=f"Revoked the workspace invitation for {item.email}.")
    db.commit()
    return {"id": str(item.id), "status": item.status}


@router.patch("/team/{user_id}/role")
def update_member_role(user_id: UUID, payload: RoleUpdate, db: Session = Depends(get_db), user: User = Depends(require_permission("team.manage"))):
    if user_id == user.id:
        raise HTTPException(status_code=403, detail="You cannot change your own workspace role")
    target = db.scalar(select(User).where(User.id == user_id, User.company_id == user.company_id))
    if not target:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    target_membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.company_id == user.company_id, WorkspaceMembership.user_id == target.id))
    if not target_membership:
        raise HTTPException(status_code=404, detail="Workspace membership not found")
    current_role = db.get(WorkspaceRole, target_membership.role_id)
    if current_role and current_role.key == "owner":
        raise HTTPException(status_code=403, detail="The workspace owner cannot be reassigned")
    new_role = db.scalar(select(WorkspaceRole).where(WorkspaceRole.company_id == user.company_id, WorkspaceRole.key == payload.role))
    if not new_role:
        raise HTTPException(status_code=400, detail="Workspace role not found")
    if new_role.key == "owner":
        raise HTTPException(status_code=403, detail="Owner access cannot be assigned through member role management")
    if current_role and current_role.id == new_role.id:
        return {"id": str(target.id), "role": new_role.key, "role_name": new_role.name, "status": target_membership.status}
    target_membership.role_id = new_role.id
    record_audit(db, company_id=user.company_id, user_id=user.id, action="member.role_changed", entity_type="user", entity_id=target.id, description=f"Changed {target.email}'s workspace role to {new_role.name}.")
    db.commit()
    return {"id": str(target.id), "role": new_role.key, "role_name": new_role.name, "status": target_membership.status}


@router.post("/team/{user_id}/suspend")
def suspend_member(user_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("team.manage"))):
    if user_id == user.id:
        raise HTTPException(status_code=403, detail="You cannot suspend your own workspace access")
    target = db.scalar(select(User).where(User.id == user_id, User.company_id == user.company_id))
    if not target:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.company_id == user.company_id, WorkspaceMembership.user_id == target.id))
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace membership not found")
    role = db.get(WorkspaceRole, membership.role_id)
    if role and role.key == "owner":
        raise HTTPException(status_code=403, detail="The workspace owner cannot be suspended")
    if membership.status == "suspended":
        return {"id": str(target.id), "status": membership.status}
    membership.status = "suspended"
    record_audit(db, company_id=user.company_id, user_id=user.id, action="member.suspended", entity_type="user", entity_id=target.id, description=f"Suspended workspace access for {target.email}.")
    db.commit()
    return {"id": str(target.id), "status": membership.status}


@router.post("/team/{user_id}/restore")
def restore_member(user_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_permission("team.manage"))):
    target = db.scalar(select(User).where(User.id == user_id, User.company_id == user.company_id))
    if not target:
        raise HTTPException(status_code=404, detail="Workspace member not found")
    membership = db.scalar(select(WorkspaceMembership).where(WorkspaceMembership.company_id == user.company_id, WorkspaceMembership.user_id == target.id))
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace membership not found")
    membership.status = "active"
    record_audit(db, company_id=user.company_id, user_id=user.id, action="member.restored", entity_type="user", entity_id=target.id, description=f"Restored workspace access for {target.email}.")
    db.commit()
    return {"id": str(target.id), "status": membership.status}


@router.get("/profile")
def workspace_profile(db: Session = Depends(get_db), user: User = Depends(require_permission("workspace.view"))):
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    return {"company": {"id": str(company.id), "name": company.name} if company else None, "user": {"id": str(user.id), "name": user.full_name, "email": user.email}}


@router.patch("/profile")
def update_workspace_profile(payload: WorkspaceProfileUpdate, db: Session = Depends(get_db), user: User = Depends(require_permission("workspace.update"))):
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
