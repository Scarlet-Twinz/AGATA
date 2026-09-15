CREATE TABLE IF NOT EXISTS billing_plans (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    amount_minor INTEGER NOT NULL DEFAULT 0,
    interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    stripe_price_id VARCHAR(255),
    paystack_plan_code VARCHAR(255),
    flutterwave_plan_id VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    provider_customer_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_customer_provider UNIQUE (company_id, provider)
);
CREATE INDEX IF NOT EXISTS ix_billing_customers_company_id ON billing_customers(company_id);
CREATE INDEX IF NOT EXISTS ix_billing_customers_provider ON billing_customers(provider);
CREATE INDEX IF NOT EXISTS ix_billing_customers_provider_customer_id ON billing_customers(provider_customer_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL,
    provider_subscription_id VARCHAR(255),
    provider_customer_id VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'incomplete',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_subscription_provider UNIQUE (company_id, provider, provider_subscription_id)
);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_company_id ON billing_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_plan_id ON billing_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_provider ON billing_subscriptions(provider);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_provider_subscription_id ON billing_subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_provider_customer_id ON billing_subscriptions(provider_customer_id);
CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_status ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_payments (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(30) NOT NULL,
    provider_payment_id VARCHAR(255),
    amount_minor INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_billing_payments_company_id ON billing_payments(company_id);
CREATE INDEX IF NOT EXISTS ix_billing_payments_subscription_id ON billing_payments(subscription_id);
CREATE INDEX IF NOT EXISTS ix_billing_payments_provider ON billing_payments(provider);
CREATE INDEX IF NOT EXISTS ix_billing_payments_provider_payment_id ON billing_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS ix_billing_payments_status ON billing_payments(status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id UUID PRIMARY KEY,
    provider VARCHAR(30) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    payload TEXT NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_webhook_event UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS ix_billing_webhook_events_provider ON billing_webhook_events(provider);

INSERT INTO billing_plans (id, code, name, description, currency, amount_minor, interval, active)
SELECT '00000000-0000-0000-0000-000000000001', 'foundation', 'AGATA Foundation', 'Core AGATA workspace capabilities. Pricing is configured before paid launch.', 'USD', 0, 'monthly', TRUE
WHERE NOT EXISTS (SELECT 1 FROM billing_plans WHERE code = 'foundation');
