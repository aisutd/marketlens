import json
from dataclasses import replace

import pytest

from marketlens.predictor import LAUNCH_METRICS, MONTHLY_METRICS, YEARLY_METRICS


def test_launch_returns_every_metric_in_sensible_ranges(predictor, power_bank):
    r = predictor.predict_launch(power_bank)
    p = r["predictions"]
    assert set(LAUNCH_METRICS) | {"never_breaks_even"} <= set(p)
    assert p["units_sold_12m"]["value"] > 0 and p["revenue_12m"]["value"] > 0
    assert 0 < p["avg_price_12m"]["value"] < 3 * power_bank.price
    assert -100 < p["margin_pct_12m"]["value"] < 100
    assert 0 < p["break_even_months"]["value"] <= 36
    assert 0 <= p["never_breaks_even"]["value"] <= 100
    assert p["units_sold_24m"]["value"] >= p["units_sold_12m"]["value"] * 0.9
    # composite: profit = revenue × margin
    assert p["profit_12m"]["value"] == pytest.approx(p["revenue_12m"]["value"] * p["margin_pct_12m"]["value"] / 100, rel=1e-2)
    json.dumps(r)   # API-ready


def test_launch_accepts_dict_and_rejects_unknown_category(predictor, power_bank):
    assert predictor.predict_launch(dict(power_bank.__dict__))["type"] == "launch"
    with pytest.raises(ValueError):
        predictor.predict_launch(replace(power_bank, category="Spaceships"))


def test_more_market_traction_means_more_units(predictor, power_bank):
    low = predictor.predict_launch(replace(power_bank, review_count=100))["predictions"]["units_sold_12m"]["value"]
    high = predictor.predict_launch(replace(power_bank, review_count=20000))["predictions"]["units_sold_12m"]["value"]
    assert high > low * 3


def test_cheap_item_is_flagged_risky(predictor):
    r = predictor.predict_launch({"category": "Office Products", "price": 5.99, "review_count": 300, "months_on_market": 12,
                                  "sub_category": "CompositionNotebooks", "name": "Notebook"})
    assert r["predictions"]["margin_pct_12m"]["value"] < 5


def test_next_month_forecast(predictor):
    pid = predictor.products().product_id.iloc[0]
    r = predictor.predict_next_month(pid)
    assert set(MONTHLY_METRICS) <= set(r["predictions"]) and r["month"] == "2026-10"
    assert "demand_growth_mom_pct" not in r["predictions"]
    assert r["demand_trend"]["direction"] in {"increase", "decrease", "stable"}
    assert r["predictions"]["units_sold"]["value"] >= 0
    promo = predictor.predict_next_month(pid, promo_depth_pct=20)
    assert promo["predictions"]["avg_price"]["value"] < r["predictions"]["avg_price"]["value"]
    json.dumps(r)


def test_year_forecasts_and_annualised_partial_year(predictor):
    pid = predictor.products().product_id.iloc[0]
    r26 = predictor.predict_year(pid, 2026)
    r27 = predictor.predict_year(pid, 2027)
    assert set(YEARLY_METRICS) <= set(r26["predictions"]) and "demand_growth_yoy_pct" not in r26["predictions"]
    yoy = r26["demand_change_yoy"]
    assert yoy["direction"] in {"increase", "decrease", "stable"}
    expected = (r26["predictions"]["demand_units"]["value"] / yoy["last_year_demand"] - 1) * 100
    assert yoy["value"] == pytest.approx(expected, abs=0.1)
    assert any("annualised" in n for n in r27["notes"])
    with pytest.raises(ValueError):
        predictor.predict_year(pid, 2035)


def test_only_34_models_are_deployed(predictor):
    assert len(predictor.bundles) == 34
    assert ("monthly", "demand_growth_mom_pct") not in predictor.bundles and ("yearly", "demand_growth_yoy_pct") not in predictor.bundles


def test_unknown_product_id(predictor):
    with pytest.raises(KeyError):
        predictor.predict_next_month("NOT_A_PRODUCT")
