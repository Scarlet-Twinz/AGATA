import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {"model": settings.ollama_model, "messages": messages, "stream": True}

    timeout = httpx.Timeout(settings.ollama_timeout_seconds, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as response:
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
    except httpx.HTTPError as exc:
        yield f"Rumi is temporarily unavailable: {exc.__class__.__name__}."
