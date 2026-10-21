"""
MarketLens: title embeddings (all-MiniLM-L6-v2) as features, on CPU.

Embeddings live in data\\embeddings\\ as chunks: title_emb_<n>.npy (float16, one row per product) and
title_emb_<n>_asins.txt (the asin of each row, same order). embed_titles.py writes them; this module
reads them back and turns them into features:

    title_emb_score     out-of-fold logistic regression on the 384-dim embedding (a semantic title_score)
    title_emb_pca_<k>   the embedding reduced to 32 dims with PCA (fit on training rows only)
"""
import glob
import os

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold

from compare_models import SEED

EMB_DIR = os.path.join("data", "embeddings")
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def stored_asins(emb_dir=EMB_DIR, prefix="title_emb"):
    done = set()
    for f in glob.glob(os.path.join(emb_dir, f"{prefix}_*_asins.txt")):
        with open(f, encoding="utf-8") as fh:
            done.update(line.strip() for line in fh)
    return done


def load_embeddings(asins, emb_dir=EMB_DIR, prefix="title_emb"):
    """Embedding rows for `asins` (same order) as float32; rows not embedded yet are NaN."""
    pos = {a: i for i, a in enumerate(asins)}
    out = None
    for f in sorted(glob.glob(os.path.join(emb_dir, f"{prefix}_*_asins.txt"))):
        with open(f, encoding="utf-8") as fh:
            chunk_asins = [line.strip() for line in fh]
        rows = [(pos[a], j) for j, a in enumerate(chunk_asins) if a in pos]
        if not rows:
            continue
        E = np.load(f.replace("_asins.txt", ".npy"), mmap_mode="r")
        if out is None:
            out = np.full((len(asins), E.shape[1]), np.nan, dtype=np.float32)
        dst, src = map(np.array, zip(*rows))
        out[dst] = E[src].astype(np.float32)
    if out is None:
        raise SystemExit(f"no {prefix} chunks in {emb_dir}; run embed_titles.py first")
    return out


def emb_score(E, y, fit_idx, apply_idx, name, n_folds=5, C=1.0):
    """Out-of-fold logistic regression score on an embedding matrix. Rows without an embedding stay NaN."""
    out = pd.Series(np.nan, index=y.index, name=name)
    has = ~np.isnan(E[:, 0])
    fit_idx = np.asarray([i for i in fit_idx if has[i]])
    apply_idx = np.asarray([i for i in apply_idx if has[i]])

    def fit_predict(tr, pr):
        clf = LogisticRegression(C=C, max_iter=300)
        clf.fit(E[tr], y.values[tr])
        out.iloc[pr] = clf.decision_function(E[pr])

    folds = StratifiedKFold(n_folds, shuffle=True, random_state=SEED)
    for k, (a, b) in enumerate(folds.split(fit_idx, y.values[fit_idx])):
        fit_predict(fit_idx[a], fit_idx[b])
        print(f"  {name}: fold {k + 1}/{n_folds} done")
    if len(apply_idx):
        fit_predict(fit_idx, apply_idx)
    return out


def emb_pca(E, fit_idx, prefix, dims=32):
    """PCA to `dims` columns, fit on training rows only (no label involved)."""
    has = ~np.isnan(E[:, 0])
    fit_rows = np.asarray([i for i in fit_idx if has[i]])
    pca = PCA(dims, random_state=SEED).fit(E[fit_rows])
    Z = np.full((len(E), dims), np.nan, dtype=np.float32)
    Z[has] = pca.transform(E[has])
    return pd.DataFrame(Z, columns=[f"{prefix}_pca_{k}" for k in range(dims)]), pca
