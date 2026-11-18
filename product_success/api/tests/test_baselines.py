"""Reasons are measured against the products the 0-100 score ranks against (issue #28).

The score ranks a product's probability among its category's reference products; reason_groups subtracts each
group's mean contribution over those products. SHAP is additive, so the adjusted groups of one product must sum
to (its log-odds - the mean log-odds of those reference products). That pins down the whole contract: the
right peers (category, or all products below 30), the right model's baselines, and nothing left out."""
import math

import numpy as np
import pandas as pd
import pytest

from conftest import in_process, ok, product_json


def logit(p):
    return np.log(p / (1 - p))


@in_process
def test_adjusted_groups_sum_to_log_odds_above_the_scores_peers(client, slow):
    import predict
    from api.app import STATE, embed
    from api.features_fast import _model_of, featurize_one
    checked = {"full": 0, "launch-time": 0}
    for _, s in slow.iterrows():
        p = product_json(s)
        if not p["title"]:
            continue
        X = featurize_one(p, STATE.bundle, STATE.tables, embed(p["title"]))
        m = _model_of(X, STATE.bundle)
        contrib = predict.shap_contribs(m, X)
        prob = float(m["xgb"].predict_proba(X)[:, 1][0])
        cid = int(X["category_id"].iloc[0])
        groups = predict.reason_groups(pd.Series(contrib[0, :-1], index=m["feature_cols"]), STATE.baselines,
                                       X.attrs["model"], cid)
        ref = m["reference"]
        peers = ref.loc[ref["category_id"] == cid, "p"]
        use_category = len(peers) >= 30                     # score_one's rule
        peers = peers if use_category else ref["p"]
        b = STATE.baselines["models"][X.attrs["model"]]
        assert (cid in b["by_category"]) == use_category, s["in_case"]
        # Exact: the adjusted groups are this product's log-odds above the stored baseline of its peers.
        baseline = b["base"] + (b["by_category"][cid] if use_category else b["overall"]).sum()
        assert groups.sum() == pytest.approx(logit(prob) - baseline, abs=1e-4), s["in_case"]
        # The stored baseline is the mean log-odds of the peers SHAP was run on: all of them without a build
        # budget (then it equals the peers' mean), or a random sample of k of the N. The gap to the mean of all
        # N is then plain sampling error, whose standard error follows from the peers' saved probabilities.
        # The all-products fallback is stratified: each category's sample mean weighted by its size.
        gap = abs(baseline - logit(peers.to_numpy()).mean())
        strata = [cid] if use_category else list(b["n"])
        total = sum(b["n"][c] for c in strata)
        var = 0.0
        for c in strata:
            lo = logit(ref.loc[ref["category_id"] == c, "p"].to_numpy())
            k, N = b["sampled"][c], len(lo)
            if k < N:
                var += (N / total) ** 2 * lo.var(ddof=1) / k * (N - k) / (N - 1)
        se = math.sqrt(var)
        assert gap < 1e-3 + 4 * se, (s["in_case"], X.attrs["model"], gap, se)
        checked[X.attrs["model"]] += 1
    assert checked["full"] > 10 and checked["launch-time"] > 10, checked


def test_reasons_say_what_they_are_measured_against(client):
    from api.app import STATE
    ref = STATE.bundle["launch"]["reference"]
    n = ref["category_id"].value_counts()
    big, small = int(n.idxmax()), int(n[n < 30].index[0])
    base = {"title": "Stainless Steel Water Bottle 32 oz", "price": 24.99}
    assert ok(client.post("/reasons", json={**base, "category": big}))["baseline"] == "category"
    assert ok(client.post("/reasons", json={**base, "category": small}))["baseline"] == "all_products"


def test_baselines_built_from_another_model_are_refused(tmp_path):
    import joblib
    import predict
    from paths import MODELS_DIR
    import os
    real = os.environ.get("MODEL_DIR", MODELS_DIR)
    b = joblib.load(os.path.join(real, predict.BASELINES_FILE))
    b["source"]["bundle_sha256"] = "0" * 64
    other = tmp_path / predict.BASELINES_FILE
    joblib.dump(b, other)
    with pytest.raises(SystemExit, match="different"):
        predict.load_baselines(str(other), os.path.join(real, "embed_model.joblib"))
    with pytest.raises(SystemExit, match="missing"):
        predict.load_baselines(str(tmp_path / "nope.joblib"), os.path.join(real, "embed_model.joblib"))


def test_category_is_no_longer_a_top_reason_for_mouse(client):
    """The case behind #28: a one-word "Mouse" in Computer External Components scored 96 while "category" was
    the second-largest reason down (-1.68 against all products). Every product it is ranked against shares the
    category, so measured against them it should not be a top reason."""
    for extra in ({"list_price": 24.99, "stars": 4.6, "reviews": 300}, {}):
        why = ok(client.post("/reasons", json={"title": "Mouse", "price": 19.99, "category": 66, **extra}))
        labels = [x["label"] for x in why["reasons_up"] + why["reasons_down"]]
        assert "category" not in labels, (why["model_used"], labels)
        assert all(math.isfinite(x["impact"]) for x in why["reasons_up"] + why["reasons_down"])
