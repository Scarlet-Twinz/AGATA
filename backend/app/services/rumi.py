import json
import re
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
        "Explain only the operational meaning directly supported by the trace. Preserve the exact deterministic result. "
        "If a fact is not in the trace, say it is not established by the trace."
    )
    return [compact_system, last_user]


def _trace_value(text: str, label: str, stop_labels: tuple[str, ...]) -> str | None:
    escaped = re.escape(label)
    stops = "|".join(re.escape(item) for item in stop_labels)
    match = re.search(rf"{escaped}:\s*(.*?)(?=\.\s*(?:{stops}):|$)", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def _historical_trace_explanation(text: str) -> str:
    """Produce a deterministic, trace-only explanation when historical mode is requested.

    Historical decision traces are audit records. A language model must not reinterpret
    missing fields or numeric counts as business facts, so this path intentionally uses
    only values explicitly present in the supplied trace.
    """
    captured = _trace_value(text, "Captured at", ("Engine", "Status")) or "not established by the trace"
    engine = _trace_value(text, "Engine", ("Status", "Score")) or "not established by the trace"
    status = _trace_value(text, "Status", ("Score", "Deterministic explanation")) or "not established by the trace"
    score = _trace_value(text, "Score", ("Deterministic explanation", "Requirements captured")) or "not established by the trace"
    deterministic = _trace_value(text, "Deterministic explanation", ("Requirements captured", "Evidence records captured")) or "not established by the trace"
    requirements = _trace_value(text, "Requirements captured", ("Evidence records captured", "Blockers captured")) or "not established by the trace"
    evidence = _trace_value(text, "Evidence records captured", ("Blockers captured", "Change actions captured")) or "not established by the trace"
    blockers = _trace_value(text, "Blockers captured", ("Change actions captured", "Decision fingerprint")) or "not established by the trace"
    changes = _trace_value(text, "Change actions captured", ("Decision fingerprint",)) or "not established by the trace"
    fingerprint = _trace_value(text, "Decision fingerprint", ()) or "not established by the trace"

    return (
        "The historical AGATA readiness decision was recorded as "
        f"{status} with a score of {score}. The trace was captured at {captured} using engine {engine}. "
        f"The deterministic explanation states: {deterministic} "
        f"The trace records {requirements} requirements, {evidence} evidence records, "
        f"{blockers} change blockers ({blockers.split('(', 1)[1].rsplit(')', 1)[0] if '(' in blockers and ')' in blockers else blockers}), "
        f"and {changes} change actions. "
        "The trace does not establish additional details about the requirements, evidence, their validity, "
        "verification state, causes, or remediation attempts. "
        f"The decision fingerprint for this recorded state is {fingerprint}."
    )


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    timeout_seconds = max(settings.ollama_timeout_seconds, 180)
    if _is_historical_trace(messages):
        last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
        if last_user:
            yield _historical_trace_explanation(last_user.get("content", ""))
        return

    try:
        async for token in _stream(messages, url, settings.ollama_model, timeout_seconds):
            yield token
    except httpx.ReadTimeout as exc:
        raise RumiUnavailableError("Rumi is temporarily unavailable: ReadTimeout.") from exc
    except httpx.HTTPError as exc:
        raise RumiUnavailableError(f"Rumi is temporarily unavailable: {exc.__class__.__name__}.") from exc
