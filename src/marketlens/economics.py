"""U.S. Amazon FBA unit economics (port of the deterministic parts of notebook 03).

At training time, weight and landed cost had random product-level noise. For a new product we use the expected
value (no noise), or the seller's own numbers when they provide them.
"""
import re

import numpy as np

BULKY = (r"television|televisions|refrigerator|washingmachine|airconditioner|airfryer|microwave|ovens|waterheater|"
         r"smarttelevision|\btv\b|monitors|printers|laptop|vacuum|purifier|geyser|roomheater|heaters|fans|cooler|"
         r"dishwasher|watercooler|inverter")
SMALL = (r"cable|charger|adapter|case|cover|screenprotector|memory|microsd|card|stylus|pen|mouse|remote|battery|"
         r"batteries|tape|stand|mount|earbud|in-ear|earphone|strap|gel|cleaning|notebook|paper|clip|bulb|usb")
SIZE_TIERS = ["small_standard", "large_standard", "large_standard_heavy", "large_bulky"]
BASE_WEIGHT_LB = {"small_standard": 0.35, "large_standard": 1.4, "large_standard_heavy": 6.5, "large_bulky": 28.0}
BASE_CUBIC_FT = {"small_standard": 0.04, "large_standard": 0.25, "large_standard_heavy": 1.1, "large_bulky": 6.0}
TIERED_REFERRAL = {"Cell Phones & Accessories", "Electronics - Audio", "Electronics - Accessories",
                   "Computer Accessories & Peripherals"}
INBOUND_FREIGHT_PER_LB = 0.45
LOW_PRICE_FBA_DISCOUNT = 0.77


def infer_size_tier(leaf_text: str, price: float) -> str:
    leaf = leaf_text.lower()
    is_bulky, is_small = bool(re.search(BULKY, leaf)), bool(re.search(SMALL, leaf))
    if is_bulky and price >= 120:
        return "large_bulky"
    if is_bulky or price >= 150:
        return "large_standard_heavy"
    if is_small and price < 60:
        return "small_standard"
    return "large_standard"


def estimate_weight_lb(tier: str, price: float, tier_median_price: float) -> float:
    return round(BASE_WEIGHT_LB[tier] * float(np.clip((price / tier_median_price) ** 0.25, 0.6, 1.8)), 2)


def cubic_ft(tier: str, weight_lb: float) -> float:
    return round(BASE_CUBIC_FT[tier] * weight_lb / BASE_WEIGHT_LB[tier], 3)


def fba_fee(tier: str, weight_lb: float, price: float) -> float:
    """Approximation of the 2025 U.S. FBA fulfilment fee per unit, incl. Low-Price FBA rates under $10."""
    w = weight_lb
    if tier == "small_standard":
        fee = 3.15 if w <= 0.25 else 3.40 if w <= 0.5 else 3.62 if w <= 0.75 else 3.92
    elif tier == "large_bulky":
        fee = 9.61 + 0.38 * max(w - 1, 0)
    else:
        fee = 4.75 if w <= 1 else 5.62 if w <= 2 else 6.30 if w <= 3 else 6.92 + 0.16 * np.ceil((w - 3) * 2)
    fee = round(fee, 2)
    return round(fee - LOW_PRICE_FBA_DISCOUNT, 2) if price < 10 else fee


def referral_fee(price: float, rate: float, category: str) -> float:
    """Electronics-accessory categories: 15% up to $100 and 8% above. Minimum $0.30."""
    fee = 0.15 * min(price, 100) + 0.08 * max(price - 100, 0) if category in TIERED_REFERRAL else price * rate
    return round(max(fee, 0.30), 2)


def landed_cost(price: float, cogs_rate: float, brand_listing_count: int, weight_lb: float) -> float:
    brand_eff = float(np.clip(1.06 - 0.04 * np.log1p(brand_listing_count), 0.85, 1.05))
    return round(price * cogs_rate * brand_eff + INBOUND_FREIGHT_PER_LB * weight_lb, 2)


def launch_fixed_cost(price: float) -> float:
    return float(round(np.clip(1500 + 18 * price, 1500, 10000)))
