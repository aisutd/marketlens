"""
MarketLens scoring API (FastAPI), for Cloud Run: one vCPU, one worker, CPU only.

    uvicorn api.app:app --port 8080 --workers 1

Everything is loaded once at start-up from MODEL_DIR (default product_success/models): embed_model.joblib, the reference
tables (tools/build_reference_tables.py) and the MiniLM ONNX model (tools/export_minilm_onnx.py). Scoring is
api/features_fast.py (score_one, featurize_one) and api/reasons.py, which give exactly what predict.py gives
for one product. Title embeddings are cached (LRU, 1,000 titles), so an edit that keeps the title skips MiniLM.

    GET  /health       status, model version, reference rows
    GET  /categories   [{id, name}] the categories the model can score
    POST /predict      product -> opportunity_score, probability, model_used, model_version
    POST /rescore      {product, changes} -> /predict of the edited product + previous_score, score_change,
                       changed_fields (stateless: both are scored)
    POST /reasons      product -> reasons_up, reasons_down (up to 3 each: feature, label, impact)
    POST /what-if      {product, prices} -> [{price, opportunity_score, probability}], 1 to 20 prices

Missing list_price, stars and reviews become 0 as in predict.load_new, so the API and the CLI build the same
features. No stars and no reviews (or both 0) means a product idea: the launch-time model scores it.
probability is the model's raw output, unrounded (the CLI prints it rounded to 4 places).

Env: MODEL_DIR, ALLOWED_ORIGINS (comma-separated, default http://localhost:3000). OMP_NUM_THREADS is set to 1
here if unset, and both XGBoost models and ONNX Runtime run on one thread.
"""
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")   # before numpy / xgboost / onnxruntime load their thread pools

import datetime  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import threading  # noqa: E402
from collections import OrderedDict  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
from typing import Annotated  # noqa: E402

import joblib  # noqa: E402
import numpy as np  # noqa: E402
from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pydantic import BaseModel, ConfigDict, Field, ValidationError  # noqa: E402

from api.embed_onnx import OnnxEmbedder  # noqa: E402
from api.features_fast import featurize_one, load_tables, resolve_category, score_one  # noqa: E402
from api.reasons import reasons_detail  # noqa: E402
from paths import MODELS_DIR  # noqa: E402

log = logging.getLogger("marketlens.api")

BUNDLE_FILE = "embed_model.joblib"
TABLES_FILE = "reference_tables.joblib"
ONNX_DIR = "minilm-onnx"
CATEGORIES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "categories.json")
CACHE_SIZE = 1000
MAX_WHAT_IF = 20


class State:
    bundle = None
    tables = None
    embedder = None
    categories = None
    model_version = None


STATE = State()
_lock = threading.Lock()                      # one scoring at a time: one vCPU, and one shared embedder cache
_emb_cache: OrderedDict[str, np.ndarray] = OrderedDict()


def embed(title):
    """The raw 384-dim MiniLM embedding of `title` (featurize_one applies the float16 round trip), LRU-cached."""
    e = _emb_cache.get(title)
    if e is not None:
        _emb_cache.move_to_end(title)
        return e
    e = STATE.embedder.encode([title])[0]
    e.flags.writeable = False
    _emb_cache[title] = e
    if len(_emb_cache) > CACHE_SIZE:
        _emb_cache.popitem(last=False)
    return e


# ---- request and response models ----

Title = Annotated[str, Field(min_length=1, max_length=500)]
Price = Annotated[float, Field(gt=0, le=100_000)]
ListPrice = Annotated[float, Field(ge=0)]
Stars = Annotated[float, Field(ge=0, le=5)]
Reviews = Annotated[int, Field(ge=0)]
Category = Annotated[str | int, Field(description="category name (any case) or numeric id; see GET /categories")]


class Product(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    price: Price
    list_price: ListPrice | None = None
    stars: Stars | None = None
    reviews: Reviews | None = None
    category: Category


class Changes(BaseModel):
    """Product fields to change, validated like Product. null clears an optional field (it becomes 0)."""
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    price: Price | None = None
    list_price: ListPrice | None = None
    stars: Stars | None = None
    reviews: Reviews | None = None
    category: Category | None = None


class RescoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product: Product
    changes: Changes


class WhatIfRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product: Product
    prices: Annotated[list[Price], Field(min_length=1, max_length=MAX_WHAT_IF)]


class Score(BaseModel):
    opportunity_score: int
    probability: float
    model_used: str
    model_version: str


class Rescore(Score):
    previous_score: int
    score_change: int
    changed_fields: list[str]


class Reason(BaseModel):
    feature: str
    label: str
    impact: float


class Reasons(BaseModel):
    reasons_up: list[Reason]
    reasons_down: list[Reason]
    model_used: str
    model_version: str


class WhatIfPoint(BaseModel):
    price: float
    opportunity_score: int
    probability: float


# ---- scoring ----

def _category_id(product):
    try:
        return resolve_category(product.category, STATE.tables)
    except ValueError:
        raise HTTPException(422, f"Unknown category: {product.category!r}. GET /categories lists the valid "
                                 f"ids and names (names match in any case).") from None


def _score(product):
    _category_id(product)
    d = product.model_dump()
    out = score_one(d, STATE.bundle, STATE.tables, embed(d["title"]))
    return {"opportunity_score": out["opportunity_score"], "probability": out["p_raw"],
            "model_used": "launch" if out["model"] == "launch-time" else "full",
            "model_version": STATE.model_version}


def _model_version(path):
    mtime = datetime.datetime.fromtimestamp(os.path.getmtime(path), datetime.timezone.utc)
    return f"{os.path.basename(path)} {mtime:%Y-%m-%d}"


@asynccontextmanager
async def lifespan(app):
    model_dir = os.environ.get("MODEL_DIR", MODELS_DIR)
    bundle_path = os.path.join(model_dir, BUNDLE_FILE)
    bundle = joblib.load(bundle_path)
    for m in (bundle, bundle.get("launch")):   # n_jobs=-1 from training; Cloud Run has one vCPU
        if m is not None:
            m["xgb"].set_params(n_jobs=1)
    STATE.bundle = bundle
    STATE.tables = load_tables(os.path.join(model_dir, TABLES_FILE), bundle)
    STATE.embedder = OnnxEmbedder(os.path.join(model_dir, ONNX_DIR), threads=1)
    with open(CATEGORIES_FILE, encoding="utf-8") as f:
        STATE.categories = json.load(f)
    STATE.model_version = _model_version(bundle_path)
    _emb_cache.clear()
    log.info("loaded %s, %d reference rows", STATE.model_version, STATE.tables["source"]["rows"])
    yield


app = FastAPI(title="MarketLens", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
                   if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(Exception)
async def internal_error(request: Request, exc: Exception):
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


@app.get("/health")
def health():
    return {"status": "ok", "model_version": STATE.model_version, "tables_rows": STATE.tables["source"]["rows"]}


@app.get("/categories")
def categories():
    return STATE.categories


@app.post("/predict", response_model=Score)
def predict_endpoint(product: Product):
    with _lock:
        return _score(product)


@app.post("/rescore", response_model=Rescore)
def rescore(req: RescoreRequest):
    changes = req.changes.model_dump(exclude_unset=True)
    try:
        edited = Product.model_validate({**req.product.model_dump(), **changes})
    except ValidationError as e:   # e.g. "price": null; the field-level checks already ran on `changes`
        raise RequestValidationError(e.errors(include_url=False, include_context=False)) from None
    changed = [f for f in Product.model_fields if getattr(edited, f) != getattr(req.product, f)]
    with _lock:
        before = _score(req.product)
        after = _score(edited)
        if "category" in changed and _category_id(edited) == _category_id(req.product):
            changed.remove("category")   # "Suitcases" -> "suitcases" or its id is the same category
    return {**after, "previous_score": before["opportunity_score"],
            "score_change": after["opportunity_score"] - before["opportunity_score"], "changed_fields": changed}


@app.post("/reasons", response_model=Reasons)
def reasons(product: Product):
    with _lock:
        _category_id(product)
        d = product.model_dump()
        X = featurize_one(d, STATE.bundle, STATE.tables, embed(d["title"]))
        up, down = reasons_detail(d, STATE.bundle, STATE.tables, None, features=X)
    return {"reasons_up": up, "reasons_down": down,
            "model_used": "launch" if X.attrs["model"] == "launch-time" else "full",
            "model_version": STATE.model_version}


@app.post("/what-if", response_model=list[WhatIfPoint])
def what_if(req: WhatIfRequest):
    """Each price is scored as its own one-product request (n + 1 rows), through score_one; the title is
    embedded once (cached)."""
    with _lock:
        out = []
        for price in req.prices:
            s = _score(req.product.model_copy(update={"price": price}))
            out.append({"price": price, "opportunity_score": s["opportunity_score"],
                        "probability": s["probability"]})
    return out
