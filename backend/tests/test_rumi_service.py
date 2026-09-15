import asyncio
from types import SimpleNamespace

import httpx
import pytest

from app.services import rumi


async def collect(stream):
    return [chunk async for chunk in stream]


def settings():
    return SimpleNamespace(
        ollama_base_url="http://127.0.0.1:11434",
        ollama_model="qwen2.5:3b-instruct",
        ollama_timeout_seconds=120,
    )


def test_historical_trace_never_calls_ollama(monkeypatch):
    calls = 0

    async def fake_stream(messages, url, model, timeout_seconds):
        nonlocal calls
        calls += 1
        yield "unsafe model answer"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    messages = [
        {
            "role": "system",
            "content": "Instructions.\n\nCURRENT AGATA WORKSPACE DATA (authoritative backend snapshot):\nlarge live context",
        },
        {"role": "assistant", "content": "old conversation"},
        {
            "role": "user",
            "content": "Explain this AGATA readiness decision trace. Status: Not Ready. Score: 0%.",
        },
    ]

    chunks = asyncio.run(collect(rumi.stream_rumi(messages)))

    assert calls == 0
    assert "Not Ready" in "".join(chunks)


def test_explicit_historical_mode_is_deterministic_and_never_calls_ollama(monkeypatch):
    calls = 0

    async def fake_stream(messages, url, model, timeout_seconds):
        nonlocal calls
        calls += 1
        yield "unsafe model answer"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    trace = (
        "RUMI_MODE: HISTORICAL_TRACE Explain this AGATA readiness decision trace. "
        "Captured at: 9/14/2026, 7:57:43 AM. Engine: readiness-v2. Status: Not Ready. "
        "Score: 0%. Deterministic explanation: 2 of 2 requirements are blocking readiness. "
        "Requirements captured: 2. Evidence records captured: 0. Blockers captured: 2 (NNNNNNNNNNNN, BB). "
        "Change actions captured: 0. Decision fingerprint: f079df44d54c62c492bfe5ea011e28e2f40211662d685160118a31a0e..."
    )

    answer = "".join(asyncio.run(collect(rumi.stream_rumi([{"role": "user", "content": trace}]))))

    assert calls == 0
    assert "Not Ready" in answer
    assert "0%" in answer
    assert "2 of 2 requirements are blocking readiness" in answer
    assert "NNNNNNNNNNNN, BB" in answer
    assert "zero evidence" in answer.lower()
    assert "zero change actions" in answer.lower()
    assert "suggests" not in answer.lower()
    assert "gather" not in answer.lower()
    assert "initiate" not in answer.lower()


def test_partial_historical_trace_preserves_fields_before_truncated_next_label():
    trace = (
        "RUMI_MODE: HISTORICAL_TRACE Explain this AGATA readiness decision trace. "
        "Captured at: 9/14/2026, 7:57:43 AM. Engine: readiness-v2. Status: Not Ready. "
        "Score: 0%. Deterministic explanation: 2 of 2 requirements are blocking readiness. "
        "Requirements captured: 2. Evidence records captured"
    )

    answer = rumi._extract_historical_answer(trace)

    assert "Not Ready" in answer
    assert "0%" in answer
    assert "2 of 2 requirements are blocking readiness" in answer
    assert "2 requirements" in answer
    assert "not established requirements" not in answer.lower()
    assert "fingerprint" not in answer.lower()
    assert "invalid" not in answer.lower()
    assert "missing evidence" not in answer.lower()


def test_partial_historical_trace_does_not_invent_missing_fields():
    trace = (
        "RUMI_MODE: HISTORICAL_TRACE Explain this AGATA readiness decision trace. "
        "Captured at: 9/14/2026, 7:57:43 AM. Engine: readiness-v2. Status: Not Ready. "
        "Score: 0%. Deterministic explanation: 2 of 2 requirements are blocking readiness. "
        "Requirements captured: 2. Evidence records captured: 0"
    )

    answer = rumi._extract_historical_answer(trace)

    assert "Not Ready" in answer
    assert "0%" in answer
    assert "2 of 2 requirements are blocking readiness" in answer
    assert "2 requirements" in answer
    assert "zero evidence records" in answer.lower()
    assert "fingerprint" not in answer.lower()
    assert "invalid" not in answer.lower()
    assert "missing evidence" not in answer.lower()


def test_memory_mode_preserves_explicit_name_without_model_rewriting(monkeypatch):
    calls: list[list[dict[str, str]]] = []

    async def fake_stream(messages, url, model, timeout_seconds):
        calls.append(messages)
        yield "We talked about AGATA readiness."

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    messages = [
        {"role": "system", "content": "CONVERSATION MEMORY MODE: Answer only from supplied history."},
        {"role": "system", "content": "RUMI CURRENT CONVERSATION: exact stored messages"},
        {
            "role": "user",
            "content": "OK SO MY NAME IS Emmanuella, WHAT'S MY NAME AND WHAT WAS OUR LAST CHAT ABOUT",
        },
    ]

    answer = "".join(asyncio.run(collect(rumi.stream_rumi(messages))))

    assert answer.startswith("Your name is Emmanuella.")
    assert "We talked about AGATA readiness." in answer
    assert calls
    assert calls[0][-1]["content"] == "OK SO WHAT WAS OUR LAST CHAT ABOUT"


def test_memory_mode_answers_name_without_calling_model(monkeypatch):
    calls = 0

    async def fake_stream(messages, url, model, timeout_seconds):
        nonlocal calls
        calls += 1
        yield "wrong name"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    messages = [
        {"role": "system", "content": "CONVERSATION MEMORY MODE"},
        {"role": "user", "content": "MY NAME IS MARK WHATS MY NAME"},
    ]

    answer = "".join(asyncio.run(collect(rumi.stream_rumi(messages))))

    assert answer == "Your name is MARK."
    assert calls == 0


def test_non_historical_timeout_raises_without_retry(monkeypatch):
    calls = 0

    async def fake_stream(messages, url, model, timeout_seconds):
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("local model timed out")
        yield "unreachable"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    messages = [
        {"role": "system", "content": "Current workspace context"},
        {"role": "user", "content": "What projects do I have?"},
    ]

    with pytest.raises(rumi.RumiUnavailableError, match="ReadTimeout"):
        asyncio.run(collect(rumi.stream_rumi(messages)))

    assert calls == 1
