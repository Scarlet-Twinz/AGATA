import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.evidence_intelligence import EvidenceIntelligenceUpdate, _computed_state
from app.models.entities import Document
from app.models.evidence_intelligence import EvidenceIntelligence


def make_document(**overrides):
    values = {
        "name": "Test certificate",
        "document_type": "certificate",
        "status": "active",
        "expires_at": None,
    }
    values.update(overrides)
    return Document(**values)


def make_intelligence(**overrides):
    values = {
        "verification_status": "verified",
        "review_status": "approved",
    }
    values.update(overrides)
    return EvidenceIntelligence(**values)


def test_unverified_evidence_is_not_valid():
    assert _computed_state(make_document(), make_intelligence(verification_status="unverified"), True) == "unverified"


def test_rejected_evidence_is_rejected():
    assert _computed_state(make_document(), make_intelligence(verification_status="rejected"), True) == "rejected"


def test_expired_evidence_is_expired():
    expiry = datetime.now(timezone.utc) - timedelta(days=1)
    assert _computed_state(make_document(expires_at=expiry), make_intelligence(), True) == "expired"


def test_expiring_evidence_is_expiring():
    expiry = datetime.now(timezone.utc) + timedelta(days=10)
    assert _computed_state(make_document(expires_at=expiry), make_intelligence(), True) == "expiring"


def test_verified_unmapped_evidence_is_unmapped():
    assert _computed_state(make_document(), make_intelligence(), False) == "unmapped"


def test_verified_mapped_pending_review_requires_review():
    assert _computed_state(make_document(), make_intelligence(review_status="pending"), True) == "requires_review"


def test_verified_mapped_approved_evidence_is_valid():
    assert _computed_state(make_document(), make_intelligence(), True) == "valid"


def test_inactive_evidence_is_inactive():
    assert _computed_state(make_document(status="inactive"), make_intelligence(), True) == "inactive"


def test_rejection_payload_requires_reason():
    with pytest.raises(ValueError):
        EvidenceIntelligenceUpdate(verification_status="rejected")

    payload = EvidenceIntelligenceUpdate(
        verification_status="rejected",
        rejection_reason="Document could not be verified.",
    )
    assert payload.rejection_reason == "Document could not be verified."
