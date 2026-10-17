"""
MarketLens helper: before building anything on Amazon Reviews 2023, check how many of OUR products it covers.

Download one category's two files from https://amazon-reviews-2023.github.io (start with a big one,
e.g. Home_and_Kitchen): meta_<Category>.jsonl.gz and <Category>.jsonl.gz. Then run:

    python check_reviews_match.py --data data\\products_dev.csv ^
        --meta data\\meta_Home_and_Kitchen.jsonl.gz --reviews data\\Home_and_Kitchen.jsonl.gz

Prints how many of our ASINs appear in the reviews file (as asin) or the meta file (as parent_asin),
and for matched products: review count, first review date, and how often the meta file has a
rating count where our data has none. If the match rate is low (under ~20%), this dataset won't move
the model and we shouldn't spend days on it.

Reads the files line by line, so it works on an 8 GB laptop. --max-reviews caps the review lines read.
"""
import argparse
import gzip
import json

import pandas as pd


def read_jsonl(path, limit=None):
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if limit and i >= limit:
                break
            yield json.loads(line)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_dev.csv")
    ap.add_argument("--meta", required=True)
    ap.add_argument("--reviews", required=True)
    ap.add_argument("--max-reviews", type=int, default=None)
    args = ap.parse_args()

    ours = pd.read_csv(args.data, usecols=["asin", "reviews", "category_id"])
    our_asins = set(ours["asin"])
    print(f"our products: {len(our_asins):,}")

    # Reviews: asin -> parent_asin, review count, first review time
    counts, first_ts, parent_of = {}, {}, {}
    for r in read_jsonl(args.reviews, args.max_reviews):
        a = r.get("asin")
        if a in our_asins:
            counts[a] = counts.get(a, 0) + 1
            ts = r.get("timestamp", 0)
            first_ts[a] = min(first_ts.get(a, ts), ts)
            parent_of[a] = r.get("parent_asin")
    # Meta is keyed by parent_asin
    meta = {}
    for m in read_jsonl(args.meta):
        meta[m.get("parent_asin")] = m.get("rating_number")

    direct_meta = our_asins & set(meta)          # our ASIN is itself a parent ASIN
    via_reviews = {a for a, p in parent_of.items() if p in meta}
    any_meta = direct_meta | via_reviews
    print(f"in reviews file (by asin):        {len(counts):>9,}  ({len(counts) / len(our_asins):.1%})")
    print(f"in meta file (direct parent_asin): {len(direct_meta):>9,}  ({len(direct_meta) / len(our_asins):.1%})")
    print(f"in meta file (any route):          {len(any_meta):>9,}  ({len(any_meta) / len(our_asins):.1%})")

    if counts:
        c = pd.Series(counts)
        first = pd.to_datetime(pd.Series(first_ts), unit="ms")
        print(f"\nmatched products: median {c.median():.0f} reviews, "
              f"first review between {first.min():%Y-%m} and {first.max():%Y-%m}")
    # Can the meta file fill our missing review counts?
    missing = set(ours.loc[ours["reviews"].fillna(0) <= 0, "asin"])
    fillable = [a for a in missing & any_meta
                if (meta.get(a) or meta.get(parent_of.get(a)) or 0) > 0]
    print(f"our products with no review count: {len(missing):,}; "
          f"meta file has a rating count for {len(fillable):,} of them")


if __name__ == "__main__":
    main()
