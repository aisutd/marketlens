"""Build models/final/inference_reference.json: the small set of constants the predictor needs to turn
user inputs into model features (category assumptions, normalisation stats, brand counts, market sizes, typical errors).

Run once after training (or whenever the data/models change):
    python scripts/build_inference_reference.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from marketlens.config import FINAL, INFERENCE_REFERENCE, MODELS, PROCESSED, REFERENCE  # noqa: E402
from marketlens.models import load_bundles, predict_target  # noqa: E402


def relative_errors(registry: pd.DataFrame) -> dict:
    """Typical error as a fraction of the actual value (test MAE / mean |actual|), per level/target."""
    tests = {"monthly": pd.read_csv(FINAL / "monthly_test.csv"), "yearly": pd.read_csv(FINAL / "yearly_test.csv"),
             "product": pd.read_csv(FINAL / "product_test.csv")}
    tests["product"]["break_even_months"] = tests["product"].break_even_months.clip(upper=36)   # model output is capped
    out = {}
    for r in registry.itertuples():
        d = tests[r.level]
        if pd.notna(r.test_MAE) and r.target in d:
            out[f"{r.level}/{r.target}"] = round(float(r.test_MAE / d[r.target].abs().mean()), 4)
    return out


def trend_accuracy() -> dict:
    """How often the demand-forecast-based trends get the direction right on the test sets (and the YoY % error)."""
    bundles = load_bundles(MODELS)
    m = pd.read_csv(FINAL / "monthly_test.csv")
    m = m[m.demand_units_lag1.notna()]
    pm = predict_target(bundles, "monthly", "demand_units", m)
    monthly_dir = (np.sign(m.demand_units - m.demand_units_lag1) == np.sign(pm - m.demand_units_lag1)).mean()
    y = pd.read_csv(FINAL / "yearly_test.csv")
    y = y[(y.months_active_prev_year == 12) & (y.months_active == 12)]
    py = predict_target(bundles, "yearly", "demand_units", y)
    actual, pred = (y.demand_units / y.demand_units_prev_year - 1) * 100, (py / y.demand_units_prev_year - 1) * 100
    return {"monthly_direction_pct": round(float(monthly_dir) * 100, 1),
            "yearly_direction_pct": round(float((np.sign(actual) == np.sign(pred)).mean()) * 100, 1),
            "yearly_change_mae_pts": round(float(np.abs(actual - pred).mean()), 1)}


def main():
    products = pd.read_csv(PROCESSED / "product_features.csv")
    assumptions = pd.read_csv(REFERENCE / "us_category_assumptions.csv").set_index("us_category")
    market = pd.read_csv(REFERENCE / "category_monthly_demand.csv", parse_dates=["month"])
    registry = pd.read_csv(MODELS / "model_registry.csv")
    spec = json.loads((FINAL / "feature_spec.json").read_text())

    counts = products.us_category.value_counts()
    lq_parts = {
        "log_about_len": np.log1p(products.about_len),
        "n_bullets_clip12": products.n_bullets.clip(upper=12),
        "rating": products.rating,
        "review_sentiment": products.review_sentiment,
    }
    stats = {k: {"mean": float(v.mean()), "std": float(v.std())} for k, v in lq_parts.items()}
    z = {k: (v - stats[k]["mean"]) / stats[k]["std"] for k, v in lq_parts.items()}
    lq = z["log_about_len"] + z["n_bullets_clip12"] + 1.5 * z["rating"] + 0.5 * z["review_sentiment"]

    recent = market[market.month > market.month.max() - pd.DateOffset(months=12)]
    ref = {
        "category_groups": sorted(counts[counts >= 10].index.tolist()),
        "categories": assumptions.reset_index().to_dict(orient="records"),
        "tier_median_price": products.groupby("size_tier").price_usd.median().round(2).to_dict(),
        "listing_quality": {"stats": stats, "lq_min": float(lq.min()), "lq_max": float(lq.max())},
        "brand_listing_counts": products.brand.value_counts().to_dict(),
        "category_market_size_recent12": recent.groupby("us_category").category_demand_units.mean().round(1).to_dict(),
        "defaults": {"review_sentiment": float(products.review_sentiment.median()), "n_bullets": int(products.n_bullets.median()),
                     "about_len": int(products.about_len.median()), "name_len": int(products.name_len.median()),
                     "cat_depth": int(products.cat_depth.median())},
        "typical_error": {f"{r.level}/{r.target}": float(r.test_MAE) for r in registry.itertuples() if pd.notna(r.test_MAE)},
        "relative_error": relative_errors(registry),
        "trend_accuracy": trend_accuracy(),
        "feature_lists": {"monthly": spec["monthly"]["features"], "yearly": spec["yearly"]["features"],
                          "launch": spec["product"]["launch_features"]},
    }
    INFERENCE_REFERENCE.write_text(json.dumps(ref, indent=1))
    print(f"wrote {INFERENCE_REFERENCE} ({INFERENCE_REFERENCE.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
