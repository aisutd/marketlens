"""
MarketLens: does the product image add anything? A pilot on the image sample (dev products only).

    python image_pilot.py            # every sampled product that has both a title and an image embedding

The label is the usual one, computed on ALL dev rows (top 20% of its category in products_dev.csv). Base and
listing features are also computed on all dev rows, then cut down to the image sample. Inside the sample it
runs 5-fold CV; in each fold everything built from the label (title score, brand rate, brand x category,
image_score) and the title PCA are fit on the other 4 folds only, then XGBoost scores the held-out fold:

    current best         base + listing + text + brand_cat_rate + title_emb_pca
    + image_score        the same plus an out-of-fold logistic regression on the CLIP image embedding

Full model: default XGBoost. Launch-time model: no stars/reviews, tuned XGBoost (as in train_final.py).
Scores are worked out on the pooled out-of-fold predictions of the whole sample.
"""
import argparse
import time

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split

from compare_models import SEED, build_features, build_target, load
from embeddings import EMB_DIR, emb_pca, emb_score, load_embeddings
from improve_xgb import REVIEW_COLS, listing_features, roc_auc_within_category, text_features, train_xgb
from push_auc import brand_cat_rate, train_tuned


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/products_dev.csv")
    ap.add_argument("--sample", default=f"{EMB_DIR}/image_sample.csv")
    args = ap.parse_args()

    t0 = time.time()
    dev = load(args.data)
    y_all = build_target(dev)
    feats_all = pd.concat([build_features(dev), listing_features(dev)[0]], axis=1)
    keep = dev["asin"].isin(pd.read_csv(args.sample)["asin"]).values
    df = dev[keep].reset_index(drop=True)
    y = y_all[keep].reset_index(drop=True)
    F = feats_all[keep].reset_index(drop=True)
    del dev, feats_all

    asins = df["asin"].astype(str).tolist()
    E_title = load_embeddings(asins, prefix="title_emb")
    E_img = load_embeddings(asins, prefix="image_emb")
    ok = ~np.isnan(E_title[:, 0]) & ~np.isnan(E_img[:, 0])
    df, y, F, E_title, E_img = (df[ok].reset_index(drop=True), y[ok].reset_index(drop=True),
                                F[ok].reset_index(drop=True), E_title[ok], E_img[ok])
    titles = df["title"].fillna("")
    from improve_xgb import brand_of
    brand = titles.map(brand_of)
    print(f"pilot products: {len(df):,} (positive rate {y.mean():.1%})")

    oof = {k: np.full(len(df), np.nan) for k in ("full best", "full + image", "launch best", "launch + image")}
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 5, "rare")
    for k, (fit_pos, te_pos) in enumerate(StratifiedKFold(5, shuffle=True, random_state=SEED).split(df, strat)):
        fit_idx, te_idx = df.index[fit_pos], df.index[te_pos]
        text = text_features(titles, brand, y, fit_idx, te_idx)
        bcr = brand_cat_rate(brand, df["category_id"], y, fit_idx, te_idx)
        pca, _ = emb_pca(E_title, fit_idx, "title_emb")
        img = emb_score(E_img, y, fit_idx, te_idx, "image_score")
        best = pd.concat([F, text, bcr, pca], axis=1)
        tr_idx, val_idx = train_test_split(fit_idx, test_size=0.1, stratify=y.loc[fit_idx], random_state=SEED)
        for name, X in [("best", best), ("+ image", pd.concat([best, img], axis=1))]:
            _, p = train_xgb(X.loc[tr_idx], y.loc[tr_idx], X.loc[val_idx], y.loc[val_idx], X.loc[te_idx])
            oof[f"full {name}"][te_pos] = p
            XL = X.drop(columns=REVIEW_COLS)
            _, p = train_tuned(XL.loc[tr_idx], y.loc[tr_idx], XL.loc[val_idx], y.loc[val_idx], XL.loc[te_idx])
            oof[f"launch {name}"][te_pos] = p
        print(f"fold {k + 1}/5 done ({time.time() - t0:.0f}s)")

    rows = [{"model": k, "ROC-AUC": roc_auc_score(y, p), "PR-AUC": average_precision_score(y, p),
             "within-cat": roc_auc_within_category(y, p, df["category_id"])} for k, p in oof.items()]
    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))
    print(f"\ntotal time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
