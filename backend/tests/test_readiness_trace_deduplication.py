from datetime import datetime, timezone
from uuid import uuid4

from app.api.readiness_intelligence import create_trace
from app.models.readiness_trace import ReadinessTrace


def _intelligence(fingerprint: str) -> dict:
    return {
        "engine_version": "readiness-v2",
        "score": 0,
        "status": "not_ready",
        "explanation": "Blocked by missing evidence.",
        "requirements": [],
        "evidence": [],
        "blockers": [],
        "minimum_change_set": [],
        "fingerprint": fingerprint,
    }


def test_create_trace_reuses_only_latest_identical_state(db_session):
    company_id = uuid4()
    project_id = uuid4()
    contractor_id = uuid4()
    first = ReadinessTrace(
        company_id=company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        engine_version="readiness-v2",
        score=0,
        status="not_ready",
        explanation="Blocked.",
        requirements_snapshot=[],
        evidence_snapshot=[],
        blockers_snapshot=[],
        change_set_snapshot=[],
        fingerprint="a" * 64,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db_session.add(first)
    db_session.commit()

    same = create_trace(
        db_session,
        company_id=company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        compliance_check_id=None,
        intelligence=_intelligence("a" * 64),
    )
    assert same.id == first.id

    later_state = create_trace(
        db_session,
        company_id=company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        compliance_check_id=None,
        intelligence=_intelligence("b" * 64),
    )
    db_session.commit()

    repeated_state = create_trace(
        db_session,
        company_id=company_id,
        project_id=project_id,
        contractor_id=contractor_id,
        compliance_check_id=None,
        intelligence=_intelligence("a" * 64),
    )
    assert repeated_state.id != first.id
    assert repeated_state.id != later_state.id
