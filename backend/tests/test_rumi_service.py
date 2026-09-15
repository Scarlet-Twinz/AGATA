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


def test_historical_trace_is_compacted_before_first_ollama_call(monkeypatch):
    calls: list[list[dict[str, str]]] = []

    async def fake_stream(messages, url, model, timeout_seconds):
        calls.append(messages)
        yield "historical answer"

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

    assert chunks == ["historical answer"]
    assert len(calls) == 1
    assert len(calls[0]) == 2
    assert calls[0][0]["role"] == "system"
    assert "CURRENT AGATA WORKSPACE DATA" not in calls[0][0]["content"]
    assert "HISTORICAL TRACE MODE" in calls[0][0]["content"]
    assert calls[0][1] == messages[-1]


def test_historical_timeout_raises_without_retrying_with_live_context(monkeypatch):
    calls: list[list[dict[str, str]]] = []

    async def fake_stream(messages, url, model, timeout_seconds):
        calls.append(messages)
        raise httpx.ReadTimeout("local model timed out")
        yield "unreachable"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(rumi, "get_settings", settings)

    messages = [
        {"role": "system", "content": "Current workspace context"},
        {"role": "user", "content": "Explain this historical trace. Status: Not Ready."},
    ]

    with pytest.raises(rumi.RumiUnavailableError, match="ReadTimeout"):
        asyncio.run(collect(rumi.stream_rumi(messages)))

    assert len(calls) == 1
    assert calls[0][1] == messages[1]


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
