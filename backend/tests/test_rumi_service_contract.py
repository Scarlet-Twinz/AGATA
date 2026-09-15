"""Contract checks for Rumi's historical-context boundary."""

from app.services.rumi import _compact_historical_messages, _is_historical_trace


def test_historical_detection_requires_user_trace_language():
    assert _is_historical_trace([{"role": "user", "content": "Explain this historical trace."}])
    assert not _is_historical_trace([{"role": "user", "content": "Explain current readiness."}])


def test_compaction_keeps_only_authoritative_trace_and_non_live_instructions():
    messages = [
        {
            "role": "system",
            "content": "Base rules.\n\nCURRENT AGATA WORKSPACE DATA (authoritative backend snapshot):\nCurrent state",
        },
        {"role": "assistant", "content": "Old answer"},
        {"role": "user", "content": "Explain this historical trace. Status: Not Ready. Score: 0%."},
    ]

    compact = _compact_historical_messages(messages)

    assert len(compact) == 2
    assert compact[1] == messages[-1]
    assert "CURRENT AGATA WORKSPACE DATA" not in compact[0]["content"]
    assert "Old answer" not in compact[0]["content"]
    assert "HISTORICAL TRACE MODE" in compact[0]["content"]
