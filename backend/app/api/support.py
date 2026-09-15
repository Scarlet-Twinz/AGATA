from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.email import EmailDeliveryError, send_email

router = APIRouter(prefix="/api/support", tags=["support"])
SUPPORT_EMAIL = os.getenv("AGATA_SUPPORT_EMAIL", "anthony@anthonytech.ng")


class SupportRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=5, max_length=255)
    topic: str = Field(default="support", min_length=1, max_length=80)
    message: str = Field(min_length=10, max_length=5000)

    @field_validator("name", "email", "topic", "message")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value


@router.post("", status_code=202)
async def submit_support_request(payload: SupportRequest):
    subject = f"[AGATA Support] {payload.topic} — {payload.name}"
    text = f"Name: {payload.name}\nEmail: {payload.email}\nTopic: {payload.topic}\n\n{payload.message}"
    html = (
        f"<h2>AGATA support request</h2>"
        f"<p><strong>Name:</strong> {payload.name}</p>"
        f"<p><strong>Email:</strong> {payload.email}</p>"
        f"<p><strong>Topic:</strong> {payload.topic}</p>"
        f"<p>{payload.message.replace(chr(10), '<br>')}</p>"
    )
    try:
        await send_email(to=SUPPORT_EMAIL, subject=subject, html=html, text=text, category="support")
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=503, detail="AGATA could not deliver your support request right now. Please email support directly.") from exc
    return {"accepted": True, "message": "Your message has been sent to AGATA support."}
