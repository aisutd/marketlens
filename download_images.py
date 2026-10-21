"""
MarketLens: download small product thumbnails for a random sample of dev products, politely and resumably.

    python download_images.py --data data\\products_dev.csv --raw data\\amazon_products.csv --n 30000

products_dev.csv has no imgUrl (clean_data.py drops it), so URLs are looked up by asin in the raw Kaggle file.
The 320 px URL is rewritten to 224 px (what CLIP uses, half the bytes). Images go to
data\\embeddings\\images\\<asin>.jpg. Already-downloaded files are skipped, so re-running resumes.
Failures (after retries) are logged to data\\embeddings\\images_failed.csv.

Polite: a few threads, a global cap on requests per second, and backoff on errors / HTTP 429 / 503.
"""
import argparse
import csv
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests
from tqdm import tqdm

from compare_models import SEED
from embeddings import EMB_DIR

SAMPLE_SEED = SEED


class RateLimit:
    def __init__(self, per_second):
        self.gap, self.next, self.lock = 1.0 / per_second, time.monotonic(), threading.Lock()

    def set_rate(self, per_second):
        with self.lock:
            self.gap = 1.0 / per_second

    def wait(self):
        with self.lock:
            now = time.monotonic()
            self.next = max(self.next + self.gap, now)
            delay = self.next - now
        if delay > 0:
            time.sleep(delay)


def image_sample(data, raw, n):
    """The same n random dev products every time, with their image URL."""
    dev = pd.read_csv(data, usecols=["asin"])
    urls = pd.read_csv(raw, usecols=["asin", "imgUrl"]).drop_duplicates("asin")
    dev = dev.merge(urls, on="asin", how="left")
    ok = dev["imgUrl"].fillna("").str.match(r"^https?://.+\.(jpg|jpeg|png|webp)$", case=False)
    dev = dev[ok]
    sample = dev.sample(min(n, len(dev)), random_state=SAMPLE_SEED)
    sample["imgUrl"] = sample["imgUrl"].str.replace("_AC_UL320_", "_AC_UL224_", regex=False)
    return sample.reset_index(drop=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/products_dev.csv")
    ap.add_argument("--raw", default="data/amazon_products.csv")
    ap.add_argument("--n", type=int, default=30_000)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--per-second", type=float, default=8.0)
    ap.add_argument("--fallback-per-second", type=float, default=7.8,
                    help="drop to this rate on the first HTTP 429/503, or if more than 2%% fail")
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--limit", type=int, default=None, help="only the next N images (for a timing test)")
    ap.add_argument("--out-dir", default=os.path.join(EMB_DIR, "images"))
    args = ap.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    sample = image_sample(args.data, args.raw, args.n)
    sample.to_csv(os.path.join(EMB_DIR, "image_sample.csv"), index=False)
    todo = [(a, u) for a, u in zip(sample["asin"], sample["imgUrl"])
            if not os.path.exists(os.path.join(args.out_dir, f"{a}.jpg"))]
    print(f"{len(sample):,} sampled, {len(sample) - len(todo):,} already downloaded, {len(todo):,} to do")
    if args.limit:
        todo = todo[:args.limit]
    t0 = time.time()

    limit, session = RateLimit(args.per_second), requests.Session()
    session.headers["User-Agent"] = "MarketLens-research/1.0 (student project; low rate)"
    failed, lock = [], threading.Lock()
    state = {"done": 0, "slowed": None, "throttled": 0}

    def slow_down(reason):
        # Once, permanently: the server pushed back or too much is failing.
        if state["slowed"] is None and args.per_second > args.fallback_per_second:
            state["slowed"] = reason
            limit.set_rate(args.fallback_per_second)
            tqdm.write(f"SLOWING DOWN to {args.fallback_per_second}/s: {reason}")

    def fetch(item):
        asin, url = item
        err = ""
        for attempt in range(args.retries + 1):
            limit.wait()
            try:
                r = session.get(url, timeout=20)
                if r.status_code == 200 and r.content:
                    path = os.path.join(args.out_dir, f"{asin}.jpg")
                    with open(path + ".tmp", "wb") as f:
                        f.write(r.content)
                    os.replace(path + ".tmp", path)
                    with lock:
                        state["done"] += 1
                    return True
                err = f"HTTP {r.status_code}"
                if r.status_code in (429, 503):
                    with lock:
                        state["throttled"] += 1
                        slow_down(f"HTTP {r.status_code} on {asin}")
                if r.status_code == 404:
                    break
            except requests.RequestException as e:
                err = type(e).__name__
            time.sleep(2 ** attempt)   # back off: 1, 2, 4 s
        with lock:
            failed.append((asin, url, err))
            state["done"] += 1
            if state["done"] >= 200 and len(failed) / state["done"] > 0.02:
                slow_down(f"failure rate {len(failed) / state['done']:.1%} after {state['done']} images")
        return False

    with ThreadPoolExecutor(args.threads) as pool:
        ok = sum(tqdm(pool.map(fetch, todo), total=len(todo), unit="img", mininterval=10))

    fail_path = os.path.join(EMB_DIR, "images_failed.csv")
    with open(fail_path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([("asin", "url", "error")] + failed)
    have = sum(os.path.exists(os.path.join(args.out_dir, f"{a}.jpg")) for a in sample["asin"])
    sec = time.time() - t0
    print(f"downloaded {ok:,} now in {sec / 60:.1f} min ({len(todo) / max(sec, 1e-9):.1f}/s); "
          f"{have:,} of {len(sample):,} on disk; failed {len(failed):,} "
          f"({len(failed) / max(len(todo), 1):.2%} of this run) -> {fail_path}; "
          f"rest would take ~{(len(sample) - have) / max(len(todo) / max(sec, 1e-9), 1e-9) / 60:.0f} min")
    print(f"HTTP 429/503 responses: {state['throttled']}; "
          f"slowed down: {state['slowed'] or f'no (stayed at {args.per_second}/s)'}")


if __name__ == "__main__":
    main()
