"""
MarketLens step 4: train the final XGBoost model on all the data and save it to disk.

Run once (takes a few minutes on the full data):
    python train_final.py --data data\\products_clean.csv

Saves:
    models\\opportunity_model.joblib   everything predict.py needs to score a new product

Keep products_clean.csv where it is: predict.py compares new products against it
(price vs category median, rank inside the category, brand size, ...).
"""
import argparse
import os
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline

from compare_models import SEED, build_features, build_target, load, set_device
from improve_xgb import REVIEW_COLS, listing_features, text_features, train_xgb
from optional_features import fit_brand_cat_rate
from push_auc import brand_cat_rate


def fit_text_model(titles, brands, y):
    """Title model + brand success rates fit on ALL rows, used only for new products."""
    vec = make_pipeline(
        HashingVectorizer(ngram_range=(1, 2), n_features=2**20, alternate_sign=False,
                          norm=None, dtype=np.float32),
        TfidfTransformer(sublinear_tf=True))
    clf = SGDClassifier(loss="log_loss", alpha=2e-6, max_iter=20, tol=None, random_state=SEED)
    clf.fit(vec.fit_transform(titles), y)
    prior = y.mean()
    stats = y.groupby(brands).agg(["sum", "count"])
    brand_rate = ((stats["sum"] + 20 * prior) / (stats["count"] + 20)).to_dict()
    return {"vec": vec, "clf": clf, "brand_rate": brand_rate, "prior": prior}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_clean.csv")
    ap.add_argument("--sample", type=int, default=None, help="only for a quick test run")
    ap.add_argument("--out", default=os.path.join("models", "combined_model.joblib"))
    ap.add_argument("--gpu", action="store_true", help="train XGBoost on an NVIDIA GPU (CUDA)")
    args = ap.parse_args()
    set_device(args.gpu)

    t0 = time.time()
    df = load(args.data, args.sample).reset_index(drop=True)
    y = build_target(df)
    listing, brand = listing_features(df)
    titles = df["title"].fillna("")
    print(f"rows={len(df):,}  positive rate={y.mean():.1%}")

    # Out-of-fold text features for every row, so XGBoost trains on honest title scores.
    print("building text features...")
    text = text_features(titles, brand, y, df.index, df.index[:0])
    # The brand's success rate inside this category, also out-of-fold.
    bcr = brand_cat_rate(brand, df["category_id"], y, df.index, df.index[:0])
    X = pd.concat([build_features(df), listing, text, bcr], axis=1)

    # Small held-out slice: early stopping, plus the reference scores for the 0-100 scale.
    tr_idx, val_idx = train_test_split(df.index, test_size=0.1, stratify=y, random_state=SEED)
    print("training XGBoost (full model, for products that already have reviews)...")
    model, p_val = train_xgb(X.loc[tr_idx], y.loc[tr_idx], X.loc[val_idx], y.loc[val_idx], X.loc[val_idx])
    # Launch-time model: no stars or review counts, for product ideas that aren't on sale yet.
    XL = X.drop(columns=REVIEW_COLS)
    print("training XGBoost (launch-time model, for brand-new product ideas)...")
    launch, p_val_l = train_xgb(XL.loc[tr_idx], y.loc[tr_idx], XL.loc[val_idx], y.loc[val_idx], XL.loc[val_idx])

    print("fitting the title model on all rows for scoring new products...")
    model.set_params(device="cpu")   # the saved models score on any laptop, GPU or not
    launch.set_params(device="cpu")
    bundle = {
        "xgb": model,
        "feature_cols": list(X.columns),
        "categories": list(X["category_id"].cat.categories),
        "text": fit_text_model(titles, brand, y),
        "brand_cat": fit_brand_cat_rate(brand, df["category_id"], y),
        # Predicted probabilities of real products: a new product's 0-100 score is the
        # share of products in its category that it beats.
        "reference": pd.DataFrame({"category_id": df.loc[val_idx, "category_id"].values,
                                   "p": p_val}),
        "launch": {"xgb": launch, "feature_cols": list(XL.columns),
                   "reference": pd.DataFrame({"category_id": df.loc[val_idx, "category_id"].values,
                                              "p": p_val_l})},
        "data_path": os.path.abspath(args.data),
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    joblib.dump(bundle, args.out, compress=3)
    print(f"saved {args.out}  ({os.path.getsize(args.out) / 1e6:.0f} MB, {time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
