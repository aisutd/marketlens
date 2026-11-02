import pandas as pd
import pytest

from marketlens.cleaning import load_and_clean, snap_99, to_number, us_category
from marketlens.config import INTERIM, RAW_CSV


def test_to_number_handles_rupees_percent_and_indian_grouping():
    s = pd.Series(["₹1,07,687", "64%", "24,269", "₹399", ""])
    assert to_number(s).tolist()[:4] == [107687, 64, 24269, 399]
    assert pd.isna(to_number(s).iloc[4])


@pytest.mark.parametrize("l1, l2, expected", [
    ("Electronics", "Mobiles&Accessories", "Cell Phones & Accessories"),
    ("Electronics", "HomeTheater,TV&Video", "Electronics - TV & Video"),
    ("Computers&Accessories", "Monitors", "Computers & Accessories"),
    ("Computers&Accessories", "Accessories&Peripherals", "Computer Accessories & Peripherals"),
    ("Home&Kitchen", "Kitchen&HomeAppliances", "Kitchen & Home Appliances"),
    ("Home&Kitchen", "HomeStorage&Organization", "Home & Kitchen"),
    ("OfficeProducts", None, "Office Products"),
    ("Unknown", None, "Other"),
])
def test_us_category_mapping(l1, l2, expected):
    assert us_category(l1, l2) == expected


def test_snap_99_price_points_and_floor():
    assert snap_99(pd.Series([3.2, 12.4, 99.99])).tolist() == [5.99, 12.99, 99.99]


@pytest.mark.skipif(not RAW_CSV.exists(), reason="raw amazon.csv not available")
def test_cleaning_reproduces_saved_interim_output():
    clean = load_and_clean(RAW_CSV)["clean"].sort_values("product_id").reset_index(drop=True)
    saved = pd.read_csv(INTERIM / "amazon_us_clean.csv").sort_values("product_id").reset_index(drop=True)
    assert len(clean) == 1351 and clean.product_id.is_unique
    pd.testing.assert_frame_equal(clean, saved, check_dtype=False, check_exact=False, rtol=1e-9)


@pytest.mark.skipif(not RAW_CSV.exists(), reason="raw amazon.csv not available")
def test_cleaning_is_independent_of_tie_order(monkeypatch):
    """Products with equal review counts can sort differently on other CPUs; output must not change."""
    original = pd.DataFrame.sort_values

    def flipped_ties(self, by, *args, **kwargs):
        kwargs.pop("kind", None)
        return original(self.iloc[::-1], by, *args, kind="mergesort", **kwargs)

    monkeypatch.setattr(pd.DataFrame, "sort_values", flipped_ties)
    clean = load_and_clean(RAW_CSV)["clean"].sort_values("product_id").reset_index(drop=True)
    monkeypatch.undo()
    saved = pd.read_csv(INTERIM / "amazon_us_clean.csv").sort_values("product_id").reset_index(drop=True)
    pd.testing.assert_frame_equal(clean, saved, check_dtype=False, check_exact=False, rtol=1e-9)
