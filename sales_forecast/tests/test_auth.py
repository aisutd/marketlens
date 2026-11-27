"""Firebase authentication tests for the forecasting API."""

import pytest

from fastapi.testclient import TestClient
from firebase_admin import auth
from google.auth.credentials import AnonymousCredentials
from google.auth.exceptions import DefaultCredentialsError

from marketlens.api.app import create_app
from marketlens.api.firebase_auth import firebase_app

# Every test here needs the trained models (directly or through the API lifespan).
pytestmark = pytest.mark.models


BASE = "/api/v1/predictions"

LAUNCH = {
    "category": "Cell Phones & Accessories",
    "price": 29.99,
    "list_price": 39.99,
    "review_count": 1200,
    "months_on_market": 10,
    "launch_month": 7,
}

PROTECTED = [
    ("GET", "/api/v1/products", None),
    ("POST", f"{BASE}/launch", LAUNCH),
    ("POST", f"{BASE}/monthly", {
        "product_id": "B07JW9H4J1"
    }),
    ("POST", f"{BASE}/yearly", {
        "product_id": "B07JW9H4J1",
        "year": 2026
    }),
]


# ========================================
# TEST CLIENT
# ========================================

@pytest.fixture(scope="module")
def client():
    with TestClient(
        create_app(),
        raise_server_exceptions=False
    ) as client:
        yield client


@pytest.fixture
def mock_credentials(monkeypatch):
    monkeypatch.setattr(
        firebase_app.credential,
        "get_credential",
        lambda: AnonymousCredentials()
    )


# ========================================
# MISSING TOKEN
# ========================================

@pytest.mark.parametrize("method,path,payload", PROTECTED)
def test_missing_token(client, method, path, payload):
    response = client.request(
        method,
        path,
        json=payload
    )

    assert response.status_code == 401
    assert response.json()["error"]["message"] == (
        "Authentication required"
    )


# ========================================
# INVALID TOKEN
# ========================================

@pytest.mark.parametrize("method,path,payload", PROTECTED)
def test_invalid_token(
    client, mock_credentials, monkeypatch,
    method, path, payload
):
    def reject_token(*args, **kwargs):
        raise auth.InvalidIdTokenError("Invalid token")

    monkeypatch.setattr(
        auth,
        "verify_id_token",
        reject_token
    )

    response = client.request(
        method,
        path,
        json=payload,
        headers={"Authorization": "Bearer invalid-token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["message"] == (
        "Invalid or expired authentication token"
    )


# ========================================
# EXPIRED TOKEN
# ========================================

@pytest.mark.parametrize("method,path,payload", PROTECTED)
def test_expired_token(
    client, mock_credentials, monkeypatch,
    method, path, payload
):
    def reject_token(*args, **kwargs):
        raise auth.ExpiredIdTokenError(
            "Expired token",
            cause=None
        )

    monkeypatch.setattr(
        auth,
        "verify_id_token",
        reject_token
    )

    response = client.request(
        method,
        path,
        json=payload,
        headers={"Authorization": "Bearer expired-token"}
    )

    assert response.status_code == 401


# ========================================
# VALID TOKEN
# ========================================

@pytest.mark.parametrize("method,path,payload", PROTECTED)
def test_valid_token(
    client, mock_credentials, monkeypatch,
    method, path, payload
):
    def accept_token(token, **kwargs):
        assert token == "valid-token"
        return {"uid": "test-user"}

    monkeypatch.setattr(
        auth,
        "verify_id_token",
        accept_token
    )

    response = client.request(
        method,
        path,
        json=payload,
        headers={"Authorization": "Bearer valid-token"}
    )

    assert response.status_code == 200, response.text
    assert "data" in response.json()


# ========================================
# INCORRECT AUTHENTICATION SCHEME
# ========================================

def test_non_bearer_token(client):
    response = client.get(
        "/api/v1/products",
        headers={"Authorization": "Basic test-token"}
    )

    assert response.status_code == 401


# ========================================
# AUTHENTICATION SERVICE FAILURE
# ========================================

def test_unavailable_credentials(client, monkeypatch):
    def unavailable():
        raise DefaultCredentialsError(
            "Private credential information"
        )

    monkeypatch.setattr(
        firebase_app.credential,
        "get_credential",
        unavailable
    )

    response = client.get(
        "/api/v1/products",
        headers={"Authorization": "Bearer test-token"}
    )

    assert response.status_code == 503
    assert response.json()["error"]["message"] == (
        "Authentication service unavailable"
    )


def test_certificate_fetch_failure(
    client, mock_credentials, monkeypatch
):
    def unavailable(*args, **kwargs):
        raise auth.CertificateFetchError(
            "Private upstream failure",
            cause=None
        )

    monkeypatch.setattr(
        auth,
        "verify_id_token",
        unavailable
    )

    response = client.get(
        "/api/v1/products",
        headers={"Authorization": "Bearer test-token"}
    )

    assert response.status_code == 503
    assert response.json()["error"]["message"] == (
        "Authentication service unavailable"
    )


# ========================================
# PUBLIC ENDPOINTS
# ========================================

@pytest.mark.parametrize("path", [
    "/health",
    "/api/v1/categories",
])
def test_public_endpoints(client, path):
    response = client.get(path)
    assert response.status_code == 200