"""
MarketLens helper: check what's still dirty in the cleaned data BEFORE cleaning more.

Run (read-only, changes nothing):
    python check_data.py --data data\\products_dev.csv

Prints four checks:
    1. Duplicate listings   same title under different ASINs (colour/size variants, resellers).
                            If copies land in both train and test, the title score has seen
                            the answer, and the test score looks better than it really is.
    2. Price outliers       per-category IQR rule (Vishal's idea): prices far outside what's
                            normal for that category.
    3. Dead categories      categories where almost nothing sells, so "top 20%" means very little.
    4. Missing values       how much of each input is empty.
"""
import argparse
import re

import pandas as pd
from sklearn.model_selection import train_test_split

from compare_models import SEED, build_target, load


def norm_title(t):
    # Lowercase and drop punctuation, so "Bottle, 32oz - Blue" == "bottle 32oz blue".
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", str(t).lower()).split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_dev.csv")
    args = ap.parse_args()

    df = load(args.data).reset_index(drop=True)
    y = build_target(df)
    n = len(df)
    print(f"rows={n:,}  categories={df['category_id'].nunique()}  positive rate={y.mean():.1%}\n")

    # 1. Duplicate listings, and how many cross the train/test split used by improve_xgb.py
    key = df["title"].map(norm_title)
    dup = key.duplicated(keep=False)
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    fit_idx, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)
    leaked = key.loc[te_idx].isin(set(key.loc[fit_idx]))
    same_label = (pd.DataFrame({"k": key, "y": y}).groupby("k")["y"].nunique() == 1)
    print("1. DUPLICATE LISTINGS")
    print(f"   rows whose title appears more than once: {dup.sum():,} ({dup.mean():.1%})")
    print(f"   distinct titles with copies:             {key[dup].nunique():,}")
    print(f"   test rows with a copy in training:       {leaked.sum():,} ({leaked.mean():.1%} of test)")
    print(f"   duplicate groups where all copies share the same label: "
          f"{same_label[key[dup].unique()].mean():.1%}")
    print("   -> if 'test rows with a copy in training' is above ~5%, split by title group instead\n")

    # 2. Price outliers by category (IQR rule, 3x for 'extreme')
    q1 = df.groupby("category_id")["price"].transform(lambda s: s.quantile(0.25))
    q3 = df.groupby("category_id")["price"].transform(lambda s: s.quantile(0.75))
    iqr = q3 - q1
    mild = (df["price"] > q3 + 1.5 * iqr) | (df["price"] < q1 - 1.5 * iqr)
    extreme = (df["price"] > q3 + 3 * iqr) | (df["price"] < q1 - 3 * iqr)
    print("2. PRICE OUTLIERS (per category)")
    print(f"   outside 1.5x IQR: {mild.sum():,} ({mild.mean():.1%})   "
          f"outside 3x IQR: {extreme.sum():,} ({extreme.mean():.1%})")
    print(f"   success rate: extreme-price rows {y[extreme].mean():.1%} vs others {y[~extreme].mean():.1%}")
    print(f"   prices under $1: {(df['price'] < 1).sum():,}\n")

    # 3. Dead categories
    cat = pd.DataFrame({"cat": df["category_id"], "y": y, "sold": df["boughtInLastMonth"] > 0})
    per = cat.groupby("cat").agg(rows=("y", "size"), pos=("y", "mean"), sold=("sold", "mean"))
    dead = per[per["sold"] < 0.05]
    print("3. DEAD CATEGORIES (under 5% of products sell at all)")
    print(f"   {len(dead)} of {len(per)} categories, {dead['rows'].sum():,} rows "
          f"({dead['rows'].sum() / n:.1%} of data)")
    print(f"   positive rate per category: median {per['pos'].median():.1%}, "
          f"min {per['pos'].min():.1%}, max {per['pos'].max():.1%}\n")

    # 4. Missing values
    print("4. MISSING / ZERO VALUES")
    for col, miss in (("stars", df["stars"].fillna(0) <= 0), ("reviews", df["reviews"].fillna(0) <= 0),
                      ("listPrice", df["listPrice"].fillna(0) <= 0),
                      ("title", df["title"].fillna("").str.len() < 10)):
        print(f"   {col:<10} {miss.mean():.1%}")


if __name__ == "__main__":
    main()
