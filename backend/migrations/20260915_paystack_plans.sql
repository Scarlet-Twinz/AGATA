-- Configure the Paystack recurring plans created in Paystack Test Mode.
-- These are provider plan identifiers, not API secrets.
UPDATE billing_plans SET paystack_plan_code = 'PLN_0hhw0b2yq17qfbo' WHERE code = 'professional';
UPDATE billing_plans SET paystack_plan_code = 'PLN_esj08gef6lai571' WHERE code = 'business';
UPDATE billing_plans SET paystack_plan_code = 'PLN_5mtf7tsjd12g4jv' WHERE code = 'professional_annual';
UPDATE billing_plans SET paystack_plan_code = 'PLN_j8gxqjatd4m85r9' WHERE code = 'business_annual';
