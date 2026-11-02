"""/predict and /reasons give exactly predict.py's probability, 0-100 score, model and reasons on the products of
models/fast_check_slow.parquet (scored one at a time through the slow path, so each is one of n + 1 rows)."""
from conftest import in_process, ok, product_json

MODEL = {"full": "full", "launch-time": "launch"}


def reasons_string(r):
    return "; ".join([f"+ {x['label']}" for x in r["reasons_up"]] + [f"- {x['label']}" for x in r["reasons_down"]])


def test_parity_set_is_the_saved_one(slow):
    assert len(slow) == 118
    assert (slow["in_title"].fillna("") == "").sum() == 1   # the "empty title" edge case, see below


def test_predict_and_reasons_identical_to_slow_path(client, slow):
    checked, failures = 0, []
    for _, s in slow.iterrows():
        p = product_json(s)
        if not p["title"]:
            continue
        pred = ok(client.post("/predict", json=p))
        why = ok(client.post("/reasons", json=p))
        got = (pred["probability"], pred["opportunity_score"], pred["model_used"], why["model_used"],
               reasons_string(why))
        want = (float(s["out_p"]), int(s["out_score"]), MODEL[s["out_model"]], MODEL[s["out_model"]],
                s["out_reasons"])
        if got != want:
            failures.append((s["in_case"], got, want))
        checked += 1
    assert checked == 117
    assert not failures, failures[:5]


def test_empty_title_case_is_rejected(client, slow):
    """The 118th product has an empty title, which the API refuses (title is 1 to 500 characters). Its features
    and score are covered by tools/check_fast_features.py, which calls featurize_one directly."""
    s = slow[slow["in_title"].fillna("") == ""].iloc[0]
    assert client.post("/predict", json=product_json(s)).status_code == 422


def test_reasons_items_are_consistent(client, slow):
    import predict
    for _, s in slow.head(30).iterrows():
        why = ok(client.post("/reasons", json=product_json(s)))
        assert len(why["reasons_up"]) <= 3 and len(why["reasons_down"]) <= 3
        for side, sign in (("reasons_up", 1), ("reasons_down", -1)):
            impacts = [x["impact"] for x in why[side]]
            assert all(sign * v > 0 for v in impacts)
            assert impacts == sorted(impacts, reverse=sign > 0)
            for x in why[side]:
                assert predict.FRIENDLY.get(x["feature"], x["feature"]) == x["label"]


@in_process
def test_reasons_detail_matches_reasons_one(slow):
    """api.reasons.reasons_detail, joined like reasons_one, is reasons_one's string for every product."""
    from api.app import STATE, embed
    from api.features_fast import reasons_one
    from api.reasons import reasons_detail
    for _, s in slow.iterrows():
        p = product_json(s)
        if not p["title"]:
            continue
        E = embed(p["title"])
        up, down = reasons_detail(p, STATE.bundle, STATE.tables, E)
        assert reasons_string({"reasons_up": up, "reasons_down": down}) == \
            reasons_one(p, STATE.bundle, STATE.tables, E), s["in_case"]
