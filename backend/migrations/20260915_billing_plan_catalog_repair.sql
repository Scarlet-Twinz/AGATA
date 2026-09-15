-- Repair the billing catalog for development/test databases where the original
-- billing seed was already marked as applied but paid plan rows are missing.
-- Keep AGATA's canonical catalog in USD; provider-specific test plan identifiers
-- are mapped independently below.

INSERT INTO billing_plans (id, code, name, description, currency, amount_minor, interval, active, paystack_plan_code)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'foundation', 'AGATA Foundation', 'Free workspace for getting started with compliance readiness, core evidence tracking, deterministic readiness, Rumi guidance, and audit history.', 'USD', 0, 'monthly', TRUE, NULL),
    ('00000000-0000-0000-0000-000000000002', 'professional', 'AGATA Professional', 'For growing contractor and project teams: full readiness intelligence, Decision Lens, Decision Impact, History, Replay, Rumi, notifications, remediation, audit trail, and operational reporting.', 'USD', 2900, 'monthly', TRUE, 'PLN_0hhw0b2yq17qfbo'),
    ('00000000-0000-0000-0000-000000000003', 'business', 'AGATA Business', 'For larger teams: expanded workspace capacity, advanced decision intelligence, team controls, analytics, reporting, and API-ready operations.', 'USD', 7900, 'monthly', TRUE, 'PLN_esj08gef6lai571'),
    ('00000000-0000-0000-0000-000000000004', 'professional_annual', 'AGATA Professional Annual', 'Professional plan billed annually with two months free compared with monthly billing.', 'USD', 29000, 'yearly', TRUE, 'PLN_5mtf7tsjd12g4jv'),
    ('00000000-0000-0000-0000-000000000005', 'business_annual', 'AGATA Business Annual', 'Business plan billed annually with two months free compared with monthly billing.', 'USD', 79000, 'yearly', TRUE, 'PLN_j8gxqjatd4m85r9')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    currency = EXCLUDED.currency,
    amount_minor = EXCLUDED.amount_minor,
    interval = EXCLUDED.interval,
    active = EXCLUDED.active,
    paystack_plan_code = EXCLUDED.paystack_plan_code;
