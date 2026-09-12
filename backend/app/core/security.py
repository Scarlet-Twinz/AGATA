from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: UUID, company_id: UUID) -> tuple[str, str, datetime]:
    settings = get_settings()
    jti = uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "company_id": str(company_id), "jti": jti, "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM), jti, expires


def decode_access_token(token: str) -> tuple[UUID, UUID, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return UUID(payload["sub"]), UUID(payload["company_id"]), str(payload["jti"])
    except (JWTError, KeyError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc
