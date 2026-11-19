"""Firebase ID token check: the scoring endpoints refuse a missing, malformed or wrongly sent token with 401;
/health, /categories and the /demo/* routes stay public, and the demo routes answer exactly as the protected ones;
CORS lets the browser send the Authorization header."""
import pytest

from conftest import in_process
from test_endpoints import DEMO

PROTECTED = [
    ("/predict", DEMO),
    ("/rescore", {"product": DEMO, "changes": {"price": 30}}),
    ("/reasons", DEMO),
    ("/what-if", {"product": DEMO, "prices": [20, 30]}),
]


@pytest.fixture
def real_auth(client, monkeypatch):
    """The app with its real token check: the client fixture's test-user override removed for one test.

    Use anonymous credentials so the real verifier runs on machines without ADC."""
    import firebase_admin
    from google.auth.credentials import AnonymousCredentials

    from api.app import app
    from api.firebase_auth import verify_firebase_token
    monkeypatch.setattr(firebase_admin.get_app().credential, "get_credential", lambda: AnonymousCredentials())
    override = app.dependency_overrides.pop(verify_firebase_token, None)
    yield client
    if override is not None:
        app.dependency_overrides[verify_firebase_token] = override


@in_process
@pytest.mark.parametrize("path,body", PROTECTED)
def test_missing_token_is_401(real_auth, path, body):
    r = real_auth.post(path, json=body)
    assert r.status_code == 401, r.text
    assert r.json() == {"detail": "Authentication required"}


@in_process
@pytest.mark.parametrize("path,body", PROTECTED)
@pytest.mark.parametrize("header", ["Bearer not-a-token", "Bearer a.b.c"])
def test_malformed_token_is_401(real_auth, path, body, header):
    r = real_auth.post(path, json=body, headers={"Authorization": header})
    assert r.status_code == 401, r.text
    assert r.json() == {"detail": "Invalid or expired authentication token"}


@in_process
@pytest.mark.parametrize("contents", [None, "invalid JSON", "[]"])
def test_unusable_adc_is_sanitized(real_auth, monkeypatch, tmp_path, caplog, contents):
    import firebase_admin
    from firebase_admin.credentials import ApplicationDefault

    credential_path = tmp_path / "private-adc.json"
    if contents is not None:
        credential_path.write_text(contents, encoding="utf-8")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", str(credential_path))
    monkeypatch.setattr(
        firebase_admin.get_app().credential,
        "get_credential",
        ApplicationDefault().get_credential,
    )

    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": "Bearer private-token"})
    assert r.status_code == 503, r.text
    assert r.json() == {"detail": "Authentication service unavailable"}
    assert "Check Application Default Credentials" in caplog.text
    assert "private-adc.json" not in caplog.text
    assert "private-token" not in caplog.text
    assert real_auth.get("/health").status_code == 200
    assert real_auth.get("/categories").status_code == 200


@in_process
def test_certificate_fetch_failure_is_sanitized(real_auth, monkeypatch, caplog):
    from firebase_admin import auth

    def unavailable(*args, **kwargs):
        raise auth.CertificateFetchError("private upstream failure", cause=None)

    monkeypatch.setattr(auth, "verify_id_token", unavailable)
    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": "Bearer private-token"})
    assert r.status_code == 503, r.text
    assert r.json() == {"detail": "Authentication service unavailable"}
    assert "Check Firebase verification credentials" in caplog.text
    assert "private upstream failure" not in caplog.text
    assert "private-token" not in caplog.text


@in_process
def test_token_must_be_bearer(real_auth):
    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": "Basic dXNlcjpwYXNz"})
    assert r.status_code == 401, r.text


@in_process
@pytest.mark.parametrize("path", ["/health", "/categories"])
def test_public_endpoints_need_no_token(real_auth, path):
    assert real_auth.get(path).status_code == 200


def test_cors_allows_authorization_header(client):
    pre = client.options("/predict", headers={"Origin": "http://localhost:3000",
                                              "Access-Control-Request-Method": "POST",
                                              "Access-Control-Request-Headers": "authorization, content-type"})
    assert pre.status_code == 200, pre.text
    assert "authorization" in pre.headers.get("access-control-allow-headers", "").lower()


# ---- public demo routes (the landing page's "Try it live") ----

DEMO_ROUTES = [
    ("/demo/predict", "/predict", DEMO),
    ("/demo/reasons", "/reasons", DEMO),
    ("/demo/what-if", "/what-if", {"product": DEMO, "prices": [20, 30, 89.99]}),
]


@in_process
@pytest.mark.parametrize("demo_path,path,body", DEMO_ROUTES)
def test_demo_routes_need_no_token(real_auth, demo_path, path, body):
    r = real_auth.post(demo_path, json=body)
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("demo_path,path,body", DEMO_ROUTES)
def test_demo_routes_match_protected_routes(client, demo_path, path, body):
    # client sends a token (in-process: the test user), so both routes answer
    demo, protected = client.post(demo_path, json=body), client.post(path, json=body)
    assert demo.status_code == protected.status_code == 200, (demo.text, protected.text)
    assert demo.json() == protected.json()


@in_process
def test_demo_routes_validate_like_protected_routes(real_auth):
    assert real_auth.post("/demo/what-if", json={"product": DEMO, "prices": []}).status_code == 422
    assert real_auth.post("/demo/predict", json={**DEMO, "price": 0}).status_code == 422


@in_process
def test_rescore_has_no_demo_route(real_auth):
    assert real_auth.post("/demo/rescore", json={"product": DEMO, "changes": {"price": 30}}).status_code == 404
