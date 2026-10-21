"""
MarketLens: embed downloaded product thumbnails with CLIP (openai/clip-vit-base-patch32) on the CPU, resumably.

    python embed_images.py                     # every image in data\\embeddings\\images that isn't embedded yet
    python embed_images.py --limit 10000       # only the next 10,000 (timing test / preliminary read)

Writes data\\embeddings\\image_emb_<n>.npy (float16, 512 dims, L2-normalised) + image_emb_<n>_asins.txt,
--chunk images per chunk, in the order of image_sample.csv. Each chunk is written under a temporary name and
then renamed, so a crash or sleep loses at most the chunk in progress; re-running skips embedded asins.
Before each batch it checks memory and waits while more than --max-ram of RAM is in use.
"""
import argparse
import ctypes
import glob
import os
import time

import numpy as np
import pandas as pd

from embeddings import EMB_DIR, stored_asins

CLIP_NAME = "openai/clip-vit-base-patch32"


def ram_in_use():
    """Share of physical RAM in use (Windows), or 0.0 elsewhere."""
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong)] + \
                   [(n, ctypes.c_ulonglong) for n in ("t", "a", "tp", "ap", "tv", "av", "ae")]
    try:
        s = MEMORYSTATUSEX()
        s.dwLength = ctypes.sizeof(s)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(s))
        return s.dwMemoryLoad / 100
    except AttributeError:
        return 0.0


def load_clip():
    os.environ.setdefault("HF_HOME", os.path.join(EMB_DIR, "hf_cache"))
    import torch
    from transformers import CLIPModel, CLIPProcessor
    model = CLIPModel.from_pretrained(CLIP_NAME).to("cpu").eval()
    return model, CLIPProcessor.from_pretrained(CLIP_NAME), torch


def embed_paths(paths, model, processor, torch, batch=64, max_ram=0.80):
    from PIL import Image
    out = []
    for i in range(0, len(paths), batch):
        while ram_in_use() > max_ram:
            print(f"  RAM {ram_in_use():.0%} > {max_ram:.0%}: waiting")
            time.sleep(10)
        imgs = []
        for p in paths[i:i + batch]:
            with Image.open(p) as im:
                imgs.append(im.convert("RGB"))
        with torch.inference_mode():
            x = processor(images=imgs, return_tensors="pt")
            e = model.get_image_features(**x)
            if not isinstance(e, torch.Tensor):   # transformers 5 returns an output object
                e = e.pooler_output               # = visual_projection(pooled), 512 dims
            e = torch.nn.functional.normalize(e, dim=-1)
        out.append(e.numpy())
    return np.concatenate(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", default=os.path.join(EMB_DIR, "images"))
    ap.add_argument("--sample", default=os.path.join(EMB_DIR, "image_sample.csv"))
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--chunk", type=int, default=5_000)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--max-ram", type=float, default=0.80)
    ap.add_argument("--threads", type=int, default=None, help="torch CPU threads (default: torch's choice)")
    args = ap.parse_args()

    order = pd.read_csv(args.sample)["asin"].astype(str)
    have = order[[os.path.exists(os.path.join(args.images, f"{a}.jpg")) for a in order]]
    done = stored_asins(EMB_DIR, prefix="image_emb")
    todo = [a for a in have if a not in done]
    if args.limit:
        todo = todo[:args.limit]
    print(f"{len(order):,} sampled, {len(have):,} downloaded, {len(done):,} embedded, {len(todo):,} to do")
    if not todo:
        return

    model, processor, torch = load_clip()
    if args.threads:
        torch.set_num_threads(args.threads)
    n = len(glob.glob(os.path.join(EMB_DIR, "image_emb_*_asins.txt")))
    t0, peak = time.time(), 0.0
    for start in range(0, len(todo), args.chunk):
        part = todo[start:start + args.chunk]
        t1 = time.time()
        E = embed_paths([os.path.join(args.images, f"{a}.jpg") for a in part], model, processor, torch,
                        args.batch, args.max_ram)
        peak = max(peak, ram_in_use())
        base = os.path.join(EMB_DIR, f"image_emb_{n}")
        np.save(base + ".tmp.npy", E.astype(np.float16))
        with open(base + ".tmp.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(part) + "\n")
        os.replace(base + ".tmp.npy", base + ".npy")   # the asin file last: it marks the chunk as done
        os.replace(base + ".tmp.txt", base + "_asins.txt")
        n += 1
        rate = len(part) / (time.time() - t1)
        left = len(todo) - start - len(part)
        print(f"chunk {n}: {len(part):,} images, {rate:.1f}/s, RAM {peak:.0%}, {left:,} left (~{left / rate / 60:.0f} min)")
    print(f"done in {(time.time() - t0) / 60:.1f} min; peak RAM in use {peak:.0%}")


if __name__ == "__main__":
    main()
