from datetime import datetime, timezone
from uuid import uuid4

from app.api.readiness_intelligence import _trace_timeline_item
from app.models.readiness_trace import ReadinessTrace


def make_trace(fingerprint: str, created_at: datetime) -> ReadinessTrace:
    return ReadinessTrace(
        company_id=uuid4(),
        project_id=uuid4(),
        contractor_id=uuid4(),
        engine_version="readiness-v2",
        score=0,
        status="not_ready",
        explanation="Blocked.",
        requirements_snapshot=[],
        evidence_snapshot=[],
        blockers_snapshot=[],
        change_set_snapshot=[],
        fingerprint=fingerprint,
        created_at=created_at,
    )


def test_timeline_distinguishes_meaningful_state_changes():
    previous = make_trace("a" * 64, datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc))
    current = make_trace("b" * 64, datetime(2026, 9, 14, 9, 0, tzinfo=timezone.utc))
    item = _trace_timeline_item(current, previous)
    assert item["fingerprint"] == "b" * 64
    assert item["score_delta"] == 0
    assert item["status_changed"] is False


def test_repeated_state_can_be_recorded_after_a_change():
    first = make_trace("a" * 64, datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc))
    middle = make_trace("b" * 64, datetime(2026, 9, 14, 9, 0, tzinfo=timezone.utc))
    repeated = make_trace("a" * 64, datetime(2026, 9, 14, 10, 0, tzinfo=timezone.utc))
    assert repeated.fingerprint == first.fingerprint
    assert repeated.created_at > middle.created_at
