"""Reasons explain the model that makes the score. Both XGBoost models were trained with early stopping
(full: 1,610 trees, best iteration 1,509; launch-time: 3,864, best 3,663), and predict_proba uses only the best
iteration's trees, so SHAP must too. Its contributions plus the bias then add up to the score's log-odds."""
import numpy as np

from conftest import in_process, product_json


@in_process
def test_shap_adds_up_to_the_scored_probability(client, slow):
    import predict
    from api.app import STATE, embed
    from api.features_fast import _model_of, featurize_one
    seen = set()
    for _, s in slow.head(40).iterrows():
        p = product_json(s)
        if not p["title"]:
            continue
        X = featurize_one(p, STATE.bundle, STATE.tables, embed(p["title"]))
        m = _model_of(X, STATE.bundle)
        prob = float(m["xgb"].predict_proba(X)[:, 1][0])
        total = float(predict.shap_contribs(m, X)[0].sum())
        assert abs(total - np.log(prob / (1 - prob))) < 1e-4, (s["in_case"], total)
        seen.add(X.attrs["model"])
    assert seen == {"full", "launch-time"}
