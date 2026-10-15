"""
MarketLens: lock away a final test set BEFORE any more training or tuning.

Run once, right after clean_data.py:
    python make_holdout.py --data data\\products_clean.csv

Writes:
    data\\products_dev.csv       90%: use this for EVERYTHING from now on
                                 (compare_models.py, improve_xgb.py, train_final.py)
    data\\products_holdout.csv   10%: don't open it, don't train on it, don't tune on it.
                                 Use it once at the end with evaluate_holdout.py.

The split keeps every category and the share of successful products the same in both files.
It refuses to overwrite an existing holdout, so it can't get reshuffled by accident.
"""
import argparse
import os

import pandas as pd
from sklearn.model_selection import train_test_split

from compare_models import build_target

HOLDOUT_SEED = 2026   # different from the training seed on purpose


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join("data", "products_clean.csv"))
    ap.add_argument("--dev-out", default=os.path.join("data", "products_dev.csv"))
    ap.add_argument("--holdout-out", default=os.path.join("data", "products_holdout.csv"))
    ap.add_argument("--size", type=float, default=0.10)
    ap.add_argument("--force", action="store_true", help="overwrite an existing holdout")
    args = ap.parse_args()

    if os.path.exists(args.holdout_out) and not args.force:
        raise SystemExit(f"{args.holdout_out} already exists. Keep using it; "
                         "re-splitting would mix test products back into training.")

    df = pd.read_csv(args.data)
    y = build_target(df)
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 20, "rare")
    dev, hold = train_test_split(df, test_size=args.size, stratify=strat, random_state=HOLDOUT_SEED)

    dev.to_csv(args.dev_out, index=False)
    hold.to_csv(args.holdout_out, index=False)
    print(f"dev:     {len(dev):>10,} rows  ({build_target(dev).mean():.1%} successful)  -> {args.dev_out}")
    print(f"holdout: {len(hold):>10,} rows  ({build_target(hold).mean():.1%} successful)  -> {args.holdout_out}")
    print("From now on run every script with --data", args.dev_out)


if __name__ == "__main__":
    main()
