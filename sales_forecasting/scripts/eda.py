"""Explore Amazon Reviews 2023 category data (without modifying it).

Examples:
    python sales_forecasting/scripts/eda.py
    python sales_forecasting/scripts/eda.py --input data/Electronics.jsonl.gz --sample 10000
"""

import argparse
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "All_Beauty.jsonl.gz"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Amazon Reviews 2023 .jsonl.gz, .jsonl, or .csv file")
    parser.add_argument("--sample", type=int, default=10_000,
                        help="Number of reviews to examine (default: 10000)")
    args = parser.parse_args()
    if args.sample <= 0:
        parser.error("--sample must be positive")
    return args


def load_sample(path: Path, sample: int) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")
    filename = path.name.lower()
    if filename.endswith((".jsonl.gz", ".jsonl", ".json.gz", ".json")):
        return pd.read_json(path, lines=True, compression="infer", nrows=sample, convert_dates=False)
    if filename.endswith((".csv", ".csv.gz")):
        return pd.read_csv(path, nrows=sample, compression="infer", low_memory=False)
    raise ValueError(f"Unsupported input extension: {path.name}")


def section(name: str) -> None:
    print(f"\n{'=' * 12} {name} {'=' * 12}")


def main() -> None:
    args = parse_args()
    path = args.input.expanduser().resolve()
    df = load_sample(path, args.sample)

    section("SOURCE")
    print(f"File: {path}")
    print(f"Rows examined: {len(df):,}")
    print("All statistics below are based on the loaded sample, NOT the full dataset.")

    section("FIRST FIVE ROWS")
    print(df.head().to_string(index=False))
    section("COLUMNS")
    print(df.columns.tolist())
    section("SHAPE AND TYPES")
    print(df.shape)
    df.info()
    section("MISSING VALUES")
    print(df.isna().sum().to_string())

    # Use the same reviewer + review identity policy as clean_data.py
    identity = [c for c in (
        "user_id", "asin", "parent_asin", "timestamp", "rating", "title", "text"
    ) if c in df.columns]
    section("POTENTIAL DUPLICATE REVIEWS")
    if "user_id" in df.columns:
        normalized = df.copy()
        for col in ("user_id", "asin", "parent_asin"):
            if col in normalized.columns:
                normalized[col] = normalized[col].astype("string").str.strip().replace("", pd.NA)
        normalized["timestamp"] = pd.to_numeric(normalized["timestamp"], errors="coerce") if "timestamp" in normalized else pd.NA
        print(int((normalized["user_id"].notna() & normalized.duplicated(subset=identity)).sum()))
    else:
        print("No user_id column: cannot apply reviewer-based deduplication rule")

    if "parent_asin" in df.columns:
        section("PRODUCTS")
        products = df["parent_asin"].astype("string").str.strip().replace("", pd.NA)
        print(f"Unique product families: {products.nunique():,}")
        print(products.value_counts().head(10).to_string())
    else:
        print("\nMissing expected column parent_asin")

    if "timestamp" in df.columns:
        section("MONTHLY REVIEW ACTIVITY")
        raw_times = pd.to_numeric(df["timestamp"], errors="coerce")
        dates = pd.to_datetime(raw_times, unit="ms", errors="coerce", utc=True)
        print(f"Invalid timestamps in sample: {dates.isna().sum():,}")
        months = dates.dropna().dt.strftime("%Y-%m").value_counts().sort_index()
        print(months.to_string())
    else:
        print("\nMissing expected column timestamp")
    print("\nReview counts are NOT observed sales units.")


if __name__ == "__main__":
    main()
