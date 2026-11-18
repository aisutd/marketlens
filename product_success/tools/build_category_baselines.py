"""
MarketLens: per-category average of every reason group's SHAP contribution, so /reasons can report factors
against the product's own category, the same comparison the 0-100 score makes.

    python -m product_success.tools.build_category_baselines        # writes models\\category_baselines.joblib

Why: the score ranks a product's probability against the reference products of its category (score_one),
but pred_contribs measures each feature against the model's average over ALL training rows. A factor every
product in a category shares (the category itself, its size, ...) can then top the reasons while barely
moving the rank. Subtracting the category's mean contribution per group fixes that: SHAP is additive, so the
adjusted groups sum to (this product's log-odds - the category's mean log-odds over its reference products).

The reference products are train_final's held-out rows (bundle["reference"] keeps only their category and
probability). This rebuilds their features the way train_final did: the same CSV, the same out-of-fold
title and brand features over all rows, the same stratified split and seed, and the title-embedding PCA
saved in the bundle. It checks the rebuild is exact before writing anything: every rebuilt row's predicted
probability must match the saved reference probability, and every row's SHAP contributions (predict.shap_contribs,
the same call the reasons use) must add up to the log-odds of that probability. If not, it stops.

SHAP on the launch-time model is slow: 3,664 trees of depth 9 took 47.5 ms per row on a 12-thread laptop,
about 99 minutes for all 124,929 reference rows (the full model: 5.4 ms per row, about 11 minutes). --budget-full / --budget-launch cap the minutes per model: SHAP is timed on 500 rows,
then each category keeps a seeded random sample of at most the number of products that fits the budget (all of
them in smaller categories). The means are then estimates; the tool prints their standard error. Without a
budget every reference product is used and the means are exact.

Saved, per model ("full", "launch-time"):
    groups        reason labels (predict.FRIENDLY values, raw names for features without one), column order
    by_category   {category_id: float64 array of mean contribution per group} for categories with >= 30
                  reference products (score_one's rule for using the category as peers)
    overall       the mean over all reference products (category means weighted by category size), for the
                  categories below 30
    n, sampled    {category_id: reference products, of which used}
    base          the model's expected value (SHAP's bias term)
plus budget_minutes and source (data_path, rows, sha256 of the CSV, the bundle file's sha256), checked at load.
"""
import argparse
import os
import time

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split

from paths import MODELS_DIR
import predict
from predict import sha256
from training.compare_models import SEED, build_features, build_target
from training.embeddings import _chunks
from training.improve_xgb import listing_features, text_features
from training.push_auc import brand_cat_rate

VERSION = 1
MIN_PEERS = 30          # score_one: fewer reference products than this and all products are the peers
P_TOLERANCE = 1e-6      # largest allowed |rebuilt p - saved reference p| over every reference row


def rebuild_reference_features(bundle, df, emb_dir):
    """train_final's feature frame for its held-out rows, in the order bundle["reference"] stores them."""
    y = build_target(df)
    listing, brand = listing_features(df)
    titles = df["title"].fillna("")
    print("out-of-fold text features over all rows (as train_final)...")
    text = text_features(titles, brand, y, df.index, df.index[:0])
    bcr = brand_cat_rate(brand, df["category_id"], y, df.index, df.index[:0])
    X = pd.concat([build_features(df), listing, text, bcr], axis=1)
    _, val_idx = train_test_split(df.index, test_size=0.1, stratify=y, random_state=SEED)

    X = X.loc[val_idx]
    if "title_emb" in bundle:
        # train_final fit this PCA on all rows and projected every row with it; use the saved one.
        fitted = bundle["title_emb"]
        asins = df.loc[val_idx, "asin"].astype(str).tolist()
        Z = np.full((len(asins), fitted["pca"].n_components_), np.nan, dtype=np.float32)
        for dst, src, E in _chunks(emb_dir, fitted["prefix"], asins):
            Z[dst] = fitted["pca"].transform(E[src].astype(np.float32))
        if np.isnan(Z[:, 0]).any():
            raise SystemExit(f"{int(np.isnan(Z[:, 0]).sum()):,} reference rows have no title embedding in {emb_dir}")
        cols = [f"{fitted['prefix']}_pca_{k}" for k in range(Z.shape[1])]
        X = pd.concat([X, pd.DataFrame(Z, columns=cols, index=X.index)], axis=1)
    X["category_id"] = pd.Categorical(df.loc[val_idx, "category_id"], categories=bundle["categories"])
    return X


def baselines_for(m, X, name, budget=None):
    """Check the rebuild against m["reference"], then average each group's contribution per category."""
    ref = m["reference"]
    Xm = X[m["feature_cols"]]
    if not np.array_equal(Xm["category_id"].astype(int).to_numpy(), ref["category_id"].to_numpy()):
        raise SystemExit(f"{name}: rebuilt held-out rows are not in the reference's category order")
    p = m["xgb"].predict_proba(Xm)[:, 1]
    gap = float(np.max(np.abs(p - ref["p"].to_numpy())))
    print(f"{name}: {len(p):,} reference rows, max |rebuilt p - saved p| = {gap:.2e}")
    if gap > P_TOLERANCE:
        raise SystemExit(f"{name}: the rebuild does not reproduce the saved reference probabilities "
                         f"(max gap {gap:.2e} > {P_TOLERANCE:.0e}); not writing baselines")

    best = getattr(m["xgb"], "best_iteration", None)
    print(f"{name}: SHAP over the {best + 1 if best is not None else 'all'} trees predict_proba uses")
    cats_all = ref["category_id"].to_numpy()
    n = pd.Series(cats_all).value_counts()
    rows = np.arange(len(ref))
    if budget:
        # Time SHAP on a small batch, then take a seeded sample per category that fits the budget.
        t0 = time.time()
        probe = rows[:: max(1, len(rows) // 500)][:500]
        predict.shap_contribs(m, Xm.iloc[probe])
        per_row = (time.time() - t0) / len(probe)
        affordable = int(budget * 60 / per_row)
        cap = len(rows)
        while cap > MIN_PEERS and n.clip(upper=cap).sum() > affordable:
            cap = int(cap * 0.9)
        cap = max(cap, MIN_PEERS)
        rng = np.random.default_rng(SEED)
        rows = np.sort(np.concatenate([rng.choice(idx, min(len(idx), cap), replace=False)
                                       for idx in pd.Series(rows).groupby(cats_all).apply(np.asarray)]))
        print(f"{name}: {per_row * 1000:.1f} ms per row; budget {budget} min -> up to {cap} reference products "
              f"per category, {len(rows):,} rows")
    t0 = time.time()
    contrib = predict.shap_contribs(m, Xm.iloc[rows])
    print(f"{name}: SHAP for {len(rows):,} rows in {time.time() - t0:.0f}s")
    base = float(contrib[0, -1])
    margin = contrib.sum(axis=1)
    contrib = pd.DataFrame(contrib[:, :-1], columns=m["feature_cols"])
    grouped = contrib.T.groupby(lambda f: predict.FRIENDLY.get(f, f)).sum().T
    groups = list(grouped.columns)
    cats = cats_all[rows]
    used = pd.Series(cats).value_counts()
    means = grouped.groupby(cats).mean()
    sem = grouped.groupby(cats).std().div(np.sqrt(used), axis=0)

    # The contributions must add up to the log-odds of the saved reference probabilities, row by row.
    pr = ref["p"].to_numpy()[rows]
    worst = float(np.max(np.abs(margin - np.log(pr / (1 - pr)))))
    print(f"{name}: max |base + sum(contributions) - log-odds of saved p| = {worst:.2e}")
    if worst > 1e-3:
        raise SystemExit(f"{name}: SHAP does not add up to the saved reference probabilities ({worst:.2e})")

    out = {
        "groups": groups,
        "by_category": {int(c): means.loc[c].to_numpy(dtype=np.float64) for c in means.index
                        if n[c] >= MIN_PEERS},
        # All products, each category weighted by its real size: a budget samples big categories less, so the
        # plain mean of the sampled rows would over-weight small categories.
        "overall": means.mul(n.loc[means.index], axis=0).sum().div(n.loc[means.index].sum())
                        .to_numpy(dtype=np.float64),
        "n": {int(c): int(k) for c, k in n.items()},
        "sampled": {int(c): int(k) for c, k in used.items()},
        "base": base,
    }
    big = [c for c in means.index if n[c] >= MIN_PEERS]
    print(f"{name}: {len(big)} categories with >= {MIN_PEERS} references, {len(means) - len(big)} use the "
          f"overall mean; standard error of a category's mean contribution: median "
          f"{np.nanmedian(sem.loc[big].to_numpy()):.3f}, max {np.nanmax(sem.loc[big].to_numpy()):.3f} log-odds")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join(MODELS_DIR, "embed_model.joblib"))
    ap.add_argument("--emb-dir", default=None, help="default: embeddings/ next to the bundle's data_path")
    ap.add_argument("--out", default=os.path.join(MODELS_DIR, "category_baselines.joblib"))
    ap.add_argument("--features-cache", default=os.path.join(MODELS_DIR, "reference_features.parquet"),
                    help="rebuilt held-out features, reused when present (delete it after a retrain)")
    ap.add_argument("--budget-full", type=float, default=None,
                    help="minutes of SHAP for the full model; default none: every reference product")
    ap.add_argument("--budget-launch", type=float, default=None,
                    help="minutes of SHAP for the launch-time model; default none: every reference product")
    args = ap.parse_args()

    t0 = time.time()
    bundle = joblib.load(args.model)
    data_path = bundle["data_path"]
    if "holdout" in data_path.lower():
        raise SystemExit("refusing: the bundle points at the holdout set")
    emb_dir = args.emb_dir or os.path.join(os.path.dirname(data_path), "embeddings")
    df = pd.read_csv(data_path).reset_index(drop=True)   # train_final: load(...).reset_index(drop=True)
    print(f"read {data_path}: {len(df):,} rows ({time.time() - t0:.0f}s)")

    if os.path.exists(args.features_cache):
        X = pd.read_parquet(args.features_cache)
        X["category_id"] = pd.Categorical(X["category_id"].astype(int), categories=bundle["categories"])
        print(f"reused {args.features_cache}")
    else:
        X = rebuild_reference_features(bundle, df, emb_dir)
        X.to_parquet(args.features_cache)
    models = {"full": baselines_for(bundle, X, "full", args.budget_full)}
    if bundle.get("launch") is not None:
        models["launch-time"] = baselines_for(bundle["launch"], X, "launch-time", args.budget_launch)

    baselines = {
        "version": VERSION,
        "min_peers": MIN_PEERS,
        "budget_minutes": {"full": args.budget_full, "launch-time": args.budget_launch},
        "source": {"data_path": data_path, "rows": len(df), "sha256": sha256(data_path),
                   "bundle_sha256": sha256(args.model)},
        "models": models,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    joblib.dump(baselines, args.out, compress=3)
    print(f"saved {args.out}: {os.path.getsize(args.out) / 2**20:.2f} MB ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
