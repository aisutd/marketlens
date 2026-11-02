"""The feature builders must reproduce the features the models were trained on."""
import numpy as np
import pandas as pd
import pytest

from marketlens.config import INTERIM, PROCESSED
from marketlens.features import ProductInput, build_next_month_features, build_product_features, category_info
from marketlens.models import predict_target

DRIFT_FREE = {"everyday_price", "avg_price", "log_avg_price"}   # month length makes the price drift differ by a few cents


def test_next_month_builder_matches_stored_september_row(predictor):
    h = predictor.monthly_history
    pid = h[(h.month == "2026-09-01") & (h.age_months > 30)].product_id.iloc[0]
    hist = h[(h.product_id == pid) & (h.month < "2026-09-01")]
    actual = h[(h.product_id == pid) & (h.month == "2026-09-01")].iloc[0]
    cat = category_info(predictor.ref, actual.us_category)
    built = build_next_month_features(hist, predictor.calendar, cat["ratings_per_order"], cat["price_drift_yr"],
                                      promo_depth_pct=actual.promo_depth_pct, everyday_price=actual.everyday_price).iloc[0]
    assert built.month == pd.Timestamp("2026-09-01")
    for f in predictor.ref["feature_lists"]["monthly"]:
        a, b = float(actual[f]), float(built[f])
        if np.isnan(a):
            assert np.isnan(b), f
        else:
            assert b == pytest.approx(a, rel=1e-4, abs=1.0 if "cum_net_profit" in f or "reviews" in f else 1e-6), f
    for target in ["units_sold", "gross_revenue", "net_profit", "roi_cum_pct"]:
        p_stored = predict_target(predictor.bundles, "monthly", target, actual.to_frame().T.infer_objects())[0]
        p_built = predict_target(predictor.bundles, "monthly", target, built.to_frame().T.infer_objects())[0]
        assert p_built == pytest.approx(p_stored, rel=1e-3, abs=1.0), target


def test_product_builder_matches_training_features(predictor, product_train):
    clean = pd.read_csv(INTERIM / "amazon_us_clean.csv").set_index("product_id")
    pf = pd.read_csv(PROCESSED / "product_features.csv").set_index("product_id")
    for pid in product_train.product_id.iloc[:25]:
        c, f = clean.loc[pid], pf.loc[pid]
        inp = ProductInput(category=c.us_category, price=c.price_usd, list_price=c.list_price_usd,
                           review_count=int(c.rating_count), months_on_market=int(f.age_months_at_obs_end), sub_category=c.cat_leaf,
                           brand=c.brand, name=c.product_name, rating=c.rating, review_sentiment=c.review_sentiment,
                           n_bullets=int(c.n_bullets), about_len=int(c.about_len), size_tier=f.size_tier, weight_lb=f.ship_weight_lb,
                           landed_cost=f.landed_cost_unit, launch_month=int(f.launch_month))
        built = build_product_features(inp, predictor.ref, predictor.encoders).iloc[0]
        stored = product_train.set_index("product_id").loc[pid]
        for col in ["log_price_usd", "rating", "listing_quality_score", "log_fba_fee_unit", "fee_share_of_price", "cost_share_of_price",
                    "unit_margin_pct", "referral_rate", "log_launch_fixed_cost", "log_rating_count",
                    "category_group__Other", "price_tier__10_25", "rating_band__4_0_4_2", "size_tier__small_standard"]:
            assert float(built[col]) == pytest.approx(float(stored[col]), rel=1e-3, abs=0.11), (pid, col)
