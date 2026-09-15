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
    return "rumi_mode: historical_trace" in content or ("historical trace" in content and "readiness decision" in content)


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
    """Build a safe natural-language explanation from an immutable trace envelope.

    Historical replay is a compliance/audit surface, so deterministic grounding is more
    important than allowing a small local model to improvise an explanation.
    """
    def field(pattern: str, default: str = "not established") -> str:
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

    return (
        f"The recorded AGATA readiness decision is {status} at {score}. "
        f"The deterministic explanation says: {explanation} "
        f"The trace captured {requirements} requirements, {evidence} evidence records, "
        f"{blockers} blockers, and {changes} change actions. "
        f"The recorded blockers are {blockers}. "
        f"The trace does not establish why those requirements are blocking readiness beyond the deterministic explanation, "
        f"nor does it establish what the zero evidence or change-action counts mean beyond those recorded counts. "
        f"So the decision-maker can conclude only what this trace explicitly records; additional causes or remediation details are not established here. "
        f"Captured at {captured_at} using {engine}, fingerprint {fingerprint}."
    )


async def stream_rumi(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    settings = get_settings()
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    timeout_seconds = max(settings.ollama_timeout_seconds, 180)

    if _is_historical_trace(messages):
        last_user = next((message for message in reversed(messages) if message.get("role") == "user"), None)
        if last_user is not None:
            # Historical explanations are an audit surface. Do not allow the local model
            # to introduce unsupported causal claims even when the prompt forbids them.
            yield _extract_historical_answer(last_user.get("content", ""))
        return

    try:
        async for token in _stream(messages, url, settings.ollama_model, timeout_seconds):
            yield token
    except httpx.ReadTimeout as exc:
        raise RumiUnavailableError("Rumi is temporarily unavailable: ReadTimeout.") from exc
    except httpx.HTTPError as exc:
        raise RumiUnavailableError(f"Rumi is temporarily unavailable: {exc.__class__.__name__}.") from exc
