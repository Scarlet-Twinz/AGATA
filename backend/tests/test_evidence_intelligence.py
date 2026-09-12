import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.evidence_intelligence import _computed_state
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


def test_verified_unmapped_evidence_is_unmapped():
    assert _computed_state(make_document(), make_intelligence(), False) == "unmapped"


def test_verified_mapped_pending_review_requires_review():
    assert _computed_state(make_document(), make_intelligence(review_status="pending"), True) == "requires_review"


def test_verified_mapped_approved_evidence_is_valid():
    assert _computed_state(make_document(), make_intelligence(), True) == "valid"
