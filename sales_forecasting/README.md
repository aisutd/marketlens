# MarketLens — Sales Forecasting: Amazon Reviews 2023

The team's EDA and cleaning scripts work across **Amazon Reviews 2023 review categories** that share the same columns, such as All_Beauty and Electronics. They **do not estimate confirmed sales**. Review-activity forecasting is only a possible proxy for sales activity.

## Setup (macOS Terminal)

Use the project root when you run these commands:

```bash
cd ~/marketlens
python3 -m venv .venv         # Only if you don't already have one
source .venv/bin/activate
python -m pip install pandas
```

Place an Amazon Reviews 2023 **review file** (not the `meta_` product-metadata file) inside `data/`. Git ignores `data/` and `.venv/`. Review files typically use `.jsonl.gz` and provide `parent_asin`, `timestamp` (Unix milliseconds), and optional review fields (`user_id`, `asin`, `rating`, `title`, `text`, `helpful_vote`, `verified_purchase`).

## Run EDA on your category

```bash
python sales_forecasting/scripts/eda.py --input data/All_Beauty.jsonl.gz
python sales_forecasting/scripts/eda.py --input data/Electronics.jsonl.gz --sample 10000
```

EDA uses the **first** 10,000 reviews by default. It is not a random or representative sample; monthly counts from EDA are not full-month totals. This script does not modify the input file.

## Clean a sample first

```bash
python sales_forecasting/scripts/clean_data.py --input data/All_Beauty.jsonl.gz --sample 10000
```

This creates `data/processed/All_Beauty_sample_10000_clean.csv`, **not** `All_Beauty_clean.csv`. On rerun, the script may overwrite its output CSV. It never alters the raw input.

## Clean the whole category

```bash
python sales_forecasting/scripts/clean_data.py --input data/All_Beauty.jsonl.gz
python sales_forecasting/scripts/clean_data.py --input data/Electronics.jsonl.gz
```

Output files use category-specific names such as `data/processed/All_Beauty_clean.csv` and `data/processed/Electronics_clean.csv`. To choose an alternative output name (for example, comparing cleaner versions without replacing the existing clean CSV):

```bash
python sales_forecasting/scripts/clean_data.py \
  --input data/All_Beauty.jsonl.gz \
  --output data/processed/All_Beauty_clean_v2.csv
```

**Memory warning:** Each full category file is loaded into RAM. All_Beauty worked on one teammate's Mac, but very large categories like Electronics may exhaust available memory. Start with `--sample`; chunked or streaming cleaning is a later improvement. The script doesn't claim to handle arbitrary-size files.

## Cleaning policy

- Drop rows missing `parent_asin` or having invalid `timestamp` values.
- Preserve capitalization of identifiers and trim whitespace.
- With `user_id`, drop duplicate identities matching reviewer, product/variant, timestamp, rating, title and review text (when present). If `user_id` is missing, no deduplication is attempted to avoid incorrectly merging distinct customers' reviews.
- Convert invalid ratings and helpful-vote values to missing; retain their review rows.
- Normalize `verified_purchase` to nullable booleans.
- Generate UTC `review_date` and `review_month` (`YYYY-MM`).

These are the same core cleaning decisions used for the previously verified All_Beauty run. The cleaner only needs to be given a different input path for a different 2023 category.

## Verify a cleaned CSV

From `~/marketlens`, run (change the file name for your category):

```bash
python - <<'PY'
import pandas as pd
p = 'data/processed/All_Beauty_clean.csv'
df = pd.read_csv(p, low_memory=False)
dates = pd.to_datetime(df['timestamp'], unit='ms', errors='coerce', utc=True)
assert df['parent_asin'].notna().all()
assert dates.notna().all()
assert df['review_month'].eq(dates.dt.strftime('%Y-%m')).all()
print(f'PASS: {len(df):,} cleaned review records; {df.parent_asin.nunique():,} product families')
PY
```

For All_Beauty, an earlier completed run produced **694,252** cleaned rows from **701,528** input rows. After making the CLI changes, compare the new count against that baseline. The count alone does not verify every value; preserve the old output when comparing versions.

## Sharing in GitHub

Commit `eda.py`, `clean_data.py`, and `README.md`, not datasets or `.venv`. **Wait until All_Beauty is validated and at least one teammate has tested another 2023 category** before merging these changes into the team's shared branch.

## Scope

These scripts target **Amazon Reviews 2023 review records**. Amazon product metadata, sales transactions, older Amazon review schemas, and arbitrary CSV formats require different field mapping or data-cleaning rules.
