from types import SimpleNamespace

from app.api.readiness_replay import _names, _trace_blocker_transition


def test_replay_name_extraction_ignores_missing_requirement_names():
    assert _names([
        {"requirement_name": "Safety Certificate"},
        {"requirement_name": None},
        {},
        {"requirement_name": "Insurance"},
    ]) == ["Safety Certificate", "Insurance"]


def test_replay_blocker_transition_uses_the_historical_trace_snapshot():
    previous = SimpleNamespace(blockers_snapshot=[{"requirement_name": "Insurance"}])
    trace = SimpleNamespace(blockers_snapshot=[{"requirement_name": "Safety Certificate"}])

    assert _trace_blocker_transition(trace, previous) == (["Safety Certificate"], ["Insurance"])


def test_replay_blocker_transition_is_empty_without_previous_trace():
    trace = SimpleNamespace(blockers_snapshot=[{"requirement_name": "Safety Certificate"}])

    assert _trace_blocker_transition(trace, None) == ([], [])
