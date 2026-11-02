"""
MarketLens: time and memory of scoring one product, stage by stage, in one fresh process.

    python tools\\measure_footprint.py                         # MiniLM through PyTorch (sentence-transformers)
    python tools\\measure_footprint.py --engine onnx           # MiniLM through ONNX Runtime (api\\embed_onnx.py)
    python tools\\measure_footprint.py --engine onnx --fast    # no CSV, no torch: api\\features_fast.py + tables

Stages: Python + psutil only, the libraries, joblib.load of the bundle, reading the reference CSV (or, with
--fast, loading models\\reference_tables.joblib), loading the title embedder, scoring the demo product once,
then 20 more times (median per call). With --fast every call includes embedding the title, the score path
(score_one) is timed on its own, and a last stage times the reasons path (reasons_one, SHAP) for the demo on
the launch-time model and, with stars and reviews added, on the full model. After each stage it
prints the table so far: seconds for the stage, resident set (RSS) and peak working set, in MB.
Peak working set is the peak over the whole process so far, which is what an instance has to fit.
"""
import time

T0 = time.perf_counter()
import psutil  # noqa: E402

PROC = psutil.Process()
ROWS = []


def mark(stage, t_start):
    mi = PROC.memory_info()
    ROWS.append((stage, time.perf_counter() - t_start, mi.rss / 2**20, mi.peak_wset / 2**20))
    print(f"\n{'stage':<44}{'seconds':>9}{'RSS MB':>9}{'peak WS MB':>12}")
    for s, sec, rss, peak in ROWS:
        print(f"{s:<44}{sec:>9.2f}{rss:>9.0f}{peak:>12.0f}")
    return time.perf_counter()


t = mark("1 Python start + psutil (baseline)", T0)

import argparse  # noqa: E402
import os  # noqa: E402
import statistics  # noqa: E402
import sys  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--engine", choices=["torch", "onnx"], default="torch")
ap.add_argument("--fast", action="store_true", help="score from the precomputed tables (needs --engine onnx)")
ap.add_argument("--model", default=os.path.join("models", "embed_model.joblib"))
ap.add_argument("--tables", default=os.path.join("models", "reference_tables.joblib"))
ap.add_argument("--onnx-dir", default=os.path.join("models", "minilm-onnx"))
ap.add_argument("--repeats", type=int, default=20)
args = ap.parse_args()
if args.fast and args.engine != "onnx":
    ap.error("--fast runs without torch: use it with --engine onnx")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)   # bundle, CSV and HF cache paths are relative to the repo
sys.path.insert(0, ROOT)
os.environ.setdefault("HF_HOME", os.path.join("data", "embeddings", "hf_cache"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")   # the model is cached; don't time network checks

import numpy  # noqa: E402,F401
import pandas as pd  # noqa: E402
import sklearn  # noqa: E402,F401
import xgboost  # noqa: E402,F401
import joblib  # noqa: E402
if args.fast:
    from api import features_fast  # noqa: E402  (imports predict.py and its training modules)
    from tools.predict_path import DEMO  # noqa: E402
else:
    from tools import predict_path  # noqa: E402  (imports predict.py and its training modules)
    DEMO = predict_path.DEMO

t = mark("2 import numpy, pandas, xgboost, sklearn", t)

bundle = joblib.load(args.model)
t = mark("3 joblib.load(embed_model.joblib)", t)

if args.fast:
    tables = features_fast.load_tables(args.tables, bundle, verify_csv=False)   # as on a server without the CSV
    t = mark("3b load reference_tables.joblib", t)
else:
    ref = pd.read_csv(bundle["data_path"])
    t = mark("3b read_csv(products_dev.csv)", t)
    ref_mb = ref.memory_usage(deep=True).sum() / 2**20

if args.engine == "torch":
    import embeddings
    import torch
    from sentence_transformers import SentenceTransformer
    torch.set_num_threads(os.cpu_count() or 1)   # what embeddings.embed_new_titles does on first use
    name = bundle["title_emb"]["model"]
    embeddings._MODELS[name] = SentenceTransformer(name, device="cpu")
    predict_path.use_embedder(None)
    t = mark("4 load SentenceTransformer (PyTorch)", t)
else:
    from api.embed_onnx import OnnxEmbedder
    emb = OnnxEmbedder(args.onnx_dir)
    if not args.fast:
        predict_path.use_embedder(emb.encode)
    t = mark("4 load OnnxEmbedder (ONNX Runtime)", t)

d = DEMO
if args.fast:
    product = {"title": d["title"], "price": d["price"], "list_price": d["list_price"], "stars": d["stars"],
               "reviews": d["reviews"], "category": d["category"]}

    def score():
        return features_fast.score_one(product, bundle, tables, emb.encode([product["title"]])[0])
else:
    new = predict_path.new_frame(d["title"], d["price"], d["list_price"], d["stars"], d["reviews"], d["category"])

    def score():
        return predict_path.score(bundle, ref, new).iloc[0]

out = score()
t = mark("5 score demo product once", t)

times = []
for _ in range(args.repeats):
    t1 = time.perf_counter()
    again = score()
    times.append(time.perf_counter() - t1)
    assert again["p_raw"] == out["p_raw"]
t = mark(f"6 score {args.repeats} more times", t)

if args.fast:
    full_product = dict(product, stars=4.5, reviews=1200)   # the predict.py docstring example: full model
    E = emb.encode([product["title"]])[0]
    paths = {}
    for label, prod, fn in (("score, full model", full_product, features_fast.score_one),
                            ("reasons, launch-time model", product, features_fast.reasons_one),
                            ("reasons, full model", full_product, features_fast.reasons_one)):
        fn(prod, bundle, tables, E)
        ts = []
        for _ in range(args.repeats):
            t1 = time.perf_counter()
            fn(prod, bundle, tables, E)
            ts.append(time.perf_counter() - t1)
        paths[label] = ts
    t = mark("7 score (full) + reasons (both models)", t)

print(f"\nengine: {args.engine}{' --fast (no CSV)' if args.fast else ''}; torch imported: {'torch' in sys.modules}")
print(f"median per call over {args.repeats}: {1000 * statistics.median(times):.0f} ms "
      f"(min {1000 * min(times):.0f}, max {1000 * max(times):.0f})")
if args.fast:
    print("  (score path: embedding + score_one, demo on the launch-time model)")
    for label, ts in paths.items():
        print(f"median {label} over {args.repeats}: {1000 * statistics.median(ts):.0f} ms "
              f"(min {1000 * min(ts):.0f}, max {1000 * max(ts):.0f}; title embedding not included)")
    print(f"demo reasons: {features_fast.reasons_one(product, bundle, tables, E)}")
    print(f"{args.tables}: {os.path.getsize(args.tables) / 2**20:.1f} MB on disk")
else:
    print(f"reference frame in memory: {ref_mb:.0f} MB ({len(ref):,} rows x {ref.shape[1]} cols)")
print(f"{args.model}: {os.path.getsize(args.model) / 2**20:.1f} MB on disk")
print(f"demo: score {out['opportunity_score']}, p={out['p_raw']:.6f}, model {out['model']}"
      + (f", reasons: {out['reasons']}" if "reasons" in out else ""))
