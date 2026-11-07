"""
MarketLens: export the MiniLM title encoder to ONNX for serving without PyTorch.

    python -m product_success.tools.export_minilm_onnx                  # writes models\\minilm-onnx\\

Exports the transformer of the model named in models\\embed_model.joblib (all-MiniLM-L6-v2, from the
local HF cache in data\\embeddings\\hf_cache) with torch.onnx.export: float32, opset 17, dynamic batch and
sequence axes, output last_hidden_state. Pooling and normalisation stay outside the graph, in
api\\embed_onnx.py. The tokenizer is saved next to it with truncation at the SentenceTransformer's
max_seq_length (256, not the 128 the hub tokenizer.json carries) and padding to the longest in the batch.
"""
import argparse
import json
import os

from paths import DATA_DIR, MODELS_DIR  # noqa: E402
os.environ.setdefault("HF_HOME", os.path.join(DATA_DIR, "embeddings", "hf_cache"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import joblib  # noqa: E402
import torch  # noqa: E402
from sentence_transformers import SentenceTransformer  # noqa: E402
from tokenizers import Tokenizer  # noqa: E402

OPSET = 17


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.path.join(MODELS_DIR, "embed_model.joblib"))
    ap.add_argument("--out-dir", default=os.path.join(MODELS_DIR, "minilm-onnx"))
    args = ap.parse_args()

    name = joblib.load(args.model)["title_emb"]["model"]
    st = SentenceTransformer(name, device="cpu")   # the same object training used: same weights, same settings
    max_len = st.max_seq_length
    transformer = st[0].auto_model.eval()
    tokenizer = st.tokenizer
    print(f"{name}: max_seq_length={max_len}, modules={[type(m).__name__ for m in st]}")
    os.makedirs(args.out_dir, exist_ok=True)

    class Encoder(torch.nn.Module):
        def __init__(self, bert):
            super().__init__()
            self.bert = bert

        def forward(self, input_ids, attention_mask, token_type_ids):
            return self.bert(input_ids=input_ids, attention_mask=attention_mask,
                             token_type_ids=token_type_ids).last_hidden_state

    sample = tokenizer(["a short title", "a somewhat longer product title for tracing"],
                       padding=True, truncation=True, max_length=max_len, return_tensors="pt")
    path = os.path.join(args.out_dir, "model.onnx")
    with torch.no_grad():
        torch.onnx.export(
            Encoder(transformer), (sample["input_ids"], sample["attention_mask"], sample["token_type_ids"]),
            path, dynamo=False, opset_version=OPSET, do_constant_folding=True,
            input_names=["input_ids", "attention_mask", "token_type_ids"],
            output_names=["last_hidden_state"],
            dynamic_axes={"input_ids": {0: "batch", 1: "seq"}, "attention_mask": {0: "batch", 1: "seq"},
                          "token_type_ids": {0: "batch", 1: "seq"}, "last_hidden_state": {0: "batch", 1: "seq"}})

    tokenizer.save_pretrained(args.out_dir)   # tokenizer.json, tokenizer_config.json, special tokens, vocab
    tok = Tokenizer.from_file(os.path.join(args.out_dir, "tokenizer.json"))
    tok.enable_truncation(max_length=max_len)
    tok.enable_padding(pad_id=tokenizer.pad_token_id, pad_token=tokenizer.pad_token)
    tok.save(os.path.join(args.out_dir, "tokenizer.json"))

    pooling = st[1]
    meta = {"source_model": name, "max_seq_length": max_len, "opset": OPSET, "dtype": "float32",
            "pooling": "mean", "normalize": any(type(m).__name__ == "Normalize" for m in st),
            "embedding_dim": (pooling.get_embedding_dimension() if hasattr(pooling, "get_embedding_dimension")
                              else pooling.get_sentence_embedding_dimension()),
            "torch": torch.__version__}
    with open(os.path.join(args.out_dir, "export_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))
    print(f"saved {path} ({os.path.getsize(path) / 2**20:.1f} MB)")


if __name__ == "__main__":
    main()
