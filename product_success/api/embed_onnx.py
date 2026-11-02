"""
MarketLens: MiniLM title embeddings with ONNX Runtime (no torch, no transformers).

    emb = OnnxEmbedder("models/minilm-onnx")      # made by tools/export_minilm_onnx.py
    E = emb.encode(["Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock"])   # (1, 384) float32

Reproduces SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2").encode(..., normalize_embeddings=True)
as used in training: the same tokenizer (lowercasing is inside it), truncation at 256 tokens, attention-mask
mean pooling, then L2 normalisation. Titles are cleaned like training, which only turns missing values into "".
The float16 round trip of embeddings.embed_new_titles is not done here; the caller applies it.
"""
import json
import os

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


class OnnxEmbedder:
    def __init__(self, model_dir, threads=1):
        with open(os.path.join(model_dir, "export_meta.json"), encoding="utf-8") as f:
            self.meta = json.load(f)
        self.tokenizer = Tokenizer.from_file(os.path.join(model_dir, "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=self.meta["max_seq_length"])   # whatever the file says
        if self.tokenizer.padding is None:
            raise ValueError(f"{model_dir}/tokenizer.json has no padding; re-run tools/export_minilm_onnx.py")
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        self.session = ort.InferenceSession(os.path.join(model_dir, "model.onnx"), opts,
                                            providers=["CPUExecutionProvider"])
        self.normalize = self.meta["normalize"]
        self.dim = self.meta["embedding_dim"]

    def encode(self, titles, batch_size=64):
        titles = ["" if t is None or (isinstance(t, float) and np.isnan(t)) else str(t) for t in titles]
        out = np.empty((len(titles), self.dim), dtype=np.float32)
        for start in range(0, len(titles), batch_size):
            enc = self.tokenizer.encode_batch(titles[start:start + batch_size])
            ids = np.array([e.ids for e in enc], dtype=np.int64)
            mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
            types = np.array([e.type_ids for e in enc], dtype=np.int64)
            hidden = self.session.run(None, {"input_ids": ids, "attention_mask": mask,
                                             "token_type_ids": types})[0]
            m = mask[:, :, None].astype(np.float32)
            pooled = (hidden * m).sum(axis=1) / np.clip(m.sum(axis=1), 1e-9, None)
            if self.normalize:
                pooled /= np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)
            out[start:start + len(enc)] = pooled
        return out
