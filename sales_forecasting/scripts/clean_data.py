"""Clean Amazon Reviews 2023 All_Beauty records for MarketLens forecasting.

Run from any directory:
    python sales_forecasting/scripts/clean_data.py

Set SAMPLE_SIZE = None after checking the first 10,000 records.
This script NEVER overwrites the raw dataset.
"""

from pathlib import Path

import pandas as pd

# The script lives in <repo>/sales_forecasting/scripts/.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
INPUT_PATH = PROJECT_ROOT / "data" / "All_Beauty.jsonl.gz"
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "All_Beauty_clean.csv"
SAMPLE_SIZE = 10_000  # Change to None to process all reviews.


def clean_reviews(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Clean review-level data without inventing missing sales/reviews."""
    required = {"parent_asin", "timestamp"}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"Required columns are missing: {sorted(missing)}")

    # Keep columns useful for counts, review trends, and future features.
    # Exclude `images`, which contains nested lists and is not needed here.
    useful = [
        "user_id", "asin", "parent_asin", "timestamp", "rating",
        "title", "text", "verified_purchase", "helpful_vote",
    ]
    df = raw[[col for col in useful if col in raw.columns]].copy()
    report = {"input_rows": len(df)}

    # Normalize identifiers, but preserve their original capitalization.
    for col in ("user_id", "asin", "parent_asin"):
        if col in df:
            df[col] = df[col].astype("string").str.strip().replace("", pd.NA)

    # Amazon Reviews 2023 records time in milliseconds since Unix epoch.
    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df["review_date"] = pd.to_datetime(
        df["timestamp"], unit="ms", errors="coerce", utc=True
    )

    bad_product = df["parent_asin"].isna()
    bad_date = df["review_date"].isna()
    report["missing_product_ids"] = int(bad_product.sum())
    report["invalid_timestamps"] = int(bad_date.sum())
    df = df.loc[~(bad_product | bad_date)].copy()

    # Avoid removing two legitimate reviews just because they share a date.
    # Only remove repeated reviews with the same reviewer, product, time,
    # rating, and text (when those columns are present).
    if "user_id" in df:
        identity_fields = [
            col for col in (
                "user_id", "asin", "parent_asin", "timestamp",
                "rating", "title", "text",
            ) if col in df
        ]
        is_duplicate = df["user_id"].notna() & df.duplicated(
            subset=identity_fields, keep="first"
        )
        report["duplicates_removed"] = int(is_duplicate.sum())
        df = df.loc[~is_duplicate].copy()
    else:
        report["duplicates_removed"] = 0

    # Bad/missing ratings are left unknown; a review still counts as a review.
    if "rating" in df:
        rating = pd.to_numeric(df["rating"], errors="coerce")
        df["rating"] = rating.where(rating.between(1, 5))

    if "helpful_vote" in df:
        votes = pd.to_numeric(df["helpful_vote"], errors="coerce")
        df["helpful_vote"] = votes.where(
            (votes >= 0) & (votes.mod(1) == 0)
        ).astype("Int64")

    if "verified_purchase" in df:
        df["verified_purchase"] = (
            df["verified_purchase"]
            .astype("string")
            .str.strip()
            .str.lower()
            .map({"true": True, "false": False})
            .astype("boolean")
        )

    # This is a time key, NOT a sales label or sales estimate.
    df["review_month"] = df["review_date"].dt.strftime("%Y-%m")
    df = df.sort_values(["parent_asin", "review_date"]).reset_index(drop=True)
    report["clean_rows"] = len(df)
    return df, report


def main() -> None:
    if not INPUT_PATH.is_file():
        raise FileNotFoundError(
            f"Dataset not found: {INPUT_PATH}\n"
            "Put All_Beauty.jsonl.gz in the project's data/ folder."
        )

    raw = pd.read_json(
        INPUT_PATH,
        lines=True,
        compression="infer",
        nrows=SAMPLE_SIZE,
    )
    cleaned, report = clean_reviews(raw)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(OUTPUT_PATH, index=False)

    print("\nData cleaning report")
    for metric, value in report.items():
        print(f"  {metric}: {value:,}")
    print(f"  output: {OUTPUT_PATH}")
    print("Note: these are review records, not confirmed sales units.")


if __name__ == "__main__":
    main()
