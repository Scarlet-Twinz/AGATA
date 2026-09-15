from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.billing import BillingPlan, BillingSubscription, SubscriptionStatus
from app.models.entities import Contractor, Document, Project, User


@dataclass(frozen=True)
class PlanEntitlements:
    users: int
    projects: int
    contractors: int
    evidence: int


ENTITLEMENTS: dict[str, PlanEntitlements] = {
    "foundation": PlanEntitlements(users=2, projects=2, contractors=10, evidence=25),
    "professional": PlanEntitlements(users=5, projects=10, contractors=50, evidence=250),
    "professional_annual": PlanEntitlements(users=5, projects=10, contractors=50, evidence=250),
    "business": PlanEntitlements(users=15, projects=50, contractors=250, evidence=2500),
    "business_annual": PlanEntitlements(users=15, projects=50, contractors=250, evidence=2500),
}


def _active_plan(db: Session, company_id: UUID) -> BillingPlan:
    subscription = db.scalar(
        select(BillingSubscription)
        .where(
            BillingSubscription.company_id == company_id,
            BillingSubscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]),
        )
        .order_by(BillingSubscription.created_at.desc())
    )
    if subscription:
        plan = db.get(BillingPlan, subscription.plan_id)
        if plan:
            return plan
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == "foundation"))
    if plan is None:
        raise RuntimeError("AGATA Foundation billing plan is not configured")
    return plan


def workspace_entitlements(db: Session, company_id: UUID) -> dict:
    plan = _active_plan(db, company_id)
    limits = ENTITLEMENTS.get(plan.code, ENTITLEMENTS["foundation"])
    counts = {
        "users": db.scalar(select(func.count(User.id)).where(User.company_id == company_id)) or 0,
        "projects": db.scalar(select(func.count(Project.id)).where(Project.company_id == company_id)) or 0,
        "contractors": db.scalar(select(func.count(Contractor.id)).where(Contractor.company_id == company_id)) or 0,
        "evidence": db.scalar(select(func.count(Document.id)).where(Document.company_id == company_id)) or 0,
    }
    return {
        "plan": {"code": plan.code, "name": plan.name, "interval": plan.interval},
        "limits": {"users": limits.users, "projects": limits.projects, "contractors": limits.contractors, "evidence": limits.evidence},
        "usage": counts,
        "remaining": {key: max(0, getattr(limits, key) - value) for key, value in counts.items()},
        "at_limit": {key: value >= getattr(limits, key) for key, value in counts.items()},
    }


def check_limit(db: Session, company_id: UUID, resource: str, current_count: int) -> None:
    plan = _active_plan(db, company_id)
    limits = ENTITLEMENTS.get(plan.code, ENTITLEMENTS["foundation"])
    limit = getattr(limits, resource, None)
    if limit is not None and current_count >= limit:
        raise ValueError(f"{resource.title()} limit reached for {plan.name}. Upgrade your AGATA plan to continue.")
