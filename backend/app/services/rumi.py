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
    """Classify only the latest user request; an old historical prompt must not poison later turns."""
    last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
    if not last_user:
        return False
    content = " ".join(last_user.get("content", "").lower().split())
    return (
        "rumi_mode: historical_trace" in content
        or "readiness decision trace" in content
        or "historical trace" in content
    )


def _is_memory_mode(messages: list[dict[str, str]]) -> bool:
    return any(
        message.get("role") == "system" and "CONVERSATION MEMORY MODE" in message.get("content", "")
        for message in messages
    )


def _declared_name(content: str) -> str | None:
    match = re.search(
        r"\bmy name is\s+([A-Za-z][A-Za-z' -]*?)(?=\s*(?:,|\.|!|\?|\band\b\s+what\b|\bwhat(?:'s|s)?\b)|$)",
        content,
        flags=re.IGNORECASE,
    )
    return match.group(1).strip() if match else None


def _is_name_question(content: str) -> bool:
    normalized = " ".join(content.lower().split())
    return bool(re.search(r"\bwhat(?:'s| is|s)?\s+my name\b", normalized))


def _remove_name_question(content: str, name: str) -> str:
    remaining = re.sub(rf"\bmy name is\s+{re.escape(name)}\s*,?\s*", "", content, count=1, flags=re.IGNORECASE)
    remaining = re.sub(r"\bwhat(?:'s| is|s)?\s+my name\b\s*(?:and\s*)?", "", remaining, count=1, flags=re.IGNORECASE)
    remaining = re.sub(r"^[\s,.:;-]+|[\s,.:;-]+$", "", remaining)
    return remaining


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
        "You are Rumi, the compliance intelligence assistant inside AGATA.\n\n"
        "HISTORICAL TRACE MODE: Answer only from the historical trace in the latest user message.\n"
        "The trace is an immutable record, not an invitation to infer missing facts.\n\n"
        "GROUNDING RULES:\n"
        "- Repeat or paraphrase only facts explicitly present in the supplied trace.\n"
        "- Zero evidence records means exactly zero evidence records were captured. It does not mean missing, required, invalid, expired, unverified, unavailable, or insufficient evidence.\n"
        "- Zero change actions means exactly zero change actions were captured. It does not mean that no remediation attempt occurred.\n"
        "- Never infer why a listed requirement is a blocker beyond the deterministic explanation supplied in the trace.\n"
        "- Never infer meaning from requirement or blocker names.\n"
        "- Never invent evidence validity, expiry, verification, requirement details, causes, remediation history, or operational consequences.\n"
        "- If a detail is not established by the trace, explicitly say that the trace does not establish it.\n"
        "- Preserve the recorded status, score, explanation, counts, timestamp, engine, and fingerprint exactly when mentioning them.\n\n"
        "STYLE: Give a concise, natural explanation. Do not recommend actions whose need is not established by the trace. Do not add examples of evidence, audits, documentation, standards, or remediation unless the trace itself contains them."
    )
    return [compact_system, last_user]


def _extract_historical_answer(content: str) -> str:
    """Build a safe natural-language explanation from an immutable trace envelope."""
    def field(pattern: str, default: str | None = None) -> str | None:
        match = re.search(pattern, content, flags=re.IGNORECASE)
        return match.group(1).strip() if match else default

    captured_at = field(r"Captured at:\s*(.*?)(?=\.\s*Engine:)")
    engine = field(r"Engine:\s*(.*?)(?=\.\s*Status:)")
    status = field(r"Status:\s*(.*?)(?=\.\s*Score:)")
    score = field(r"Score:\s*(.*?)(?=\.\s*Deterministic explanation:)")
    explanation = field(r"Deterministic explanation:\s*(.*?)(?=\.\s*Requirements captured:)")
    requirements = field(r"Requirements captured:\s*(.*?)(?=\.\s*Evidence records captured:)")
    evidence = field(r"Evidence records captured:\s*(.*?)(?=\.\s*Blockers captured:)")
    blockers = field(r"Blockers captured:\s*(.*?)(?=\.\s*Change actions captured:)")
    changes = field(r"Change actions captured:\s*(.*?)(?=\.\s*Decision fingerprint:)")
    fingerprint = field(r"Decision fingerprint:\s*(.*?)(?:\.\s*Explain why|$)")

    parts: list[str] = []
    if status is not None and score is not None:
        parts.append(f"The recorded AGATA readiness decision is {status} at {score}.")
    elif status is not None:
        parts.append(f"The recorded AGATA readiness decision is {status}.")
    elif score is not None:
        parts.append(f"The recorded readiness score is {score}.")
    else:
        parts.append("The supplied trace does not establish the recorded readiness status or score.")

    if explanation is not None:
        parts.append(f"The deterministic explanation says: {explanation.rstrip('.')}.")

    count_parts: list[str] = []
    if requirements is not None:
        count_parts.append(f"{requirements} requirements")
    if evidence is not None:
        count_parts.append(f"{'zero' if evidence == '0' else evidence} evidence records")
    if blockers is not None:
        blocker_match = re.fullmatch(r"(\d+)\s*\((.*)\)", blockers)
        count_parts.append(f"{blocker_match.group(1) if blocker_match else blockers} blockers")
    if changes is not None:
        count_parts.append(f"{'zero' if changes == '0' else changes} change actions")
    if count_parts:
        if len(count_parts) == 1:
            parts.append(f"The trace captured {count_parts[0]}.")
        else:
            parts.append(f"The trace captured {', '.join(count_parts[:-1])}, and {count_parts[-1]}.")

    if blockers is not None:
        blocker_match = re.fullmatch(r"(\d+)\s*\((.*)\)", blockers)
        if blocker_match:
            blocker_count, blocker_names = blocker_match.groups()
            parts.append(f"The recorded blockers are {blocker_names} ({blocker_count} total).")
        else:
            parts.append(f"The recorded blocker count is {blockers}.")

    parts.append(
        "The trace does not establish why the listed requirements are blocking readiness beyond the deterministic explanation, "
        "and it does not establish meanings or causes for recorded counts unless those facts are explicitly present."
    )

    metadata: list[str] = []
    if captured_at is not None:
        metadata.append(f"Captured at {captured_at}")
    if engine is not None:
        metadata.append(f"using {engine}")
    if fingerprint is not None:
        metadata.append(f"fingerprint {fingerprint}")
    if metadata:
        parts.append("; ".join(metadata) + ".")

    return " ".join(parts)


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    timeout_seconds = max(settings.ollama_timeout_seconds, 180)

    if _is_historical_trace(messages):
        last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
        if last_user is not None:
            yield _extract_historical_answer(last_user.get("content", ""))
        return

    model_messages = messages
    last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
    if _is_memory_mode(messages) and last_user is not None:
        memory_name = _declared_name(last_user.get("content", ""))
        if memory_name and _is_name_question(last_user.get("content", "")):
            yield f"Your name is {memory_name}."
            remaining = _remove_name_question(last_user.get("content", ""), memory_name)
            if not remaining:
                return
            model_messages = [
                ({**message, "content": remaining} if message is last_user else message)
                for message in messages
            ]

    try:
        async for token in _stream(model_messages, url, settings.ollama_model, timeout_seconds):
            yield token
    except httpx.ReadTimeout as exc:
        raise RumiUnavailableError("Rumi is temporarily unavailable: ReadTimeout.") from exc
    except httpx.HTTPError as exc:
        raise RumiUnavailableError(f"Rumi is temporarily unavailable: {exc.__class__.__name__}.") from exc
