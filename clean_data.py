"""
MarketLens step 1: clean the Kaggle "Amazon Products Dataset 2023 (1.4M)" before training.

Input (from https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products):
    amazon_products.csv     asin,title,imgUrl,productURL,stars,reviews,price,listPrice,
                            category_id,isBestSeller,boughtInLastMonth
    amazon_categories.csv   id,category_name   (optional, adds readable names)

Run:
    python clean_data.py --data data\\amazon_products.csv ^
        --categories-file data\\amazon_categories.csv --out data\\products_clean.csv
    python clean_data.py --min-cat-size 500 --out clean.csv
    python clean_data.py --categories "Kitchen & Dining,Sports & Outdoors"

Output:
    products_clean.csv      cleaned rows, ready for make_holdout.py
    cleaning_report.txt     rows removed at each step (paste this into the Discord update)
"""
import argparse

import numpy as np
import pandas as pd


def clean(df, cats=None, min_cat_size=200, keep_categories=None):
    log = [("raw rows", len(df))]

    def step(name, frame):
        log.append((name, len(frame)))
        return frame

    df = df.copy()
    df["title"] = df["title"].astype("string").str.strip()
    df = step("drop rows with no ASIN or title",
              df[df["asin"].notna() & (df["title"].fillna("").str.len() > 0)])
    df = step("drop duplicate ASINs", df.drop_duplicates(subset="asin"))

    # In this dataset 0 means "missing", not a real value.
    df["price"] = df["price"].replace(0, np.nan)
    df["listPrice"] = df["listPrice"].replace(0, np.nan)
    df.loc[(df["stars"] == 0) & (df["reviews"] == 0), "stars"] = np.nan
    df = step("drop rows with no price", df.dropna(subset=["price"]))

    # Extreme prices are almost always data errors or bundles; cut the top 0.1%.
    df = step("drop top 0.1% prices", df[df["price"] <= df["price"].quantile(0.999)])
    df.loc[df["listPrice"] < df["price"], "listPrice"] = np.nan  # list price below price is invalid

    df["boughtInLastMonth"] = df["boughtInLastMonth"].fillna(0).clip(lower=0).astype(int)
    df["reviews"] = df["reviews"].fillna(0).clip(lower=0).astype(int)

    if cats is not None:
        df = df.merge(cats.rename(columns={"id": "category_id"}), on="category_id", how="left")
    if keep_categories:
        df = step("keep chosen categories", df[df["category_name"].isin(keep_categories)])

    sizes = df["category_id"].map(df["category_id"].value_counts())
    df = step(f"drop categories with < {min_cat_size} products", df[sizes >= min_cat_size])

    # A category where nothing sold can't define "top 20% of sales", so it can't train the model.
    sold = df.groupby("category_id")["boughtInLastMonth"].transform("max")
    df = step("drop categories with no sales signal", df[sold > 0])

    for col in ("imgUrl", "productURL"):
        if col in df:
            df = df.drop(columns=col)
    return df.reset_index(drop=True), log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="amazon_products.csv")
    ap.add_argument("--categories-file", default="amazon_categories.csv")
    ap.add_argument("--categories", default="", help="comma-separated category names to keep")
    ap.add_argument("--min-cat-size", type=int, default=200)
    ap.add_argument("--out", default="products_clean.csv")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    try:
        cats = pd.read_csv(args.categories_file)
    except FileNotFoundError:
        cats = None
    keep = [c.strip() for c in args.categories.split(",") if c.strip()]
    clean_df, log = clean(df, cats, args.min_cat_size, keep)
    clean_df.to_csv(args.out, index=False)

    lines = [f"{name:<45}{n:>12,}" for name, n in log]
    lines += ["", f"categories kept: {clean_df['category_id'].nunique()}",
              f"share with boughtInLastMonth > 0: {(clean_df['boughtInLastMonth'] > 0).mean():.1%}",
              f"missing stars: {clean_df['stars'].isna().mean():.1%}",
              f"missing listPrice: {clean_df['listPrice'].isna().mean():.1%}"]
    report = "\n".join(lines)
    print(report)
    with open("cleaning_report.txt", "w") as f:
        f.write(report + "\n")


if __name__ == "__main__":
    main()
