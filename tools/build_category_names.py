"""
MarketLens: write api/categories.json, the display names of the categories the model can score.

    python tools\\build_category_names.py

The reference tables keep category names in lower case only (they are used for case-insensitive matching).
The website's dropdown wants the original names, which live in data/amazon_categories.csv; that CSV is not
shipped with the API. This writes [{"id": ..., "name": ...}] for the categories in
models/reference_tables.joblib, sorted by name, so the API can list them. It changes nothing in the model.
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import joblib  # noqa: E402
import pandas as pd  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--categories-file", default=os.path.join(ROOT, "data", "amazon_categories.csv"))
    ap.add_argument("--tables", default=os.path.join(ROOT, "models", "reference_tables.joblib"))
    ap.add_argument("--out", default=os.path.join(ROOT, "api", "categories.json"))
    args = ap.parse_args()

    tables = joblib.load(args.tables)
    cats = pd.read_csv(args.categories_file)
    names = {int(i): str(n).strip() for i, n in zip(cats["id"], cats["category_name"])}
    missing = sorted(set(tables["categories"]) - set(names))
    if missing:
        sys.exit(f"{args.categories_file} has no name for category ids {missing}")
    for cid in tables["categories"]:   # the tables match on the lower-cased name: it must lead back to cid
        if tables["category_names"].get(names[cid].lower()) != cid:
            sys.exit(f"category {cid} {names[cid]!r} does not resolve to itself in {args.tables}")
    out = sorted(({"id": cid, "name": names[cid]} for cid in tables["categories"]), key=lambda c: c["name"].lower())
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + ",\n".join(json.dumps(c, ensure_ascii=False) for c in out) + "\n]\n")
    print(f"wrote {args.out}: {len(out)} categories")


if __name__ == "__main__":
    main()
