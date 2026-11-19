
"""
MarketLens scoring API (FastAPI), for Cloud Run: one vCPU, one worker, CPU only.

    uvicorn api.app:app --port 8080 --workers 1

Everything is loaded once at start-up from MODEL_DIR (default product_success/models):
embed_model.joblib, the reference tables (tools/build_reference_tables.py),
the per-category reason baselines (tools/build_category_baselines.py)
and the MiniLM ONNX model (tools/export_minilm_onnx.py).

Scoring is api/features_fast.py (score_one, featurize_one) and api/reasons.py,
which give exactly what predict.py gives for one product.

Title embeddings are cached (LRU, 1,000 titles), so an edit that keeps
the title skips MiniLM.

    GET  /health       status, model version, reference rows
    GET  /categories   [{id, name}] the categories the model can score
    POST /predict      product -> opportunity_score, probability, model_used, model_version
    POST /rescore      {product, changes} -> edited score + previous_score,
                       score_change, changed_fields
    POST /reasons      product -> reasons_up, reasons_down, baseline
                       (impact is measured against the products the score
                       ranks against: "category", or "all_products" for a
                       category with fewer than 30 reference products)
    POST /what-if      {product, prices} -> scores for 1 to 20 prices

    POST /demo/predict, /demo/reasons, /demo/what-if
                       the same as /predict, /reasons and /what-if, with no
                       token: the landing page's "Try it live" demo

Firebase Authentication:
    /health, /categories and /demo/* are public.
    /predict, /rescore, /reasons and /what-if require a valid Firebase ID token.

Env:
    MODEL_DIR
    ALLOWED_ORIGINS
    FIREBASE_PROJECT_ID
    AUTH_ONLY_DEV (set to 1 locally to skip ML model loading)
"""

import os

os.environ.setdefault("OMP_NUM_THREADS", "1")

import datetime  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import threading  # noqa: E402
from collections import OrderedDict  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402
from typing import Annotated  # noqa: E402

import joblib  # noqa: E402
import numpy as np  # noqa: E402

from fastapi import Depends, FastAPI, HTTPException, Request  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
)  # noqa: E402

from api.embed_onnx import OnnxEmbedder  # noqa: E402
from api.features_fast import (
    featurize_one,
    load_tables,
    resolve_category,
    score_one,
)  # noqa: E402
from api.reasons import reasons_detail  # noqa: E402
from api.firebase_auth import verify_firebase_token  # noqa: E402
from paths import MODELS_DIR  # noqa: E402
from predict import BASELINES_FILE, baseline_of, load_baselines  # noqa: E402

# ========================================
# LOGGING AND CONFIGURATION
# ========================================

log = logging.getLogger("marketlens.api")

BUNDLE_FILE = "embed_model.joblib"
TABLES_FILE = "reference_tables.joblib"
ONNX_DIR = "minilm-onnx"

CATEGORIES_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "categories.json"
)

CACHE_SIZE = 1000
MAX_WHAT_IF = 20

# ========================================
# APPLICATION STATE
# ========================================

class State:
    bundle = None
    tables = None
    baselines = None
    embedder = None
    categories = None
    model_version = None


STATE = State()

_lock = threading.Lock()

_emb_cache: OrderedDict[str, np.ndarray] = OrderedDict()

# ========================================
# EMBEDDING CACHE
# ========================================

def embed(title):
    """
    Return the raw 384-dimensional MiniLM embedding.

    Title embeddings are cached so repeated scoring
    of the same title does not rerun MiniLM.
    """

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

# ========================================
# REQUEST FIELD TYPES
# ========================================

Title = Annotated[
    str,
    Field(min_length=1, max_length=500)
]

Price = Annotated[
    float,
    Field(gt=0, le=100_000)
]

ListPrice = Annotated[
    float,
    Field(ge=0)
]

Stars = Annotated[
    float,
    Field(ge=0, le=5)
]

Reviews = Annotated[
    int,
    Field(ge=0)
]

Category = Annotated[
    str | int,
    Field(
        description=(
            "category name (any case) or numeric id; "
            "see GET /categories"
        )
    )
]

# ========================================
# PRODUCT REQUEST MODELS
# ========================================

class Product(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    price: Price
    list_price: ListPrice | None = None
    stars: Stars | None = None
    reviews: Reviews | None = None
    category: Category


class Changes(BaseModel):
    """
    Product fields to change, validated like Product.

    Null clears an optional field and becomes 0.
    """

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

    prices: Annotated[
        list[Price],
        Field(min_length=1, max_length=MAX_WHAT_IF)
    ]

# ========================================
# RESPONSE MODELS
# ========================================

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
    baseline: str
    model_used: str
    model_version: str


class WhatIfPoint(BaseModel):
    price: float
    opportunity_score: int
    probability: float

# ========================================
# CATEGORY VALIDATION
# ========================================

def _category_id(product):
    try:
        return resolve_category(
            product.category,
            STATE.tables
        )

    except ValueError:
        raise HTTPException(
            422,
            (
                f"Unknown category: {product.category!r}. "
                "GET /categories lists the valid ids and names "
                "(names match in any case)."
            )
        ) from None

# ========================================
# PRODUCT SCORING
# ========================================

def _require_models():
    if STATE.bundle is None or STATE.tables is None or STATE.embedder is None:
        raise HTTPException(
            status_code=503,
            detail="ML models are unavailable in authentication-only development mode",
        )


def _score(product):
    _require_models()
    _category_id(product)

    d = product.model_dump()

    out = score_one(
        d,
        STATE.bundle,
        STATE.tables,
        embed(d["title"])
    )

    return {
        "opportunity_score": out["opportunity_score"],
        "probability": out["p_raw"],
        "model_used": (
            "launch"
            if out["model"] == "launch-time"
            else "full"
        ),
        "model_version": STATE.model_version,
    }

# ========================================
# MODEL VERSION
# ========================================

def _model_version(path):
    mtime = datetime.datetime.fromtimestamp(
        os.path.getmtime(path),
        datetime.timezone.utc
    )

    return (
        f"{os.path.basename(path)} "
        f"{mtime:%Y-%m-%d}"
    )

# ========================================
# APPLICATION STARTUP
# ========================================

@asynccontextmanager
async def lifespan(app):
    if os.environ.get("AUTH_ONLY_DEV") == "1":
        log.warning("AUTH_ONLY_DEV enabled: ML models are not loaded")
        with open(CATEGORIES_FILE, encoding="utf-8") as f:
            STATE.categories = json.load(f)
        yield
        return

    model_dir = os.environ.get(
        "MODEL_DIR",
        MODELS_DIR
    )

    bundle_path = os.path.join(
        model_dir,
        BUNDLE_FILE
    )

    bundle = joblib.load(bundle_path)

    # Limit XGBoost to one CPU worker.

    for m in (
        bundle,
        bundle.get("launch")
    ):
        if m is not None:
            m["xgb"].set_params(
                n_jobs=1
            )

    STATE.bundle = bundle

    STATE.tables = load_tables(
        os.path.join(
            model_dir,
            TABLES_FILE
        ),
        bundle
    )

    STATE.baselines = load_baselines(
        os.path.join(
            model_dir,
            BASELINES_FILE
        ),
        bundle_path
    )

    STATE.embedder = OnnxEmbedder(
        os.path.join(
            model_dir,
            ONNX_DIR
        ),
        threads=1
    )

    with open(
        CATEGORIES_FILE,
        encoding="utf-8"
    ) as f:
        STATE.categories = json.load(f)

    STATE.model_version = _model_version(
        bundle_path
    )

    _emb_cache.clear()

    log.info(
        "loaded %s, %d reference rows",
        STATE.model_version,
        STATE.tables["source"]["rows"]
    )

    yield

# ========================================
# FASTAPI APPLICATION
# ========================================

app = FastAPI(
    title="MarketLens",
    lifespan=lifespan
)

# ========================================
# CORS CONFIGURATION
# ========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:3000"
        ).split(",")
        if origin.strip()
    ],

    allow_methods=[
        "GET",
        "POST"
    ],

    allow_headers=[
        "Content-Type",
        "Authorization"
    ],
)

# ========================================
# INTERNAL ERROR HANDLER
# ========================================

@app.exception_handler(Exception)
async def internal_error(
    request: Request,
    exc: Exception
):
    log.exception(
        "unhandled error on %s %s",
        request.method,
        request.url.path
    )

    return JSONResponse(
        {
            "detail": "Internal server error"
        },
        status_code=500
    )

# ========================================
# PUBLIC ENDPOINT: HEALTH
# ========================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_version": STATE.model_version,
        "tables_rows": (
            STATE.tables["source"]["rows"] if STATE.tables is not None else None
        ),
    }

# ========================================
# PUBLIC ENDPOINT: CATEGORIES
# ========================================

@app.get("/categories")
def categories():
    return STATE.categories

# ========================================
# PROTECTED ENDPOINT: PREDICT
# ========================================

@app.post(
    "/predict",
    response_model=Score,
    dependencies=[
        Depends(verify_firebase_token),
        Depends(_require_models),
    ]
)
def predict_endpoint(product: Product):
    with _lock:
        return _score(product)

# ========================================
# PROTECTED ENDPOINT: RESCORE
# ========================================

@app.post(
    "/rescore",
    response_model=Rescore,
    dependencies=[
        Depends(verify_firebase_token),
        Depends(_require_models),
    ]
)
def rescore(req: RescoreRequest):
    changes = req.changes.model_dump(
        exclude_unset=True
    )

    try:
        edited = Product.model_validate({
            **req.product.model_dump(),
            **changes
        })

    except ValidationError as e:
        raise RequestValidationError(
            e.errors(
                include_url=False,
                include_context=False
            )
        ) from None

    changed = [
        f
        for f in Product.model_fields
        if getattr(edited, f) != getattr(req.product, f)
    ]

    with _lock:
        before = _score(req.product)
        after = _score(edited)

        if (
            "category" in changed
            and _category_id(edited)
            == _category_id(req.product)
        ):
            changed.remove("category")

    return {
        **after,
        "previous_score": before["opportunity_score"],
        "score_change": (
            after["opportunity_score"]
            - before["opportunity_score"]
        ),
        "changed_fields": changed,
    }

# ========================================
# PROTECTED ENDPOINT: REASONS
# ========================================

@app.post(
    "/reasons",
    response_model=Reasons,
    dependencies=[
        Depends(verify_firebase_token),
        Depends(_require_models),
    ]
)
def reasons(product: Product):
    _require_models()
    with _lock:
        _category_id(product)

        d = product.model_dump()

        X = featurize_one(
            d,
            STATE.bundle,
            STATE.tables,
            embed(d["title"])
        )

        up, down = reasons_detail(
            d,
            STATE.bundle,
            STATE.tables,
            None,
            STATE.baselines,
            features=X
        )

    return {
        "reasons_up": up,
        "reasons_down": down,
        "baseline": baseline_of(
            STATE.baselines,
            X.attrs["model"],
            X["category_id"].iloc[0]
        ),
        "model_used": (
            "launch"
            if X.attrs["model"] == "launch-time"
            else "full"
        ),
        "model_version": STATE.model_version,
    }

# ========================================
# PROTECTED ENDPOINT: WHAT-IF
# ========================================

@app.post(
    "/what-if",
    response_model=list[WhatIfPoint],
    dependencies=[
        Depends(verify_firebase_token),
        Depends(_require_models),
    ]
)
def what_if(req: WhatIfRequest):
    """
    Each price is scored as its own one-product request.

    The title is embedded once and cached.
    """

    with _lock:
        out = []

        for price in req.prices:
            s = _score(
                req.product.model_copy(
                    update={
                        "price": price
                    }
                )
            )

            out.append({
                "price": price,
                "opportunity_score": s["opportunity_score"],
                "probability": s["probability"],
            })
    return out

# ========================================
# PUBLIC DEMO ENDPOINTS
# ========================================

# The landing page's "Try it live" demo scores products without an
# account. These routes run the same handlers as /predict, /reasons and
# /what-if, with no token check; the app's own pages use the protected
# routes. /rescore has no demo route because the demo does not use it.

for _path, _endpoint, _model in (
    ("/demo/predict", predict_endpoint, Score),
    ("/demo/reasons", reasons, Reasons),
    ("/demo/what-if", what_if, list[WhatIfPoint]),
):
    app.post(
        _path,
        response_model=_model,
        dependencies=[Depends(_require_models)],
    )(_endpoint)
