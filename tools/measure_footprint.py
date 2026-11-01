"""
MarketLens: time and memory of scoring one product, stage by stage, in one fresh process.

    python tools\\measure_footprint.py                  # MiniLM through PyTorch (sentence-transformers)
    python tools\\measure_footprint.py --engine onnx    # MiniLM through ONNX Runtime (api\\embed_onnx.py)

Stages: Python + psutil only, the libraries, joblib.load of the bundle, reading the reference CSV, loading
the title embedder, scoring the demo product once, then 20 more times (median per call). After each stage it
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
ap.add_argument("--model", default=os.path.join("models", "embed_model.joblib"))
ap.add_argument("--onnx-dir", default=os.path.join("models", "minilm-onnx"))
ap.add_argument("--repeats", type=int, default=20)
args = ap.parse_args()
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
from tools import predict_path  # noqa: E402  (imports predict.py and its training modules)

t = mark("2 import numpy, pandas, xgboost, sklearn", t)

bundle = joblib.load(args.model)
t = mark("3 joblib.load(embed_model.joblib)", t)

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
    predict_path.use_embedder(emb.encode)
    t = mark("4 load OnnxEmbedder (ONNX Runtime)", t)

d = predict_path.DEMO
new = predict_path.new_frame(d["title"], d["price"], d["list_price"], d["stars"], d["reviews"], d["category"])
out = predict_path.score(bundle, ref, new)
t = mark("5 score demo product once", t)

times = []
for _ in range(args.repeats):
    t1 = time.perf_counter()
    again = predict_path.score(bundle, ref, new)
    times.append(time.perf_counter() - t1)
    assert again["p_raw"].iloc[0] == out["p_raw"].iloc[0]
t = mark(f"6 score {args.repeats} more times", t)

print(f"\nengine: {args.engine}")
print(f"median per call over {args.repeats}: {1000 * statistics.median(times):.0f} ms "
      f"(min {1000 * min(times):.0f}, max {1000 * max(times):.0f})")
print(f"reference frame in memory: {ref_mb:.0f} MB ({len(ref):,} rows x {ref.shape[1]} cols)")
print(f"{args.model}: {os.path.getsize(args.model) / 2**20:.1f} MB on disk")
r = out.iloc[0]
print(f"demo: score {r['opportunity_score']}, p={r['p_raw']:.6f}, model {r['model']}, reasons: {r['reasons']}")
