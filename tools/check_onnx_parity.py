"""
MarketLens: prove the ONNX title embedder (api\\embed_onnx.py) gives the same answers as the PyTorch one.

    python tools\\check_onnx_parity.py

Uses dev rows only (data\\products_dev.csv), never the holdout. Four checks, each with a pass line:

  1. embeddings: 1,000 dev titles (fixed seed; the 50 longest, the 50 shortest, 900 random) plus a few
     synthetic over-long titles that hit the 256-token truncation. SentenceTransformer with the training
     settings vs OnnxEmbedder, in batches of 64 and one at a time, compared in float32 BEFORE the float16
     round trip. Pass: max abs diff < 1e-4. Also reported after the round trip (how many values flip).
  2. PCA: both embeddings through the bundle's PCA-32. Pass: max abs diff < 1e-4 (float32, before rounding),
     also reported after rounding.
  3. end to end: 1,000 dev products (half with their stars/reviews, half as ideas with none) scored in one
     batched pass through predict.py's code path with the ONNX embedder and with PyTorch one title at a time
     (the way the API scores: one product per request; ONNX gives identical embeddings at any batch size).
     float16 round trip kept. Pass: no 0-100 score moves more than 3 points and at most 1% of products
     change score. Also printed for scale: PyTorch against itself (batch 64 and production batch 32, each vs
     one at a time) and ONNX vs PyTorch production.
  4. accuracy gate: 20,000 products from the dev test split (improve_xgb.py's split, never the holdout),
     one batched featurize with PyTorch production embeddings and one with ONNX. ROC-AUC, PR-AUC and
     within-category ROC-AUC of the full and the launch-time model. Pass: each within 0.0005.

     Why not identical scores or a flat 1e-5 on the probability: a PCA feature sitting on an XGBoost split
     threshold moves the probability by a whole leaf value for a ~3e-7 change in the embedding, and PyTorch
     does this to itself when only the batch size changes. On 1,000 dev products, PyTorch batch 64 vs one at
     a time already moves the probability by up to 1.21e-02 and changes 1 score (67 -> 64).

Then timings: import and load of each engine (fresh processes), median ms per single title, ms per batch of 64.
"""
import argparse
import os
import statistics
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, ROOT)
os.environ.setdefault("HF_HOME", os.path.join("data", "embeddings", "hf_cache"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from tools import predict_path  # noqa: E402

SEED = 42
TOL_EMB = 1e-4
TOL_PCA = 1e-4
TOL_P = 1e-5            # only for counting products whose probability moved
MAX_SCORE_MOVE = 3      # check 3: no 0-100 score moves more than this
MAX_SCORE_SHARE = 0.01  # check 3: at most this share of products change score
TOL_AUC = 0.0005        # check 4: each AUC within this


def f16(E):
    return E.astype(np.float16).astype(np.float32)


def compare(name, A, B):
    """Max abs diff and min cosine between two (n, d) matrices, before and after the float16 round trip."""
    d = np.abs(A - B)
    cos = (A * B).sum(1) / (np.linalg.norm(A, axis=1) * np.linalg.norm(B, axis=1))
    d16 = np.abs(f16(A) - f16(B))
    flips = int((d16 > 0).sum())
    print(f"  {name:<34} max|diff| {d.max():.2e}  mean {d.mean():.1e}  min cos {cos.min():.8f}  "
          f"| after f16: max|diff| {d16.max():.2e}, {flips:,} of {d16.size:,} values differ "
          f"in {int((d16 > 0).any(1).sum())} rows")
    return float(d.max()), float(d16.max())


def pick_titles(dev, n=1000, n_long=50, n_short=50):
    titles = dev["title"].fillna("").astype(str).drop_duplicates()
    by_len = titles.str.len().sort_values()
    short = titles.loc[by_len.index[:n_short]]
    long = titles.loc[by_len.index[-n_long:]]
    rest = titles.drop(short.index.union(long.index)).sample(n - n_short - n_long, random_state=SEED)
    picked = pd.concat([long, short, rest]).tolist()
    # Real titles are far below 256 tokens, so add a few that are not, to exercise truncation.
    rng = np.random.default_rng(SEED)
    synthetic = [" ".join(rng.choice(rest.tolist(), k)) for k in (8, 15, 30)]
    return picked, synthetic


def time_engine(code, repeats=3):
    """Seconds for `code` in a fresh interpreter (median of a few runs)."""
    runs = []
    for _ in range(repeats):
        r = subprocess.run([sys.executable, "-c", "import time; t=time.perf_counter()\n" + code +
                            "\nprint(time.perf_counter()-t)"], capture_output=True, text=True, cwd=ROOT,
                           env={**os.environ})
        if r.returncode:
            raise SystemExit(r.stderr)
        runs.append(float(r.stdout.strip().splitlines()[-1]))
    return statistics.median(runs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join("models", "embed_model.joblib"))
    ap.add_argument("--onnx-dir", default=os.path.join("models", "minilm-onnx"))
    ap.add_argument("--n-products", type=int, default=1000)
    ap.add_argument("--n-test", type=int, default=20_000)
    args = ap.parse_args()

    import torch
    from sentence_transformers import SentenceTransformer
    from api.embed_onnx import OnnxEmbedder
    import embeddings

    bundle = joblib.load(args.model)
    name, pca = bundle["title_emb"]["model"], bundle["title_emb"]["pca"]
    print(f"bundle data_path: {bundle['data_path']}")
    if "holdout" in bundle["data_path"].lower():
        raise SystemExit("refusing: the bundle points at the holdout set")
    dev = pd.read_csv(bundle["data_path"])

    torch.set_num_threads(os.cpu_count() or 1)   # as embeddings.embed_new_titles does
    st = SentenceTransformer(name, device="cpu")
    onnx = OnnxEmbedder(args.onnx_dir)
    titles, synthetic = pick_titles(dev)
    n_tok = np.array([sum(e.attention_mask) for e in onnx.tokenizer.encode_batch(titles + synthetic)])  # not len(ids): padded
    print(f"\n{len(titles)} dev titles: {min(map(len, titles))}-{max(map(len, titles))} chars, "
          f"tokens incl. [CLS]/[SEP] {n_tok[:len(titles)].min()}-{n_tok[:len(titles)].max()}; "
          f"{len(synthetic)} synthetic long titles: {n_tok[len(titles):].tolist()} tokens after truncation")

    def st_encode(t, bs):
        return st.encode(t, batch_size=bs, normalize_embeddings=True, convert_to_numpy=True,
                         show_progress_bar=False).astype(np.float32)

    allt = titles + synthetic
    print("\n[1] embeddings, float32 before the float16 round trip")
    S64, O64 = st_encode(allt, 64), onnx.encode(allt, batch_size=64)
    S1 = np.vstack([st_encode([t], 1) for t in allt])
    O1 = np.vstack([onnx.encode([t]) for t in allt])
    n = len(titles)
    results = {}
    results["b64"] = compare("ST b64 vs ONNX b64 (dev)", S64[:n], O64[:n])
    results["one"] = compare("ST one vs ONNX one (dev)", S1[:n], O1[:n])
    results["syn"] = compare("ST b64 vs ONNX b64 (synthetic)", S64[n:], O64[n:])
    compare("ST one vs ONNX one (synthetic)", S1[n:], O1[n:])
    print("  for scale, each engine against itself across batch sizes:")
    compare("ST b64 vs ST one", S64, S1)
    compare("ONNX b64 vs ONNX one", O64, O1)
    emb_max = max(results["b64"][0], results["one"][0], results["syn"][0],
                  float(np.abs(S1[n:] - O1[n:]).max()))
    pass1 = emb_max < TOL_EMB
    print(f"  CHECK 1 {'PASS' if pass1 else 'FAIL'}: max abs diff {emb_max:.2e} (< {TOL_EMB:g})")

    print("\n[2] PCA-32 outputs")
    zs = {}
    for label, A, B in (("b64", S64, O64), ("one", S1, O1)):
        za, zb = pca.transform(A).astype(np.float32), pca.transform(B).astype(np.float32)
        zs[label] = float(np.abs(za - zb).max())
        z16 = float(np.abs(pca.transform(f16(A)) - pca.transform(f16(B))).max())
        print(f"  {label}: max|diff| float32 {zs[label]:.2e} | after f16 round trip {z16:.2e}")
    pca_max = max(zs.values())
    pass2 = pca_max < TOL_PCA
    print(f"  CHECK 2 {'PASS' if pass2 else 'FAIL'}: max abs diff {pca_max:.2e} (< {TOL_PCA:g})")

    print(f"\n[3] end to end on {args.n_products} dev products, one batched pass each through predict.featurize "
          f"(float16 round trip kept)")
    rows = dev.dropna(subset=["title"]).sample(args.n_products, random_state=SEED).reset_index(drop=True)
    new = pd.DataFrame({"title": rows["title"], "price": rows["price"], "listPrice": rows["listPrice"],
                        "stars": rows["stars"], "reviews": rows["reviews"], "category": rows["category_id"]})
    new.loc[len(new) // 2:, ["stars", "reviews"]] = 0   # the second half are product ideas
    embeddings._MODELS[name] = st                        # reuse the loaded model; same object embed_new_titles makes
    engines = {
        "pytorch": None,                                 # embed_new_titles as is: batch 32, the production path
        "onnx": onnx.encode,
        "pytorch_b64": lambda t: st_encode(t, 64),
        "pytorch_one": lambda t: np.vstack([st_encode([x], 1) for x in t]),
    }
    out = {}
    for label, encode in engines.items():
        predict_path.use_embedder(encode)
        t = time.perf_counter()
        out[label] = predict_path.score(bundle, dev, new)
        print(f"  {label} pass {time.perf_counter() - t:.0f}s")
    predict_path.use_embedder(None)
    print(f"  models used: {out['pytorch']['model'].value_counts().to_dict()}")

    tt = new["title"].fillna("").astype(str).tolist()
    Et, Eo = embeddings.embed_new_titles(tt), f16(onnx.encode(tt))
    print(f"  embeddings after f16 (PyTorch vs ONNX): {int((Et != Eo).sum()):,} of {Et.size:,} values differ, in "
          f"{int((Et != Eo).any(1).sum())} of {len(tt)} products; PCA max|diff| "
          f"{np.abs(pca.transform(Et) - pca.transform(Eo)).max():.2e}")

    def diff(a, b):
        A, B = out[a], out[b]
        dp = np.abs(A["p_raw"].values - B["p_raw"].values)
        ds = np.abs(A["opportunity_score"].values.astype(int) - B["opportunity_score"].values.astype(int))
        return {"max_dp": float(dp.max()), "over": int((dp > TOL_P).sum()), "any": int((dp > 0).sum()),
                "scores": int((ds > 0).sum()), "max_move": int(ds.max()),
                "reasons": int((A["reasons"].values != B["reasons"].values).sum())}

    rows3 = [("ONNX vs PyTorch one at a time", diff("pytorch_one", "onnx")),
             ("PyTorch b64 vs one (noise)", diff("pytorch_b64", "pytorch_one")),
             ("PyTorch b32 vs one (noise)", diff("pytorch", "pytorch_one")),
             ("ONNX vs PyTorch b32 (production)", diff("pytorch", "onnx"))]
    print(f"  {'':<34}{'max |p diff|':>13}{f'> {TOL_P:g}':>8}{'any diff':>10}{'scores chg':>12}"
          f"{'max move':>10}{'reasons chg':>13}")
    for label, r in rows3:
        print(f"  {label:<34}{r['max_dp']:>13.2e}{r['over']:>8}{r['any']:>10}{r['scores']:>12}"
              f"{r['max_move']:>10}{r['reasons']:>13}")
    ox = rows3[0][1]
    pass3 = ox["max_move"] <= MAX_SCORE_MOVE and ox["scores"] <= MAX_SCORE_SHARE * len(new)
    print(f"  CHECK 3 {'PASS' if pass3 else 'FAIL'}: ONNX vs PyTorch one at a time: largest score move "
          f"{ox['max_move']} (<= {MAX_SCORE_MOVE}), {ox['scores']} of {len(new)} scores changed "
          f"(<= {MAX_SCORE_SHARE:.0%})")

    print(f"\n[4] accuracy gate: {args.n_test:,} products from the dev test split (not the holdout), "
          f"PyTorch production embeddings vs ONNX, one batched featurize each")
    from sklearn.metrics import average_precision_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    from compare_models import build_target
    from improve_xgb import roc_auc_within_category
    y_all = build_target(dev)
    # The test split of improve_xgb.py / push_auc.py / export_split.py (20% of dev, stratified).
    strat = dev["category_id"].astype(str) + "_" + y_all.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    _, te_idx = train_test_split(dev.index, test_size=0.2, stratify=strat, random_state=SEED)
    te = dev.loc[te_idx].sample(args.n_test, random_state=SEED)
    y_te, cats = y_all.loc[te.index].values, te["category_id"].values
    test_new = te.drop(columns=["boughtInLastMonth"]).reset_index(drop=True)   # as evaluate_holdout.py does
    print(f"  {len(te):,} products, {y_te.mean():.1%} successful (the bundle was fit on all dev rows, so "
          f"these AUCs are not honest estimates; the gate is only the difference between engines)")
    aucs = {}
    for label, encode in (("pytorch", None), ("onnx", onnx.encode)):
        predict_path.use_embedder(encode)
        t = time.perf_counter()
        X = predict_path.predict.featurize(bundle, dev, test_new)
        for mname, m in (("full", bundle), ("launch", bundle["launch"])):
            p = m["xgb"].predict_proba(X[m["feature_cols"]])[:, 1]
            aucs[label, mname] = {"ROC-AUC": roc_auc_score(y_te, p), "PR-AUC": average_precision_score(y_te, p),
                                  "within-cat": roc_auc_within_category(y_te, p, cats)}
        print(f"  {label} pass {time.perf_counter() - t:.0f}s")
    predict_path.use_embedder(None)
    print(f"  {'model':<8}{'metric':<12}{'PyTorch':>10}{'ONNX':>10}{'diff':>11}")
    worst = 0.0
    for mname in ("full", "launch"):
        for metric in ("ROC-AUC", "PR-AUC", "within-cat"):
            a, b = aucs["pytorch", mname][metric], aucs["onnx", mname][metric]
            worst = max(worst, abs(a - b))
            print(f"  {mname:<8}{metric:<12}{a:>10.5f}{b:>10.5f}{b - a:>+11.6f}")
    pass4 = worst <= TOL_AUC
    print(f"  CHECK 4 {'PASS' if pass4 else 'FAIL'}: largest AUC difference {worst:.6f} (<= {TOL_AUC:g})")

    print("\n[5] timings")
    one = allt[:200]
    def per_title(f):
        ts = []
        for x in one:
            t = time.perf_counter()
            f([x])
            ts.append(time.perf_counter() - t)
        return 1000 * statistics.median(ts)
    batches = [allt[i:i + 64] for i in range(0, 640, 64)]
    def per_batch(f):
        ts = []
        for b in batches:
            t = time.perf_counter()
            f(b)
            ts.append(time.perf_counter() - t)
        return 1000 * statistics.median(ts)
    threads = torch.get_num_threads()
    rows_t = [(f"PyTorch, {threads} threads", per_title(lambda x: st_encode(x, 64)), per_batch(lambda x: st_encode(x, 64)))]
    torch.set_num_threads(1)
    rows_t.append(("PyTorch, 1 thread", per_title(lambda x: st_encode(x, 64)), per_batch(lambda x: st_encode(x, 64))))
    torch.set_num_threads(threads)
    rows_t.append(("ONNX Runtime, 1 thread", per_title(onnx.encode), per_batch(onnx.encode)))
    print(f"  {'engine':<26}{'ms/title':>10}{'ms/batch64':>12}")
    for r in rows_t:
        print(f"  {r[0]:<26}{r[1]:>10.1f}{r[2]:>12.0f}")

    imp_t = time_engine("import torch, sentence_transformers")
    load_t = time_engine("import torch\nfrom sentence_transformers import SentenceTransformer\n"
                         f"SentenceTransformer({name!r}, device='cpu')")
    imp_o = time_engine("import onnxruntime, tokenizers")
    load_o = time_engine(f"from api.embed_onnx import OnnxEmbedder\nOnnxEmbedder({args.onnx_dir!r})")
    print(f"  import: PyTorch+sentence-transformers {imp_t:.2f}s, onnxruntime+tokenizers {imp_o:.2f}s")
    print(f"  import + load model (fresh process): PyTorch {load_t:.2f}s, ONNX {load_o:.2f}s")
    print(f"  {args.onnx_dir}/model.onnx: {os.path.getsize(os.path.join(args.onnx_dir, 'model.onnx')) / 2**20:.1f} MB")

    print(f"\nSUMMARY: check 1 {'PASS' if pass1 else 'FAIL'}, check 2 {'PASS' if pass2 else 'FAIL'}, "
          f"check 3 {'PASS' if pass3 else 'FAIL'}, check 4 {'PASS' if pass4 else 'FAIL'}")
    sys.exit(0 if pass1 and pass2 and pass3 and pass4 else 1)


if __name__ == "__main__":
    main()
