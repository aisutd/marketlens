"""
MarketLens helper: score our features on Vishal's first target (monthly sales), so his R2 numbers
can be compared with ours on the same products.

Trains XGBRegressor on log1p(boughtInLastMonth) with the same features and the same split as
improve_xgb.py (seed 42, 20% test, stratified by category + label), and prints
R2 and RMSE on the log scale, and MAE in units per month, for:

    baseline: category average   each test product gets its category's mean log-sales (training rows)
    all features                 base + listing + text
    launch-time                  the same without the product's own stars and review counts

Run:
    python compare_with_vishal.py --data data\\products_dev.csv --sample 300000
"""
import argparse
import time

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from compare_models import SEED, build_features, build_target, load, set_device, xgb_device
from improve_xgb import REVIEW_COLS, listing_features, text_features


def train_reg(X_tr, y_tr, X_val, y_val, X_te):
    model = XGBRegressor(
        n_estimators=3000, learning_rate=0.05, max_depth=7, min_child_weight=5,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=2.0, tree_method="hist",
        enable_categorical=True, max_cat_to_onehot=1, eval_metric="rmse",
        early_stopping_rounds=100, n_jobs=-1, random_state=SEED, device=xgb_device())
    model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
    return model, model.predict(X_te)


def scores(name, y_log, p_log):
    return {"model": name,
            "R2 (log scale)": r2_score(y_log, p_log),
            "RMSE (log scale)": np.sqrt(mean_squared_error(y_log, p_log)),
            "MAE (units/month)": mean_absolute_error(np.expm1(y_log), np.expm1(np.clip(p_log, 0, None)))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_dev.csv")
    ap.add_argument("--sample", type=int, default=None)
    ap.add_argument("--gpu", action="store_true", help="train XGBoost on an NVIDIA GPU (CUDA)")
    args = ap.parse_args()
    set_device(args.gpu)

    t0 = time.time()
    df = load(args.data, args.sample).reset_index(drop=True)
    y = build_target(df)
    log_sales = np.log1p(df["boughtInLastMonth"].clip(lower=0))
    listing, brand = listing_features(df)
    print(f"rows={len(df):,}")

    # Same split as improve_xgb.py
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    fit_idx, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)
    tr_idx, val_idx = train_test_split(fit_idx, test_size=0.1, stratify=y.loc[fit_idx], random_state=SEED)

    print("building text features...")
    text = text_features(df["title"].fillna(""), brand, y, fit_idx, te_idx)
    X = pd.concat([build_features(df), listing, text], axis=1)

    y_te = log_sales.loc[te_idx]
    cat_avg = log_sales.loc[fit_idx].groupby(df.loc[fit_idx, "category_id"]).mean()
    p_cat = df.loc[te_idx, "category_id"].map(cat_avg).fillna(log_sales.loc[fit_idx].mean())
    rows = [scores("baseline: category average", y_te, p_cat)]
    for name, Xs in [("all features", X), ("launch-time", X.drop(columns=REVIEW_COLS))]:
        _, p = train_reg(Xs.loc[tr_idx], log_sales.loc[tr_idx], Xs.loc[val_idx], log_sales.loc[val_idx],
                         Xs.loc[te_idx])
        rows.append(scores(name, y_te, p))
        print(rows[-1])

    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))
    print(f"\ntotal time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
