from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.entities import User
from app.services.rumi import stream_rumi

router = APIRouter(prefix="/api/rumi", tags=["rumi"])


class RumiMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=12000)


class RumiRequest(BaseModel):
    messages: list[RumiMessage] = Field(min_length=1, max_length=20)


@router.post("/chat")
async def chat(payload: RumiRequest, user: User = Depends(get_current_user)) -> StreamingResponse:
    system = {
        "role": "system",
        "content": (
            "You are Rumi, the compliance intelligence assistant inside AGATA. "
            "Be concise, practical, and transparent. Do not invent company data. "
            "When application data is supplied by the backend, reason only from that context. "
            f"The current organization is {user.company_id}."
        ),
    }
    messages = [system, *[message.model_dump() for message in payload.messages]]

    async def body() -> AsyncIterator[str]:
        async for token in stream_rumi(messages):
            yield token

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
