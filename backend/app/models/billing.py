from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BillingProvider(str, Enum):
    STRIPE = "stripe"
    PAYSTACK = "paystack"
    FLUTTERWAVE = "flutterwave"


class SubscriptionStatus(str, Enum):
    INCOMPLETE = "incomplete"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    PAUSED = "paused"


class BillingPlan(Base):
    __tablename__ = "billing_plans"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    amount_minor: Mapped[int] = mapped_column(Integer, default=0)
    interval: Mapped[str] = mapped_column(String(20), default="monthly")
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    stripe_amount_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    paystack_plan_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paystack_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    paystack_amount_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flutterwave_plan_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flutterwave_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    flutterwave_amount_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active: Mapped[bool] = mapped_column(default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingCustomer(Base):
    __tablename__ = "billing_customers"
    __table_args__ = (UniqueConstraint("company_id", "provider", name="uq_billing_customer_provider"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    provider: Mapped[BillingProvider] = mapped_column(String(30), index=True)
    provider_customer_id: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingSubscription(Base):
    __tablename__ = "billing_subscriptions"
    __table_args__ = (UniqueConstraint("company_id", "provider", "provider_subscription_id", name="uq_billing_subscription_provider"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[UUID] = mapped_column(ForeignKey("billing_plans.id", ondelete="RESTRICT"), index=True)
    provider: Mapped[BillingProvider] = mapped_column(String(30), index=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    provider_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[SubscriptionStatus] = mapped_column(String(30), default=SubscriptionStatus.INCOMPLETE, index=True)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(default=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BillingPayment(Base):
    __tablename__ = "billing_payments"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    subscription_id: Mapped[UUID | None] = mapped_column(ForeignKey("billing_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    provider: Mapped[BillingProvider] = mapped_column(String(30), index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    amount_minor: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"
    __table_args__ = (UniqueConstraint("provider", "event_id", name="uq_billing_webhook_event"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    provider: Mapped[BillingProvider] = mapped_column(String(30), index=True)
    event_id: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[str] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
