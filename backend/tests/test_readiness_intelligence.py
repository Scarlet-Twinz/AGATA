import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.readiness_intelligence import _trace_timeline_item
from app.models.entities import Document
from app.models.evidence_intelligence import EvidenceIntelligence
from app.models.readiness_trace import ReadinessTrace
from app.services.readiness_intelligence import _evidence_state, _fingerprint


def make_document(**overrides):
    values = {"name": "Certificate", "document_type": "certificate", "status": "active", "expires_at": None}
    values.update(overrides)
    return Document(**values)


def make_intelligence(**overrides):
    values = {"verification_status": "verified", "review_status": "approved"}
    values.update(overrides)
    return EvidenceIntelligence(**values)


def make_trace(**overrides):
    values = {
        "score": 50,
        "status": "not_ready",
        "explanation": "One requirement is blocked.",
        "engine_version": "readiness-v2",
        "requirements_snapshot": [{"requirement_name": "Insurance"}],
        "evidence_snapshot": [{"document_name": "Certificate"}],
        "blockers_snapshot": [{"requirement_name": "Insurance"}],
        "change_set_snapshot": [{"action_type": "provide_evidence"}],
        "fingerprint": "a" * 64,
        "created_at": datetime(2026, 9, 14, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return ReadinessTrace(**values)


def test_verified_approved_evidence_is_valid():
    assert _evidence_state(make_document(), make_intelligence()) == "valid"


def test_expired_evidence_is_expired():
    assert _evidence_state(make_document(expires_at=datetime.now(timezone.utc) - timedelta(days=1)), make_intelligence()) == "expired"


def test_evidence_expiring_within_thirty_days_is_expiring():
    assert _evidence_state(make_document(expires_at=datetime.now(timezone.utc) + timedelta(days=10)), make_intelligence()) == "expiring"


def test_unverified_evidence_is_unverified():
    assert _evidence_state(make_document(), make_intelligence(verification_status="unverified")) == "unverified"


def test_rejected_evidence_is_rejected():
    assert _evidence_state(make_document(), make_intelligence(verification_status="rejected")) == "rejected"


def test_fingerprint_is_order_independent_for_object_keys():
    assert _fingerprint({"b": 2, "a": 1}) == _fingerprint({"a": 1, "b": 2})


def test_timeline_item_reports_resolved_blockers_and_score_delta():
    previous = make_trace(score=25, blockers_snapshot=[{"requirement_name": "Insurance"}, {"requirement_name": "Training"}])
    current = make_trace(score=75, status="attention", blockers_snapshot=[{"requirement_name": "Training"}])
    item = _trace_timeline_item(current, previous)
    assert item["score_delta"] == 50
    assert item["status_changed"] is True
    assert item["blockers_added"] == []
    assert item["blockers_resolved"] == ["Insurance"]
