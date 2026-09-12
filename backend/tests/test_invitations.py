from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.session import Base
from app.models import entities  # noqa: F401
from app.models import workspace  # noqa: F401
from app.models.entities import Company
from app.services.invitations import issue_invitation, rotate_invitation


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        yield session


def test_new_invitation_stores_hash_not_raw_token(db: Session) -> None:
    company = Company(id=uuid4(), name="Invitation Test Workspace")
    db.add(company)
    db.flush()

    item, raw_token = issue_invitation(db, company_id=company.id, email="invitee@example.com", role="member")

    assert raw_token
    assert item.token is None
    assert item.token_hash is not None
    assert item.token_hash != raw_token
    assert item.expires_at is not None


def test_rotation_replaces_token_hash_and_expiry(db: Session) -> None:
    company = Company(id=uuid4(), name="Invitation Test Workspace")
    db.add(company)
    db.flush()
    item, first_token = issue_invitation(db, company_id=company.id, email="invitee@example.com", role="member")
    first_hash = item.token_hash

    second_token = rotate_invitation(db, item)

    assert second_token != first_token
    assert item.token_hash != first_hash
    assert item.token_hash is not None
    assert item.expires_at is not None
