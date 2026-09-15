from __future__ import annotations

from collections import Counter

from fastapi import HTTPException
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models.entities import Contractor, Document, Project
from app.models.workspace import WorkspaceMembership
from app.services.entitlements import ENTITLEMENTS, _active_plan

_RESOURCE_MODELS = {
    "projects": Project,
    "contractors": Contractor,
    "evidence": Document,
    "users": WorkspaceMembership,
}


def _current_count(session: Session, model, company_id) -> int:
    query = select(func.count(model.id)).where(model.company_id == company_id)
    if model is WorkspaceMembership:
        query = query.where(model.status == "active")
    return int(session.scalar(query) or 0)


def enforce_entitlements_before_flush(session: Session, _flush_context, _instances) -> None:
    pending: Counter[tuple[str, object]] = Counter()
    for obj in session.new:
        for resource, model in _RESOURCE_MODELS.items():
            if isinstance(obj, model):
                company_id = getattr(obj, "company_id", None)
                if company_id is not None and (resource != "users" or getattr(obj, "status", "active") == "active"):
                    pending[(resource, company_id)] += 1
                break

    for (resource, company_id), pending_count in pending.items():
        try:
            plan = _active_plan(session, company_id)
        except RuntimeError:
            # Keep legacy/test databases usable until the billing seed migration runs.
            continue
        limits = ENTITLEMENTS.get(plan.code, ENTITLEMENTS["foundation"])
        limit = getattr(limits, resource)
        existing_count = _current_count(session, _RESOURCE_MODELS[resource], company_id)
        if existing_count + pending_count > limit:
            raise HTTPException(
                status_code=403,
                detail=f"{resource.title()} limit reached for {plan.name}. Upgrade your AGATA plan to continue.",
            )


event.listen(Session, "before_flush", enforce_entitlements_before_flush)
