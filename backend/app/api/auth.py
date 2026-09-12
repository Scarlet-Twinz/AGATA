from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.auth_security import UserSecurity
from app.models.entities import Company, User
from app.schemas.auth import (
    AuthMessageResponse,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services.audit import record_audit
from app.services.auth_tokens import consume_token, issue_email_verification_token, issue_password_reset_token
from app.services.email import EmailDeliveryError, send_email
from app.services.rbac import ensure_workspace_access

router = APIRouter(prefix="/auth", tags=["auth"])


GENERIC_RECOVERY_MESSAGE = "If an AGATA account exists for that email, we have sent recovery instructions."


def _verification_url(token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/verify-email?token={quote(token)}"


def _reset_url(token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/reset-password?token={quote(token)}"


async def _send_verification_email(user: User, token: str) -> None:
    url = _verification_url(token)
    await send_email(
        to=user.email,
        subject="Verify your AGATA email",
        category="email_verification",
        text=f"Verify your AGATA email by opening this link:\n{url}\n\nThis link expires soon and can only be used once.",
        html=f"<p>Verify your AGATA email to activate your account.</p><p><a href=\"{url}\">Verify email</a></p><p>This link expires soon and can only be used once.</p>",
    )


async def _send_password_reset_email(user: User, token: str) -> None:
    url = _reset_url(token)
    await send_email(
        to=user.email,
        subject="Reset your AGATA password",
        category="password_reset",
        text=f"Reset your AGATA password by opening this link:\n{url}\n\nIf you did not request this, you can ignore this email.",
        html=f"<p>We received a request to reset your AGATA password.</p><p><a href=\"{url}\">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>",
    )


@router.post("/signup", response_model=AuthMessageResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthMessageResponse:
    if not payload.accepted_terms:
        raise HTTPException(status_code=400, detail="You must agree to the Terms and Privacy Policy before creating an account")

    email = payload.email.lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    company = Company(name=payload.company_name.strip())
    user = User(
        company=company,
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    ensure_workspace_access(db, user, commit=False)
    db.add(UserSecurity(user_id=user.id))
    token = issue_email_verification_token(db, user.id)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="account.created", entity_type="user", entity_id=user.id, description="Created an AGATA account and verification request.")
    db.commit()

    try:
        await _send_verification_email(user, token)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="Account created, but AGATA could not send the verification email. Please use Resend verification when email delivery is configured.") from exc

    return AuthMessageResponse(message="Account created. Check your email to verify your AGATA account before signing in.")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    security = db.get(UserSecurity, user.id)
    if security is not None and security.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in")

    ensure_workspace_access(db, user)
    return TokenResponse(access_token=create_access_token(user.id, user.company_id))


@router.post("/verify-email", response_model=AuthMessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)) -> AuthMessageResponse:
    item = consume_token(db, raw_token=token, token_type="email_verification")
    if item is None:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired")

    user = db.get(User, item.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired")
    security = db.get(UserSecurity, user.id)
    if security is None:
        security = UserSecurity(user_id=user.id)
        db.add(security)
    security.email_verified_at = datetime.now(timezone.utc)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="account.email_verified", entity_type="user", entity_id=user.id, description="Verified the account email address.")
    db.commit()
    return AuthMessageResponse(message="Email verified. You can now sign in to AGATA.")


@router.post("/resend-verification", response_model=AuthMessageResponse)
async def resend_verification(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> AuthMessageResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        return AuthMessageResponse(message="If an AGATA account exists for that email, we have sent a verification message.")

    security = db.get(UserSecurity, user.id)
    if security is None:
        return AuthMessageResponse(message="If an AGATA account exists for that email, we have sent a verification message.")
    if security.email_verified_at is not None:
        return AuthMessageResponse(message="That AGATA email is already verified.")

    token = issue_email_verification_token(db, user.id)
    db.commit()
    try:
        await _send_verification_email(user, token)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="AGATA could not send the verification email right now.") from exc
    return AuthMessageResponse(message="If an AGATA account exists for that email, we have sent a verification message.")


@router.post("/forgot-password", response_model=AuthMessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> AuthMessageResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        return AuthMessageResponse(message=GENERIC_RECOVERY_MESSAGE)

    token = issue_password_reset_token(db, user.id)
    db.commit()
    try:
        await _send_password_reset_email(user, token)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="AGATA could not send the recovery email right now.") from exc
    return AuthMessageResponse(message=GENERIC_RECOVERY_MESSAGE)


@router.post("/reset-password", response_model=AuthMessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> AuthMessageResponse:
    item = consume_token(db, raw_token=payload.token, token_type="password_reset")
    if item is None:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired")

    user = db.get(User, item.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired")

    user.password_hash = hash_password(payload.password)
    security = db.get(UserSecurity, user.id)
    if security is None:
        security = UserSecurity(user_id=user.id)
        db.add(security)
    security.password_changed_at = datetime.now(timezone.utc)
    record_audit(db, company_id=user.company_id, user_id=user.id, action="account.password_reset", entity_type="user", entity_id=user.id, description="Reset the account password using a recovery link.")
    db.commit()
    return AuthMessageResponse(message="Password updated. You can now sign in with your new password.")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
