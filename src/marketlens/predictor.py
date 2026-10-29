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
from .features import (OBS_PARTIAL_YEAR, PREV_YEAR_FIELDS, ProductInput, build_next_month_features,
                       build_product_features, build_year_features, category_info)
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


def _set_value(metric: dict, value: float, signed: bool = False, plus_minus: Optional[float] = None) -> None:
    """Replace a metric's value (after a consistency rule) and recompute its range.
    Keeps the metric's typical error unless a derived one is given."""
    metric["value"] = round(float(value), 2)
    if plus_minus is not None:
        metric["plus_minus"] = round(float(plus_minus), 2)
    err = metric.get("plus_minus")
    if err is not None:
        lo = metric["value"] - err
        metric["range"] = [round(lo if signed else max(lo, 0.0), 2), round(metric["value"] + err, 2)]


def _cap_units_at_demand(preds: dict, units: str, demand: str) -> None:
    """You can't sell more than customers want: units sold <= demand."""
    if preds[units]["value"] > preds[demand]["value"]:
        _set_value(preds[units], preds[demand]["value"])


def _demand_at_least_units(preds: dict, units: str, demand: str) -> None:
    """Used where units sold is the more accurate figure: demand is raised to at least units sold."""
    if preds[demand]["value"] < preds[units]["value"]:
        _set_relative(preds[demand], preds[units]["value"], preds[demand])


def _set_relative(metric: dict, value: float, error_source: dict) -> None:
    """Set a derived value, keeping the same relative (%) uncertainty the metric had."""
    old = error_source["value"]
    rel = (error_source.get("plus_minus") or 0) / abs(old) if old else 0.0
    _set_value(metric, value, plus_minus=rel * abs(value))


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
        self._consistent_launch(preds)
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
        self._consistent_month(preds, X)
        # Demand trend: the demand forecast compared with last month's actual demand
        last_demand = float(X.demand_units_lag1.iloc[0])
        change = (preds["demand_units"]["value"] / last_demand - 1) * 100 if last_demand > 0 else 0.0
        trend = {"label": "Demand trend vs last month", "direction": _direction(change),
                 "last_month_demand": round(last_demand), "direction_accuracy_pct": self.ref["trend_accuracy"]["monthly_direction_pct"]}
        return {"type": "next_month", "product_id": product_id, "product_name": h.product_name.iloc[0],
                "month": X.month.iloc[0].strftime("%Y-%m"), "promo_depth_pct": promo_depth_pct,
                "promo_source": "planned by seller" if planned else "expected from history",
                "predictions": preds, "demand_trend": trend, "notes": []}

    @staticmethod
    def _consistent_launch(preds: dict) -> None:
        """Revenue and price are the most accurate launch models (test accuracy 92% / 94%), so units are derived from
        them (units = revenue / price: 92% vs 80% for the units model), and the rest follows."""
        if preds["revenue_24m"]["value"] < preds["revenue_12m"]["value"]:
            _set_relative(preds["revenue_24m"], preds["revenue_12m"]["value"], preds["revenue_24m"])
        price = preds["avg_price_12m"]["value"]
        if price > 0:
            for h in ("12m", "24m"):
                _set_relative(preds[f"units_sold_{h}"], preds[f"revenue_{h}"]["value"] / price, preds[f"units_sold_{h}"])
        _demand_at_least_units(preds, "units_sold_12m", "demand_units_12m")
        _set_relative(preds["avg_monthly_demand_12m"], preds["demand_units_12m"]["value"] / 12, preds["avg_monthly_demand_12m"])
        # profit_12m / profit_24m are already revenue × margin

    @staticmethod
    def _consistent_month(preds: dict, X: pd.DataFrame) -> None:
        """Units and price are predicted directly; revenue = units × price and profit = revenue × margin
        (both more accurate on test data than the separate revenue / profit models)."""
        _cap_units_at_demand(preds, "units_sold", "demand_units")
        revenue = preds["units_sold"]["value"] * preds["avg_price"]["value"]
        _set_relative(preds["gross_revenue"], revenue, preds["gross_revenue"])
        _set_relative(preds["net_profit"], revenue * preds["profit_margin_pct"]["value"] / 100, preds["net_profit"])
        # cumulative ROI = last month's cumulative ROI + this month's profit / capital invested
        cum_prev, cum_profit_prev = float(X.roi_cum_pct_lag1.iloc[0]), float(X.cum_net_profit_lag1.iloc[0])
        if abs(cum_prev) > 1 and cum_profit_prev / cum_prev > 0:
            capital = cum_profit_prev / cum_prev * 100
            _set_value(preds["roi_cum_pct"], cum_prev + preds["net_profit"]["value"] / capital * 100, signed=True,
                       plus_minus=(preds["net_profit"]["plus_minus"] or 0) / capital * 100)

    @staticmethod
    def _consistent_roi(preds: dict, yh: pd.DataFrame, X: pd.DataFrame, year: int, prev_cum_override: Optional[float] = None,
                        prev_cum_err: float = 0.0) -> None:
        """ROI = profit / capital invested. Capital is recovered from the product's own history
        (net_profit / roi_year_pct), so ROI moves with the profit forecast, and
        cumulative ROI = cumulative ROI at the end of last year + this year's ROI."""
        hist = yh[yh.roi_year_pct.abs() > 1]
        if hist.empty:
            return
        capital = float((hist.net_profit / hist.roi_year_pct * 100).median())
        if capital <= 0:
            return
        roi_year = preds["net_profit"]["value"] / capital * 100
        roi_err = (preds["net_profit"]["plus_minus"] or 0) / capital * 100     # ROI uncertainty follows profit's
        _set_value(preds["roi_year_pct"], roi_year, signed=True, plus_minus=roi_err)
        if prev_cum_override is not None:     # last year was itself forecast (partly observed year)
            prev_cum = prev_cum_override
        else:
            prev = yh[yh.year == year - 1].iloc[0]
            prev_cum = float(prev.roi_cum_pct)
        # past years are known; only forecast years add uncertainty
        _set_value(preds["roi_cum_pct"], prev_cum + roi_year, signed=True, plus_minus=prev_cum_err + roi_err)

    def predict_year(self, product_id: str, year: int = 2026, promo_months: Optional[int] = None) -> dict:
        """Full-year forecast for a calendar year (needs the previous year's history)."""
        yh = self.yearly_history[self.yearly_history.product_id == product_id]
        if yh.empty:
            raise KeyError(f"Unknown product_id {product_id!r}")
        # If last year is only partly observed (history ends Sep 2026), use its full-year forecast as "last year",
        # so the numbers chain together: this year's change, ROI and cumulative ROI build on that forecast.
        prev_override, prev_cum, prev_cum_err, extra_notes = None, None, 0.0, []
        prev_rows = yh[yh.year == year - 1]
        if (year - 1 == OBS_PARTIAL_YEAR and len(prev_rows) and prev_rows.months_active.iloc[0] < 12
                and (yh.year < OBS_PARTIAL_YEAR).any()):
            prev_fc = self.predict_year(product_id, year - 1, promo_months)["predictions"]
            prev_override = {k: prev_fc[k]["value"] for k in PREV_YEAR_FIELDS}
            prev_cum, prev_cum_err = prev_fc["roi_cum_pct"]["value"], prev_fc["roi_cum_pct"]["plus_minus"] or 0.0
            extra_notes.append(f"{year - 1} is only observed through September; its full-year forecast is used as last year.")
        X, notes = build_year_features(yh, year, promo_months, prev_override)
        notes = extra_notes + notes
        preds = self._format("yearly", YEARLY_METRICS, X)
        # Revenue, price and profit are the strongest yearly models: units = revenue / price (91% vs 86%),
        # margin = profit / revenue, demand >= units, and ROI follows profit.
        if preds["avg_price"]["value"] > 0:
            _set_relative(preds["units_sold"], preds["gross_revenue"]["value"] / preds["avg_price"]["value"], preds["units_sold"])
        _demand_at_least_units(preds, "units_sold", "demand_units")
        if preds["gross_revenue"]["value"] > 0:
            _set_value(preds["profit_margin_pct"], preds["net_profit"]["value"] / preds["gross_revenue"]["value"] * 100, signed=True)
        self._consistent_roi(preds, yh, X, year, prev_cum, prev_cum_err)
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
