"""Firebase ID token check: the scoring endpoints refuse a missing, malformed or wrongly sent token with 401;
/health and /categories stay public; CORS lets the browser send the Authorization header."""
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

    firebase_admin builds its auth client from Application Default Credentials, which a test machine may not have
    (then every check raises DefaultCredentialsError, a 500). Checking an ID token needs only Google's public keys, so
    the app's credential is swapped for anonymous credentials and the real verifier still runs."""
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
