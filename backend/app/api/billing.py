from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.billing import BillingPayment, BillingPlan, BillingProvider, BillingSubscription, BillingWebhookEvent, SubscriptionStatus
from app.models.entities import User
from app.services.billing import BillingProviderError, get_adapter, webhook_event_id
from app.services.rbac import require_permission

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=80)
    provider: BillingProvider | None = None


def _plan_payload(plan: BillingPlan) -> dict:
    return {"code": plan.code, "name": plan.name, "description": plan.description, "currency": plan.currency, "amount_minor": plan.amount_minor, "interval": plan.interval, "active": plan.active}


def _subscription_payload(item: BillingSubscription, plan: BillingPlan) -> dict:
    return {"id": str(item.id), "provider": item.provider, "plan": _plan_payload(plan), "status": item.status, "current_period_start": item.current_period_start, "current_period_end": item.current_period_end, "cancel_at_period_end": item.cancel_at_period_end}


@router.get("/plans")
def list_plans(db: Session = Depends(get_db), _: User = Depends(require_permission("billing.view"))):
    return [_plan_payload(plan) for plan in db.scalars(select(BillingPlan).where(BillingPlan.active.is_(True)).order_by(BillingPlan.amount_minor.asc())).all()]


@router.get("")
def billing_summary(db: Session = Depends(get_db), user: User = Depends(require_permission("billing.view"))):
    subscriptions = db.scalars(select(BillingSubscription).where(BillingSubscription.company_id == user.company_id).order_by(BillingSubscription.created_at.desc())).all()
    payments = db.scalars(select(BillingPayment).where(BillingPayment.company_id == user.company_id).order_by(BillingPayment.created_at.desc()).limit(20)).all()
    result = []
    for item in subscriptions:
        plan = db.get(BillingPlan, item.plan_id)
        if plan: result.append(_subscription_payload(item, plan))
    return {"provider": get_settings().billing_default_provider, "subscriptions": result, "payments": [{"id": str(p.id), "provider": p.provider, "amount_minor": p.amount_minor, "currency": p.currency, "status": p.status, "paid_at": p.paid_at, "created_at": p.created_at} for p in payments]}


@router.post("/checkout")
async def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(require_permission("billing.view"))):
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == payload.plan_code, BillingPlan.active.is_(True)))
    if not plan: raise HTTPException(status_code=404, detail="Billing plan not found")
    provider = payload.provider or BillingProvider(get_settings().billing_default_provider)
    try:
        result = await get_adapter(provider).create_checkout(email=user.email, plan=plan, company_id=str(user.company_id))
    except BillingProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"provider": provider, "authorization_url": result.authorization_url, "reference": result.provider_reference}


@router.post("/webhooks/{provider}", status_code=status.HTTP_200_OK)
async def receive_webhook(provider: BillingProvider, request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    adapter = get_adapter(provider)
    if not adapter.verify_webhook(body=body, headers={key.lower(): value for key, value in request.headers.items()}):
        raise HTTPException(status_code=401, detail="Invalid billing webhook signature")
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from exc
    event_id = webhook_event_id(provider, payload)
    event_type = str(payload.get("type") or payload.get("event") or "unknown")
    existing = db.scalar(select(BillingWebhookEvent).where(BillingWebhookEvent.provider == provider, BillingWebhookEvent.event_id == event_id))
    if existing:
        return {"received": True, "duplicate": True}
    event = BillingWebhookEvent(provider=provider, event_id=event_id, event_type=event_type, payload=body.decode("utf-8"))
    db.add(event)
    data = payload.get("data") or {}
    metadata = data.get("metadata") or data.get("meta") or {}
    company_id_raw = metadata.get("company_id")
    if company_id_raw:
        try: company_id = UUID(str(company_id_raw))
        except ValueError: company_id = None
    else: company_id = None

    plan_code = metadata.get("plan_code")
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == plan_code)) if plan_code else None
    provider_subscription_id = data.get("subscription") or data.get("subscription_code") or data.get("id")
    provider_customer_id = data.get("customer")
    if isinstance(provider_customer_id, dict): provider_customer_id = provider_customer_id.get("customer_code") or provider_customer_id.get("id")

    if company_id and plan and event_type in {"checkout.session.completed", "customer.subscription.created", "subscription.create", "charge.success", "payment.completed"}:
        subscription = db.scalar(select(BillingSubscription).where(BillingSubscription.company_id == company_id, BillingSubscription.provider == provider, BillingSubscription.provider_subscription_id == str(provider_subscription_id))) if provider_subscription_id else None
        if subscription is None:
            subscription = BillingSubscription(company_id=company_id, plan_id=plan.id, provider=provider, provider_subscription_id=str(provider_subscription_id) if provider_subscription_id else None, provider_customer_id=str(provider_customer_id) if provider_customer_id else None, status=SubscriptionStatus.ACTIVE)
            db.add(subscription)
        else:
            subscription.status = SubscriptionStatus.ACTIVE
        amount = int(data.get("amount") or data.get("amount_total") or plan.amount_minor)
        currency = str(data.get("currency") or plan.currency).upper()
        db.add(BillingPayment(company_id=company_id, subscription_id=subscription.id, provider=provider, provider_payment_id=str(data.get("reference") or data.get("id") or event_id), amount_minor=amount, currency=currency, status="paid", paid_at=datetime.now(timezone.utc)))

    if company_id and event_type in {"customer.subscription.deleted", "subscription.disable", "subscription.not_renew", "invoice.payment_failed", "invoice.payment_failed"}:
        query = select(BillingSubscription).where(BillingSubscription.company_id == company_id, BillingSubscription.provider == provider)
        if provider_subscription_id: query = query.where(BillingSubscription.provider_subscription_id == str(provider_subscription_id))
        subscription = db.scalar(query.order_by(BillingSubscription.created_at.desc()))
        if subscription: subscription.status = SubscriptionStatus.CANCELED if event_type in {"customer.subscription.deleted", "subscription.disable"} else SubscriptionStatus.PAST_DUE

    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return {"received": True}
