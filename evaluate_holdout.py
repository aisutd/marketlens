"""
MarketLens: the final, honest test of the saved model on the locked-away holdout.

Run ONCE, when you're finished improving the model:
    python evaluate_holdout.py --model models\\combined_model.joblib ^
        --holdout data\\products_holdout.csv

The holdout products are scored exactly like new product ideas (predict.py), against the
dev products the model was trained on. Their real "successful" label uses each category's
cutoff from the dev data, so nothing about the holdout leaks into how it's judged.

Prints ROC-AUC / PR-AUC / within-category ROC-AUC for the full and the launch-time model, and how often products in each Opportunity Score band really
succeeded (the table to show in the final presentation).
"""
import argparse
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from improve_xgb import roc_auc_within_category
from predict import featurize


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join("models", "combined_model.joblib"))
    ap.add_argument("--holdout", default=os.path.join("data", "products_holdout.csv"))
    args = ap.parse_args()

    bundle = joblib.load(args.model)
    ref = pd.read_csv(bundle["data_path"])
    hold = pd.read_csv(args.holdout)
    if set(hold["asin"]) & set(ref["asin"]):
        raise SystemExit("The model was trained on data that contains holdout products. "
                         "Retrain with --data data\\products_dev.csv first.")

    # Same label rule as training, with each category's cutoff taken from the dev data.
    cutoff = ref.groupby("category_id")["boughtInLastMonth"].quantile(0.8)
    hold = hold[hold["category_id"].isin(cutoff.index)].reset_index(drop=True)
    sold = hold["boughtInLastMonth"]
    y = ((sold >= hold["category_id"].map(cutoff)) & (sold > 0)).astype(int).values

    print(f"scoring {len(hold):,} holdout products...")
    X = featurize(bundle, ref, hold.drop(columns=["boughtInLastMonth"]))
    models = [("FULL MODEL", bundle)]
    if "launch" in bundle:   # same products, scored as if they had no stars or reviews yet
        models.append(("LAUNCH-TIME MODEL", bundle["launch"]))
    for name, m in models:
        report(name, m, X, y, hold["category_id"])


def report(name, m, X, y, cats):
    p = m["xgb"].predict_proba(X[m["feature_cols"]])[:, 1]

    # 0-100 Opportunity Score, same rule as predict.py: share of category peers it beats.
    peers = m["reference"]
    score = np.empty(len(p))
    for cid, idx in pd.Series(range(len(p))).groupby(cats.values):
        ref_p = peers.loc[peers["category_id"] == cid, "p"].values
        ref_p = np.sort(ref_p if len(ref_p) >= 30 else peers["p"].values)
        score[idx.values] = 100 * np.searchsorted(ref_p, p[idx.values]) / len(ref_p)

    print(f"\n{name}  ROC-AUC = {roc_auc_score(y, p):.4f}   PR-AUC = {average_precision_score(y, p):.4f}"
          f"   within category = {roc_auc_within_category(y, p, cats):.4f}"
          f"   (baseline PR-AUC = {y.mean():.4f})")
    bands = pd.cut(score, [0, 20, 40, 60, 80, 90, 100.1], right=False,
                   labels=["0-19", "20-39", "40-59", "60-79", "80-89", "90-100"])
    table = pd.DataFrame({"score band": bands, "successful": y}).groupby("score band", observed=False)
    table = table["successful"].agg(products="count", really_successful="mean")
    table["really_successful"] = (100 * table["really_successful"]).round(1).astype(str) + "%"
    print("How often products in each Opportunity Score band were really successful:")
    print(table.to_string())

if __name__ == "__main__":
    main()
