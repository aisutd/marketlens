"""
MarketLens step 5: score new product ideas with the saved model (0-100 Opportunity Score).

First run train_final.py once. Then either score one product:
    python predict.py --title "Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock" ^
        --price 89.99 --list-price 119.99 --stars 4.5 --reviews 1200 --category "Suitcases"

or a CSV of products (columns: title, price, listPrice, stars, reviews, category):
    python predict.py --csv my_ideas.csv --out my_ideas_scored.csv

"category" can be the category name (from amazon_categories.csv) or its numeric id.
Leave stars/reviews/list price out for a product that doesn't exist yet: it is then scored
by the launch-time model, which never uses stars or reviews. Products with stars or reviews use
the full model. (Models saved before the launch-time model existed fill missing stars/reviews with
the category's median instead; --as-is turns that off.)

Output per product:
    opportunity_score   0-100: share of real products in the same category it beats
    probability         raw model output (relative, not a calibrated chance of success)
    reasons             the 3 features pushing the score up and down the most (SHAP)
"""
import argparse
import os

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from compare_models import build_features
from improve_xgb import listing_features
from optional_features import apply_brand_cat_rate

FRIENDLY = {
    "title_score": "title wording", "brand_rate": "brand track record", "stars": "star rating",
    "brand_cat_rate": "brand track record in category",
    "log_reviews": "review count", "log_price": "price", "price_vs_cat_median": "price vs category",
    "price_pct_in_cat": "price rank in category", "stars_pct_in_cat": "rating rank in category",
    "reviews_pct_in_cat": "review rank in category", "discount_pct": "discount",
    "has_list_price": "shows a 'was' price", "category_id": "category", "title_len": "title length",
    "title_words": "title length", "brand_size_log": "brand size", "is_set": "sold as a set",
    "pack_count": "pack size", "cat_size_log": "category size", "title_caps_ratio": "title capitals",
    "title_has_size": "size in title", "brand_cats": "brand breadth",
    "cat_median_reviews_log": "category review level", "has_review_count": "review count",
}


def load_new(args):
    if args.csv:
        new = pd.read_csv(args.csv)
    else:
        new = pd.DataFrame([{"title": args.title, "price": args.price, "listPrice": args.list_price,
                             "stars": args.stars, "reviews": args.reviews, "category": args.category}])
    for col, default in (("listPrice", 0), ("stars", 0), ("reviews", 0)):
        new[col] = pd.to_numeric(new.get(col), errors="coerce").fillna(default) if col in new else default
    return new


def resolve_categories(new, ref, categories_file):
    names = {}
    if os.path.exists(categories_file):
        cats = pd.read_csv(categories_file)
        names = {str(n).strip().lower(): i for i, n in zip(cats["id"], cats["category_name"])}
    known = set(ref["category_id"].unique())
    ids = []
    for c in new["category"]:
        cid = int(c) if str(c).strip().isdigit() else names.get(str(c).strip().lower())
        if cid not in known:
            raise SystemExit(f"Unknown category: {c!r}. Use a name from {categories_file} "
                             f"or a category_id that appears in the training data.")
        ids.append(cid)
    return ids


def featurize(bundle, ref, new):
    """Features for the rows of `new`, computed with the real products in `ref` around them,
    exactly like in training. `new` needs title, price, listPrice, stars, reviews, category_id."""
    new = new.copy()
    new["asin"] = [f"NEW{i}" for i in range(len(new))]
    new["boughtInLastMonth"] = 0   # unknown for a new product, and not used by any feature
    both = pd.concat([ref, new[[c for c in new.columns if c in ref.columns]]], ignore_index=True)
    rows = both.index[len(ref):]
    listing, brand = listing_features(both)
    X = pd.concat([build_features(both), listing], axis=1).loc[rows]
    text = bundle["text"]
    titles = both.loc[rows, "title"].fillna("")
    X["title_score"] = text["clf"].decision_function(text["vec"].transform(titles))
    X["brand_rate"] = brand.loc[rows].map(text["brand_rate"]).fillna(text["prior"]).values
    if "brand_cat" in bundle:   # models saved before brand_cat_rate existed don't have it
        X["brand_cat_rate"] = apply_brand_cat_rate(bundle["brand_cat"], brand.loc[rows],
                                                   both.loc[rows, "category_id"]).values
    X["category_id"] = pd.Categorical(both.loc[rows, "category_id"], categories=bundle["categories"])
    return X[bundle["feature_cols"]].reset_index(drop=True)


def fill_typical(new, ref):
    """A product idea has no rating or reviews yet. Left empty, the model reads that as
    "unrated listing" (which rarely sells) and the score drops for the wrong reason.
    Fill the gaps with the category's median so the score reflects title, price and category."""
    new = new.copy()
    stars = ref["stars"].where(ref["stars"] > 0).groupby(ref["category_id"]).median()
    reviews = ref["reviews"].where(ref["reviews"] > 0).groupby(ref["category_id"]).median()
    for col, med in (("stars", stars), ("reviews", reviews)):
        new[col] = new[col].astype(float)   # 0 defaults are ints; medians like 4.3 need floats
        missing = new[col].fillna(0) <= 0
        new.loc[missing, col] = new.loc[missing, "category_id"].map(med).fillna(0).values
        if missing.any():
            print(f"note: {missing.sum()} product(s) had no {col}; using the category median")
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join("models", "opportunity_model.joblib"))
    ap.add_argument("--categories-file", default=os.path.join("data", "amazon_categories.csv"))
    ap.add_argument("--csv")
    ap.add_argument("--out")
    ap.add_argument("--title")
    ap.add_argument("--price", type=float)
    ap.add_argument("--list-price", type=float, default=0)
    ap.add_argument("--stars", type=float, default=0)
    ap.add_argument("--reviews", type=float, default=0)
    ap.add_argument("--category")
    ap.add_argument("--as-is", action="store_true",
                    help="score missing stars/reviews as missing (by default they are filled with "
                         "the category's typical values, since a product idea has no ratings yet)")
    args = ap.parse_args()
    if not args.csv and not (args.title and args.price and args.category):
        ap.error("give --csv, or at least --title, --price and --category")

    bundle = joblib.load(args.model)
    print("loading reference products (a few seconds)...")
    ref = pd.read_csv(bundle["data_path"])
    new = load_new(args)
    new["category_id"] = resolve_categories(new, ref, args.categories_file)
    # No stars and no reviews = a product idea: score it with the launch-time model if we have one.
    is_idea = (new["stars"].fillna(0) <= 0) & (new["reviews"].fillna(0) <= 0)
    launch = bundle.get("launch")
    if launch is None and not args.as_is:
        new = fill_typical(new, ref)   # older saved model: fall back to category medians
    X = featurize(bundle, ref, new)

    out = new[["title", "price", "category"]].copy()
    out["model"], out["probability"], out["opportunity_score"], out["reasons"] = "full", np.nan, 0, ""
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
            peers = peers if len(peers) >= 30 else ref_p["p"]   # too few peers: compare with everything
            c = contrib.iloc[j].groupby(lambda f: FRIENDLY.get(f, f)).sum().sort_values()
            up = [f"+ {k}" for k, v in c[::-1].head(3).items() if v > 0]
            down = [f"- {k}" for k, v in c.head(3).items() if v < 0]
            out.iloc[i, out.columns.get_indexer(["model", "probability", "opportunity_score", "reasons"])] = [
                name, round(float(pi), 4), round(100 * (peers < pi).mean()), "; ".join(up + down)]

    if args.out:
        out.to_csv(args.out, index=False)
        print(f"saved {args.out}")
    with pd.option_context("display.max_colwidth", 60, "display.width", 200):
        print(out[["title", "opportunity_score", "probability", "model", "reasons"]].to_string(index=False))


if __name__ == "__main__":
    main()
