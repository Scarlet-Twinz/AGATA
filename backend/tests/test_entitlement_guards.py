from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.entities import Contractor
from app.services import entitlement_guards


class FakeSession:
    def __init__(self, *new_objects):
        self.new = list(new_objects)


def test_entitlement_guard_blocks_new_resource_at_limit(monkeypatch) -> None:
    company_id = uuid4()
    contractor = Contractor(company_id=company_id, name="Contractor at limit")
    monkeypatch.setattr(
        entitlement_guards,
        "_active_plan",
        lambda _session, _company_id: type("Plan", (), {"code": "foundation", "name": "AGATA Foundation"})(),
    )
    monkeypatch.setattr(entitlement_guards, "_current_count", lambda *_args: 10)

    with pytest.raises(HTTPException) as exc_info:
        entitlement_guards.enforce_entitlements_before_flush(FakeSession(contractor), None, None)

    assert exc_info.value.status_code == 403
    assert "Contractors limit reached" in exc_info.value.detail


def test_entitlement_guard_allows_new_resource_below_limit(monkeypatch) -> None:
    company_id = uuid4()
    contractor = Contractor(company_id=company_id, name="New contractor")
    monkeypatch.setattr(
        entitlement_guards,
        "_active_plan",
        lambda _session, _company_id: type("Plan", (), {"code": "foundation", "name": "AGATA Foundation"})(),
    )
    monkeypatch.setattr(entitlement_guards, "_current_count", lambda *_args: 9)

    entitlement_guards.enforce_entitlements_before_flush(FakeSession(contractor), None, None)
