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


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    timeout_seconds = max(settings.ollama_timeout_seconds, 180)

    try:
        async for token in _stream(messages, url, settings.ollama_model, timeout_seconds):
            yield token
            
    except httpx.ReadTimeout:
        # Historical decision explanations already carry their authoritative facts in the
        # user message. Retry without the large live-workspace/history payload so a slow
        # local model is not forced to process irrelevant context a second time.
        last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
        if last_user and "historical trace" in last_user.get("content", "").lower():
            system = messages[0] if messages and messages[0].get("role") == "system" else {
                "role": "system",
                "content": (
                    "You are Rumi, AGATA's compliance intelligence assistant. "
                    "For this historical decision explanation, the supplied user trace is authoritative. "
                    "Do not invent or infer evidence validity, expiry, verification state, requirement details, "
                    "or any other unsupported fact. Explain only what the trace supports and do not override "
                    "the deterministic readiness result."
                ),
            }
            instruction_boundary = system.get("content", "").find("CURRENT AGATA WORKSPACE DATA")
            compact_system = dict(system)
            if instruction_boundary >= 0:
                compact_system["content"] = system["content"][:instruction_boundary].rstrip()
            compact_system["content"] += (
                "\n\nHISTORICAL TRACE MODE: The user's supplied historical trace is authoritative for this answer. "
                "Do not use current workspace data or prior conversation messages to add facts to the trace."
            )
            try:
                async for token in _stream([compact_system, last_user], url, settings.ollama_model, timeout_seconds):
                    yield token
                return
            except httpx.HTTPError as retry_exc:
                yield f"Rumi is temporarily unavailable: {retry_exc.__class__.__name__}."
                return
        yield "Rumi is temporarily unavailable: ReadTimeout."
    except httpx.HTTPError as exc:
        yield f"Rumi is temporarily unavailable: {exc.__class__.__name__}."
