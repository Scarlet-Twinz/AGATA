from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.entities import Company, User
from app.models.security import UserSecurityState, UserSession
from app.schemas.auth import LoginRequest, PasswordChangeRequest, SignupRequest, TokenResponse, UserResponse
from app.services.rbac import ensure_workspace_access

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_session(db: Session, user: User) -> TokenResponse:
    token, jti, expires = create_access_token(user.id, user.company_id)
    db.add(UserSession(user_id=user.id, company_id=user.company_id, token_jti=jti, expires_at=expires))
    db.commit()
    return TokenResponse(access_token=token)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if not payload.accepted_terms:
        raise HTTPException(status_code=400, detail="You must agree to the Terms and Privacy Policy before creating an account")

    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    company = Company(name=payload.company_name.strip())
    user = User(
        company=company,
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    ensure_workspace_access(db, user, commit=False)
    db.add(UserSecurityState(user_id=user.id, password_changed_at=datetime.now(timezone.utc)))
    db.commit()
    db.refresh(user)
    return _issue_session(db, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    ensure_workspace_access(db, user)
    return _issue_session(db, user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different from the current password")

    current_user.password_hash = hash_password(payload.new_password)
    state = db.get(UserSecurityState, current_user.id)
    if state is None:
        state = UserSecurityState(user_id=current_user.id)
        db.add(state)
    state.password_changed_at = datetime.now(timezone.utc)
    db.query(UserSession).filter(UserSession.user_id == current_user.id, UserSession.revoked_at.is_(None)).update(
        {UserSession.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False
    )
    db.commit()


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
