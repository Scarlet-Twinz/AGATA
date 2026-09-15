from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.models.billing import BillingPlan, BillingProvider


class BillingProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class CheckoutResult:
    authorization_url: str
    provider_reference: str | None = None
    provider_customer_id: str | None = None
    provider_subscription_id: str | None = None


class BillingAdapter:
    provider: BillingProvider

    def __init__(self) -> None:
        self.settings = get_settings()

    async def create_checkout(self, *, email: str, plan: BillingPlan, company_id: str) -> CheckoutResult:
        raise NotImplementedError

    def verify_webhook(self, *, body: bytes, headers: dict[str, str]) -> bool:
        raise NotImplementedError


class StripeAdapter(BillingAdapter):
    provider = BillingProvider.STRIPE

    async def create_checkout(self, *, email: str, plan: BillingPlan, company_id: str) -> CheckoutResult:
        if not self.settings.stripe_secret_key or not plan.stripe_price_id:
            raise BillingProviderError("Stripe is not configured for this plan")
        data = {"mode": "subscription", "customer_email": email, "line_items[0][price]": plan.stripe_price_id, "line_items[0][quantity]": "1", "success_url": f"{self.settings.frontend_url}/billing?checkout=success", "cancel_url": f"{self.settings.frontend_url}/billing?checkout=cancelled", "metadata[company_id]": company_id, "metadata[plan_code]": plan.code}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post("https://api.stripe.com/v1/checkout/sessions", data=data, auth=(self.settings.stripe_secret_key, ""))
        if response.is_error:
            raise BillingProviderError(f"Stripe checkout failed: {response.text[:300]}")
        payload = response.json()
        return CheckoutResult(authorization_url=payload["url"], provider_reference=payload.get("id"))

    def verify_webhook(self, *, body: bytes, headers: dict[str, str]) -> bool:
        secret = self.settings.stripe_webhook_secret
        signature = headers.get("stripe-signature", "")
        if not secret or not signature:
            return False
        parts = dict(item.split("=", 1) for item in signature.split(",") if "=" in item)
        timestamp, digest = parts.get("t"), parts.get("v1")
        if not timestamp or not digest:
            return False
        signed = f"{timestamp}.{body.decode('utf-8')}".encode()
        expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, digest)


class PaystackAdapter(BillingAdapter):
    provider = BillingProvider.PAYSTACK

    async def create_checkout(self, *, email: str, plan: BillingPlan, company_id: str) -> CheckoutResult:
        if not self.settings.paystack_secret_key or not plan.paystack_plan_code:
            raise BillingProviderError("Paystack is not configured for this plan")
        data = {"email": email, "plan": plan.paystack_plan_code, "callback_url": f"{self.settings.frontend_url}/billing?checkout=success", "metadata": {"company_id": company_id, "plan_code": plan.code}}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post("https://api.paystack.co/transaction/initialize", json=data, headers={"Authorization": f"Bearer {self.settings.paystack_secret_key}"})
        if response.is_error:
            raise BillingProviderError(f"Paystack checkout failed: {response.text[:300]}")
        payload = response.json()
        if not payload.get("status"):
            raise BillingProviderError(payload.get("message", "Paystack checkout failed"))
        result = payload.get("data", {})
        return CheckoutResult(authorization_url=result["authorization_url"], provider_reference=result.get("reference"), provider_customer_id=result.get("customer_code"))

    def verify_webhook(self, *, body: bytes, headers: dict[str, str]) -> bool:
        secret, signature = self.settings.paystack_secret_key, headers.get("x-paystack-signature", "")
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)


class FlutterwaveAdapter(BillingAdapter):
    provider = BillingProvider.FLUTTERWAVE

    async def create_checkout(self, *, email: str, plan: BillingPlan, company_id: str) -> CheckoutResult:
        if not self.settings.flutterwave_secret_key or not plan.flutterwave_plan_id:
            raise BillingProviderError("Flutterwave is not configured for this plan")
        data = {"tx_ref": f"agata-{company_id}-{plan.code}", "amount": plan.amount_minor / 100, "currency": plan.currency, "redirect_url": f"{self.settings.frontend_url}/billing?checkout=success", "customer": {"email": email}, "payment_plan": plan.flutterwave_plan_id, "meta": {"company_id": company_id, "plan_code": plan.code}}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post("https://api.flutterwave.com/v3/payments", json=data, headers={"Authorization": f"Bearer {self.settings.flutterwave_secret_key}"})
        if response.is_error:
            raise BillingProviderError(f"Flutterwave checkout failed: {response.text[:300]}")
        payload = response.json(); result = payload.get("data", {})
        if payload.get("status") != "success" or not result.get("link"):
            raise BillingProviderError(payload.get("message", "Flutterwave checkout failed"))
        return CheckoutResult(authorization_url=result["link"], provider_reference=data["tx_ref"])

    def verify_webhook(self, *, body: bytes, headers: dict[str, str]) -> bool:
        expected, supplied = self.settings.flutterwave_webhook_secret_hash, headers.get("verif-hash", "")
        return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def get_adapter(provider: BillingProvider) -> BillingAdapter:
    return {BillingProvider.STRIPE: StripeAdapter, BillingProvider.PAYSTACK: PaystackAdapter, BillingProvider.FLUTTERWAVE: FlutterwaveAdapter}[provider]()


def webhook_event_id(provider: BillingProvider, payload: dict) -> str:
    if provider == BillingProvider.STRIPE:
        return str(payload.get("id") or hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest())
    if provider == BillingProvider.PAYSTACK:
        data = payload.get("data") or {}
        return str(data.get("reference") or hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest())
    return str(payload.get("id") or (payload.get("data") or {}).get("id") or hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest())
