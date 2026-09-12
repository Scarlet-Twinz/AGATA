from __future__ import annotations

import httpx

from app.core.config import get_settings


class EmailDeliveryError(RuntimeError):
    pass


async def send_email(*, to: str, subject: str, html: str, text: str, category: str) -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        if settings.app_env == "development":
            print(f"[AGATA email:development] to={to} category={category} subject={subject}\n{text}")
            return
        raise EmailDeliveryError("Transactional email delivery is not configured")

    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
        "tags": [{"name": "category", "value": category}],
    }
    headers = {"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if response.is_error:
            raise EmailDeliveryError(f"Email provider rejected the message ({response.status_code})")
    except httpx.HTTPError as exc:
        raise EmailDeliveryError("Email provider could not be reached") from exc
