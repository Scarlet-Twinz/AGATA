import json
from collections.abc import AsyncIterator

import httpx

from app.core.config import get_settings


class RumiUnavailableError(RuntimeError):
    """Raised when the local Rumi model cannot produce an answer."""


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
    """Classify only the latest user request; an old historical prompt must not poison later turns."""
    last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
    if not last_user:
        return False
    content = last_user.get("content", "").lower()
    return "historical trace" in content and "readiness decision" in content


def _compact_historical_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Give the model only the historical request and strict trace-grounding instructions."""
    last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
    if last_user is None:
        return messages

    system = messages[0] if messages and messages[0].get("role") == "system" else {
        "role": "system",
        "content": "You are Rumi, AGATA's compliance intelligence assistant.",
    }
    compact_system = dict(system)
    compact_system["content"] = (
        "You are Rumi, AGATA's compliance intelligence assistant.\n\n"
        "HISTORICAL TRACE MODE: Answer naturally and helpfully, but treat the historical trace supplied in the user's latest message as the complete and only source of facts. "
        "Do not use current AGATA workspace data, previous conversation turns, or general assumptions.\n\n"
        "GROUNDING RULES:\n"
        "- Repeat or paraphrase only facts explicitly present in the supplied trace.\n"
        "- You may explain that the deterministic engine recorded the listed requirements as blockers because the trace explicitly says they are blocking readiness.\n"
        "- Never infer why a requirement is a blocker beyond what the deterministic explanation states.\n"
        "- An evidence count of zero means only that zero evidence records were captured in this trace. It does NOT establish that evidence was missing, required, invalid, expired, unverified, unavailable, or insufficient.\n"
        "- Never infer meaning from requirement or blocker names. Names such as NNNNNNNNNNNN or BB are labels only unless the trace gives them meaning.\n"
        "- Never call a requirement critical, unmet, unsatisfied, unresolved, or failed unless the trace explicitly uses that condition.\n"
        "- Never infer that no remediation attempt occurred merely because zero change actions were captured. Say only that zero change actions were captured.\n"
        "- Never invent evidence validity, expiry, verification, requirement details, causes, remediation history, or operational consequences.\n"
        "- If the trace does not establish a detail, say that the trace does not establish it.\n"
        "- Preserve the deterministic readiness result exactly. Do not override it.\n\n"
        "STYLE: Do not sound like a hardcoded template or repeat the user's entire prompt mechanically. Give a concise, natural explanation focused on what the recorded decision means and what the decision-maker can legitimately conclude from the trace."
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
    except httpx.ReadTimeout as exc:
        raise RumiUnavailableError("Rumi is temporarily unavailable: ReadTimeout.") from exc
    except httpx.HTTPError as exc:
        raise RumiUnavailableError(f"Rumi is temporarily unavailable: {exc.__class__.__name__}.") from exc
