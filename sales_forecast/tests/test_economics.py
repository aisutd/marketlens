import pytest

from marketlens import economics as eco


@pytest.mark.parametrize("leaf, price, tier", [
    ("USBCables", 9.99, "small_standard"),
    ("SmartTelevisions", 399.0, "large_bulky"),
    ("Fans", 39.0, "large_standard_heavy"),
    ("ElectricKettles", 24.0, "large_standard"),
    ("Anything", 199.0, "large_standard_heavy"),
])
def test_size_tier_rules(leaf, price, tier):
    assert eco.infer_size_tier(leaf, price) == tier


def test_fba_fee_tiers_and_low_price_discount():
    assert eco.fba_fee("small_standard", 0.2, 12.0) == 3.15
    assert eco.fba_fee("small_standard", 0.2, 8.0) == round(3.15 - 0.77, 2)   # Low-Price FBA under $10
    assert eco.fba_fee("large_standard", 1.5, 30.0) == 5.62
    assert eco.fba_fee("large_bulky", 21.0, 300.0) == round(9.61 + 0.38 * 20, 2)


def test_referral_fee_tiered_minimum_and_flat():
    assert eco.referral_fee(200, 0.15, "Electronics - Audio") == round(0.15 * 100 + 0.08 * 100, 2)
    assert eco.referral_fee(1.0, 0.15, "Office Products") == 0.30
    assert eco.referral_fee(50, 0.08, "Camera & Photo") == 4.0


def test_launch_fixed_cost_bounds():
    assert eco.launch_fixed_cost(1) == 1518
    assert eco.launch_fixed_cost(5000) == 10000
