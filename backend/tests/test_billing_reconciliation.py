from app.api.billing import _paystack_plan_code, _provider_customer_id, _provider_subscription_id
from app.models.billing import BillingProvider


def test_paystack_plan_code_prefers_metadata():
    assert _paystack_plan_code(
        {"plan": {"plan_code": "PLN_provider"}},
        {"plan_code": "business"},
    ) == "business"


def test_paystack_plan_code_falls_back_to_provider_plan():
    assert _paystack_plan_code(
        {"plan": {"plan_code": "PLN_provider"}},
        {},
    ) == "PLN_provider"


def test_provider_customer_id_normalizes_paystack_customer_object():
    assert _provider_customer_id({"customer": {"customer_code": "CUS_123"}}) == "CUS_123"


def test_provider_subscription_id_normalizes_paystack_subscription_object():
    assert _provider_subscription_id(
        {"subscription": {"subscription_code": "SUB_123"}},
        BillingProvider.PAYSTACK,
    ) == "SUB_123"


def test_stripe_subscription_id_uses_subscription_object_id():
    assert _provider_subscription_id(
        {"object": "subscription", "id": "sub_123"},
        BillingProvider.STRIPE,
    ) == "sub_123"
