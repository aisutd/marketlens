"""/rescore, /what-if, validation, model routing, the embedding cache, CORS, errors, /health and /categories."""
import numpy as np
import pytest

from conftest import in_process, ok, product_json

DEMO = {"title": "Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock", "price": 89.99,
        "list_price": 119.99, "category": "Suitcases"}


def predict(client, p):
    return ok(client.post("/predict", json=p))


@pytest.fixture(scope="module")
def twenty(slow):
    """20 dev products: 10 with stars/reviews (full model), 10 as ideas (launch-time model)."""
    rows = slow[slow["in_case"].isin([f"dev{i}" for i in [*range(10), *range(50, 60)]])]
    assert len(rows) == 20
    return [product_json(r) for _, r in rows.iterrows()]


def edits(p, other_category):
    return {
        "price": round(p["price"] * 1.2 + 1, 2),
        "list_price": round(p["price"] * 1.5, 2),
        "category": other_category,
        "stars": 3.0 if p["stars"] == 4.0 else 4.0,
        "title": p["title"] + " Premium Edition",
    }


# ---- /rescore ----

def test_rescore_equals_predict(client, twenty):
    other = [c["id"] for c in ok(client.get("/categories"))][:2]
    failures = []
    for p in twenty:
        before = predict(client, p)
        oc = other[0] if str(other[0]) != str(p["category"]) else other[1]
        for field, value in edits(p, oc).items():
            r = ok(client.post("/rescore", json={"product": p, "changes": {field: value}}))
            after = predict(client, {**p, field: value})
            got = (r["opportunity_score"], r["probability"], r["model_used"], r["model_version"],
                   r["previous_score"], r["score_change"], r["changed_fields"])
            want = (after["opportunity_score"], after["probability"], after["model_used"], after["model_version"],
                    before["opportunity_score"], after["opportunity_score"] - before["opportunity_score"], [field])
            if got != want:
                failures.append((p["title"][:30], field, got, want))
    assert not failures, failures[:5]


def test_rescore_changed_fields(client):
    def changed(changes, product=DEMO):
        return ok(client.post("/rescore", json={"product": product, "changes": changes}))["changed_fields"]
    assert changed({}) == []
    assert changed({"price": DEMO["price"]}) == []                       # same value: nothing changed
    assert changed({"category": "SUITCASES"}) == []                      # same category, other spelling
    sid = next(c["id"] for c in ok(client.get("/categories")) if c["name"] == "Suitcases")
    assert changed({"category": sid}) == []                              # same category by id
    assert changed({"stars": 4.5, "price": 79.0}) == ["price", "stars"]  # in field order
    assert changed({"list_price": None}) == ["list_price"]               # cleared: becomes 0, like the CLI
    r = ok(client.post("/rescore", json={"product": DEMO, "changes": {"list_price": None}}))
    assert r["opportunity_score"] == predict(client, {**DEMO, "list_price": None})["opportunity_score"]
    assert r["opportunity_score"] == predict(client, {k: v for k, v in DEMO.items() if k != "list_price"})[
        "opportunity_score"]


# ---- /what-if ----

def test_what_if_equals_predict(client, twenty):
    prices = [round(5 + 9.5 * k, 2) for k in range(20)]
    for p in [twenty[0], twenty[10], DEMO]:
        pts = ok(client.post("/what-if", json={"product": p, "prices": prices}))
        assert [x["price"] for x in pts] == prices
        for x in pts:
            want = predict(client, {**p, "price": x["price"]})
            assert (x["opportunity_score"], x["probability"]) == (want["opportunity_score"], want["probability"])
            assert set(x) == {"price", "opportunity_score", "probability"}


# ---- validation ----

BAD = {
    "price 0": {**DEMO, "price": 0},
    "negative price": {**DEMO, "price": -5},
    "price over 100,000": {**DEMO, "price": 100_000.01},
    "stars 6": {**DEMO, "stars": 6},
    "negative stars": {**DEMO, "stars": -0.1},
    "negative reviews": {**DEMO, "reviews": -1},
    "fractional reviews": {**DEMO, "reviews": 1.5},
    "negative list price": {**DEMO, "list_price": -1},
    "empty title": {**DEMO, "title": ""},
    "501-character title": {**DEMO, "title": "x" * 501},
    "unknown category": {**DEMO, "category": "Not A Category"},
    "unknown category id": {**DEMO, "category": 99999},
    "missing title": {k: v for k, v in DEMO.items() if k != "title"},
    "missing category": {k: v for k, v in DEMO.items() if k != "category"},
    "unknown product field": {**DEMO, "colour": "red"},
}


@pytest.mark.parametrize("name", BAD)
def test_bad_product_is_422(client, name):
    for path, body in (("/predict", BAD[name]), ("/reasons", BAD[name]),
                       ("/what-if", {"product": BAD[name], "prices": [10.0]}),
                       ("/rescore", {"product": BAD[name], "changes": {}})):
        assert client.post(path, json=body).status_code == 422, (path, name)


def test_limits_accepted(client):
    ok(client.post("/predict", json={**DEMO, "title": "x" * 500, "price": 100_000, "stars": 5, "reviews": 0,
                                     "list_price": 0}))
    ok(client.post("/predict", json={**DEMO, "title": "x", "price": 0.01, "stars": 0}))


def test_unknown_category_message(client):
    r = client.post("/predict", json={**DEMO, "category": "Not A Category"})
    assert r.status_code == 422 and "/categories" in r.json()["detail"]


@pytest.mark.parametrize("changes", [
    {"colour": "red"}, {"price": 0}, {"price": -1}, {"stars": 6}, {"title": ""}, {"title": "x" * 501},
    {"category": "Not A Category"}, {"price": None}, {"title": None}, {"category": None}, {"reviews": -3},
])
def test_bad_changes_are_422(client, changes):
    assert client.post("/rescore", json={"product": DEMO, "changes": changes}).status_code == 422, changes


@pytest.mark.parametrize("prices", [[], [10.0] * 21, [10.0, 0], [-1.0], [100_000.5]])
def test_bad_what_if_prices_are_422(client, prices):
    assert client.post("/what-if", json={"product": DEMO, "prices": prices}).status_code == 422


def test_twenty_what_if_prices_accepted(client):
    assert len(ok(client.post("/what-if", json={"product": DEMO, "prices": [10.0 + k for k in range(20)]}))) == 20


# ---- model routing ----

@pytest.mark.parametrize("extra, model", [
    ({}, "launch"),
    ({"stars": None, "reviews": None}, "launch"),
    ({"stars": 0, "reviews": 0}, "launch"),
    ({"stars": 4.2}, "full"),
    ({"reviews": 15}, "full"),
    ({"stars": 4.2, "reviews": 15}, "full"),
])
def test_model_routing(client, extra, model):
    p = {**DEMO, **extra}
    assert predict(client, p)["model_used"] == model
    assert ok(client.post("/reasons", json=p))["model_used"] == model


# ---- embedding cache ----

@in_process
def test_price_only_rescore_skips_embedder(client, monkeypatch):
    from api import app as api_app
    calls = []
    encode = api_app.STATE.embedder.encode
    monkeypatch.setattr(api_app.STATE.embedder, "encode", lambda titles, **kw: calls.append(list(titles)) or
                        encode(titles, **kw))
    p = {**DEMO, "title": DEMO["title"] + " cache test"}
    predict(client, p)
    assert calls == [[p["title"]]]                     # a new title is embedded once
    calls.clear()
    ok(client.post("/rescore", json={"product": p, "changes": {"price": 70.0}}))
    ok(client.post("/what-if", json={"product": p, "prices": [10.0, 20.0, 30.0]}))
    ok(client.post("/reasons", json=p))
    assert calls == []                                 # same title: no MiniLM call at all
    ok(client.post("/rescore", json={"product": p, "changes": {"title": p["title"] + " v2"}}))
    assert calls == [[p["title"] + " v2"]]             # only the new title


@in_process
def test_cache_is_bounded_lru(client, monkeypatch):
    from api import app as api_app
    monkeypatch.setattr(api_app, "CACHE_SIZE", 3)
    monkeypatch.setattr(api_app.STATE.embedder, "encode", lambda titles, **kw: np.zeros((1, 384), np.float32))
    api_app._emb_cache.clear()
    for t in "abcd":
        api_app.embed(t)
    assert list(api_app._emb_cache) == ["b", "c", "d"]
    api_app.embed("b")
    api_app.embed("e")
    assert list(api_app._emb_cache) == ["d", "b", "e"]
    api_app._emb_cache.clear()


# ---- CORS ----

def test_cors_allowed_origin(client):
    r = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    pre = client.options("/predict", headers={"Origin": "http://localhost:3000",
                                              "Access-Control-Request-Method": "POST",
                                              "Access-Control-Request-Headers": "content-type"})
    assert pre.status_code == 200 and pre.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_other_origin(client):
    r = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
    pre = client.options("/predict", headers={"Origin": "https://evil.example",
                                              "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in pre.headers
    pre = client.options("/predict", headers={"Origin": "http://localhost:3000",
                                              "Access-Control-Request-Method": "DELETE"})
    assert pre.status_code == 400


# ---- errors ----

@in_process
def test_unexpected_error_is_short_500(monkeypatch, caplog):
    from fastapi.testclient import TestClient
    from api import app as api_app

    def boom(*a, **kw):
        raise RuntimeError("secret internal detail")
    with TestClient(api_app.app, raise_server_exceptions=False) as c:
        monkeypatch.setattr(api_app, "score_one", boom)
        r = c.post("/predict", json=DEMO)
    assert r.status_code == 500
    assert r.json() == {"detail": "Internal server error"}
    assert "secret" not in r.text and "Traceback" not in r.text
    assert "secret internal detail" in caplog.text and "Traceback" in caplog.text   # logged instead


# ---- /health and /categories ----

def test_health(client):
    h = ok(client.get("/health"))
    assert h["status"] == "ok" and h["tables_rows"] == 1249285
    assert h["model_version"].startswith("embed_model.joblib 20")


def test_categories(client):
    cats = ok(client.get("/categories"))
    assert len(cats) == 232 and len({c["id"] for c in cats}) == 232
    assert {"id": 1, "name": "Beading & Jewelry Making"} in cats
    by_id = predict(client, {**DEMO, "category": next(c["id"] for c in cats if c["name"] == "Suitcases")})
    for spelling in ("Suitcases", "suitcases", " SUITCASES "):
        assert predict(client, {**DEMO, "category": spelling}) == by_id
