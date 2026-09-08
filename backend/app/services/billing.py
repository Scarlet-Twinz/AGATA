from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class BillingStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"


@dataclass(frozen=True)
class CheckoutRequest:
    company_id: str
    plan_code: str
    currency: str
    success_url: str
    cancel_url: str


@dataclass(frozen=True)
class CheckoutSession:
    provider: str
    provider_reference: str
    checkout_url: str


class BillingProvider(Protocol):
    name: str

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        ...

    async def cancel_subscription(self, provider_subscription_id: str) -> None:
        ...


class BillingService:
    def __init__(self, provider: BillingProvider | None = None):
        self.provider = provider

    async def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        if self.provider is None:
            raise RuntimeError("No billing provider configured")
        return await self.provider.create_checkout(request)
