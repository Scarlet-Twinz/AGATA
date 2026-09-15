import pytest
from fastapi import HTTPException

from app.api import support


@pytest.mark.anyio
async def test_support_request_sends_sanitized_html(monkeypatch) -> None:
    captured: dict[str, str] = {}

    async def fake_send_email(*, to: str, subject: str, html: str, text: str, category: str) -> None:
        captured.update(to=to, subject=subject, html=html, text=text, category=category)

    monkeypatch.setattr(support, "send_email", fake_send_email)

    result = await support.submit_support_request(
        support.SupportRequest(
            name="<Admin>",
            email="User@Example.com",
            topic="billing",
            message="Hello <script>alert(1)</script>\nPlease help.",
        )
    )

    assert result["accepted"] is True
    assert captured["to"] == support.SUPPORT_EMAIL
    assert captured["category"] == "support"
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in captured["html"]
    assert "<script>" not in captured["html"]
    assert "user@example.com" in captured["text"]


@pytest.mark.anyio
async def test_support_request_surfaces_delivery_failure(monkeypatch) -> None:
    async def failing_send_email(**_: str) -> None:
        raise support.EmailDeliveryError("provider unavailable")

    monkeypatch.setattr(support, "send_email", failing_send_email)

    with pytest.raises(HTTPException) as exc_info:
        await support.submit_support_request(
            support.SupportRequest(
                name="Anthony",
                email="anthony@example.com",
                topic="support",
                message="I need help with my workspace.",
            )
        )

    assert exc_info.value.status_code == 503
