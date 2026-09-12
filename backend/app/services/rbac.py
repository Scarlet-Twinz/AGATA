from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.models.workspace import WorkspaceMembership, WorkspacePermission, WorkspaceRole, WorkspaceRolePermission


PERMISSIONS: dict[str, str] = {
    "workspace.view": "View workspace administration",
    "workspace.update": "Update workspace details",
    "team.view": "View workspace members",
    "team.invite": "Invite people to the workspace",
    "team.manage": "Manage member roles and access",
    "projects.view": "View projects",
    "projects.create": "Create projects",
    "projects.update": "Update projects",
    "projects.delete": "Delete projects",
    "contractors.view": "View contractors",
    "contractors.create": "Create contractors",
    "contractors.update": "Update contractors",
    "requirements.view": "View requirements",
    "requirements.manage": "Manage requirements",
    "evidence.view": "View evidence",
    "evidence.upload": "Upload evidence",
    "evidence.review": "Review evidence",
    "readiness.view": "View readiness",
    "readiness.evaluate": "Run readiness evaluations",
    "readiness.approve": "Approve readiness decisions",
    "audit.view": "View audit history",
    "settings.view": "View settings",
    "settings.manage": "Manage settings",
    "billing.view": "View billing and plan information",
}

ROLE_DEFINITIONS: dict[str, tuple[str, str, set[str]]] = {
    "owner": (
        "Owner",
        "Full workspace control",
        set(PERMISSIONS),
    ),
    "admin": (
        "Admin",
        "Workspace administration and operational control",
        set(PERMISSIONS) - {"billing.view"},
    ),
    "compliance_manager": (
        "Compliance Manager",
        "Manage compliance evidence and readiness operations",
        {
            "workspace.view", "team.view", "projects.view", "projects.update",
            "contractors.view", "contractors.update", "requirements.view", "requirements.manage",
            "evidence.view", "evidence.upload", "evidence.review", "readiness.view",
            "readiness.evaluate", "readiness.approve", "audit.view", "settings.view",
        },
    ),
    "project_manager": (
        "Project Manager",
        "Manage project and contractor readiness operations",
        {
            "workspace.view", "team.view", "projects.view", "projects.create", "projects.update",
            "contractors.view", "contractors.create", "contractors.update", "requirements.view",
            "evidence.view", "evidence.upload", "readiness.view", "readiness.evaluate", "audit.view",
        },
    ),
    "reviewer": (
        "Reviewer",
        "Review evidence and readiness decisions",
        {
            "workspace.view", "team.view", "projects.view", "contractors.view", "requirements.view",
            "evidence.view", "evidence.review", "readiness.view", "readiness.evaluate", "audit.view",
        },
    ),
    "member": (
        "Member",
        "Standard workspace access",
        {
            "workspace.view", "team.view", "projects.view", "contractors.view", "requirements.view",
            "evidence.view", "readiness.view", "settings.view",
        },
    ),
}


def ensure_workspace_access(db: Session, user: User, *, commit: bool = True) -> WorkspaceMembership:
    """Ensure a legacy/new user has a persistent workspace membership and roles exist."""
    permissions_by_key: dict[str, WorkspacePermission] = {}
    for key, description in PERMISSIONS.items():
        permission = db.scalar(select(WorkspacePermission).where(WorkspacePermission.key == key))
        if permission is None:
            permission = WorkspacePermission(key=key, name=key.replace(".", " ").title(), description=description)
            db.add(permission)
            db.flush()
        permissions_by_key[key] = permission

    roles: dict[str, WorkspaceRole] = {}
    for key, (name, description, permission_keys) in ROLE_DEFINITIONS.items():
        role = db.scalar(select(WorkspaceRole).where(WorkspaceRole.company_id == user.company_id, WorkspaceRole.key == key))
        if role is None:
            role = WorkspaceRole(company_id=user.company_id, key=key, name=name, description=description, is_system=True)
            db.add(role)
            db.flush()
        roles[key] = role
        existing_permission_ids = set(
            db.scalars(select(WorkspaceRolePermission.permission_id).where(WorkspaceRolePermission.role_id == role.id)).all()
        )
        for permission_key in permission_keys:
            permission = permissions_by_key[permission_key]
            if permission.id not in existing_permission_ids:
                db.add(WorkspaceRolePermission(role_id=role.id, permission_id=permission.id))

    membership = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.company_id == user.company_id,
            WorkspaceMembership.user_id == user.id,
        )
    )
    if membership is None:
        membership = WorkspaceMembership(company_id=user.company_id, user_id=user.id, role_id=roles["owner"].id, status="active")
        db.add(membership)
        db.flush()
    elif membership.status != "active":
        membership.status = "active"

    if commit:
        db.commit()
        db.refresh(membership)
    return membership


def get_membership(db: Session, user: User) -> WorkspaceMembership:
    membership = db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.company_id == user.company_id,
            WorkspaceMembership.user_id == user.id,
            WorkspaceMembership.status == "active",
        )
    )
    if membership is None:
        membership = ensure_workspace_access(db, user)
    return membership


def has_permission(db: Session, user: User, permission_key: str) -> bool:
    membership = get_membership(db, user)
    permission = db.scalar(select(WorkspacePermission).where(WorkspacePermission.key == permission_key))
    if permission is None:
        return False
    return db.scalar(
        select(WorkspaceRolePermission.id).where(
            WorkspaceRolePermission.role_id == membership.role_id,
            WorkspaceRolePermission.permission_id == permission.id,
        )
    ) is not None


def require_permission(permission_key: str) -> Callable:
    def dependency(
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ) -> User:
        if not has_permission(db, user, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission_key}",
            )
        return user

    return dependency


def membership_role(db: Session, user: User) -> WorkspaceRole:
    membership = get_membership(db, user)
    role = db.get(WorkspaceRole, membership.role_id)
    if role is None:
        raise HTTPException(status_code=500, detail="Workspace role is missing")
    return role


__all__ = [
    "PERMISSIONS",
    "ROLE_DEFINITIONS",
    "ensure_workspace_access",
    "get_membership",
    "has_permission",
    "membership_role",
    "require_permission",
]
