"""API contracts exercised against the committed models and catalogue."""
import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from marketlens import MarketLensPredictor, ProductInput
from marketlens.api.app import create_app

LAUNCH = {"category": "Cell Phones & Accessories", "price": 29.99, "list_price": 39.99,
          "review_count": 1200, "months_on_market": 10, "launch_month": 7}
BASE = "/api/v1/predictions"


@pytest.fixture(scope="module")
def client():
    with patch.dict("os.environ", {"MARKETLENS_CORS_ORIGINS": "http://localhost:3000,http://localhost:5173"}):
        app = create_app()
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_health_and_documentation(client):
    assert client.get("/health").json() == {"data": {"status": "ok", "models_loaded": 34}}
    assert client.get("/docs").status_code == 200
    spec = client.get("/openapi.json").json()
    assert {"/health", "/api/v1/products", "/api/v1/categories",
            *(f"{BASE}/{kind}" for kind in ("launch", "monthly", "yearly"))} <= spec["paths"].keys()


def test_catalogue_and_categories(client):
    response = client.get("/api/v1/products?limit=2").json()["data"]
    assert response["total"] == 1351
    assert len(response["items"]) == 2
    assert {"product_id", "product_name", "us_category", "last_month"} == response["items"][0].keys()
    next_page = client.get("/api/v1/products?offset=2&limit=2").json()["data"]
    assert response["items"] != next_page["items"]
    assert client.get("/api/v1/products?offset=9999").json()["data"]["items"] == []
    assert LAUNCH["category"] in client.get("/api/v1/categories").json()["data"]["items"]


@pytest.mark.parametrize("kind,payload", [
    ("launch", LAUNCH),
    ("monthly", {"product_id": "B07JW9H4J1"}),
    ("monthly", {"product_id": "B07JW9H4J1", "promo_depth_pct": 20, "everyday_price": 15}),
    ("yearly", {"product_id": "B07JW9H4J1", "year": 2026, "promo_months": 3}),
    ("yearly", {"product_id": "B07JW9H4J1", "year": 2027}),
])
def test_predictions_preserve_library_output(client, kind, payload):
    response = client.post(f"{BASE}/{kind}", json=payload)
    assert response.status_code == 200, response.text
    predictor = client.app.state.predictor
    if kind == "launch":
        expected = predictor.predict_launch(ProductInput(**payload))
    elif kind == "monthly":
        expected = predictor.predict_next_month(**payload)
    else:
        expected = predictor.predict_year(**payload)
    assert response.json() == {"data": expected}
    assert any(v.get("plus_minus") is not None and v.get("range") is not None
               for v in response.json()["data"]["predictions"].values())


@pytest.mark.parametrize("changes", [
    {"price": 0}, {"price": -1}, {"list_price": 1}, {"rating": 6},
    {"review_count": -1}, {"review_count": 1.5}, {"months_on_market": -1},
    {"category": " "}, {"category": "Spaceships"}, {"size_tier": "invalid"},
    {"launch_month": 13}, {"weight_lb": 0}, {"landed_cost": -1},
    {"review_sentiment": 2}, {"unexpected": True},
])
def test_invalid_launch(client, changes):
    response = client.post(f"{BASE}/launch", json={**LAUNCH, **changes})
    assert response.status_code == 422
    assert {"code", "message", "details"} == response.json()["error"].keys()


@pytest.mark.parametrize("kind,payload,status", [
    ("launch", {}, 422),
    ("monthly", {"product_id": "unknown"}, 404),
    ("yearly", {"product_id": "unknown", "year": 2026}, 404),
    ("monthly", {"product_id": "B07JW9H4J1", "promo_depth_pct": -1}, 422),
    ("monthly", {"product_id": "B07JW9H4J1", "promo_depth_pct": 100}, 422),
    ("monthly", {"product_id": "B07JW9H4J1", "everyday_price": 0}, 422),
    ("yearly", {"product_id": "B07JW9H4J1", "year": 2035}, 422),
    ("yearly", {"product_id": "B07JW9H4J1", "promo_months": 13}, 422),
    ("yearly", {"product_id": "B07JW9H4J1", "year": True}, 422),
])
def test_forecast_errors(client, kind, payload, status):
    response = client.post(f"{BASE}/{kind}", json=payload)
    assert response.status_code == status
    assert "error" in response.json()


def test_validation_and_routing_errors(client):
    for path in ("/api/v1/products?limit=0", "/api/v1/products?offset=-1"):
        assert client.get(path).status_code == 422
    assert client.get("/missing").json()["error"]["code"] == "http_error"
    assert client.get(f"{BASE}/launch").status_code == 405
    malformed = client.post(f"{BASE}/launch", content="{", headers={"Content-Type": "application/json"})
    assert malformed.status_code == 422
    for value in (float("nan"), float("inf"), -float("inf")):
        nonfinite = client.post(f"{BASE}/launch", content=json.dumps({**LAUNCH, "price": value}),
                                headers={"Content-Type": "application/json"})
        assert nonfinite.status_code == 422


def test_cors(client):
    headers = {"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
               "Access-Control-Request-Headers": "content-type"}
    allowed = client.options(f"{BASE}/launch", headers=headers)
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == headers["Origin"]
    denied = client.options(f"{BASE}/launch", headers={**headers, "Origin": "https://untrusted.example"})
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


def test_server_errors_hide_internal_details(client, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("private filesystem information")
    monkeypatch.setattr(client.app.state.predictor, "predict_launch", fail)
    response = client.post(f"{BASE}/launch", json=LAUNCH)
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "internal_error", "message": "An unexpected error occurred", "details": []}}


def test_models_loaded_once_and_startup_failure(monkeypatch):
    with patch("marketlens.api.app.MarketLensPredictor", wraps=MarketLensPredictor) as factory:
        with TestClient(create_app()) as client:
            client.get("/health")
            client.get("/health")
            assert factory.call_count == 1
    with patch("marketlens.api.app.MarketLensPredictor", side_effect=FileNotFoundError("missing models")):
        with pytest.raises(FileNotFoundError, match="missing models"):
            with TestClient(create_app()):
                pass


def test_cors_defaults_and_wildcard_rejection(monkeypatch):
    monkeypatch.delenv("MARKETLENS_CORS_ORIGINS", raising=False)
    with TestClient(create_app()) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:3000"})
        assert "access-control-allow-origin" not in response.headers
    monkeypatch.setenv("MARKETLENS_CORS_ORIGINS", "*")
    with pytest.raises(ValueError, match="explicit frontend origins"):
        create_app()
