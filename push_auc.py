"""
MarketLens helper: try to push ROC-AUC from 0.85 toward 0.88 with new signals from the data we already have.

Starts from the best set in improve_xgb.py (base + listing + text) and adds, one at a time:

    + brand x category   the brand's success rate INSIDE this category (a brand can be big in
                         phone cases and nothing in kitchen), smoothed, out-of-fold
    + title sales        a second title score, trained to predict log(sales) instead of yes/no,
                         so it learns "how much" as well as "whether", out-of-fold
    + similar titles     success rate of the 20 most similar training titles (nearest neighbours
                         on TF-IDF), out-of-fold: "how did products like this do?"
    tuned XGBoost        slower learning rate and deeper trees on the final set

Run (dev data only, the holdout stays locked):
    python push_auc.py --data data\\products_dev.csv --sample 300000   # quick read, ~10 min
    python push_auc.py --data data\\products_dev.csv                   # full, can take an hour+

Use --skip-neighbours if the similar-titles step is too slow on your laptop.
Same split and metrics as improve_xgb.py, so the numbers line up with your 0.852.
"""
import argparse
import time

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.linear_model import SGDRegressor
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import KFold, train_test_split
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import make_pipeline
from xgboost import XGBClassifier

from compare_models import SEED, build_features, build_target, load, set_device, xgb_device
from improve_xgb import listing_features, roc_auc_within_category, text_features, train_xgb


def oof(fit_idx, apply_idx, fit_predict, n_folds=5, label=""):
    """Out-of-fold wrapper: each training row is filled by a model that never saw it."""
    fit_idx = np.asarray(fit_idx)
    for k, (a, b) in enumerate(KFold(n_folds, shuffle=True, random_state=SEED).split(fit_idx)):
        fit_predict(fit_idx[a], fit_idx[b])
        print(f"  {label}: fold {k + 1}/{n_folds} done")
    if len(apply_idx):
        fit_predict(fit_idx, np.asarray(apply_idx))


def brand_cat_rate(brand, cat, y, fit_idx, apply_idx, smoothing=20):
    key = brand.astype(str) + "|" + cat.astype(str)
    out = pd.Series(np.nan, index=y.index, name="brand_cat_rate")

    def fp(tr, pr):
        # Pull toward the category's own rate, not the global one.
        cat_rate = y.loc[tr].groupby(cat.loc[tr]).mean()
        stats = y.loc[tr].groupby(key.loc[tr]).agg(["sum", "count"])
        prior = cat.loc[pr].map(cat_rate).fillna(y.loc[tr].mean()).values
        s = key.loc[pr].map(stats["sum"]).fillna(0).values
        n = key.loc[pr].map(stats["count"]).fillna(0).values
        out.loc[pr] = (s + smoothing * prior) / (n + smoothing)

    oof(fit_idx, apply_idx, fp, label="brand x category")
    return out.to_frame()


def title_sales_score(titles, log_sales, fit_idx, apply_idx):
    vec = make_pipeline(
        HashingVectorizer(ngram_range=(1, 2), n_features=2**20, alternate_sign=False,
                          norm=None, dtype=np.float32),
        TfidfTransformer(sublinear_tf=True))
    out = pd.Series(np.nan, index=titles.index, name="title_sales_score")

    def fp(tr, pr):
        reg = SGDRegressor(alpha=2e-6, max_iter=20, tol=None, random_state=SEED)
        reg.fit(vec.fit_transform(titles.loc[tr]), log_sales.loc[tr])
        out.loc[pr] = reg.predict(vec.transform(titles.loc[pr]))

    oof(fit_idx, apply_idx, fp, label="title sales")
    return out.to_frame()


def similar_titles_rate(titles, y, fit_idx, apply_idx, k=20, dims=64, ref_size=100_000):
    """Success rate of the k nearest training titles, in a compressed (SVD) TF-IDF space.

    Neighbours are searched among a random ref_size of the training rows, which keeps this to
    minutes instead of hours on a laptop.
    """
    vec = make_pipeline(
        HashingVectorizer(ngram_range=(1, 2), n_features=2**18, alternate_sign=False,
                          norm=None, dtype=np.float32),
        TfidfTransformer(sublinear_tf=True))
    Z = TruncatedSVD(dims, random_state=SEED).fit_transform(vec.fit_transform(titles))
    Z /= np.linalg.norm(Z, axis=1, keepdims=True).clip(min=1e-9)
    Z = pd.DataFrame(Z.astype(np.float32), index=titles.index)
    out = pd.Series(np.nan, index=titles.index, name="similar_titles_rate")

    rng = np.random.default_rng(SEED)

    def fp(tr, pr):
        if len(tr) > ref_size:
            tr = rng.choice(tr, ref_size, replace=False)
        nn = NearestNeighbors(n_neighbors=k, algorithm="brute", n_jobs=-1).fit(Z.loc[tr].values)
        ytr = y.loc[tr].values
        for i in range(0, len(pr), 50_000):
            part = pr[i:i + 50_000]
            _, idx = nn.kneighbors(Z.loc[part].values)
            out.loc[part] = ytr[idx].mean(axis=1)

    oof(fit_idx, apply_idx, fp, label="similar titles")
    return out.to_frame()


def train_tuned(X_tr, y_tr, X_val, y_val, X_te):
    pos_weight = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)
    model = XGBClassifier(
        n_estimators=8000, learning_rate=0.02, max_depth=9, min_child_weight=10,
        subsample=0.8, colsample_bytree=0.7, reg_lambda=5.0, gamma=0.1, tree_method="hist",
        max_bin=512, enable_categorical=True, max_cat_to_onehot=1, scale_pos_weight=pos_weight,
        eval_metric="auc", early_stopping_rounds=200, n_jobs=-1, random_state=SEED,
        device=xgb_device())
    model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
    return model, model.predict_proba(X_te)[:, 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_dev.csv")
    ap.add_argument("--sample", type=int, default=None)
    ap.add_argument("--skip-neighbours", action="store_true")
    ap.add_argument("--gpu", action="store_true", help="train XGBoost on an NVIDIA GPU (CUDA)")
    args = ap.parse_args()
    set_device(args.gpu)

    t0 = time.time()
    df = load(args.data, args.sample).reset_index(drop=True)
    y = build_target(df)
    titles = df["title"].fillna("")
    listing, brand = listing_features(df)
    print(f"rows={len(df):,}  positive rate={y.mean():.1%}")

    # Same split as improve_xgb.py
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    fit_idx, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)
    tr_idx, val_idx = train_test_split(fit_idx, test_size=0.1, stratify=y.loc[fit_idx], random_state=SEED)

    print("building title + brand features...")
    X = pd.concat([build_features(df), listing, text_features(titles, brand, y, fit_idx, te_idx)], axis=1)
    sets = [("start: + text (improve_xgb best)", X)]
    X = pd.concat([X, brand_cat_rate(brand, df["category_id"], y, fit_idx, te_idx)], axis=1)
    sets.append(("+ brand x category", X))
    log_sales = np.log1p(df["boughtInLastMonth"].clip(lower=0))
    X = pd.concat([X, title_sales_score(titles, log_sales, fit_idx, te_idx)], axis=1)
    sets.append(("+ title sales", X))
    if not args.skip_neighbours:
        X = pd.concat([X, similar_titles_rate(titles, y, fit_idx, te_idx)], axis=1)
        sets.append(("+ similar titles", X))

    y_te, cats_te = y.loc[te_idx], df.loc[te_idx, "category_id"]
    rows = []

    def record(name, p, model, t1):
        rows.append({"step": name, "ROC-AUC": roc_auc_score(y_te, p),
                     "PR-AUC": average_precision_score(y_te, p),
                     "ROC-AUC within category": roc_auc_within_category(y_te, p, cats_te),
                     "trees": model.best_iteration + 1, "sec": time.time() - t1})
        print(rows[-1])

    for name, Xs in sets:
        t1 = time.time()
        model, p = train_xgb(Xs.loc[tr_idx], y.loc[tr_idx], Xs.loc[val_idx], y.loc[val_idx], Xs.loc[te_idx])
        record(name, p, model, t1)
    t1 = time.time()
    model, p = train_tuned(X.loc[tr_idx], y.loc[tr_idx], X.loc[val_idx], y.loc[val_idx], X.loc[te_idx])
    record("tuned XGBoost (all of the above)", p, model, t1)

    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))
    print(f"\ntotal time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
