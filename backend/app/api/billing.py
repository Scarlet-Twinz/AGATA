from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.billing import BillingCustomer, BillingPayment, BillingPlan, BillingProvider, BillingSubscription, BillingWebhookEvent, SubscriptionStatus
from app.models.entities import User
from app.services.billing import BillingProviderError, get_adapter, webhook_event_id
from app.services.entitlements import workspace_entitlements
from app.services.rbac import require_permission

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=80)
    provider: BillingProvider | None = None


def _provider_plan_id(plan: BillingPlan, provider: BillingProvider) -> str | None:
    return {BillingProvider.STRIPE: plan.stripe_price_id, BillingProvider.PAYSTACK: plan.paystack_plan_code, BillingProvider.FLUTTERWAVE: plan.flutterwave_plan_id}[provider]


def _plan_payload(plan: BillingPlan) -> dict:
    return {"code": plan.code, "name": plan.name, "description": plan.description, "currency": plan.currency, "amount_minor": plan.amount_minor, "interval": plan.interval, "active": plan.active}


def _subscription_payload(item: BillingSubscription, plan: BillingPlan) -> dict:
    return {"id": str(item.id), "provider": item.provider, "plan": _plan_payload(plan), "status": item.status, "current_period_start": item.current_period_start, "current_period_end": item.current_period_end, "cancel_at_period_end": item.cancel_at_period_end}


def _paystack_plan_code(data: dict, metadata: dict) -> str | None:
    if metadata.get("plan_code"):
        return str(metadata["plan_code"])
    provider_plan = data.get("plan")
    if isinstance(provider_plan, dict):
        code = provider_plan.get("plan_code") or provider_plan.get("plan_code_id")
        if code:
            return str(code)
    if provider_plan:
        return str(provider_plan)
    return None


def _provider_customer_id(data: dict) -> str | None:
    customer = data.get("customer")
    if isinstance(customer, dict):
        customer = customer.get("customer_code") or customer.get("id")
    return str(customer) if customer else None


def _provider_subscription_id(data: dict, provider: BillingProvider) -> str | None:
    subscription = data.get("subscription") or data.get("subscription_code")
    if isinstance(subscription, dict):
        subscription = subscription.get("subscription_code") or subscription.get("id")
    if provider == BillingProvider.STRIPE and data.get("object") == "subscription":
        subscription = data.get("id")
    return str(subscription) if subscription else None


@router.get("/plans")
def list_plans(db: Session = Depends(get_db), _: User = Depends(require_permission("billing.view"))):
    plans = db.scalars(select(BillingPlan).where(BillingPlan.active.is_(True)).order_by(BillingPlan.amount_minor.asc(), BillingPlan.interval.asc())).all()
    return [{**_plan_payload(plan), "provider_ready": {provider.value: bool(_provider_plan_id(plan, provider)) for provider in BillingProvider}} for plan in plans]


@router.get("")
def billing_summary(db: Session = Depends(get_db), user: User = Depends(require_permission("billing.view"))):
    subscriptions = db.scalars(select(BillingSubscription).where(BillingSubscription.company_id == user.company_id).order_by(BillingSubscription.created_at.desc())).all()
    payments = db.scalars(select(BillingPayment).where(BillingPayment.company_id == user.company_id).order_by(BillingPayment.created_at.desc()).limit(20)).all()
    result = []
    for item in subscriptions:
        plan = db.get(BillingPlan, item.plan_id)
        if plan:
            result.append(_subscription_payload(item, plan))
    return {"provider": get_settings().billing_default_provider, "subscriptions": result, "payments": [{"id": str(p.id), "provider": p.provider, "amount_minor": p.amount_minor, "currency": p.currency, "status": p.status, "paid_at": p.paid_at, "created_at": p.created_at} for p in payments]}


@router.get("/entitlements")
def billing_entitlements(db: Session = Depends(get_db), user: User = Depends(require_permission("billing.view"))):
    return workspace_entitlements(db, user.company_id)


@router.post("/checkout")
async def create_checkout(payload: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(require_permission("billing.manage"))):
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == payload.plan_code, BillingPlan.active.is_(True)))
    if not plan:
        raise HTTPException(status_code=404, detail="Billing plan not found")
    provider = payload.provider or BillingProvider(get_settings().billing_default_provider)
    if plan.amount_minor > 0 and not _provider_plan_id(plan, provider):
        raise HTTPException(status_code=409, detail=f"{provider.value.title()} recurring plan is not configured for {plan.code}")
    try:
        result = await get_adapter(provider).create_checkout(email=user.email, plan=plan, company_id=str(user.company_id))
    except BillingProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if result.provider_customer_id:
        customer = db.scalar(select(BillingCustomer).where(BillingCustomer.company_id == user.company_id, BillingCustomer.provider == provider))
        if customer is None:
            db.add(BillingCustomer(company_id=user.company_id, provider=provider, provider_customer_id=result.provider_customer_id, email=user.email))
        else:
            customer.provider_customer_id = result.provider_customer_id
            customer.email = user.email
        db.commit()

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
    if db.scalar(select(BillingWebhookEvent).where(BillingWebhookEvent.provider == provider, BillingWebhookEvent.event_id == event_id)):
        return {"received": True, "duplicate": True}
    event = BillingWebhookEvent(provider=provider, event_id=event_id, event_type=event_type, payload=body.decode("utf-8"))
    db.add(event)

    data = payload.get("data") or {}
    metadata = data.get("metadata") or data.get("meta") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    company_id = None
    if metadata.get("company_id"):
        try:
            company_id = UUID(str(metadata["company_id"]))
        except ValueError:
            pass

    provider_customer_id = _provider_customer_id(data)
    if company_id is None and provider_customer_id:
        customer = db.scalar(select(BillingCustomer).where(BillingCustomer.provider == provider, BillingCustomer.provider_customer_id == provider_customer_id))
        if customer:
            company_id = customer.company_id

    plan_code = metadata.get("plan_code")
    if provider == BillingProvider.PAYSTACK:
        plan_code = _paystack_plan_code(data, metadata) or plan_code
    plan = None
    if plan_code:
        plan = db.scalar(select(BillingPlan).where(BillingPlan.code == str(plan_code)))
    if plan is None and provider == BillingProvider.PAYSTACK:
        provider_plan_code = _paystack_plan_code(data, {})
        if provider_plan_code:
            plan = db.scalar(select(BillingPlan).where(BillingPlan.paystack_plan_code == provider_plan_code))

    provider_subscription_id = _provider_subscription_id(data, provider)
    if provider_customer_id and company_id:
        customer = db.scalar(select(BillingCustomer).where(BillingCustomer.company_id == company_id, BillingCustomer.provider == provider))
        if customer is None:
            db.add(BillingCustomer(company_id=company_id, provider=provider, provider_customer_id=provider_customer_id, email=str(data.get("email") or "")))
        elif customer.provider_customer_id != provider_customer_id:
            customer.provider_customer_id = provider_customer_id

    active_events = {"checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "invoice.paid", "subscription.create", "charge.success", "payment.completed"}
    failed_events = {"invoice.payment_failed", "subscription.not_renew"}
    canceled_events = {"customer.subscription.deleted", "subscription.disable"}

    if company_id and (event_type in active_events or event_type in failed_events or event_type in canceled_events):
        subscription = None
        if provider_subscription_id:
            subscription = db.scalar(select(BillingSubscription).where(BillingSubscription.company_id == company_id, BillingSubscription.provider == provider, BillingSubscription.provider_subscription_id == provider_subscription_id))
        if subscription is None:
            subscription = db.scalar(select(BillingSubscription).where(BillingSubscription.company_id == company_id, BillingSubscription.provider == provider).order_by(BillingSubscription.created_at.desc()))

        if event_type in active_events:
            if subscription is None and plan:
                subscription = BillingSubscription(company_id=company_id, plan_id=plan.id, provider=provider, provider_subscription_id=provider_subscription_id, provider_customer_id=provider_customer_id, status=SubscriptionStatus.ACTIVE)
                db.add(subscription)
                db.flush()
            elif subscription:
                subscription.status = SubscriptionStatus.ACTIVE
                if provider_customer_id:
                    subscription.provider_customer_id = provider_customer_id
                if plan and subscription.plan_id != plan.id:
                    subscription.plan_id = plan.id
                if provider_subscription_id and not subscription.provider_subscription_id:
                    subscription.provider_subscription_id = provider_subscription_id

            if event_type in {"charge.success", "payment.completed", "invoice.paid"} and subscription:
                amount = int(data.get("amount") or data.get("amount_total") or (plan.amount_minor if plan else 0))
                currency = str(data.get("currency") or (plan.currency if plan else "USD")).upper()
                payment_id = str(data.get("reference") or data.get("id") or event_id)
                existing_payment = db.scalar(select(BillingPayment).where(BillingPayment.provider == provider, BillingPayment.provider_payment_id == payment_id))
                if existing_payment is None:
                    db.add(BillingPayment(company_id=company_id, subscription_id=subscription.id, provider=provider, provider_payment_id=payment_id, amount_minor=amount, currency=currency, status="paid", paid_at=datetime.now(timezone.utc)))
        elif subscription:
            subscription.status = SubscriptionStatus.CANCELED if event_type in canceled_events else SubscriptionStatus.PAST_DUE
            if event_type == "subscription.not_renew":
                subscription.cancel_at_period_end = True

    event.processed_at = datetime.now(timezone.utc)
    db.commit()
    return {"received": True}
