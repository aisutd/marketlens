"""
MarketLens step 7: the final, honest test of the saved model on the locked-away holdout.

Run ONCE, when you're finished improving the model:
    python evaluate_holdout.py --model models\\opportunity_model.joblib ^
        --holdout data\\products_holdout.csv

The holdout products are scored exactly like new product ideas (predict.py), against the
dev products the model was trained on. Their real "successful" label uses each category's
cutoff from the dev data, so nothing about the holdout leaks into how it's judged.

Prints ROC-AUC / PR-AUC, and how often products in each Opportunity Score band really
succeeded (the table to show in the final presentation).
"""
import argparse
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from predict import featurize


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join("models", "opportunity_model.joblib"))
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
    p = bundle["xgb"].predict_proba(X)[:, 1]

    # 0-100 Opportunity Score, same rule as predict.py: share of category peers it beats.
    peers = bundle["reference"]
    score = np.empty(len(p))
    for cid, idx in pd.Series(range(len(p))).groupby(hold["category_id"].values):
        ref_p = peers.loc[peers["category_id"] == cid, "p"].values
        ref_p = np.sort(ref_p if len(ref_p) >= 30 else peers["p"].values)
        score[idx.values] = 100 * np.searchsorted(ref_p, p[idx.values]) / len(ref_p)

    print(f"\nHOLDOUT  ROC-AUC = {roc_auc_score(y, p):.4f}   PR-AUC = {average_precision_score(y, p):.4f}"
          f"   (baseline PR-AUC = {y.mean():.4f})")
    bands = pd.cut(score, [0, 20, 40, 60, 80, 90, 100.1], right=False,
                   labels=["0-19", "20-39", "40-59", "60-79", "80-89", "90-100"])
    table = pd.DataFrame({"score band": bands, "successful": y}).groupby("score band", observed=False)
    table = table["successful"].agg(products="count", really_successful="mean")
    table["really_successful"] = (100 * table["really_successful"]).round(1).astype(str) + "%"
    print("\nHow often products in each Opportunity Score band were really successful:")
    print(table.to_string())


if __name__ == "__main__":
    main()
