"""
Tests run against the app in-process (FastAPI TestClient, models from MODEL_DIR or models/), or against a running
server when API_BASE_URL is set, e.g. a container:

    pytest api/tests                                        # in-process
    API_BASE_URL=http://localhost:8080 pytest api/tests     # a running server; in-process-only tests are skipped
"""
import math
import os
import sys

import pandas as pd
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

BASE_URL = os.environ.get("API_BASE_URL")
SLOW = os.path.join(ROOT, "models", "fast_check_slow.parquet")   # tools/check_fast_features.py --slow

in_process = pytest.mark.skipif(bool(BASE_URL), reason="needs the app in-process (API_BASE_URL is set)")


@pytest.fixture(scope="session")
def client():
    if BASE_URL:
        import httpx
        with httpx.Client(base_url=BASE_URL, timeout=60) as c:
            yield c
    else:
        os.chdir(ROOT)   # MODEL_DIR defaults to the relative "models"
        from fastapi.testclient import TestClient
        from api.app import app
        with TestClient(app) as c:
            yield c


@pytest.fixture(scope="session")
def slow():
    """The 118 products of the slow-path check, with predict.py's outputs (out_p, out_score, out_reasons)."""
    if not os.path.exists(SLOW):
        pytest.skip(f"{SLOW} missing: run tools/check_fast_features.py --slow")
    return pd.read_parquet(SLOW)


def product_json(row):
    """A parity row as an API product: NaN (missing) -> null, which the API turns into 0 like the CLI."""
    def opt(v, cast=float):
        return None if v is None or (isinstance(v, float) and math.isnan(v)) else cast(v)
    return {"title": row["in_title"], "price": float(row["in_price"]), "list_price": opt(row["in_list_price"]),
            "stars": opt(row["in_stars"]), "reviews": opt(row["in_reviews"], lambda v: int(v)),
            "category": row["in_category"]}


def ok(response):
    assert response.status_code == 200, response.text
    return response.json()
