# Arthur Holobaugh - MarketLens - The University Of Texas at Dallas
# Sales_Foreacasting_Team




# ******** This script is used for initial Exploratory Data Analysis (EDA) ******
# ******** This script shall not be used for dataset cleaning

import pandas as pd

# ========== DATASET CONFIGURATION ==========
FILE_PATH = "data/All_Beauty.jsonl.gz"
FILE_TYPE = "json"  # "json" or "csv"
SAMPLE_SIZE = 10000

# Change these to match the dataset's column names
USER_COL = "user_id"
PRODUCT_COL = "parent_asin"
DATE_COL = "timestamp"

print()
print()
print()
# Date format: "ms", "s", or None for date strings
TIMESTAMP_UNIT = "ms"

print()
print()
print()
# ========== LOAD DATA ==========
if FILE_TYPE == "json":
    df = pd.read_json(
        FILE_PATH,
        lines=True,
        compression="infer",
        nrows=SAMPLE_SIZE
    )
elif FILE_TYPE == "csv":
    df = pd.read_csv(FILE_PATH, nrows=SAMPLE_SIZE)
else:
    raise ValueError("Unsupported file type")

print()
print()
print()
# ========== GENERAL EDA ==========
def section(title):
    print(f"\n{'=' * 40}\n{title}\n{'=' * 40}")

section("First 5 Rows")
print(df.head())

section("Columns")
print(df.columns.tolist())

section("Dataset Shape")
print(df.shape)

section("Data Types")
df.info()

section("Missing Values")
print(df.isnull().sum())

print()
print()
print()
# ========== DUPLICATES ==========
section("Duplicate Reviews")

duplicate_cols = [USER_COL, PRODUCT_COL, DATE_COL]

if all(col in df.columns for col in duplicate_cols):
    print(df.duplicated(subset=duplicate_cols).sum())
else:
    print("Required columns unavailable; skipping.")

print()
print()
print()
# ========== PRODUCT ANALYSIS ==========
if PRODUCT_COL in df.columns:
    section("Unique Products")
    print(df[PRODUCT_COL].nunique())

    section("Top 10 Products by Reviews")
    print(df[PRODUCT_COL].value_counts().head(10))

print()
print()
print()
# ========== MONTHLY REVIEW ACTIVITY ==========
if DATE_COL in df.columns:
    section("Monthly Review Activity")

    if TIMESTAMP_UNIT is not None:
        dates = pd.to_datetime(
            df[DATE_COL],
            unit=TIMESTAMP_UNIT,
            errors="coerce",
            utc=True
        )
    else:
        dates = pd.to_datetime(
            df[DATE_COL],
            errors="coerce",
            utc=True
        )

    monthly_reviews = (
        df.assign(review_date=dates)
          .dropna(subset=["review_date"])
          .set_index("review_date")
          .resample("MS")
          .size()
    )

    print(monthly_reviews)

