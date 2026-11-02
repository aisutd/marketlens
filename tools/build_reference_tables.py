"""
MarketLens: precompute the small tables api\\features_fast.py needs to score a product without the dev CSV.

    python tools\\build_reference_tables.py              # writes models\\reference_tables.joblib

predict.featurize appends the new product to all rows of the bundle's data_path (products_dev.csv) and
rebuilds every feature over the whole frame. Only eight features look at other products; this stores
exactly what they need, read once from the same CSV with the same pd.read_csv defaults:

    per category   n (asin count), sorted float64 arrays of price (raw), non-zero price,
                   non-NaN stars after replace(0, nan), and positive reviews
    per brand      row count and the categories it appears in (brand = improve_xgb.brand_of(title))
    categories     amazon_categories.csv name -> id, for predict.resolve_categories' lookup
    schema         the CSV's columns and dtypes as a 0-row frame, so a 1-row frame concatenates like featurize
    source         data_path, row count and SHA-256 of the CSV, checked against the bundle
"""
import argparse
import hashlib
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from improve_xgb import brand_of  # noqa: E402

VERSION = 1


def sha256(path, block=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(block):
            h.update(chunk)
    return h.hexdigest()


def sorted_f64(s):
    return np.sort(s.dropna().to_numpy(dtype=np.float64))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join("models", "embed_model.joblib"))
    ap.add_argument("--categories-file", default=os.path.join("data", "amazon_categories.csv"))
    ap.add_argument("--out", default=os.path.join("models", "reference_tables.joblib"))
    args = ap.parse_args()

    t0 = time.time()
    data_path = joblib.load(args.model)["data_path"]
    if "holdout" in data_path.lower():
        raise SystemExit("refusing: the bundle points at the holdout set")
    ref = pd.read_csv(data_path)   # same call as predict.py, so values and dtypes parse identically
    print(f"read {data_path}: {len(ref):,} rows ({time.time() - t0:.0f}s)")

    # The same series build_features / listing_features rank and take medians of.
    price = ref["price"]
    price_nz = price.replace(0, np.nan)
    stars = ref["stars"].replace(0, np.nan)
    reviews = ref["reviews"].where(ref["reviews"] > 0)
    cats = {}
    for cid, idx in ref.groupby("category_id").groups.items():
        p = sorted_f64(price.loc[idx])
        p_nz = sorted_f64(price_nz.loc[idx])
        cats[int(cid)] = {
            "n": int(ref.loc[idx, "asin"].count()),
            "price": p,
            "price_nz": p if len(p_nz) == len(p) else p_nz,   # same object when no zero prices: stored once
            "stars": sorted_f64(stars.loc[idx]),
            "reviews": sorted_f64(reviews.loc[idx]),
        }

    brand = ref["title"].fillna("").map(brand_of)
    brand_count = brand.value_counts()
    brand_cats = ref.groupby(brand)["category_id"].unique()
    brands = {b: (int(n), tuple(sorted(int(c) for c in brand_cats[b]))) for b, n in brand_count.items()}

    names = {}
    if os.path.exists(args.categories_file):
        cf = pd.read_csv(args.categories_file)
        names = {str(n).strip().lower(): int(i) for i, n in zip(cf["id"], cf["category_name"])}

    tables = {
        "version": VERSION,
        "source": {"data_path": data_path, "rows": len(ref), "sha256": sha256(data_path)},
        "schema": ref.iloc[:0].copy(),
        "categories": cats,
        "category_names": names,
        "brands": brands,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    joblib.dump(tables, args.out, compress=3)
    size = os.path.getsize(args.out) / 2**20
    n_vals = sum(len(c[k]) for c in cats.values() for k in ("price", "stars", "reviews")) + \
        sum(len(c["price_nz"]) for c in cats.values() if c["price_nz"] is not c["price"])
    print(f"{len(cats)} categories, {n_vals:,} stored values, {len(brands):,} brands, "
          f"{len(names)} category names; sha256 {tables['source']['sha256'][:16]}...")
    print(f"saved {args.out}: {size:.1f} MB ({time.time() - t0:.0f}s){'  OVER the 60 MB target' if size > 60 else ''}")


if __name__ == "__main__":
    main()
