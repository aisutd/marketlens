"""
Tests run against the app in-process (FastAPI TestClient, models from MODEL_DIR or product_success/models/), or against a running
server when API_BASE_URL is set, e.g. a container:

    pytest api/tests                                        # in-process, from product_success/
    API_BASE_URL=http://localhost:8080 pytest api/tests     # a running server; in-process-only tests are skipped

The scoring endpoints need a Firebase ID token: in-process the check is replaced by a test user, and against a
server API_ID_TOKEN=<a signed-in user's ID token> is sent as the Bearer token.
"""
import math
import os

import pandas as pd
import pytest

from paths import MODELS_DIR  # noqa: E402  (product_success/ is on the path through pytest.ini)

BASE_URL = os.environ.get("API_BASE_URL")
SLOW = os.path.join(MODELS_DIR, "fast_check_slow.parquet")   # tools/check_fast_features.py --slow

in_process = pytest.mark.skipif(bool(BASE_URL), reason="needs the app in-process (API_BASE_URL is set)")


TEST_USER = {"uid": "test-user"}


@pytest.fixture(scope="session")
def client():
    """The scoring endpoints need a Firebase ID token. In-process, the token check is replaced by a fixed test user
    (test_auth.py removes the override to test the check itself); against a server, API_ID_TOKEN is sent if set."""
    if BASE_URL:
        import httpx
        token = os.environ.get("API_ID_TOKEN")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        with httpx.Client(base_url=BASE_URL, timeout=60, headers=headers) as c:
            yield c
    else:
        from fastapi.testclient import TestClient
        from api.app import app
        from api.firebase_auth import verify_firebase_token
        app.dependency_overrides[verify_firebase_token] = lambda: TEST_USER
        try:
            with TestClient(app) as c:
                yield c
        finally:
            app.dependency_overrides.pop(verify_firebase_token, None)


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
