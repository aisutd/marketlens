"""
MarketLens: embed product titles with all-MiniLM-L6-v2 on the CPU, resumably.

    python embed_titles.py --data data\\products_dev.csv --sample 300000     # the experiment sample
    python embed_titles.py --data data\\products_dev.csv                     # all dev rows (adds the rest)
    python embed_titles.py --data data\\products_dev.csv --limit 10000 --time-only   # timing test, saves nothing

Writes data\\embeddings\\title_emb_<n>.npy (float16) + title_emb_<n>_asins.txt, 50,000 titles per chunk.
Each chunk is written to a temporary name and then renamed, so a crash or sleep loses at most the
chunk in progress; run the same command again and it skips every asin that is already embedded.
"""
import argparse
import glob
import os
import time

import numpy as np
import pandas as pd

from compare_models import load
from embeddings import EMB_DIR, MODEL_NAME, stored_asins


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/products_dev.csv")
    ap.add_argument("--sample", type=int, default=None, help="same rows as the scripts' --sample")
    ap.add_argument("--asins", default=None, help="CSV with an asin column: embed only those products")
    ap.add_argument("--limit", type=int, default=None, help="only the first N rows still to do")
    ap.add_argument("--chunk", type=int, default=50_000)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--threads", type=int, default=None, help="torch CPU threads (default: physical cores)")
    ap.add_argument("--time-only", action="store_true", help="embed --limit rows and report speed, save nothing")
    ap.add_argument("--out-dir", default=EMB_DIR)
    args = ap.parse_args()

    os.environ.setdefault("HF_HOME", os.path.join(args.out_dir, "hf_cache"))   # model download stays out of git
    from sentence_transformers import SentenceTransformer
    os.makedirs(args.out_dir, exist_ok=True)

    df = load(args.data, args.sample)[["asin", "title"]].drop_duplicates("asin")
    if args.asins:   # only these products (a CSV with an asin column, e.g. image_sample.csv)
        df = df[df["asin"].isin(pd.read_csv(args.asins)["asin"])]
    done = set() if args.time_only else stored_asins(args.out_dir)
    todo = df[~df["asin"].isin(done)]
    if args.limit:
        todo = todo.head(args.limit)
    print(f"{len(df):,} products, {len(df) - len(todo):,} already embedded, {len(todo):,} to do")
    if not len(todo):
        return

    model = SentenceTransformer(MODEL_NAME, device="cpu")
    if args.threads:
        import torch
        torch.set_num_threads(args.threads)
    n = len(glob.glob(os.path.join(args.out_dir, "title_emb_*_asins.txt")))
    t0 = time.time()
    for start in range(0, len(todo), args.chunk):
        part = todo.iloc[start:start + args.chunk]
        t1 = time.time()
        E = model.encode(part["title"].fillna("").astype(str).tolist(), batch_size=args.batch,
                         show_progress_bar=True, convert_to_numpy=True, normalize_embeddings=True)
        rate = len(part) / (time.time() - t1)
        if args.time_only:
            print(f"{len(part):,} titles in {time.time() - t1:.0f}s = {rate:.0f}/s; "
                  f"all {len(df):,} would take ~{len(df) / rate / 60:.0f} min")
            return
        base = os.path.join(args.out_dir, f"title_emb_{n}")
        np.save(base + ".tmp.npy", E.astype(np.float16))
        with open(base + ".tmp.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(part["asin"]) + "\n")
        os.replace(base + ".tmp.npy", base + ".npy")         # the asin file last: it marks the chunk as done
        os.replace(base + ".tmp.txt", base + "_asins.txt")
        n += 1
        left = len(todo) - start - len(part)
        print(f"chunk {n}: {len(part):,} titles, {rate:.0f}/s, {left:,} left (~{left / rate / 60:.0f} min)")
    print(f"done in {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
