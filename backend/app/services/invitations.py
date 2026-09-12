from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.workspace import WorkspaceInvitation
from app.services.email import EmailDeliveryError, send_email


INVITATION_EXPIRE_HOURS = 72


def _new_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(48)
    return raw_token, hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def issue_invitation(db: Session, *, company_id: UUID, email: str, role: str) -> tuple[WorkspaceInvitation, str]:
    existing = db.scalar(
        select(WorkspaceInvitation).where(
            WorkspaceInvitation.company_id == company_id,
            WorkspaceInvitation.email == email,
            WorkspaceInvitation.status == "pending",
        )
    )
    if existing is not None:
        return existing, rotate_invitation(db, existing)

    raw_token, token_hash = _new_token()
    now = datetime.now(timezone.utc)
    item = WorkspaceInvitation(
        company_id=company_id,
        email=email,
        role=role,
        token=None,
        token_hash=token_hash,
        status="pending",
        expires_at=now + timedelta(hours=INVITATION_EXPIRE_HOURS),
    )
    db.add(item)
    db.flush()
    return item, raw_token


def rotate_invitation(db: Session, item: WorkspaceInvitation) -> str:
    raw_token, token_hash = _new_token()
    item.token = None
    item.token_hash = token_hash
    item.status = "pending"
    item.expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRE_HOURS)
    item.accepted_at = None
    item.revoked_at = None
    return raw_token


def invitation_url(raw_token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/accept-invitation?token={raw_token}"


async def send_invitation_email(*, email: str, role: str, company_name: str, raw_token: str) -> None:
    url = invitation_url(raw_token)
    await send_email(
        to=email,
        subject=f"You have been invited to {company_name} on AGATA",
        category="workspace_invitation",
        text=(
            f"You have been invited to join {company_name} on AGATA as {role.replace('_', ' ').title()}.\n\n"
            f"Accept the invitation:\n{url}\n\n"
            f"This invitation expires in {INVITATION_EXPIRE_HOURS} hours and can only be used once."
        ),
        html=(
            f"<p>You have been invited to join <strong>{company_name}</strong> on AGATA as "
            f"<strong>{role.replace('_', ' ').title()}</strong>.</p>"
            f"<p><a href=\"{url}\">Accept invitation</a></p>"
            f"<p>This invitation expires in {INVITATION_EXPIRE_HOURS} hours and can only be used once.</p>"
        ),
    )


__all__ = ["EmailDeliveryError", "INVITATION_EXPIRE_HOURS", "invitation_url", "issue_invitation", "rotate_invitation", "send_invitation_email"]
