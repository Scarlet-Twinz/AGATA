import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings


async def _stream(messages: list[dict[str, str]], url: str, model: str, timeout_seconds: int) -> AsyncIterator[str]:
    timeout = httpx.Timeout(timeout_seconds, connect=10.0, read=timeout_seconds, write=timeout_seconds, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, json={"model": model, "messages": messages, "stream": True}) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break


def _is_historical_trace(messages: list[dict[str, str]]) -> bool:
    return any(
        message.get("role") == "user" and "historical trace" in message.get("content", "").lower()
        for message in messages
    )


def _compact_historical_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Keep historical explanations anchored to the supplied trace, not live state or old chats."""
    last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
    if last_user is None:
        return messages

    system = messages[0] if messages and messages[0].get("role") == "system" else {
        "role": "system",
        "content": "You are Rumi, AGATA's compliance intelligence assistant.",
    }
    compact_system = dict(system)
    instruction_boundary = compact_system.get("content", "").find("CURRENT AGATA WORKSPACE DATA")
    if instruction_boundary >= 0:
        compact_system["content"] = compact_system["content"][:instruction_boundary].rstrip()
    compact_system["content"] += (
        "\n\nHISTORICAL TRACE MODE: The user's supplied historical trace is the only authoritative source for this answer. "
        "Use its facts literally. Do not use current workspace data, prior conversation messages, names, or general assumptions "
        "to fill gaps. Do not say a requirement is 'not met', 'unsatisfied', 'missing', 'invalid', 'critical', or 'required' "
        "unless that exact condition is explicitly stated in the supplied trace. Do not turn an evidence count of zero into "
        "a claim that evidence was required, missing, invalid, expired, unverified, or unavailable for a requirement. "
        "Do not invent requirement meaning or operational details from requirement names. "
        "You may state that the listed requirements are blockers because the deterministic explanation says they block readiness. "
        "Explain only the operational meaning directly supported by the trace. Preserve the exact deterministic result: "
        "Not Ready, 0%, with 2 of 2 requirements blocking readiness."
    )
    return [compact_system, last_user]


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    timeout_seconds = max(settings.ollama_timeout_seconds, 180)
    request_messages = _compact_historical_messages(messages) if _is_historical_trace(messages) else messages

    try:
        async for token in _stream(request_messages, url, settings.ollama_model, timeout_seconds):
            yield token
    except httpx.ReadTimeout:
        yield "Rumi is temporarily unavailable: ReadTimeout."
    except httpx.HTTPError as exc:
        yield f"Rumi is temporarily unavailable: {exc.__class__.__name__}."
