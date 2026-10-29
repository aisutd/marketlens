"""Build model feature rows (ports of the feature logic in notebooks 03, 04, 06 and 07).

- build_product_features: a product description from the user -> one launch/investment feature row
- build_next_month_features: a product's monthly history -> the feature row for the following month
- build_year_features: a product's yearly history -> the feature row for a given calendar year
"""
import re
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from . import economics as eco
from .cleaning import BUNDLE, snap_99
from .config import DISCOUNT_CAP_PCT, ECOMMERCE_GROWTH_YR

PRICE_TIERS = ([0, 10, 25, 50, 100, 250, 1e6], ["<$10", "$10-25", "$25-50", "$50-100", "$100-250", "$250+"])
RATING_BANDS = ([0, 3.5, 3.8, 4.0, 4.2, 4.4, 5], ["<3.5", "3.5-3.8", "3.8-4.0", "4.0-4.2", "4.2-4.4", "4.4+"])


@dataclass
class ProductInput:
    """What a user enters to evaluate a product (a listing to invest in, or a new idea benchmarked on a competitor).

    review_count / months_on_market: the listing's own numbers, or those of a comparable competitor for a new idea.
    Optional fields are estimated from category averages when left empty.
    """
    category: str                       # U.S. category, e.g. "Cell Phones & Accessories"
    price: float                        # everyday selling price, USD
    review_count: int                   # star ratings on the listing (or comparable competitor)
    months_on_market: int               # months since the listing (or competitor) launched
    list_price: Optional[float] = None  # reference / strikethrough price
    sub_category: str = ""              # leaf category, e.g. "USBCables", "ElectricKettles"
    brand: str = ""
    name: str = ""
    rating: float = 4.2
    review_sentiment: Optional[float] = None
    n_bullets: Optional[int] = None
    about_len: Optional[int] = None
    size_tier: Optional[str] = None     # small_standard | large_standard | large_standard_heavy | large_bulky
    weight_lb: Optional[float] = None
    landed_cost: Optional[float] = None # manufacturing + freight + duties per unit
    launch_month: Optional[int] = None  # 1-12
    is_bundle: Optional[bool] = None


def _slug(v: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "_", v).strip("_")


def _band(value: float, bins_labels) -> str:
    bins, labels = bins_labels
    return str(pd.cut([value], bins, labels=labels)[0])


def one_hot(row: dict, category_groups: list) -> dict:
    vocab = {"category_group": category_groups + ["Other"] if "Other" not in category_groups else category_groups,
             "size_tier": eco.SIZE_TIERS, "price_tier": PRICE_TIERS[1], "rating_band": RATING_BANDS[1]}
    return {f"{col}__{_slug(v)}": int(row[col] == v) for col, values in vocab.items() for v in values}


def category_info(ref: dict, category: str) -> dict:
    for c in ref["categories"]:
        if c["us_category"] == category:
            return c
    raise ValueError(f"Unknown category {category!r}. Choose one of: {[c['us_category'] for c in ref['categories']]}")


def build_product_features(p: ProductInput, ref: dict, encoders: dict) -> pd.DataFrame:
    """One feature row for the product launch / investment models."""
    cat = category_info(ref, p.category)
    d = ref["defaults"]
    price = float(p.price)
    list_price = float(p.list_price) if p.list_price else price
    orig_discount = max(0.0, (1 - price / list_price) * 100)
    if orig_discount > DISCOUNT_CAP_PCT:   # U.S. reference-price rule from cleaning
        list_price = float(snap_99(pd.Series([price / (1 - DISCOUNT_CAP_PCT / 100)])).iloc[0])
    discount = max(0.0, round((1 - price / list_price) * 100, 2))

    leaf_text = f"{p.sub_category} {p.name}"
    tier = p.size_tier or eco.infer_size_tier(leaf_text, price)
    weight = p.weight_lb or eco.estimate_weight_lb(tier, price, ref["tier_median_price"][tier])
    brand_count = int(ref["brand_listing_counts"].get(p.brand, 1))
    landed = p.landed_cost or eco.landed_cost(price, cat["cogs_rate"], brand_count, weight)
    fba = eco.fba_fee(tier, weight, price)
    referral = eco.referral_fee(price, cat["referral_rate"], p.category)
    fixed = eco.launch_fixed_cost(price)

    rating = float(p.rating)
    sentiment = d["review_sentiment"] if p.review_sentiment is None else float(p.review_sentiment)
    n_bullets = d["n_bullets"] if p.n_bullets is None else int(p.n_bullets)
    about_len = d["about_len"] if p.about_len is None else int(p.about_len)
    lq = ref["listing_quality"]
    zs = {k: (v - lq["stats"][k]["mean"]) / lq["stats"][k]["std"] for k, v in
          {"log_about_len": np.log1p(about_len), "n_bullets_clip12": min(n_bullets, 12), "rating": rating, "review_sentiment": sentiment}.items()}
    lq_raw = zs["log_about_len"] + zs["n_bullets_clip12"] + 1.5 * zs["rating"] + 0.5 * zs["review_sentiment"]
    quality = round(float(np.clip((lq_raw - lq["lq_min"]) / (lq["lq_max"] - lq["lq_min"]) * 100, 0, 100)), 1)

    is_bundle = p.is_bundle if p.is_bundle is not None else bool(re.search(BUNDLE, p.name, flags=re.I))
    launch_month = p.launch_month or pd.Timestamp.today().month
    row = {
        "us_category": p.category, "brand": p.brand, "cat_leaf": p.sub_category,
        "category_group": p.category if p.category in ref["category_groups"] else "Other",
        "size_tier": tier, "price_tier": _band(price, PRICE_TIERS), "rating_band": _band(rating, RATING_BANDS),
        "log_price_usd": np.log1p(price), "log_list_price_usd": np.log1p(list_price), "discount_pct": discount,
        "deep_discount_listing": int(orig_discount > DISCOUNT_CAP_PCT), "rating": rating, "review_sentiment": sentiment,
        "listing_quality_score": quality, "log_brand_listing_count": np.log1p(brand_count), "is_bundle": int(is_bundle),
        "cat_depth": d["cat_depth"], "name_len": len(p.name) if p.name else d["name_len"], "n_bullets": n_bullets,
        "log_ship_weight_lb": np.log1p(weight), "cubic_ft": eco.cubic_ft(tier, weight), "log_fba_fee_unit": np.log1p(fba),
        "log_landed_cost_unit": np.log1p(landed), "referral_rate": cat["referral_rate"], "return_rate": cat["return_rate"],
        "tacos_rate": cat["tacos_rate"], "price_elasticity": cat["price_elasticity"],
        "fee_share_of_price": round((fba + referral) / price, 4), "cost_share_of_price": round(landed / price, 4),
        "unit_margin_pct": round((price - referral - fba - landed) / price * 100, 2),
        "launch_month": launch_month, "log_launch_fixed_cost": np.log1p(fixed),
        # market traction (listing or comparable competitor)
        "log_rating_count": np.log1p(p.review_count), "log_listing_age": np.log1p(p.months_on_market),
        "log_reviews_per_month": np.log1p(p.review_count) - np.log1p(p.months_on_market),
        # category market size for the demand-share composite
        "cat_market_size_12m": ref["category_market_size_recent12"].get(p.category, np.nan),
        # unit economics, returned to the user as context
        "fba_fee_unit": fba, "referral_fee_unit": referral, "landed_cost_unit": landed, "ship_weight_lb": weight,
        "launch_fixed_cost": fixed,
    }
    row["log_cat_market_size"] = np.log1p(row["cat_market_size_12m"])
    for name, (key, enc, prior) in encoders["encoders"].items():
        if name.startswith(("brand_te", "leaf_te")):
            row[name] = float(enc.get({"brand": p.brand, "cat_leaf": p.sub_category}[key], prior))
    row.update(one_hot(row, ref["category_groups"] + ["Other"]))
    return pd.DataFrame([row])


# ----------------------------------------------------------------------------------------------- calendar
def calendar_row(month: pd.Timestamp, calendar: pd.DataFrame) -> dict:
    """U.S. retail calendar flags and macro index for a month (extrapolated beyond the calendar file)."""
    month = pd.Timestamp(month)
    hit = calendar[calendar.month == month]
    if len(hit):
        r = hit.iloc[0]
        flags = {k: int(r[k]) for k in ["is_prime_day", "is_prime_big_deal_days", "is_bfcm", "is_holiday_peak", "is_back_to_school"]}
        macro = float(r.macro_index)
    else:
        y, m = month.year, month.month
        flags = {"is_prime_day": int(m == {2020: 10, 2021: 6}.get(y, 7)), "is_prime_big_deal_days": int(m == 10 and y >= 2022),
                 "is_bfcm": int(m == 11), "is_holiday_peak": int(m == 12), "is_back_to_school": int(m == 8)}
        last = calendar.iloc[-1]
        months_ahead = (y - last.month.year) * 12 + m - last.month.month
        macro = float(last.macro_index * ECOMMERCE_GROWTH_YR ** (months_ahead / 12))
    return {"month_of_year": month.month, "moy_sin": np.sin(2 * np.pi * month.month / 12), "moy_cos": np.cos(2 * np.pi * month.month / 12),
            "year": month.year, **flags, "macro_index": macro}


# ----------------------------------------------------------------------------------------------- monthly
def build_next_month_features(history: pd.DataFrame, calendar: pd.DataFrame, ratings_per_order: float, price_drift_yr: float,
                              promo_depth_pct: float = 0.0, everyday_price: Optional[float] = None) -> pd.DataFrame:
    """Feature row for the month after the last row of `history` (one product, monthly rows from data/final, sorted)."""
    h = history.sort_values("month").reset_index(drop=True)
    last = h.iloc[-1]
    month = pd.Timestamp(last.month) + pd.DateOffset(months=1)
    row = {c: last[c] for c in h.columns if not c.endswith(("_lag1", "_lag2", "_lag3", "_lag12", "_mean", "_std", "3v12"))}
    row.update(calendar_row(month, calendar))
    row["month"] = month

    age = int(last.age_months) + 1
    everyday = everyday_price if everyday_price is not None else float(last.everyday_price) * (1 + price_drift_yr) ** (1 / 12)
    avg_price = everyday * (1 - promo_depth_pct / 100)
    row.update({"age_months": age, "log_age_months": np.log1p(age), "is_launch_phase": int(age < 6),
                "promo_flag": int(promo_depth_pct > 0), "promo_depth_pct": promo_depth_pct, "everyday_price": everyday,
                "avg_price": avg_price, "log_avg_price": np.log(avg_price), "price_vs_everyday": avg_price / everyday})

    def back(col, k):   # value k months before the new month (k=1 -> last observed month)
        return float(h[col].iloc[-k]) if len(h) >= k else np.nan
    for col in ["units_sold", "demand_units", "avg_price", "net_profit", "gross_revenue"]:
        for k in (1, 2, 3, 12):
            row[f"{col}_lag{k}"] = back(col, k)
    for col in ["profit_margin_pct", "demand_share_pct"]:
        for k in (1, 12):
            row[f"{col}_lag{k}"] = back(col, k)
    for col in ["units_sold", "demand_units", "net_profit"]:
        for w in (3, 6, 12):
            row[f"{col}_roll{w}_mean"] = float(h[col].iloc[-w:].mean())
    row["units_roll3_std"] = float(h.units_sold.iloc[-3:].std()) if len(h) >= 2 else np.nan
    row["units_trend_3v12"] = row["units_sold_roll3_mean"] / row["units_sold_roll12_mean"] if row["units_sold_roll12_mean"] else np.nan

    cum_units = float(last.cum_units_sold_lag1) + float(last.units_sold)
    row["cum_units_sold_lag1"] = cum_units
    row["reviews_to_date_lag1"] = float(round(cum_units * ratings_per_order))
    row["cum_net_profit_lag1"] = float(last.cum_net_profit_lag1) + float(last.net_profit)
    row["roi_cum_pct_lag1"] = float(last.roi_cum_pct)
    return pd.DataFrame([row])


# ----------------------------------------------------------------------------------------------- yearly
OBS_PARTIAL_YEAR = 2026   # the simulated history ends in Sep 2026


PREV_YEAR_FIELDS = ["units_sold", "demand_units", "gross_revenue", "net_profit", "profit_margin_pct", "avg_price"]


def build_year_features(yearly: pd.DataFrame, year: int, promo_months: Optional[int] = None,
                        prev_override: Optional[dict] = None) -> tuple[pd.DataFrame, list]:
    """Feature row for `year` (one product, yearly rows from data/final). Returns (row, notes).

    prev_override: full-year figures to use for the previous year (e.g. its forecast when that year is only
    partly observed). Without it, a partly observed previous year is annualised linearly.
    """
    y = yearly.sort_values("year").set_index("year")
    notes = []
    if year - 1 not in y.index:
        raise ValueError(f"Need the product's {year - 1} figures to forecast {year}; available years: {list(y.index)}")
    last = y.iloc[-1]
    launch_year = int(last.name - last.years_since_launch)
    prev = y.loc[year - 1].copy()
    if prev_override is not None:
        for c in PREV_YEAR_FIELDS:
            prev[c] = prev_override[c]
        prev["months_active"] = 12
    elif year - 1 == OBS_PARTIAL_YEAR and prev.months_active < 12 and launch_year < OBS_PARTIAL_YEAR:
        scale = 12 / prev.months_active
        for c in ["units_sold", "demand_units", "gross_revenue", "net_profit"]:
            prev[c] = prev[c] * scale
        prev["months_active"] = 12
        notes.append(f"{year - 1} only has {int(12 / scale)} months of data; it was annualised to a full year.")
    row = {c: last[c] for c in yearly.columns if c not in ("year",)}
    months_active = 12 if launch_year < year else 13 - int(last.launch_month)
    row.update({"year": year, "years_since_launch": year - launch_year, "months_active": months_active,
                "is_partial_year": int(months_active < 12),
                "promo_months": promo_months if promo_months is not None else int(round(prev.promo_months * 12 / max(prev.months_active, 1)))})
    for c in PREV_YEAR_FIELDS:
        row[f"{c}_prev_year"] = float(prev[c])
    row["months_active_prev_year"] = int(prev.months_active)
    return pd.DataFrame([row]), notes
