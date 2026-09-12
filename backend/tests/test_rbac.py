from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models import entities  # noqa: F401
from app.models import workspace  # noqa: F401
from app.models.entities import Company, User
from app.models.workspace import WorkspaceRole
from app.services.rbac import ensure_workspace_access, get_membership, has_permission, membership_role


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def make_user(db: Session) -> User:
    company = Company(id=uuid4(), name="RBAC Test Workspace")
    user = User(company=company, email=f"{uuid4()}@example.com", password_hash="test", full_name="Test User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_legacy_user_is_migrated_to_owner(db: Session) -> None:
    user = make_user(db)
    membership = ensure_workspace_access(db, user)

    assert membership.status == "active"
    assert membership_role(db, user).key == "owner"
    assert has_permission(db, user, "team.invite") is True
    assert has_permission(db, user, "workspace.update") is True


def test_member_role_is_restricted(db: Session) -> None:
    user = make_user(db)
    ensure_workspace_access(db, user)
    member_role = db.scalar(select(WorkspaceRole).where(WorkspaceRole.company_id == user.company_id, WorkspaceRole.key == "member"))
    assert member_role is not None
    membership = get_membership(db, user)
    membership.role_id = member_role.id
    db.commit()

    assert has_permission(db, user, "team.view") is True
    assert has_permission(db, user, "team.invite") is False
    assert has_permission(db, user, "workspace.update") is False


def test_suspended_membership_is_denied(db: Session) -> None:
    user = make_user(db)
    membership = ensure_workspace_access(db, user)
    membership.status = "suspended"
    db.commit()

    with pytest.raises(Exception, match="Workspace access is suspended"):
        get_membership(db, user)
