import asyncio
from types import SimpleNamespace

import httpx

from app.services import rumi


def test_historical_trace_retries_without_live_workspace_context(monkeypatch):
    calls: list[list[dict[str, str]]] = []

    async def fake_stream(messages, url, model, timeout_seconds):
        calls.append(messages)
        if len(calls) == 1:
            raise httpx.ReadTimeout("local model timed out")
        yield "historical answer"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(
        rumi,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://127.0.0.1:11434",
            ollama_model="qwen2.5:3b-instruct",
            ollama_timeout_seconds=120,
        ),
    )

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
    assert len(calls) == 2
    assert calls[0] == messages
    assert len(calls[1]) == 2
    assert calls[1][0]["role"] == "system"
    assert "CURRENT AGATA WORKSPACE DATA" not in calls[1][0]["content"]
    assert calls[1][1] == messages[-1]


def test_non_historical_timeout_does_not_retry_with_unrelated_context(monkeypatch):
    calls = 0

    async def fake_stream(messages, url, model, timeout_seconds):
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("local model timed out")
        yield "unreachable"

    monkeypatch.setattr(rumi, "_stream", fake_stream)
    monkeypatch.setattr(
        rumi,
        "get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://127.0.0.1:11434",
            ollama_model="qwen2.5:3b-instruct",
            ollama_timeout_seconds=120,
        ),
    )

    messages = [
        {"role": "system", "content": "Current workspace context"},
        {"role": "user", "content": "What projects do I have?"},
    ]

    chunks = asyncio.run(collect(rumi.stream_rumi(messages)))

    assert chunks == ["Rumi is temporarily unavailable: ReadTimeout."]
    assert calls == 1


async def collect(stream):
    return [chunk async for chunk in stream]
