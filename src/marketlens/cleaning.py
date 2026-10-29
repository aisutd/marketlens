"""Raw Amazon scrape -> clean U.S. product table (port of notebooks/01_data_cleaning.ipynb).

The output matches data/interim/amazon_us_clean.csv exactly for the same seed, on any machine:
the row order used for the seeded price noise is pinned in data/reference/cleaning_row_order.csv.
(Sorting alone isn't enough: products with tied review counts can sort differently across CPU
architectures, which would shuffle the noise between them.)
"""
import numpy as np
import pandas as pd

from .config import DISCOUNT_CAP_PCT, FX_INR_PER_USD, REFERENCE, SEED

ROW_ORDER_FILE = REFERENCE / "cleaning_row_order.csv"

TEXT_COLS = ["review_title", "review_content", "user_id", "review_id"]
BRAND_FIX = {"boAt": "boAt", "MI": "Xiaomi", "Redmi": "Xiaomi", "Mi": "Xiaomi"}
POS = r"\b(good|great|excellent|nice|awesome|best|value|perfect|love|satisf|worth|recommend|amazing|fine|quality)"
NEG = r"\b(bad|poor|worst|waste|broken|defect|stopp|not working|cheap|return|disappoint|fake|issue|problem)"
BUNDLE = r"pack of|set of|combo|\b\d+\s?(?:pcs|pieces)\b"
CLEAN_COLUMNS = ["product_id", "product_name", "brand", "us_category", "cat_l1", "cat_l2", "cat_l3", "cat_leaf", "cat_depth",
                 "price_usd", "list_price_usd", "discount_pct", "discount_usd", "orig_discount_pct",
                 "rating", "rating_count", "review_sentiment", "n_reviews_sampled",
                 "name_len", "about_len", "n_bullets", "brand_listing_count", "is_bundle"]


def to_number(s: pd.Series) -> pd.Series:
    """'₹1,07,687' / '64%' / '24,269' -> float. Strips every character except digits and '.'."""
    return pd.to_numeric(s.str.replace(r"[^0-9.]", "", regex=True).replace("", np.nan), errors="coerce")


def us_category(cat_l1: str, cat_l2) -> str:
    """Map the Indian category path to the U.S. Amazon top-level category used for fees and economics."""
    l2 = cat_l2 or ""
    if l2 in ("Mobiles&Accessories", "WearableTechnology"):          return "Cell Phones & Accessories"
    if l2 in ("Headphones,Earbuds&Accessories", "HomeAudio"):        return "Electronics - Audio"
    if l2 == "HomeTheater,TV&Video":                                 return "Electronics - TV & Video"
    if l2 == "Cameras&Photography":                                  return "Camera & Photo"
    if cat_l1 == "Electronics":                                      return "Electronics - Accessories"
    if cat_l1 == "Computers&Accessories":
        if l2 in ("Components", "Monitors", "Tablets", "ExternalDevices&DataStorage", "NetworkingDevices", "Laptops"):
            return "Computers & Accessories"
        return "Computer Accessories & Peripherals"
    if cat_l1 == "Home&Kitchen":
        return "Kitchen & Home Appliances" if l2 in ("Kitchen&HomeAppliances", "Heating,Cooling&AirQuality") else "Home & Kitchen"
    return {"OfficeProducts": "Office Products", "MusicalInstruments": "Musical Instruments",
            "HomeImprovement": "Tools & Home Improvement", "Toys&Games": "Toys & Games",
            "Car&Motorbike": "Automotive", "Health&PersonalCare": "Health & Household"}.get(cat_l1, "Other")


def us_multiplier(price_usd_fx: pd.Series) -> pd.Series:
    """U.S. market price multiplier: ~2.6x at $2, ~2.0x at $20, ~1.6x at $200, floor 1.25x."""
    return (2.6 - 0.45 * np.log10(price_usd_fx.clip(lower=2) / 2)).clip(lower=1.25)


def snap_99(x: pd.Series, floor: float = 5.99) -> pd.Series:
    """Snap to U.S. .99 price points with a $5.99 floor."""
    return (np.floor(x.clip(lower=floor)) + 0.99).where(x >= floor, floor)


def _join_unique(s: pd.Series) -> str:
    parts = []
    for v in s.dropna():
        parts.extend(p for p in str(v).split(",") if p and p not in parts)
    return ",".join(parts)


def _pinned_rows(raw: pd.DataFrame):
    """Raw row labels (in order) behind the committed cleaned data, if this is that same raw file."""
    if not ROW_ORDER_FILE.exists():
        return None
    pinned = pd.read_csv(ROW_ORDER_FILE)
    rows = pinned.raw_row.tolist()
    if not raw.index.is_unique or not set(rows) <= set(raw.index) or (raw.loc[rows, "product_id"].values != pinned.product_id.values).any():
        return None
    return rows


def clean_raw(raw: pd.DataFrame, seed: int = SEED) -> dict:
    """Clean the raw scrape. Returns {"clean", "catalogue", "audit"} DataFrames."""
    rng = np.random.default_rng(seed)
    df = raw.copy()
    df["price_inr"] = to_number(df["discounted_price"])
    df["list_price_inr"] = to_number(df["actual_price"])
    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    df["rating_count"] = to_number(df["rating_count"])
    df["discount_pct"] = ((1 - df.price_inr / df.list_price_inr) * 100).round(2)

    leaf = df["category"].str.split("|").str[-1]
    df["rating"] = df["rating"].fillna(df.groupby(leaf)["rating"].transform("median")).fillna(df.rating.median())
    main = df["category"].str.split("|").str[0]
    p10 = df.groupby(main)["rating_count"].transform(lambda s: s.quantile(0.10))
    df["rating_count"] = df["rating_count"].fillna(p10).round()

    # One row per ASIN: numbers from the snapshot with the most reviews, union of review text.
    # Stable sort + pinned row order -> identical results on every platform.
    df = df.sort_values("rating_count", ascending=False, kind="mergesort")
    merged_text = df.groupby("product_id")[TEXT_COLS].agg(_join_unique)
    pinned = _pinned_rows(raw)
    df = df.loc[pinned] if pinned is not None else df.drop_duplicates("product_id", keep="first")
    df = df.set_index("product_id")
    df[TEXT_COLS] = merged_text
    df = df.reset_index()

    levels = df["category"].str.split("|", expand=True)
    df["cat_l1"], df["cat_l2"], df["cat_l3"] = levels[0], levels[1], levels[2]
    df["cat_leaf"] = df["category"].str.split("|").str[-1]
    df["cat_depth"] = df["category"].str.count(r"\|") + 1
    df["us_category"] = [us_category(a, b) for a, b in zip(df.cat_l1, df.cat_l2)]

    list_fx = df.list_price_inr / FX_INR_PER_USD
    noise = rng.normal(1.0, 0.08, len(df)).clip(0.85, 1.15)
    df["list_price_usd"] = snap_99(list_fx * us_multiplier(list_fx) * noise)
    df["price_usd"] = snap_99(df.list_price_usd * (1 - df.discount_pct / 100))
    df["price_usd"] = np.minimum(df.price_usd, df.list_price_usd)
    df["discount_pct"] = ((1 - df.price_usd / df.list_price_usd) * 100).round(2)

    df["orig_discount_pct"] = df["discount_pct"]
    mask = df.discount_pct > DISCOUNT_CAP_PCT
    df.loc[mask, "list_price_usd"] = snap_99(df.loc[mask, "price_usd"] / (1 - DISCOUNT_CAP_PCT / 100))
    df["discount_pct"] = ((1 - df.price_usd / df.list_price_usd) * 100).clip(lower=0).round(2)
    df["discount_usd"] = (df.list_price_usd - df.price_usd).round(2)

    df["brand"] = df["product_name"].str.split().str[0].str.strip(",()").replace(BRAND_FIX)
    df["name_len"] = df["product_name"].str.len()
    df["about_len"] = df["about_product"].fillna("").str.len()
    df["n_bullets"] = df["about_product"].fillna("").str.count(r"\|") + 1
    df["n_reviews_sampled"] = df["review_id"].fillna("").str.count(",") + 1
    t = df["review_title"].fillna("").str.lower()
    pos, neg = t.str.count(POS), t.str.count(NEG)
    df["review_sentiment"] = ((pos - neg) / (pos + neg).replace(0, np.nan)).fillna(0).round(3)
    df["brand_listing_count"] = df.groupby("brand")["product_id"].transform("count")
    df["is_bundle"] = df["product_name"].str.contains(BUNDLE, case=False).astype(int)

    catalogue = df[["product_id", "product_name", "brand", "us_category", "about_product", "img_link", "product_link"]].copy()
    catalogue["product_link"] = catalogue["product_link"].str.replace("amazon.in", "amazon.com", regex=False)
    audit = df[["product_id", "price_inr", "list_price_inr", "orig_discount_pct", "review_title", "review_content"]].copy()

    clean = df[CLEAN_COLUMNS].copy()
    clean["rating_count"] = clean["rating_count"].astype(int)
    clean["cat_l3"] = clean["cat_l3"].fillna(clean["cat_l2"])
    assert clean.product_id.is_unique
    assert (clean.price_usd <= clean.list_price_usd).all()
    return {"clean": clean, "catalogue": catalogue, "audit": audit}


def load_and_clean(path) -> dict:
    return clean_raw(pd.read_csv(path, dtype=str))
