ALTER TABLE billing_plans
    ADD COLUMN IF NOT EXISTS stripe_currency VARCHAR(8),
    ADD COLUMN IF NOT EXISTS stripe_amount_minor INTEGER,
    ADD COLUMN IF NOT EXISTS flutterwave_currency VARCHAR(8),
    ADD COLUMN IF NOT EXISTS flutterwave_amount_minor INTEGER,
    ADD COLUMN IF NOT EXISTS paystack_currency VARCHAR(8),
    ADD COLUMN IF NOT EXISTS paystack_amount_minor INTEGER;

-- Provider prices are deliberately separate from AGATA's canonical USD catalog.
-- Paystack/Flutterwave test plans created for the Nigerian test environment use NGN.
UPDATE billing_plans
SET paystack_currency = 'NGN', paystack_amount_minor = 3850000,
    flutterwave_currency = 'NGN', flutterwave_amount_minor = 3850000
WHERE code = 'professional';

UPDATE billing_plans
SET paystack_currency = 'NGN', paystack_amount_minor = 10500000,
    flutterwave_currency = 'NGN', flutterwave_amount_minor = 10500000
WHERE code = 'business';

UPDATE billing_plans
SET paystack_currency = 'NGN', paystack_amount_minor = 38500000,
    flutterwave_currency = 'NGN', flutterwave_amount_minor = 38500000
WHERE code = 'professional_annual';

UPDATE billing_plans
SET paystack_currency = 'NGN', paystack_amount_minor = 105000000,
    flutterwave_currency = 'NGN', flutterwave_amount_minor = 105000000
WHERE code = 'business_annual';

UPDATE billing_plans
SET stripe_currency = currency, stripe_amount_minor = amount_minor
WHERE stripe_amount_minor IS NULL;

-- Flutterwave TEST payment-plan IDs supplied from the dashboard.
UPDATE billing_plans SET flutterwave_plan_id = '243468svg' WHERE code = 'professional';
UPDATE billing_plans SET flutterwave_plan_id = '243469svg' WHERE code = 'business';
UPDATE billing_plans SET flutterwave_plan_id = '243470svg' WHERE code = 'professional_annual';
UPDATE billing_plans SET flutterwave_plan_id = '243471svg' WHERE code = 'business_annual';

-- Paystack TEST plan pricing already created for the same NGN test catalog.
UPDATE billing_plans SET paystack_plan_code = 'PLN_0hhw0b2yq17qfbo' WHERE code = 'professional';
UPDATE billing_plans SET paystack_plan_code = 'PLN_esj08gef6lai571' WHERE code = 'business';
UPDATE billing_plans SET paystack_plan_code = 'PLN_5mtf7tsjd12g4jv' WHERE code = 'professional_annual';
UPDATE billing_plans SET paystack_plan_code = 'PLN_j8gxqjatd4m85r9' WHERE code = 'business_annual';
