"""
MarketLens: export our train/test split so Vishal can score his model on the same products.

Run:
    python export_split.py --data data\\products_dev.csv

Writes data\\split_for_vishal.csv with columns asin, split ("train" or "test"). It is the exact
split improve_xgb.py uses (seed 42, 20% test, stratified by category + label). Vishal puts the file
in his data\\ folder and sets SPLIT_FILE in his notebook's Setup. The holdout isn't in it.
"""
import argparse
import os

import pandas as pd
from sklearn.model_selection import train_test_split

from compare_models import SEED, build_target, load


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join("data", "products_dev.csv"))
    ap.add_argument("--out", default=os.path.join("data", "split_for_vishal.csv"))
    args = ap.parse_args()

    df = load(args.data).reset_index(drop=True)
    y = build_target(df)
    # Same split as improve_xgb.py, so both models are judged on the same test products.
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    _, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)

    split = pd.DataFrame({"asin": df["asin"], "split": "train"})
    split.loc[te_idx, "split"] = "test"
    split.to_csv(args.out, index=False)
    print(split["split"].value_counts().to_string())
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
