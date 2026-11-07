"""
MarketLens: prove api\\features_fast.py gives exactly the features and scores of predict.featurize.

    python -m product_success.tools.check_fast_features --slow      # slow path, ~23 s per product: writes the cache
    python -m product_success.tools.check_fast_features             # fast path against the cache (builds it first if missing)

Products: 100 dev products (fixed seed; half with their stars/reviews, half as ideas) plus hand-made edge
cases (price above the category max, below the min, at the exact median, a price shared by many products,
no list price, list price = price, the smallest category, ideas in 5 categories, an unseen brand, an empty
title, reviews > 0 in a category where no product has positive reviews, stars without reviews, the demo).
Never the holdout.

Slow path: tools/predict_path.score, one product per call (so the new product is one of n + 1 rows, as in
the API), with predict.featurize's output captured. Fast path: features_fast.featurize_one / score_one. Both
embed titles with the same OnnxEmbedder, so only the features differ. The slow results go to
models/fast_check_slow.parquet and are reused.

Pass: every feature equal (floats within 1e-9 and NaN in the same places, ints and categories exactly, same
dtypes), every probability identical, every 0-100 score and every reason identical.
"""
import argparse
import os
import sys
import time

from paths import MODELS_DIR  # noqa: E402

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

SEED = 42
TOL = 1e-9
CACHE = os.path.join(MODELS_DIR, "fast_check_slow.parquet")
IN_COLS = ["case", "title", "price", "list_price", "stars", "reviews", "category"]


def build_products(dev, tables):
    rows = dev.sample(100, random_state=SEED).reset_index(drop=True)
    P = pd.DataFrame({"case": [f"dev{i}" for i in range(100)], "title": rows["title"], "price": rows["price"],
                      "list_price": rows["listPrice"], "stars": rows["stars"], "reviews": rows["reviews"],
                      "category": rows["category_id"].astype(str)})
    P.loc[50:, ["stars", "reviews"]] = 0   # the second half as product ideas (launch-time model)

    cats = tables["categories"]
    big = dev["category_id"].value_counts().index[0]
    smallest = dev["category_id"].value_counts().index[-1]
    ties = dev.loc[dev["price"] == 9.99, "category_id"].value_counts()
    tie_cat, tie_n = int(ties.index[0]), int(ties.iloc[0])
    low_cat = next(c for c in dev["category_id"].value_counts().index if cats[int(c)]["price"][0] > 1)
    no_reviews = [c for c, t in cats.items() if len(t["reviews"]) == 0]
    p_nz = cats[int(big)]["price_nz"]
    median = float(np.median(p_nz))
    template = dev[dev["category_id"] == big].iloc[0]
    title, rng = template["title"], np.random.default_rng(SEED)
    idea_cats = rng.choice(sorted(cats), 5, replace=False)
    unseen = "Zqxjvorplm Stainless Steel Water Bottle 32 oz Insulated"
    from training.improve_xgb import brand_of
    assert brand_of(unseen) not in tables["brands"], "the 'unseen' brand exists"

    def case(name, **kw):
        base = {"case": name, "title": title, "price": 29.99, "list_price": np.nan, "stars": 0, "reviews": 0,
                "category": str(int(big))}
        base.update(kw)
        return base

    edge = [
        case("price above category max", price=round(float(cats[int(big)]["price"][-1]) + 50, 2), stars=4.4,
             reviews=120),
        case("price below category min", category=str(int(low_cat)),
             price=round(float(cats[int(low_cat)]["price"][0]) / 2, 2)),
        case(f"price at exact category median ({median})", price=median),
        case(f"price 9.99 tied with {tie_n} others", category=str(tie_cat), price=9.99, stars=4.0),
        case("no list price", price=24.5, list_price=np.nan, stars=4.1, reviews=33),
        case("list price equal to price", price=24.5, list_price=24.5),
        case("smallest category, idea", category=str(int(smallest)), price=15.0),
        case("smallest category, with reviews", category=str(int(smallest)), price=15.0, stars=4.6, reviews=10),
        *[case(f"idea in category {int(c)}", category=str(int(c)),
               title=dev.loc[dev["category_id"] == c, "title"].iloc[0], price=19.99, list_price=24.99)
          for c in idea_cats],
        case("unseen brand", title=unseen, price=21.0),
        case("empty title (brand '')", title="", price=12.0),
        case(f"reviews > 0 in category {no_reviews[0]} with no positive reviews", category=str(no_reviews[0]),
             price=89.99, stars=4.2, reviews=150),
        case("stars but no reviews", price=35.0, stars=3.9, reviews=0),
        case("demo product", title="Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock", price=89.99,
             list_price=119.99, category="Suitcases"),
    ]
    return pd.concat([P, pd.DataFrame(edge)], ignore_index=True)


def product_dict(r):
    return {"title": r["title"], "price": r["price"], "list_price": r["list_price"], "stars": r["stars"],
            "reviews": r["reviews"], "category": r["category"]}


def run_slow(bundle, tables, onnx, cache=CACHE, limit=None):
    from tools import predict_path
    dev = pd.read_csv(bundle["data_path"])
    P = build_products(dev, tables)
    if limit:
        P = pd.concat([P.head(limit), P.tail(limit)], ignore_index=True)   # a few dev rows + edge cases
    predict_path.use_embedder(onnx.encode)
    captured = {}
    featurize = predict_path.predict.featurize

    def capture(b, ref, new):
        captured["X"] = featurize(b, ref, new)
        return captured["X"]

    predict_path.predict.featurize = capture
    rows, t0 = [], time.time()
    for i, r in P.iterrows():
        d = product_dict(r)
        new = predict_path.new_frame(d["title"], d["price"], d["list_price"], d["stars"], d["reviews"],
                                     d["category"])
        out = predict_path.score(bundle, dev, new).iloc[0]
        X = captured["X"].copy()
        X.insert(0, "out_model", out["model"])
        X.insert(1, "out_p", out["p_raw"])
        X.insert(2, "out_score", int(out["opportunity_score"]))
        X.insert(3, "out_reasons", out["reasons"])
        for k, c in enumerate(IN_COLS):
            X.insert(k, f"in_{c}", r[c])
        rows.append(X)
        print(f"  slow {i + 1}/{len(P)} {r['case'][:50]:<50} score {out['opportunity_score']} "
              f"({(time.time() - t0) / (i + 1):.0f}s each)", flush=True)
    predict_path.predict.featurize = featurize
    S = pd.concat(rows, ignore_index=True)
    S["category_id"] = pd.Categorical(S["category_id"].astype(int), categories=bundle["categories"])
    S.to_parquet(cache, index=False)
    print(f"saved {cache} ({len(S)} products)")


def compare(bundle, tables, onnx, cache=CACHE):
    from api.features_fast import featurize_one, reasons_one, score_one
    S = pd.read_parquet(cache)
    feats = bundle["feature_cols"]
    failures, worst = [], {}
    t_fast = []
    for i, s in S.iterrows():
        d = {c: s[f"in_{c}"] for c in IN_COLS}
        E = onnx.encode([d["title"]])[0]
        t = time.perf_counter()
        X = featurize_one(d, bundle, tables, E, all_columns=True)
        out = score_one(d, bundle, tables, E)
        t_fast.append(time.perf_counter() - t)
        out["reasons"] = reasons_one(d, bundle, tables, E)
        for f in feats:
            a, b = s[f], X[f].iloc[0]
            if isinstance(X[f].dtype, pd.CategoricalDtype):
                ok = int(a) == int(b) and list(X[f].cat.categories) == list(bundle["categories"])
                diff = 0.0 if ok else np.inf
            elif pd.api.types.is_integer_dtype(X[f].dtype):
                ok = S[f].dtype == X[f].dtype and int(a) == int(b)
                diff = abs(int(a) - int(b))
            else:
                both_nan = np.isnan(a) and np.isnan(b)
                diff = 0.0 if both_nan else abs(float(a) - float(b))
                ok = S[f].dtype == X[f].dtype and (both_nan or diff <= TOL)
            worst[f] = max(worst.get(f, 0.0), diff if not np.isnan(diff) else np.inf)
            if not ok:
                failures.append((s["in_case"], f, a, b, str(S[f].dtype), str(X[f].dtype)))
        for k_slow, k_fast in (("out_model", "model"), ("out_p", "p_raw"), ("out_score", "opportunity_score"),
                               ("out_reasons", "reasons")):
            if s[k_slow] != out[k_fast]:
                failures.append((s["in_case"], k_fast, s[k_slow], out[k_fast], "", ""))

    float_feats = [f for f in feats if f in worst and not pd.api.types.is_integer_dtype(S[f].dtype)
                   and not isinstance(S[f].dtype, pd.CategoricalDtype)]
    print(f"{len(S)} products ({(S['in_case'].str.startswith('dev')).sum()} dev, "
          f"{(~S['in_case'].str.startswith('dev')).sum()} edge cases), {len(feats)} features each")
    print(f"models: {S['out_model'].value_counts().to_dict()}")
    print("largest float differences: " + ", ".join(
        f"{f} {worst[f]:.1e}" for f in sorted(float_feats, key=lambda f: -worst[f])[:6]))
    print("edge cases (slow score = fast score):")
    for _, s in S[~S["in_case"].str.startswith("dev")].iterrows():
        print(f"  {s['in_case']:<58} {s['out_model']:<12} score {s['out_score']:>3}  p {s['out_p']:.6f}")
    print(f"fast score path: median {1000 * np.median(t_fast):.0f} ms per product (features + score, no embedding, no reasons)")
    if failures:
        print(f"\nFAIL: {len(failures)} mismatches")
        for case, f, a, b, da, db in failures[:40]:
            print(f"  {case:<50} {f:<24} slow {a!r} ({da})  fast {b!r} ({db})")
        return False
    print("\nPASS: every feature, probability, 0-100 score and reason identical")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slow", action="store_true", help="(re)build the slow-path cache")
    ap.add_argument("--model", default=os.path.join(MODELS_DIR, "embed_model.joblib"))
    ap.add_argument("--tables", default=os.path.join(MODELS_DIR, "reference_tables.joblib"))
    ap.add_argument("--onnx-dir", default=os.path.join(MODELS_DIR, "minilm-onnx"))
    ap.add_argument("--cache", default=CACHE)
    ap.add_argument("--limit", type=int, default=None, help="smoke test: first and last N products only")
    args = ap.parse_args()
    from api.embed_onnx import OnnxEmbedder
    from api.features_fast import load_tables
    bundle = joblib.load(args.model)
    if "holdout" in bundle["data_path"].lower():
        raise SystemExit("refusing: the bundle points at the holdout set")
    tables = load_tables(args.tables, bundle)
    onnx = OnnxEmbedder(args.onnx_dir)
    if args.slow or not os.path.exists(args.cache):
        run_slow(bundle, tables, onnx, args.cache, args.limit)
    sys.exit(0 if compare(bundle, tables, onnx, args.cache) else 1)


if __name__ == "__main__":
    main()
