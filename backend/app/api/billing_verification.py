from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import BillingPayment, BillingPlan, BillingProvider, BillingSubscription, SubscriptionStatus
from app.models.entities import User
from app.services.billing import BillingProviderError, FlutterwaveAdapter, StripeAdapter
from app.services.rbac import require_permission

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _payload(plan: BillingPlan) -> dict:
    return {"code": plan.code, "name": plan.name, "description": plan.description, "currency": plan.currency, "amount_minor": plan.amount_minor, "interval": plan.interval, "active": plan.active}


def _activate(db: Session, *, user: User, plan: BillingPlan, provider: BillingProvider, provider_customer_id: str | None, provider_subscription_id: str | None, payment_id: str, amount_minor: int, currency: str) -> BillingSubscription:
    subscription = None
    if provider_subscription_id:
        subscription = db.scalar(select(BillingSubscription).where(BillingSubscription.company_id == user.company_id, BillingSubscription.provider == provider, BillingSubscription.provider_subscription_id == provider_subscription_id))
    if subscription is None:
        subscription = db.scalar(select(BillingSubscription).where(BillingSubscription.company_id == user.company_id, BillingSubscription.provider == provider).order_by(BillingSubscription.created_at.desc()))
    if subscription is None:
        subscription = BillingSubscription(company_id=user.company_id, plan_id=plan.id, provider=provider, provider_subscription_id=provider_subscription_id, provider_customer_id=provider_customer_id, status=SubscriptionStatus.ACTIVE)
        db.add(subscription)
        db.flush()
    else:
        subscription.plan_id = plan.id
        subscription.status = SubscriptionStatus.ACTIVE
        if provider_customer_id:
            subscription.provider_customer_id = provider_customer_id
        if provider_subscription_id:
            subscription.provider_subscription_id = provider_subscription_id

    existing = db.scalar(select(BillingPayment).where(BillingPayment.provider == provider, BillingPayment.provider_payment_id == payment_id))
    if existing is None:
        db.add(BillingPayment(company_id=user.company_id, subscription_id=subscription.id, provider=provider, provider_payment_id=payment_id, amount_minor=amount_minor, currency=currency.upper(), status="paid", paid_at=datetime.now(timezone.utc)))
    db.commit()
    return subscription


@router.get("/stripe/verify/{session_id}")
async def verify_stripe_checkout(session_id: str, db: Session = Depends(get_db), user: User = Depends(require_permission("billing.manage"))):
    try:
        session = await StripeAdapter().verify_checkout_session(session_id)
    except BillingProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if session.get("status") != "complete" or session.get("payment_status") != "paid":
        raise HTTPException(status_code=402, detail="Stripe Checkout session has not completed successfully")
    if session.get("mode") != "subscription":
        raise HTTPException(status_code=400, detail="Stripe session is not a subscription checkout")

    metadata = session.get("metadata") or {}
    if str(metadata.get("company_id") or "") != str(user.company_id):
        raise HTTPException(status_code=403, detail="Stripe checkout session does not belong to this workspace")

    plan_code = str(metadata.get("plan_code") or "")
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == plan_code, BillingPlan.active.is_(True)))
    if plan is None or not plan.stripe_price_id:
        raise HTTPException(status_code=400, detail="Stripe checkout session is not mapped to an active AGATA plan")

    line_items = session.get("line_items") or {}
    items = line_items.get("data") or []
    price_ids = {str(item.get("price", {}).get("id")) for item in items if isinstance(item.get("price"), dict)}
    if price_ids and plan.stripe_price_id not in price_ids:
        raise HTTPException(status_code=400, detail="Stripe price does not match the selected AGATA plan")

    amount = int(session.get("amount_total") or 0)
    currency = str(session.get("currency") or "").upper()
    expected_amount = plan.stripe_amount_minor if plan.stripe_amount_minor is not None else plan.amount_minor
    expected_currency = (plan.stripe_currency or plan.currency).upper()
    if amount != expected_amount or currency != expected_currency:
        raise HTTPException(status_code=400, detail="Stripe amount or currency does not match the selected AGATA plan")

    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    subscription = _activate(db, user=user, plan=plan, provider=BillingProvider.STRIPE, provider_customer_id=str(customer_id) if customer_id else None, provider_subscription_id=str(subscription_id) if subscription_id else None, payment_id=session_id, amount_minor=amount, currency=currency)
    return {"verified": True, "provider": BillingProvider.STRIPE, "reference": session_id, "plan": _payload(plan), "subscription_status": subscription.status}


@router.get("/flutterwave/verify/{transaction_id}")
async def verify_flutterwave_checkout(transaction_id: str, db: Session = Depends(get_db), user: User = Depends(require_permission("billing.manage"))):
    try:
        data = await FlutterwaveAdapter().verify_transaction(transaction_id)
    except BillingProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if str(data.get("status", "")).lower() != "successful":
        raise HTTPException(status_code=402, detail="Flutterwave transaction has not completed successfully")

    metadata = data.get("meta") or data.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    if str(metadata.get("company_id") or "") != str(user.company_id):
        raise HTTPException(status_code=403, detail="Flutterwave transaction does not belong to this workspace")

    plan_code = str(metadata.get("plan_code") or "")
    plan = db.scalar(select(BillingPlan).where(BillingPlan.code == plan_code, BillingPlan.active.is_(True)))
    if plan is None or not plan.flutterwave_plan_id:
        raise HTTPException(status_code=400, detail="Flutterwave transaction is not mapped to an active AGATA plan")

    amount = float(data.get("amount") or 0)
    expected_amount_minor = plan.flutterwave_amount_minor if plan.flutterwave_amount_minor is not None else plan.amount_minor
    expected_amount = expected_amount_minor / 100
    expected_currency = (plan.flutterwave_currency or plan.currency).upper()
    currency = str(data.get("currency") or "").upper()
    if amount < expected_amount or currency != expected_currency:
        raise HTTPException(status_code=400, detail="Flutterwave amount or currency does not match the selected AGATA plan")

    payment_id = str(data.get("id") or transaction_id)
    customer = data.get("customer")
    customer_id = customer.get("id") if isinstance(customer, dict) else None
    subscription = _activate(db, user=user, plan=plan, provider=BillingProvider.FLUTTERWAVE, provider_customer_id=str(customer_id) if customer_id else None, provider_subscription_id=None, payment_id=payment_id, amount_minor=int(round(amount * 100)), currency=currency)
    return {"verified": True, "provider": BillingProvider.FLUTTERWAVE, "reference": payment_id, "plan": _payload(plan), "subscription_status": subscription.status}
