"""
MarketLens: features and score for ONE product without the dev CSV, identical to predict.featurize.

    bundle = joblib.load("models/embed_model.joblib")
    tables = load_tables("models/reference_tables.joblib", bundle)      # tools/build_reference_tables.py
    E = OnnxEmbedder("models/minilm-onnx").encode([title])[0]           # cacheable per title
    product = {"title": title, "price": 89.99, "list_price": 119.99, "category": "Suitcases"}
    out = score_one(product, bundle, tables, E)        # model, probability, opportunity_score (~70 ms)
    why = reasons_one(product, bundle, tables, E)      # the SHAP reasons string (~0.5 s on the launch model)

predict.featurize appends the product to all 1.25M dev rows and rebuilds the features over the whole frame.
Here the product becomes a 1-row frame with the CSV's dtypes, build_features and listing_features run on that
row (so every row-only feature is the training code itself), and the eight features that look at other
products are recomputed from the tables, counting the new product as featurize does (n + 1 rows):

    price_vs_cat_median      price / median of non-zero prices in the category, new price included
    cat_size_log             log1p(products in the category + 1)
    cat_median_reviews_log   log1p(median of positive reviews in the category, new one included if > 0)
    brand_size_log           log1p(rows with this brand + 1), over all categories
    brand_cats               categories of this brand, plus this one if new
    price_pct_in_cat         rank(pct=True), method 'average', of the raw price within the category
    stars_pct_in_cat         the same over stars (0 -> NaN)
    reviews_pct_in_cat       the same over reviews (<= 0 -> NaN)

Ranks: with k values below v and e equal to it, the new row's average rank is k + 1 + e/2, out of the
non-NaN count + 1. Medians take the middle of the sorted values with v inserted, (a + b) / 2 when even.
Missing list price, stars and reviews become 0 through predict.load_new, exactly like the CLI.
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

import joblib  # noqa: E402

import predict  # noqa: E402  (imports compare_models, improve_xgb, optional_features; no torch)
from compare_models import build_features  # noqa: E402
from improve_xgb import listing_features  # noqa: E402

TABLES_VERSION = 1


def load_tables(path, bundle, verify_csv=True):
    """Load reference tables and check they were built from the CSV the bundle was trained on.
    If that CSV is on this machine, its row count and SHA-256 are checked too (skip with verify_csv=False)."""
    tables = joblib.load(path)
    if tables.get("version") != TABLES_VERSION:
        raise ValueError(f"{path}: tables version {tables.get('version')}, expected {TABLES_VERSION}")
    check_source(tables, bundle)
    src = tables["source"]
    if verify_csv and os.path.exists(src["data_path"]):
        import hashlib
        h = hashlib.sha256()
        with open(src["data_path"], "rb") as f:
            while chunk := f.read(1 << 20):
                h.update(chunk)
        if h.hexdigest() != src["sha256"]:
            raise ValueError(f"{src['data_path']} has changed since {path} was built; rebuild the tables")
    return tables


def check_source(tables, bundle):
    if os.path.normcase(tables["source"]["data_path"]) != os.path.normcase(bundle["data_path"]):
        raise ValueError(f"reference tables were built from {tables['source']['data_path']}, "
                         f"but the model's data_path is {bundle['data_path']}")


def new_frame(product):
    """predict.load_new on one product dict (keys as the CLI: title, price, list_price, stars, reviews,
    category; listPrice is accepted for list_price). Missing list price, stars and reviews become 0."""
    lp = product.get("list_price", product.get("listPrice"))
    args = argparse.Namespace(csv=None, title=product.get("title"), price=product.get("price"),
                              list_price=lp, stars=product.get("stars"), reviews=product.get("reviews"),
                              category=product.get("category"))
    return predict.load_new(args)


def resolve_category(category, tables):
    """predict.resolve_categories for one value, with the names and known ids from the tables."""
    c = category
    cid = int(c) if str(c).strip().isdigit() else tables["category_names"].get(str(c).strip().lower())
    if cid not in tables["categories"]:
        raise ValueError(f"Unknown category: {c!r}. Use a name from amazon_categories.csv "
                         f"or a category_id that appears in the training data.")
    return cid


def _pct_rank(sorted_vals, v):
    """groupby(...).rank(pct=True) of a value appended to a group whose non-NaN values are sorted_vals."""
    if np.isnan(v):
        return np.nan
    k = np.searchsorted(sorted_vals, v, side="left")
    e = np.searchsorted(sorted_vals, v, side="right") - k
    return (k + 1 + e / 2) / (len(sorted_vals) + 1)


def _median_with(sorted_vals, v):
    """groupby(...).transform('median') of a group: sorted_vals plus v (skipped when NaN)."""
    vals = sorted_vals if np.isnan(v) else np.insert(sorted_vals, np.searchsorted(sorted_vals, v), v)
    m = len(vals)
    if m == 0:
        return np.nan
    return vals[m // 2] if m % 2 else (vals[m // 2] + vals[m // 2 - 1]) / 2


def _lookup(mapping, key, default):
    """mapping.get(key), with a missing key or a NaN value giving `default` (Series.map(...).fillna)."""
    v = mapping.get(key)
    return default if v is None or v != v else v


def featurize_one(product, bundle, tables, embedding, all_columns=False):
    """One row of features for `product`, equal to predict.featurize for that product alone.
    `embedding` is the title's 384-dim MiniLM embedding (float16 round trip applied here; idempotent).
    Returns the chosen model's feature_cols (attrs['model'] says which), or the bundle's 56 with all_columns."""
    check_source(tables, bundle)
    new = new_frame(product)
    cid = resolve_category(new["category"].iloc[0], tables)
    new["category_id"] = [cid]
    is_idea = bool((new["stars"].fillna(0) <= 0).iloc[0] and (new["reviews"].fillna(0) <= 0).iloc[0])

    # featurize's concat, onto a 0-row frame with the CSV's dtypes instead of the CSV itself.
    new["asin"] = ["NEW0"]
    new["boughtInLastMonth"] = 0
    schema = tables["schema"]
    row = pd.concat([schema, new[[c for c in new.columns if c in schema.columns]]], ignore_index=True)
    listing, brand = listing_features(row)
    X = pd.concat([build_features(row), listing], axis=1)

    cat = tables["categories"][cid]
    price, stars, reviews = (float(row[c].iloc[0]) for c in ("price", "stars", "reviews"))
    price_nz = np.nan if price == 0 else price
    stars_nz = np.nan if stars == 0 else stars
    reviews_pos = reviews if reviews > 0 else np.nan
    b = brand.iloc[0]
    n_brand, brand_cats = tables["brands"].get(b, (0, ()))
    X.loc[0, "price_vs_cat_median"] = price_nz / _median_with(cat["price_nz"], price_nz)
    X.loc[0, "cat_size_log"] = np.log1p(cat["n"] + 1)
    X.loc[0, "cat_median_reviews_log"] = np.log1p(_median_with(cat["reviews"], reviews_pos))
    X.loc[0, "brand_size_log"] = np.log1p(n_brand + 1)
    X.loc[0, "brand_cats"] = len(brand_cats) + (cid not in brand_cats)
    X.loc[0, "price_pct_in_cat"] = _pct_rank(cat["price"], price)
    X.loc[0, "stars_pct_in_cat"] = _pct_rank(cat["stars"], stars_nz)
    X.loc[0, "reviews_pct_in_cat"] = _pct_rank(cat["reviews"], reviews_pos)

    # The bundle features, as in featurize. The two brand rates are plain dict lookups with the fallbacks of
    # featurize's brand.map(...).fillna(prior) and optional_features.apply_brand_cat_rate: Series.map turns
    # each 100k-290k entry dict into a Series on every call (~200 ms); the values are the same.
    text = bundle["text"]
    titles = row["title"].fillna("")
    X["title_score"] = text["clf"].decision_function(text["vec"].transform(titles))
    X["brand_rate"] = _lookup(text["brand_rate"], b, text["prior"])
    if "brand_cat" in bundle:
        fitted = bundle["brand_cat"]
        fallback = _lookup(fitted["cat_rate"], cid, fitted["prior"])
        X["brand_cat_rate"] = _lookup(fitted["map"], f"{b}|{cid}", fallback)
    if "title_emb" in bundle:
        fitted = bundle["title_emb"]
        E = np.asarray(embedding, dtype=np.float32).reshape(1, -1).astype(np.float16).astype(np.float32)
        Z = fitted["pca"].transform(E)
        Z = pd.DataFrame(Z, columns=[f"{fitted['prefix']}_pca_{k}" for k in range(Z.shape[1])], index=X.index)
        X = pd.concat([X, Z], axis=1)
    X["category_id"] = pd.Categorical(row["category_id"], categories=bundle["categories"])

    launch = bundle.get("launch")
    model = "launch-time" if (launch is not None and is_idea) else "full"
    cols = bundle["feature_cols"] if all_columns or model == "full" else launch["feature_cols"]
    X = X[cols].reset_index(drop=True)
    X.attrs["model"] = model
    return X


def _model_of(X, bundle):
    return bundle["launch"] if X.attrs["model"] == "launch-time" else bundle


def score_one(product, bundle, tables, embedding, features=None):
    """predict.main's score for one product, without the reasons: model, probability (rounded to 4) and
    0-100 opportunity score, plus p_raw (unrounded) and category_id. `features` reuses featurize_one's frame."""
    X = featurize_one(product, bundle, tables, embedding) if features is None else features
    m = _model_of(X, bundle)
    p = float(m["xgb"].predict_proba(X)[:, 1][0])
    cid = int(X["category_id"].iloc[0])
    ref_p = m["reference"]
    peers = ref_p.loc[ref_p["category_id"] == cid, "p"]
    peers = peers if len(peers) >= 30 else ref_p["p"]
    return {"model": X.attrs["model"], "probability": round(p, 4),
            "opportunity_score": round(100 * (peers < p).mean()), "p_raw": p, "category_id": cid}


def reasons_one(product, bundle, tables, embedding, features=None):
    """predict.main's reasons for one product: the same pred_contribs (exact TreeSHAP) call and grouping, so
    they are identical. Kept apart from score_one because SHAP on the launch-time model's 3,864 trees takes
    ~0.5 s while the score takes ~70 ms."""
    X = featurize_one(product, bundle, tables, embedding) if features is None else features
    m = _model_of(X, bundle)
    contrib = m["xgb"].get_booster().predict(xgb.DMatrix(X, enable_categorical=True), pred_contribs=True)
    contrib = pd.Series(contrib[0, :-1], index=m["feature_cols"])
    c = contrib.groupby(lambda f: predict.FRIENDLY.get(f, f)).sum().sort_values()
    up = [f"+ {k}" for k, v in c[::-1].head(3).items() if v > 0]
    down = [f"- {k}" for k, v in c.head(3).items() if v < 0]
    return "; ".join(up + down)
