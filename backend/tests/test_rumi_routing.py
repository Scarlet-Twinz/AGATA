from app.api.rumi import _is_conversation_memory_request, _is_historical_trace_request, _is_lightweight_request


def user(content: str) -> dict[str, str]:
    return {"role": "user", "content": content}


def test_casual_turns_use_lightweight_rumi_path():
    for content in ("hi", "hello", "so", "how are you", "what's up", "thanks", "ok"):
        assert _is_lightweight_request(user(content)) is True


def test_workspace_questions_do_not_use_lightweight_path():
    for content in ("Which contractors are not ready right now?", "What evidence needs attention?", "Show me readiness", "How do I create a contractor?"):
        assert _is_lightweight_request(user(content)) is False


def test_historical_trace_always_uses_historical_path():
    message = user("Explain this AGATA readiness decision trace using the supplied historical trace as the authoritative facts.")
    assert _is_historical_trace_request(message) is True
    assert _is_lightweight_request(message) is False


def test_explicit_historical_mode_marker_is_authoritative():
    message = user("RUMI_MODE: HISTORICAL_TRACE\nExplain this trace.")
    assert _is_historical_trace_request(message) is True
    assert _is_lightweight_request(message) is False


def test_short_historical_label_without_marker_is_not_forced_into_trace_mode():
    message = user("Explain this trace.")
    assert _is_historical_trace_request(message) is False


def test_conversation_memory_requests_use_memory_path():
    for content in (
        "What was our last chat about?",
        "What did we talk about earlier?",
        "What did I ask before?",
        "What was our previous conversation?",
    ):
        assert _is_conversation_memory_request(user(content)) is True
        assert _is_lightweight_request(user(content)) is False


def test_short_business_term_is_not_misclassified_as_casual():
    assert _is_lightweight_request(user("project")) is False
    assert _is_lightweight_request(user("ready?")) is False
    assert _is_lightweight_request(user("audit")) is False
