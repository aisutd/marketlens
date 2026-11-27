"""Security regression tests for GitHub Issue #37.

The public landing page demo runs entirely in the browser.

These tests verify that:
- Anonymous demo scoring endpoints have been removed.
- Protected scoring endpoints require authentication.
- Removed endpoints cannot execute scoring.
- Retired endpoints are absent from the API schema.

Trained ML models are not required for these tests.

Most checks inspect the app in-process and are skipped when API_BASE_URL
is set; test_demo_route_is_absent_on_server then sends the /demo/* checks
to that server instead.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

from api.app import app
from api.firebase_auth import verify_firebase_token
from conftest import BASE_URL, in_process


api_module = importlib.import_module("api.app")


PRODUCT = {
    "title": "Reusable Silicone Food Storage Bags",
    "category": "Kitchen & Dining",
    "price": 14.99,
    "listPrice": 19.99,
}


PROTECTED_ROUTES = [
    (
        "/predict",
        PRODUCT
    ),
    (
        "/reasons",
        PRODUCT
    ),
    (
        "/what-if",
        {
            "product": PRODUCT,
            "prices": [10, 15, 20]
        }
    ),
    (
        "/rescore",
        {
            "product": PRODUCT,
            "changes": {"price": 15}
        }
    ),
]


DEMO_ROUTES = [
    (
        f"/demo{path}",
        body
    )
    for path, body in PROTECTED_ROUTES
]


@pytest.fixture
def isolated_client(monkeypatch):
    """Create a test client without running model startup.

    TestClient is deliberately not used as a context
    manager because that would execute the application's
    lifespan and load the trained ML artifacts.

    The real authentication dependency remains active.
    """

    def unexpected_scoring(*args, **kwargs):
        pytest.fail(
            "A security test unexpectedly executed ML scoring."
        )

    monkeypatch.setattr(
        api_module,
        "_score",
        unexpected_scoring
    )

    monkeypatch.setattr(
        api_module,
        "featurize_one",
        unexpected_scoring
    )

    monkeypatch.setattr(
        api_module,
        "embed",
        unexpected_scoring
    )

    original_overrides = app.dependency_overrides.copy()

    app.dependency_overrides.pop(
        verify_firebase_token,
        None
    )

    client = TestClient(app)

    try:
        yield client
    finally:
        client.close()

        app.dependency_overrides.clear()

        app.dependency_overrides.update(
            original_overrides
        )


# ---- Removed anonymous demo endpoints ----

@in_process
@pytest.mark.parametrize(
    "path,body",
    DEMO_ROUTES
)
def test_anonymous_demo_route_returns_404(
    isolated_client,
    path,
    body
):
    response = isolated_client.post(
        path,
        json=body
    )

    assert response.status_code == 404, response.text


@in_process
@pytest.mark.parametrize(
    "path,body",
    DEMO_ROUTES
)
def test_demo_route_with_token_returns_404(
    isolated_client,
    path,
    body
):
    response = isolated_client.post(
        path,
        json=body,
        headers={
            "Authorization": "Bearer example-token"
        }
    )

    assert response.status_code == 404, response.text


# ---- Protected scoring endpoints ----

@in_process
@pytest.mark.parametrize(
    "path,body",
    PROTECTED_ROUTES
)
def test_protected_route_requires_authentication(
    isolated_client,
    path,
    body
):
    response = isolated_client.post(
        path,
        json=body
    )

    assert response.status_code == 401, response.text

    assert response.json() == {
        "detail": "Authentication required"
    }


@in_process
@pytest.mark.parametrize(
    "path,body",
    PROTECTED_ROUTES
)
def test_protected_route_rejects_basic_auth(
    isolated_client,
    path,
    body
):
    response = isolated_client.post(
        path,
        json=body,
        headers={
            "Authorization": "Basic dXNlcjpwYXNz"
        }
    )

    assert response.status_code == 401, response.text


# ---- FastAPI route registration ----

@in_process
@pytest.mark.parametrize(
    "path,body",
    DEMO_ROUTES
)
def test_demo_route_is_not_registered(
    path,
    body
):
    registered_paths = {
        route.path
        for route in app.routes
    }

    assert path not in registered_paths


@in_process
@pytest.mark.parametrize(
    "path,body",
    PROTECTED_ROUTES
)
def test_protected_route_is_still_registered(
    path,
    body
):
    registered_paths = {
        route.path
        for route in app.routes
    }

    assert path in registered_paths


@in_process
@pytest.mark.parametrize(
    "path,body",
    PROTECTED_ROUTES
)
def test_protected_route_has_firebase_dependency(
    path,
    body
):
    route = next(
        route
        for route in app.routes
        if route.path == path
        and "POST" in getattr(
            route,
            "methods",
            set()
        )
    )

    dependencies = [
        dependency.call
        for dependency in route.dependant.dependencies
    ]

    assert verify_firebase_token in dependencies


# ---- OpenAPI documentation ----

@in_process
@pytest.mark.parametrize(
    "path,body",
    DEMO_ROUTES
)
def test_demo_route_is_not_in_openapi(
    path,
    body
):
    schema = app.openapi()

    assert path not in schema["paths"]


@in_process
@pytest.mark.parametrize(
    "path,body",
    PROTECTED_ROUTES
)
def test_protected_route_is_still_in_openapi(
    path,
    body
):
    schema = app.openapi()

    assert path in schema["paths"]

    assert "post" in schema["paths"][path]


# ---- Deployed server ----

@pytest.mark.skipif(
    not BASE_URL,
    reason="needs a running server (API_BASE_URL is not set)"
)
@pytest.mark.parametrize(
    "path,body",
    DEMO_ROUTES
)
def test_demo_route_is_absent_on_server(
    client,
    path,
    body
):
    response = client.post(
        path,
        json=body
    )

    assert response.status_code == 404, response.text
