import pandas as pd
import pytest

from marketlens import MarketLensPredictor, ProductInput
from marketlens import config as ml_config


def pytest_collection_modifyitems(config, items):
    """Skip tests marked `models` when models/final and data/ are not present (they are gitignored), so a clean
    checkout runs the pure unit tests and reports the rest as skipped. `pytest -m "not models"` deselects them."""
    if ml_config.has_root():
        return
    skip = pytest.mark.skip(reason="needs models/final and data/ (gitignored); set MARKETLENS_ROOT to run")
    for item in items:
        if "models" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def predictor():
    return MarketLensPredictor()


@pytest.fixture
def power_bank():
    return ProductInput(category="Cell Phones & Accessories", price=29.99, list_price=39.99, review_count=1200,
                        months_on_market=10, sub_category="PowerBanks", brand="Ambrane", name="Ambrane 10000mAh power bank")


@pytest.fixture(scope="session")
def product_train():
    return pd.read_csv(ml_config.FINAL / "product_train.csv")
