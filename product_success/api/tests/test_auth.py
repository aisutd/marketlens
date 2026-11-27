"""Firebase ID token check: the scoring endpoints refuse a missing, malformed or wrongly sent token with 401;
/health and /categories stay public;
CORS lets the browser send the Authorization header.

The former public demo scoring routes are covered by test_demo_security.py.
"""
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


# ---- clock skew: a token minted on a clock slightly ahead of the server's ----

@pytest.fixture
def sign_token(real_auth, monkeypatch):
    """Sign real RS256 ID tokens with a throwaway key, served as Google's public certificate.

    The SDK's own checks (signature, audience, issuer, iat/exp) all run; only the certificate download is replaced."""
    import datetime
    import time

    import google.oauth2.id_token
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    from google.auth import crypt, jwt

    from api.firebase_auth import PROJECT_ID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(1).not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=1)).sign(key, hashes.SHA256()))
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    key_pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption())
    monkeypatch.setattr(google.oauth2.id_token, "_fetch_certs", lambda request, url: {"test-kid": cert_pem})
    signer = crypt.RSASigner.from_string(key_pem, key_id="test-kid")

    def sign(issued_ahead_seconds):
        iat = int(time.time()) + issued_ahead_seconds
        claims = {"iss": f"https://securetoken.google.com/{PROJECT_ID}", "aud": PROJECT_ID,
                  "sub": "skewed-user", "iat": iat, "auth_time": iat, "exp": iat + 3600}
        return jwt.encode(signer, claims).decode()
    return sign


@in_process
def test_token_signed_now_is_accepted(real_auth, sign_token):
    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": f"Bearer {sign_token(0)}"})
    assert r.status_code == 200, r.text


@in_process
def test_token_issued_slightly_ahead_is_accepted(real_auth, sign_token):
    # a server clock a few seconds behind Google's must not reject a token minted just now
    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": f"Bearer {sign_token(5)}"})
    assert r.status_code == 200, r.text


@in_process
def test_token_issued_beyond_the_allowance_is_rejected(real_auth, sign_token):
    from api.firebase_auth import CLOCK_SKEW_SECONDS
    ahead = CLOCK_SKEW_SECONDS + 20
    r = real_auth.post("/predict", json=DEMO, headers={"Authorization": f"Bearer {sign_token(ahead)}"})
    assert r.status_code == 401, r.text
    assert r.json() == {"detail": "Invalid or expired authentication token"}
