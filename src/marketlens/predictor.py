"""MarketLens predictor: one entry point the backend/API calls.

    from marketlens import MarketLensPredictor, ProductInput
    p = MarketLensPredictor()
    p.predict_launch(ProductInput(category="Cell Phones & Accessories", price=29.99, review_count=1200, months_on_market=10))
    p.predict_next_month("B07JW9H4J1")
    p.predict_year("B07JW9H4J1", 2026)
"""
import json
from functools import cached_property
from typing import Optional, Union

import joblib
import numpy as np
import pandas as pd

from . import config
from .features import (ProductInput, build_next_month_features, build_product_features, build_year_features,
                       category_info)
from .models import load_bundles, predict_target

# target -> (label, unit, can_be_negative)
LAUNCH_METRICS = {
    "units_sold_12m": ("Units sold, first 12 months", "units", False),
    "demand_units_12m": ("Demand, first 12 months", "units", False),
    "avg_monthly_demand_12m": ("Average monthly demand, first 12 months", "units/month", False),
    "demand_share_pct_12m": ("Share of category demand, first 12 months", "%", False),
    "avg_price_12m": ("Average selling price, first 12 months", "USD", False),
    "revenue_12m": ("Revenue, first 12 months", "USD", False),
    "profit_12m": ("Net profit, first 12 months", "USD", True),
    "margin_pct_12m": ("Profit margin, first 12 months", "%", True),
    "roi_pct_12m": ("ROI, first 12 months", "%", True),
    "units_sold_24m": ("Units sold, first 24 months", "units", False),
    "revenue_24m": ("Revenue, first 24 months", "USD", False),
    "profit_24m": ("Net profit, first 24 months", "USD", True),
    "margin_pct_24m": ("Profit margin, first 24 months", "%", True),
    "roi_pct_24m": ("ROI, first 24 months", "%", True),
    "break_even_months": ("Months to break even", "months", False),
}
MONTHLY_METRICS = {
    "units_sold": ("Units sold", "units", False),
    "demand_units": ("Demand", "units", False),
    "demand_share_pct": ("Share of category demand", "%", False),
    "avg_price": ("Average selling price", "USD", False),
    "gross_revenue": ("Revenue", "USD", False),
    "net_profit": ("Net profit", "USD", True),
    "profit_margin_pct": ("Profit margin", "%", True),
    "roi_unit_pct": ("ROI per unit", "%", True),
    "roi_cum_pct": ("Cumulative ROI since launch", "%", True),
}
YEARLY_METRICS = {
    "units_sold": ("Units sold", "units", False),
    "demand_units": ("Demand", "units", False),
    "demand_share_pct": ("Share of category demand", "%", False),
    "avg_price": ("Average selling price", "USD", False),
    "gross_revenue": ("Revenue", "USD", False),
    "net_profit": ("Net profit", "USD", True),
    "profit_margin_pct": ("Profit margin", "%", True),
    "roi_year_pct": ("ROI earned this year", "%", True),
    "roi_cum_pct": ("Cumulative ROI since launch", "%", True),
}


RELATIVE_UNITS = {"units", "units/month", "USD", "months"}


def _direction(change_pct: float) -> str:
    return "increase" if change_pct > 2 else "decrease" if change_pct < -2 else "stable"


class MarketLensPredictor:
    def __init__(self, models_dir=None):
        self.models_dir = models_dir or config.MODELS
        self.bundles = load_bundles(self.models_dir)
        self.ref = json.loads(config.INFERENCE_REFERENCE.read_text())
        self.encoders = joblib.load(self.models_dir / "product_track_record_encoders.joblib")
        self.calendar = pd.read_csv(config.REFERENCE / "us_retail_calendar.csv", parse_dates=["month"])

    # ------------------------------------------------------------------ data (loaded on first use)
    @cached_property
    def monthly_history(self) -> pd.DataFrame:
        parts = [pd.read_csv(config.FINAL / f, parse_dates=["month"]) for f in ("monthly_train.csv", "monthly_test.csv")]
        return pd.concat(parts, ignore_index=True).sort_values(["product_id", "month"])

    @cached_property
    def yearly_history(self) -> pd.DataFrame:
        parts = [pd.read_csv(config.FINAL / f) for f in ("yearly_train.csv", "yearly_test.csv", "yearly_2026_partial.csv")]
        return pd.concat(parts, ignore_index=True).sort_values(["product_id", "year"])

    def products(self) -> pd.DataFrame:
        """Catalogue products available for monthly / yearly forecasts."""
        h = self.monthly_history
        return h.groupby("product_id").agg(product_name=("product_name", "first"), us_category=("us_category", "first"),
                                           last_month=("month", "max")).reset_index()

    # ------------------------------------------------------------------ helpers
    def _format(self, level: str, metrics: dict, X: pd.DataFrame) -> dict:
        out = {}
        for target, (label, unit, signed) in metrics.items():
            value = float(predict_target(self.bundles, level, target, X)[0])
            key = f"{level}/{target}"
            if unit in RELATIVE_UNITS or "share" in target:   # scale-dependent: typical % error applied to this value
                rel = self.ref["relative_error"].get(key)
                err = rel * abs(value) if rel is not None else None
            else:                                               # margins / ROI / growth in % points: absolute error
                err = self.ref["typical_error"].get(key)
            lo = value - err if err is not None else None
            if lo is not None and not signed:
                lo = max(lo, 0.0)
            out[target] = {"label": label, "value": round(value, 2), "unit": unit,
                           "plus_minus": round(err, 2) if err is not None else None,
                           "range": [round(lo, 2), round(value + err, 2)] if err is not None else None}
        return out

    # ------------------------------------------------------------------ public API
    def predict_launch(self, product: Union[ProductInput, dict]) -> dict:
        """First 12/24-month performance, break-even and payback risk for a product (listing or new idea)."""
        if isinstance(product, dict):
            product = ProductInput(**product)
        X = build_product_features(product, self.ref, self.encoders)
        preds = self._format("product", LAUNCH_METRICS, X)
        be = preds["break_even_months"]
        be["display"] = (f"{config.BREAK_EVEN_CAP_MONTHS}+ months" if be["value"] >= config.BREAK_EVEN_CAP_MONTHS - 0.5
                         else f"~{be['value']:.0f} months")
        risk = float(predict_target(self.bundles, "product", "never_breaks_even", X)[0])
        preds["never_breaks_even"] = {"label": "Chance it never pays back", "value": round(risk * 100, 1), "unit": "%",
                                      "risk_level": "low" if risk < 0.2 else "medium" if risk < 0.5 else "high"}
        x = X.iloc[0]
        return {
            "type": "launch",
            "input": product.__dict__,
            "unit_economics": {"fba_fee": float(x.fba_fee_unit), "referral_fee": float(x.referral_fee_unit),
                               "landed_cost": float(x.landed_cost_unit), "est_weight_lb": float(x.ship_weight_lb), "size_tier": x.size_tier,
                               "launch_fixed_cost": float(x.launch_fixed_cost), "pre_ad_unit_margin_pct": float(x.unit_margin_pct)},
            "predictions": preds,
            "notes": ["Estimates are based on simulated U.S. market data; plus_minus is the model's typical error on unseen test data."],
        }

    def predict_next_month(self, product_id: str, promo_depth_pct: Optional[float] = None, everyday_price: Optional[float] = None) -> dict:
        """Forecast for the month after the product's latest month of history.

        promo_depth_pct: a planned discount (%) for that month. If None, the price model forecasts the expected selling
        price (it has learned the usual Prime Day / BFCM discounting) and the other models use that same price.
        """
        h = self.monthly_history[self.monthly_history.product_id == product_id]
        if h.empty:
            raise KeyError(f"Unknown product_id {product_id!r}")
        cat = category_info(self.ref, h.us_category.iloc[0])
        build = lambda promo: build_next_month_features(h, self.calendar, cat["ratings_per_order"], cat["price_drift_yr"], promo, everyday_price)
        planned = promo_depth_pct is not None
        if planned:
            X = build(float(promo_depth_pct))
        else:   # expected promo implied by the price model's forecast
            X0 = build(0.0)
            expected_price = float(predict_target(self.bundles, "monthly", "avg_price", X0)[0])
            promo_depth_pct = round(float(np.clip((1 - expected_price / X0.everyday_price.iloc[0]) * 100, 0, 50)), 1)
            X = build(promo_depth_pct)
        preds = self._format("monthly", MONTHLY_METRICS, X)
        if planned:   # the seller sets the price, so it is known exactly
            preds["avg_price"].update(value=round(float(X.avg_price.iloc[0]), 2), plus_minus=0.0,
                                      range=[round(float(X.avg_price.iloc[0]), 2)] * 2, source="planned")
        # Demand trend: the demand forecast compared with last month's actual demand
        last_demand = float(X.demand_units_lag1.iloc[0])
        change = (preds["demand_units"]["value"] / last_demand - 1) * 100 if last_demand > 0 else 0.0
        trend = {"label": "Demand trend vs last month", "direction": _direction(change),
                 "last_month_demand": round(last_demand), "direction_accuracy_pct": self.ref["trend_accuracy"]["monthly_direction_pct"]}
        return {"type": "next_month", "product_id": product_id, "product_name": h.product_name.iloc[0],
                "month": X.month.iloc[0].strftime("%Y-%m"), "promo_depth_pct": promo_depth_pct,
                "promo_source": "planned by seller" if planned else "expected from history",
                "predictions": preds, "demand_trend": trend, "notes": []}

    def predict_year(self, product_id: str, year: int = 2026, promo_months: Optional[int] = None) -> dict:
        """Full-year forecast for a calendar year (needs the previous year's history)."""
        yh = self.yearly_history[self.yearly_history.product_id == product_id]
        if yh.empty:
            raise KeyError(f"Unknown product_id {product_id!r}")
        X, notes = build_year_features(yh, year, promo_months)
        preds = self._format("yearly", YEARLY_METRICS, X)
        # Year-over-year demand change: the yearly demand forecast compared with last year's demand
        prev_demand, prev_months = float(X.demand_units_prev_year.iloc[0]), int(X.months_active_prev_year.iloc[0])
        acc = self.ref["trend_accuracy"]
        if prev_months == 12 and int(X.months_active.iloc[0]) == 12 and prev_demand > 0:
            change = (preds["demand_units"]["value"] / prev_demand - 1) * 100
            yoy = {"label": "Demand change vs last year", "value": round(change, 1), "unit": "%", "direction": _direction(change),
                   "plus_minus": acc["yearly_change_mae_pts"], "last_year_demand": round(prev_demand),
                   "direction_accuracy_pct": acc["yearly_direction_pct"]}
        else:
            yoy = {"label": "Demand change vs last year", "value": None, "unit": "%", "direction": None,
                   "last_year_demand": round(prev_demand)}
            notes.append("Year-over-year change needs two full years of sales; not available for this product/year.")
        return {"type": "year", "product_id": product_id, "product_name": yh.product_name.iloc[0], "year": year,
                "months_active": int(X.months_active.iloc[0]), "predictions": preds, "demand_change_yoy": yoy, "notes": notes}
