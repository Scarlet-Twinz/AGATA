-- Repair billing plans for databases where the original billing migration was
-- recorded as applied before all launch pricing rows existed.
-- Paystack plan codes below are provider identifiers, not API secrets.
INSERT INTO billing_plans (id, code, name, description, currency, amount_minor, interval, paystack_plan_code, active)
VALUES
    ('00000000-0000-0000-0000-000000000002', 'professional', 'AGATA Professional', 'For growing contractor and project teams: full readiness intelligence, Decision Lens, Decision Impact, History, Replay, Rumi, notifications, remediation, audit trail, and operational reporting.', 'USD', 2900, 'monthly', 'PLN_0hhw0b2yq17qfbo', TRUE),
    ('00000000-0000-0000-0000-000000000003', 'business', 'AGATA Business', 'For larger teams: expanded workspace capacity, advanced decision intelligence, team controls, analytics, reporting, and API-ready operations.', 'USD', 7900, 'monthly', 'PLN_esj08gef6lai571', TRUE),
    ('00000000-0000-0000-0000-000000000004', 'professional_annual', 'AGATA Professional Annual', 'Professional plan billed annually with two months free compared with monthly billing.', 'USD', 29000, 'yearly', 'PLN_5mtf7tsjd12g4jv', TRUE),
    ('00000000-0000-0000-0000-000000000005', 'business_annual', 'AGATA Business Annual', 'Business plan billed annually with two months free compared with monthly billing.', 'USD', 79000, 'yearly', 'PLN_j8gxqjatd4m85r9', TRUE)
ON CONFLICT (code) DO UPDATE SET
    paystack_plan_code = EXCLUDED.paystack_plan_code,
    active = EXCLUDED.active;
