"""Rate-limiting tests for the forecasting API."""

from unittest.mock import Mock

import pytest
from fastapi import Request, HTTPException
from fastapi.testclient import TestClient

from marketlens.api.app import create_app
from marketlens.api.firebase_auth import verify_firebase_token
from marketlens.api.rate_limit import (
    PRODUCTS_PER_MINUTE,
    PREDICTIONS_PER_MINUTE,
    PREDICTIONS_PER_DAY,
)


BASE = "/api/v1/predictions"

LAUNCH = {
    "category": "Cell Phones & Accessories",
    "price": 29.99,
    "review_count": 1200,
    "months_on_market": 10,
    "launch_month": 7,
}

MONTHLY = {
    "product_id": "B07JW9H4J1",
}

YEARLY = {
    "product_id": "B07JW9H4J1",
    "year": 2026,
}

USER_A = {
    "Authorization": "Bearer user-a",
}

USER_B = {
    "Authorization": "Bearer user-b",
}


# ========================================
# TEST CLIENT
# ========================================

@pytest.fixture(scope="module")
def client():

    app = create_app()

    def mock_authentication(request: Request):

        authorization = request.headers.get(
            "Authorization"
        )

        identities = {
            "Bearer user-a": "rate-limit-user-a",
            "Bearer user-b": "rate-limit-user-b",
        }

        uid = identities.get(authorization)

        if uid is None:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
            )

        return {"uid": uid}

    app.dependency_overrides[
        verify_firebase_token
    ] = mock_authentication

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# ========================================
# ISOLATE RATE LIMIT COUNTERS
# ========================================

@pytest.fixture(autouse=True)
def reset_rate_limits(client):

    limiter = client.app.state.limiter

    limiter.reset()

    yield

    limiter.reset()


# ========================================
# MOCK EXPENSIVE MODEL EXECUTION
# ========================================

@pytest.fixture
def models(client, monkeypatch):

    launch = Mock(return_value={"predictions": {}})

    monthly = Mock(return_value={"predictions": {}})

    yearly = Mock(return_value={"predictions": {}})

    predictor = client.app.state.predictor

    monkeypatch.setattr(
        predictor,
        "predict_launch",
        launch,
    )

    monkeypatch.setattr(
        predictor,
        "predict_next_month",
        monthly,
    )

    monkeypatch.setattr(
        predictor,
        "predict_year",
        yearly,
    )

    return {
        "launch": launch,
        "monthly": monthly,
        "yearly": yearly,
    }


# ========================================
# AUTHENTICATION STILL REQUIRED
# ========================================

def test_unauthenticated_request(client):

    response = client.get("/api/v1/products")

    assert response.status_code == 401


# ========================================
# PRODUCT CATALOGUE LIMIT
# ========================================

def test_product_catalogue_rate_limit(client):

    for _ in range(PRODUCTS_PER_MINUTE):

        response = client.get(
            "/api/v1/products",
            headers=USER_A,
        )

        assert response.status_code == 200

    response = client.get(
        "/api/v1/products",
        headers=USER_A,
    )

    assert response.status_code == 429

    assert response.json()["error"]["code"] == (
        "rate_limit_exceeded"
    )


# ========================================
# PREDICTION ENDPOINT LIMITS
# ========================================

@pytest.mark.parametrize(
    "endpoint,payload",
    [
        ("launch", LAUNCH),
        ("monthly", MONTHLY),
        ("yearly", YEARLY),
    ],
)
def test_prediction_rate_limit(
    client,
    models,
    endpoint,
    payload,
):

    for _ in range(PREDICTIONS_PER_MINUTE):

        response = client.post(
            f"{BASE}/{endpoint}",
            json=payload,
            headers=USER_A,
        )

        assert response.status_code == 200, response.text

    response = client.post(
        f"{BASE}/{endpoint}",
        json=payload,
        headers=USER_A,
    )

    assert response.status_code == 429

    assert models[endpoint].call_count == (
        PREDICTIONS_PER_MINUTE
    )


# ========================================
# USER QUOTA ISOLATION
# ========================================

def test_independent_user_limits(client, models):

    for _ in range(PREDICTIONS_PER_MINUTE):

        response = client.post(
            f"{BASE}/monthly",
            json=MONTHLY,
            headers=USER_A,
        )

        assert response.status_code == 200

    blocked = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    assert blocked.status_code == 429

    allowed = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_B,
    )

    assert allowed.status_code == 200


# ========================================
# INDEPENDENT ENDPOINT LIMITS
# ========================================

def test_independent_endpoint_limits(client, models):

    for _ in range(PREDICTIONS_PER_MINUTE):

        response = client.post(
            f"{BASE}/launch",
            json=LAUNCH,
            headers=USER_A,
        )

        assert response.status_code == 200

    blocked = client.post(
        f"{BASE}/launch",
        json=LAUNCH,
        headers=USER_A,
    )

    assert blocked.status_code == 429

    monthly = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    yearly = client.post(
        f"{BASE}/yearly",
        json=YEARLY,
        headers=USER_A,
    )

    assert monthly.status_code == 200
    assert yearly.status_code == 200


# ========================================
# RETRY-AFTER HEADER
# ========================================

def test_retry_after_header(client, models):

    for _ in range(PREDICTIONS_PER_MINUTE):

        response = client.post(
            f"{BASE}/monthly",
            json=MONTHLY,
            headers=USER_A,
        )

        assert response.status_code == 200

    response = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    assert response.status_code == 429

    retry_after = int(
        response.headers["Retry-After"]
    )

    assert 1 <= retry_after <= 60

    error = response.json()["error"]

    assert error["code"] == "rate_limit_exceeded"

    assert error["details"][0]["retry_after"] == (
        retry_after
    )


# ========================================
# SHARED DAILY PREDICTION QUOTA
# ========================================

def test_shared_daily_quota(
    client,
    models,
    monkeypatch,
):

    import time

    current_time = time.time()

    monkeypatch.setattr(
        time,
        "time",
        lambda: current_time,
    )

    endpoints = [
        ("launch", LAUNCH),
        ("monthly", MONTHLY),
        ("yearly", YEARLY),
    ]

    for index in range(PREDICTIONS_PER_DAY):

        endpoint, payload = endpoints[index % 3]

        response = client.post(
            f"{BASE}/{endpoint}",
            json=payload,
            headers=USER_A,
        )

        assert response.status_code == 200, response.text

        current_time += 61

    response = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    assert response.status_code == 429

    assert sum(
        model.call_count
        for model in models.values()
    ) == PREDICTIONS_PER_DAY


# ========================================
# RATE LIMIT WINDOW RESET
# ========================================

def test_rate_limit_window_reset(
    client,
    models,
    monkeypatch,
):

    import time

    current_time = time.time()

    monkeypatch.setattr(
        time,
        "time",
        lambda: current_time,
    )

    for _ in range(PREDICTIONS_PER_MINUTE):

        response = client.post(
            f"{BASE}/monthly",
            json=MONTHLY,
            headers=USER_A,
        )

        assert response.status_code == 200

    blocked = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    assert blocked.status_code == 429

    current_time += 61

    allowed = client.post(
        f"{BASE}/monthly",
        json=MONTHLY,
        headers=USER_A,
    )

    assert allowed.status_code == 200


# ========================================
# PUBLIC ENDPOINTS REMAIN AVAILABLE
# ========================================

@pytest.mark.parametrize(
    "path",
    [
        "/health",
        "/api/v1/categories",
    ],
)
def test_public_endpoints(client, path):

    for _ in range(PRODUCTS_PER_MINUTE + 1):

        response = client.get(path)

        assert response.status_code == 200


# ========================================
# APPLICATION LIMITER ISOLATION
# ========================================

def test_application_limiter_isolation():

    first_app = create_app()

    second_app = create_app()

    assert first_app.state.limiter is not (
        second_app.state.limiter
    )