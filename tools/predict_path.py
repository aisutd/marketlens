"""
MarketLens: score products through exactly the code path predict.py uses, without its CLI.

predict.py keeps its scoring loop inside main(), so this module repeats that loop line for line around
the same functions (load_new, resolve_categories, fill_typical, featurize). It takes an already-loaded
bundle and reference frame, so callers can time one product without re-reading the 231 MB CSV.

The title embedding is made by embeddings.embed_new_titles, which featurize reaches through
embeddings.title_emb_columns. use_embedder() swaps that function for another engine (ONNX) while keeping
its float16 round trip, so everything else stays the training code.
"""
import argparse
import os
import sys

import numpy as np
import pandas as pd
import xgboost as xgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import embeddings  # noqa: E402
import predict  # noqa: E402

DEMO = {"title": "Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock", "price": 89.99,
        "list_price": 119.99, "stars": 0, "reviews": 0, "category": "Suitcases"}
CATEGORIES_FILE = os.path.join(ROOT, "data", "amazon_categories.csv")


def new_frame(title, price, list_price=0, stars=0, reviews=0, category=None, csv=None):
    """The `new` frame predict.load_new builds from the CLI arguments."""
    args = argparse.Namespace(csv=csv, title=title, price=price, list_price=list_price,
                              stars=stars, reviews=reviews, category=category)
    return predict.load_new(args)


def score(bundle, ref, new, categories_file=CATEGORIES_FILE, as_is=False):
    """predict.main from resolve_categories to the output frame (same columns, same rounding)."""
    new = new.copy()
    new["category_id"] = predict.resolve_categories(new, ref, categories_file)
    is_idea = (new["stars"].fillna(0) <= 0) & (new["reviews"].fillna(0) <= 0)
    launch = bundle.get("launch")
    if launch is None and not as_is:
        new = predict.fill_typical(new, ref)
    X = predict.featurize(bundle, ref, new)

    out = new[["title", "price", "category"]].copy()
    out["model"], out["probability"], out["opportunity_score"], out["reasons"] = "full", np.nan, 0, ""
    out["p_raw"] = np.nan   # unrounded probability, for parity checks (predict.py prints it rounded to 4)
    groups = [("full", bundle, ~is_idea if launch else is_idea | ~is_idea)]
    if launch:
        groups.append(("launch-time", launch, is_idea))
    for name, m, mask in groups:
        rows = np.flatnonzero(mask.values)
        if not len(rows):
            continue
        Xm = X.iloc[rows][m["feature_cols"]]
        p = m["xgb"].predict_proba(Xm)[:, 1]
        contrib = m["xgb"].get_booster().predict(xgb.DMatrix(Xm, enable_categorical=True),
                                                 pred_contribs=True)
        contrib = pd.DataFrame(contrib[:, :-1], columns=m["feature_cols"])
        ref_p = m["reference"]
        for j, (i, pi) in enumerate(zip(rows, p)):
            peers = ref_p.loc[ref_p["category_id"] == new["category_id"].iloc[i], "p"]
            peers = peers if len(peers) >= 30 else ref_p["p"]
            c = contrib.iloc[j].groupby(lambda f: predict.FRIENDLY.get(f, f)).sum().sort_values()
            up = [f"+ {k}" for k, v in c[::-1].head(3).items() if v > 0]
            down = [f"- {k}" for k, v in c.head(3).items() if v < 0]
            out.iloc[i, out.columns.get_indexer(["model", "probability", "opportunity_score", "reasons", "p_raw"])] = [
                name, round(float(pi), 4), round(100 * (peers < pi).mean()), "; ".join(up + down), float(pi)]
    return out


_ORIGINAL = embeddings.embed_new_titles


def use_embedder(encode=None):
    """Make featurize embed titles with `encode(list[str]) -> (n, 384) float32`, rounded through float16
    like embed_new_titles. None puts the original (SentenceTransformer) function back."""
    if encode is None:
        embeddings.embed_new_titles = _ORIGINAL
        return

    def embed_new_titles(titles, model_name=embeddings.MODEL_NAME, batch=32):
        return np.asarray(encode(list(titles)), dtype=np.float32).astype(np.float16).astype(np.float32)

    embeddings.embed_new_titles = embed_new_titles
