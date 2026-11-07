import pandas as pd
import pytest

from marketlens import MarketLensPredictor, ProductInput
from marketlens.config import FINAL


@pytest.fixture(scope="session")
def predictor():
    return MarketLensPredictor()


@pytest.fixture
def power_bank():
    return ProductInput(category="Cell Phones & Accessories", price=29.99, list_price=39.99, review_count=1200,
                        months_on_market=10, sub_category="PowerBanks", brand="Ambrane", name="Ambrane 10000mAh power bank")


@pytest.fixture(scope="session")
def product_train():
    return pd.read_csv(FINAL / "product_train.csv")
