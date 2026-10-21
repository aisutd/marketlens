"""
MarketLens: test one change to the model at a time, on the dev data only.

Builds the best set from improve_xgb.py (base + listing + text), switches on the optional parts
from optional_features.py, and reports ROC-AUC, PR-AUC and within-category ROC-AUC for the full
and the launch-time model. Same label, split and XGBoost as improve_xgb.py.

Run:
    python run_experiment.py --data data\\products_dev.csv --sample 300000                    # baseline
    python run_experiment.py --data data\\products_dev.csv --sample 300000 --add cat_sales_encoded
    python run_experiment.py --data data\\products_dev.csv --sample 300000 --clean            # notebook cleaning
    python run_experiment.py --data data\\products_dev.csv --sample 300000 --blend 0.2,0.3,0.5
        # average the Random Forest's probabilities (weight w) with XGBoost's (weight 1 - w)
"""
import argparse
import time

import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import train_test_split

from compare_models import SEED, build_features, build_target, load, set_device
from improve_xgb import REVIEW_COLS, listing_features, roc_auc_within_category, text_features, train_xgb
from optional_features import (RF_REVIEW_COLS, cat_sales_encoded, notebook_cleaning, optional_features,
                               rf_features, train_lgbm, train_rf)
from push_auc import train_tuned


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_dev.csv")
    ap.add_argument("--sample", type=int, default=None)
    ap.add_argument("--add", default="", help="comma-separated optional features to switch on")
    ap.add_argument("--clean", action="store_true", help="apply the notebook's cleaning first")
    ap.add_argument("--blend", default="", help="comma-separated Random Forest weights to try")
    ap.add_argument("--rf-trees", type=int, default=300)
    ap.add_argument("--tuned", choices=["none", "launch", "both"], default="none",
                    help="which models use push_auc.py's tuned XGBoost settings")
    ap.add_argument("--lgbm", action="store_true", help="also train LightGBM and average it with XGBoost")
    ap.add_argument("--gpu", action="store_true", help="train XGBoost on an NVIDIA GPU (CUDA)")
    args = ap.parse_args()
    set_device(args.gpu)
    add = [a.strip() for a in args.add.split(",") if a.strip()]
    weights = [float(w) for w in args.blend.split(",") if w.strip()]

    t0 = time.time()
    df = load(args.data, args.sample).reset_index(drop=True)
    if args.clean:
        n = len(df)
        df = notebook_cleaning(df)
        assert len(df) == n, "cleaning must not remove rows (it would change the test split)"
    y = build_target(df)
    base = build_features(df)
    listing, brand = listing_features(df)
    print(f"rows={len(df):,}  positive rate={y.mean():.1%}  add={add or '-'}  clean={args.clean}  "
          f"blend={weights or '-'}  tuned={args.tuned}")

    # Same split as improve_xgb.py
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    fit_idx, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)
    tr_idx, val_idx = train_test_split(fit_idx, test_size=0.1, stratify=y.loc[fit_idx], random_state=SEED)

    print("building text features...")
    text = text_features(df["title"].fillna(""), brand, y, fit_idx, te_idx)
    X = pd.concat([base, listing, text, optional_features(df, add, fit_idx, te_idx)], axis=1)

    y_te, cats_te = y.loc[te_idx], df.loc[te_idx, "category_id"]
    rows = []

    def record(name, p, sec):
        rows.append({"model": name, "ROC-AUC": roc_auc_score(y_te, p),
                     "PR-AUC": average_precision_score(y_te, p),
                     "within-cat": roc_auc_within_category(y_te, p, cats_te), "sec": sec})
        print(rows[-1])

    rf_X = None
    if weights:
        cse = cat_sales_encoded(df, fit_idx, te_idx)
        rf_X = rf_features(df, base, listing, text, cse)
    for name, Xs, rf_drop in [("full", X, []), ("launch-time", X.drop(columns=REVIEW_COLS), RF_REVIEW_COLS)]:
        t1 = time.time()
        tuned = args.tuned == "both" or (args.tuned == "launch" and name == "launch-time")
        _, p = (train_tuned if tuned else train_xgb)(Xs.loc[tr_idx], y.loc[tr_idx], Xs.loc[val_idx], y.loc[val_idx], Xs.loc[te_idx])
        record(f"{name} XGB", p, time.time() - t1)
        if args.lgbm:
            t1 = time.time()
            p_lgb = train_lgbm(Xs.loc[tr_idx], y.loc[tr_idx], Xs.loc[val_idx], y.loc[val_idx], Xs.loc[te_idx])
            record(f"{name} LightGBM alone", p_lgb, time.time() - t1)
            record(f"{name} XGB + LightGBM average", (p + p_lgb) / 2, 0.0)
        if weights:
            t1 = time.time()
            R = rf_X.drop(columns=rf_drop)
            _, p_rf = train_rf(R.loc[tr_idx], y.loc[tr_idx], R.loc[te_idx], n_estimators=args.rf_trees)
            record(f"{name} RF alone", p_rf, time.time() - t1)
            for w in weights:
                record(f"{name} blend w_rf={w:g}", (1 - w) * p + w * p_rf, 0.0)

    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))
    print(f"\ntotal time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
