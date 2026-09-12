from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import Base
from app.models import entities  # noqa: F401
from app.models import security  # noqa: F401
from app.models import workspace  # noqa: F401
from app.models.entities import Company, User
from app.models.security import UserSession


def test_access_token_contains_unique_session_id() -> None:
    user_id, company_id = uuid4(), uuid4()
    token_a, jti_a, expires_a = create_access_token(user_id, company_id)
    token_b, jti_b, expires_b = create_access_token(user_id, company_id)

    assert token_a != token_b
    assert jti_a != jti_b
    assert decode_access_token(token_a) == (user_id, company_id, jti_a)
    assert expires_a > datetime.now(timezone.utc)
    assert expires_b > datetime.now(timezone.utc)


def test_password_hashing_round_trip() -> None:
    password = "correct horse battery staple"
    password_hash = hash_password(password)
    assert verify_password(password, password_hash) is True
    assert verify_password("wrong password", password_hash) is False


def test_revoked_session_is_persistable() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        company = Company(name="Security Test Workspace")
        user = User(company=company, email=f"{uuid4()}@example.com", password_hash="test", full_name="Security User")
        db.add(user)
        db.flush()
        session = UserSession(
            user_id=user.id,
            company_id=company.id,
            token_jti=uuid4().hex,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(session)
        db.commit()
        session.revoked_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(session)
        assert session.revoked_at is not None
