"""Clean Amazon Reviews 2023 review records (JSONL/JSONL.GZ/CSV).

Usage from the MarketLens repository root:
    python sales_forecasting/scripts/clean_data.py
    python sales_forecasting/scripts/clean_data.py --input data/Electronics.jsonl.gz --sample 10000
    python sales_forecasting/scripts/clean_data.py --input data/Electronics.jsonl.gz

Input is never modified. A default sample run writes a *different* output file.
The script loads the selected records in memory; large categories may require
chunked processing, which is not implemented here.
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
    parser.add_argument("--output", type=Path, default=None,
                        help="Optional output CSV path (default: data/processed/<category>_clean.csv)")
    parser.add_argument("--sample", type=int, default=None,
                        help="Only clean the first N reviews; default: all reviews")
    args = parser.parse_args()
    if args.sample is not None and args.sample <= 0:
        parser.error("--sample must be a positive integer")
    return args


def detect_format(path: Path) -> str:
    filename = path.name.lower()
    if filename.endswith((".jsonl.gz", ".jsonl", ".json.gz", ".json")):
        return "jsonl"
    if filename.endswith((".csv.gz", ".csv")):
        return "csv"
    raise ValueError(f"Unsupported input extension: {path.name}. Use .jsonl.gz, .jsonl, or .csv")


def default_output(input_path: Path, sample: int | None) -> Path:
    stem = input_path.name
    for extension in (".jsonl.gz", ".json.gz", ".csv.gz", ".jsonl", ".json", ".csv"):
        if stem.lower().endswith(extension):
            stem = stem[:-len(extension)]
            break
    if sample is not None:
        stem += f"_sample_{sample}"
    return PROJECT_ROOT / "data" / "processed" / f"{stem}_clean.csv"


def load_reviews(input_path: Path, sample: int | None) -> pd.DataFrame:
    if not input_path.is_file():
        raise FileNotFoundError(f"Dataset not found: {input_path}")
    file_format = detect_format(input_path)
    if file_format == "jsonl":
        return pd.read_json(input_path, lines=True, compression="infer", nrows=sample, convert_dates=False)
    return pd.read_csv(input_path, compression="infer", nrows=sample, low_memory=False)


def clean_reviews(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """Preserve the team's verified cleaning rules for Amazon Reviews 2023."""
    required = {"parent_asin", "timestamp"}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(
            f"Required Amazon Reviews 2023 columns missing: {sorted(missing)}. "
            f"Available columns: {raw.columns.tolist()}"
        )

    useful = [
        "user_id", "asin", "parent_asin", "timestamp", "rating",
        "title", "text", "verified_purchase", "helpful_vote",
    ]
    df = raw[[col for col in useful if col in raw.columns]].copy()
    report = {"input_rows": len(df)}

    for col in ("user_id", "asin", "parent_asin"):
        if col in df:
            df[col] = df[col].astype("string").str.strip().replace("", pd.NA)

    # Amazon Reviews 2023 timestamps represent milliseconds since Unix epoch.
    df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
    df["review_date"] = pd.to_datetime(df["timestamp"], unit="ms", errors="coerce", utc=True)

    bad_product = df["parent_asin"].isna()
    bad_date = df["review_date"].isna()
    report["missing_product_ids"] = int(bad_product.sum())
    report["invalid_timestamps"] = int(bad_date.sum())
    df = df.loc[~(bad_product | bad_date)].copy()

    if "user_id" in df:
        identity_fields = [
            col for col in (
                "user_id", "asin", "parent_asin", "timestamp",
                "rating", "title", "text",
            ) if col in df
        ]
        is_duplicate = df["user_id"].notna() & df.duplicated(subset=identity_fields, keep="first")
        report["duplicates_removed"] = int(is_duplicate.sum())
        df = df.loc[~is_duplicate].copy()
    else:
        # Keep all review records when reviewer IDs are unavailable: do not
        # guess that same-product/same-time reviews are necessarily duplicates.
        report["duplicates_removed"] = 0

    if "rating" in df:
        rating = pd.to_numeric(df["rating"], errors="coerce")
        df["rating"] = rating.where(rating.between(1, 5))

    if "helpful_vote" in df:
        votes = pd.to_numeric(df["helpful_vote"], errors="coerce")
        df["helpful_vote"] = votes.where((votes >= 0) & (votes.mod(1) == 0)).astype("Int64")

    if "verified_purchase" in df:
        df["verified_purchase"] = (
            df["verified_purchase"].astype("string").str.strip().str.lower()
            .map({"true": True, "false": False}).astype("boolean")
        )

    df["review_month"] = df["review_date"].dt.strftime("%Y-%m")
    df = df.sort_values(["parent_asin", "review_date"]).reset_index(drop=True)
    report["clean_rows"] = len(df)
    return df, report


def main() -> None:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_path = (args.output or default_output(input_path, args.sample)).expanduser().resolve()
    if input_path == output_path:
        raise ValueError("Output cannot overwrite the raw input dataset")

    raw = load_reviews(input_path, args.sample)
    cleaned, report = clean_reviews(raw)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(output_path, index=False)

    print("\nDATA CLEANING REPORT")
    for metric, value in report.items():
        print(f"  {metric}: {value:,}")
    print(f"  source: {input_path}")
    print(f"  output: {output_path}")
    print("  These are review records, NOT sales units.")
    print("  Full files are loaded into RAM; use --sample first for large categories.")


if __name__ == "__main__":
    main()
