"""
MarketLens: the reasons of features_fast.reasons_one as data instead of a string.

    up, down = reasons_detail(product, bundle, tables, E)
    # up   = [{"feature": "stars", "label": "star rating", "impact": 0.41}, ...]   at most 3, largest first
    # down = [{"feature": "category_id", "label": "category", "impact": -0.22}, ...]

The same pred_contribs (exact TreeSHAP) call, the same grouping by predict.FRIENDLY and the same top-3
selection as reasons_one, so the labels and their order are identical to it (api/tests check that, and that
"; ".join of "+ label" / "- label" gives reasons_one's string). On top of the label it returns:

    impact    the label's summed SHAP contribution, in log-odds (what reasons_one sorts by)
    feature   the raw feature in that label's group with the largest contribution in the same direction
              ("title meaning" sums 32 title_emb_pca_* columns, "title length" title_len and title_words)
"""
import pandas as pd
import xgboost as xgb

import predict
from api.features_fast import _model_of, featurize_one


def reasons_detail(product, bundle, tables, embedding, features=None):
    X = featurize_one(product, bundle, tables, embedding) if features is None else features
    m = _model_of(X, bundle)
    contrib = m["xgb"].get_booster().predict(xgb.DMatrix(X, enable_categorical=True), pred_contribs=True)
    contrib = pd.Series(contrib[0, :-1], index=m["feature_cols"])
    c = contrib.groupby(lambda f: predict.FRIENDLY.get(f, f)).sum().sort_values()
    labels = contrib.index.map(lambda f: predict.FRIENDLY.get(f, f))

    def item(label, v):
        members = contrib[labels == label]
        top = members.idxmax() if v > 0 else members.idxmin()
        return {"feature": top, "label": label, "impact": float(v)}

    up = [item(k, v) for k, v in c[::-1].head(3).items() if v > 0]
    down = [item(k, v) for k, v in c.head(3).items() if v < 0]
    return up, down
