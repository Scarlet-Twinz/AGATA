from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.auth_security import AuthToken


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def issue_token(db: Session, *, user_id: UUID, token_type: str, expires_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    db.execute(delete(AuthToken).where(AuthToken.user_id == user_id, AuthToken.token_type == token_type, AuthToken.consumed_at.is_(None)))
    raw_token = secrets.token_urlsafe(48)
    db.add(AuthToken(user_id=user_id, token_hash=_hash_token(raw_token), token_type=token_type, expires_at=now + timedelta(minutes=expires_minutes)))
    return raw_token


def consume_token(db: Session, *, raw_token: str, token_type: str) -> AuthToken | None:
    now = datetime.now(timezone.utc)
    item = db.scalar(select(AuthToken).where(AuthToken.token_hash == _hash_token(raw_token), AuthToken.token_type == token_type, AuthToken.consumed_at.is_(None)))
    if item is None or item.expires_at <= now:
        return None
    item.consumed_at = now
    return item


def issue_email_verification_token(db: Session, user_id: UUID) -> str:
    return issue_token(db, user_id=user_id, token_type="email_verification", expires_minutes=get_settings().auth_verification_expire_minutes)


def issue_password_reset_token(db: Session, user_id: UUID) -> str:
    return issue_token(db, user_id=user_id, token_type="password_reset", expires_minutes=get_settings().auth_reset_expire_minutes)
