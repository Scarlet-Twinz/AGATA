-- Normalize Flutterwave TEST payment-plan IDs. The dashboard export may show
-- an SVG/icon suffix; the API expects the numeric plan ID only.
UPDATE billing_plans SET flutterwave_plan_id = '243468' WHERE code = 'professional';
UPDATE billing_plans SET flutterwave_plan_id = '243469' WHERE code = 'business';
UPDATE billing_plans SET flutterwave_plan_id = '243470' WHERE code = 'professional_annual';
UPDATE billing_plans SET flutterwave_plan_id = '243471' WHERE code = 'business_annual';
