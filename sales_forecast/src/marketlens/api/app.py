"""Run with: uvicorn marketlens.api.app:app --host 127.0.0.1 --port 8000."""

import logging
import math
import os
import time

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from slowapi.errors import RateLimitExceeded

from marketlens import MarketLensPredictor, ProductInput

from .schemas import (
    DataResponse,
    ErrorResponse,
    LaunchRequest,
    MonthlyRequest,
    YearlyRequest,
)

from .rate_limit import (
    create_limiter,
    authenticate_rate_limit_user,
    PRODUCTS_LIMIT,
    PREDICTION_LIMIT,
    DAILY_PREDICTION_LIMIT,
    PREDICTION_QUOTA_SCOPE,
)

logger = logging.getLogger(__name__)

PROTECTED = [Depends(authenticate_rate_limit_user)]


def error_response(status: int, code: str, message: str, details=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or [],
            }
        },
    )


def create_app() -> FastAPI:

    # Each application receives its own limiter.
    limiter = create_limiter()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        predictor = MarketLensPredictor()

        catalogue = predictor.products().copy()

        catalogue["last_month"] = (
            catalogue["last_month"].dt.strftime("%Y-%m")
        )

        _ = predictor.yearly_history

        app.state.predictor = predictor
        app.state.catalogue = catalogue.to_dict(
            orient="records"
        )

        try:
            yield
        finally:
            del app.state.predictor
            del app.state.catalogue

    app = FastAPI(
        title="MarketLens API",
        version="0.1.0",
        lifespan=lifespan,
        description=(
            "Existing ML forecasts based partly on simulated "
            "U.S. financial data. Uncertainty estimates are "
            "typical model errors, not guaranteed confidence "
            "intervals."
        ),
        responses={
            422: {"model": ErrorResponse},
            500: {"model": ErrorResponse},
        },
    )

    # ========================================
    # RATE LIMITER CONFIGURATION
    # ========================================

    app.state.limiter = limiter

    # ========================================
    # CORS CONFIGURATION
    # ========================================

    origins = [
        v.strip()
        for v in os.getenv(
            "MARKETLENS_CORS_ORIGINS", ""
        ).split(",")
        if v.strip()
    ]

    if "*" in origins:
        raise ValueError(
            "MARKETLENS_CORS_ORIGINS must list explicit "
            "frontend origins; wildcard is not supported"
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Retry-After"],
    )

    # ========================================
    # RATE LIMIT ERROR HANDLER
    # ========================================

    @app.exception_handler(RateLimitExceeded)
    def rate_limit_error(
        request: Request,
        exc: RateLimitExceeded,
    ):
        rate_limit, keys = request.state.view_rate_limit

        window = (
            request.app.state.limiter.limiter.get_window_stats(
                rate_limit,
                *keys,
            )
        )

        retry_after = max(
            1,
            math.ceil(window.reset_time - time.time()),
        )

        response = error_response(
            429,
            "rate_limit_exceeded",
            "Request limit exceeded. Please try again later.",
            [
                {
                    "limit": str(rate_limit),
                    "retry_after": retry_after,
                }
            ],
        )

        response.headers["Retry-After"] = str(retry_after)

        return response

    # ========================================
    # VALIDATION ERROR HANDLER
    # ========================================

    @app.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request,
        exc: RequestValidationError,
    ):
        details = [
            {
                "loc": list(e["loc"]),
                "msg": e["msg"],
                "type": e["type"],
            }
            for e in exc.errors()
        ]

        return error_response(
            422,
            "validation_error",
            "Invalid request",
            details,
        )

    # ========================================
    # HTTP ERROR HANDLER
    # ========================================

    @app.exception_handler(HTTPException)
    async def http_error(
        request: Request,
        exc: HTTPException,
    ):
        response = error_response(
            exc.status_code,
            "http_error",
            str(exc.detail),
        )

        response.headers.update(exc.headers or {})

        return response

    # ========================================
    # UNEXPECTED ERROR HANDLER
    # ========================================

    @app.exception_handler(Exception)
    async def unexpected_error(
        request: Request,
        exc: Exception,
    ):
        logger.error(
            "Unhandled API error",
            exc_info=exc,
        )

        return error_response(
            500,
            "internal_error",
            "An unexpected error occurred",
        )

    # ========================================
    # PREDICTION HELPER
    # ========================================

    def predict(method, *args, **kwargs):
        try:
            return {"data": method(*args, **kwargs)}

        except KeyError as exc:
            product_id = kwargs.get("product_id")

            if product_id is not None and not any(
                p["product_id"] == product_id
                for p in app.state.catalogue
            ):
                raise HTTPException(
                    404,
                    "Unknown product_id",
                ) from exc

            raise

        except ValueError as exc:
            raise HTTPException(
                422,
                str(exc),
            ) from exc

    # ========================================
    # PUBLIC ENDPOINTS
    # ========================================

    @app.get(
        "/health",
        response_model=DataResponse,
        tags=["Health"],
    )
    def health(request: Request):
        return {
            "data": {
                "status": "ok",
                "models_loaded": len(
                    request.app.state.predictor.bundles
                ),
            }
        }

    @app.get(
        "/api/v1/categories",
        response_model=DataResponse,
        tags=["Catalogue"],
    )
    def categories(request: Request):
        return {
            "data": {
                "items": sorted(
                    c["us_category"]
                    for c in
                    request.app.state.predictor.ref["categories"]
                )
            }
        }

    # ========================================
    # PROTECTED PRODUCT CATALOGUE
    # ========================================

    @app.get(
        "/api/v1/products",
        response_model=DataResponse,
        tags=["Catalogue"],
        dependencies=PROTECTED,
    )
    @limiter.limit(PRODUCTS_LIMIT)
    def products(
        request: Request,
        offset: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
    ):
        items = request.app.state.catalogue

        return {
            "data": {
                "items": items[offset:offset + limit],
                "total": len(items),
                "offset": offset,
                "limit": limit,
            }
        }

    # ========================================
    # PROTECTED LAUNCH PREDICTION
    # ========================================

    @app.post(
        "/api/v1/predictions/launch",
        response_model=DataResponse,
        tags=["Predictions"],
        dependencies=PROTECTED,
    )
    @limiter.limit(PREDICTION_LIMIT)
    @limiter.shared_limit(
        DAILY_PREDICTION_LIMIT,
        scope=PREDICTION_QUOTA_SCOPE,
    )
    def launch(
        body: LaunchRequest,
        request: Request,
    ):
        return predict(
            request.app.state.predictor.predict_launch,
            ProductInput(**body.model_dump()),
        )

    # ========================================
    # PROTECTED MONTHLY PREDICTION
    # ========================================

    @app.post(
        "/api/v1/predictions/monthly",
        response_model=DataResponse,
        tags=["Predictions"],
        dependencies=PROTECTED,
        responses={404: {"model": ErrorResponse}},
    )
    @limiter.limit(PREDICTION_LIMIT)
    @limiter.shared_limit(
        DAILY_PREDICTION_LIMIT,
        scope=PREDICTION_QUOTA_SCOPE,
    )
    def monthly(
        body: MonthlyRequest,
        request: Request,
    ):
        return predict(
            request.app.state.predictor.predict_next_month,
            **body.model_dump(),
        )

    # ========================================
    # PROTECTED YEARLY PREDICTION
    # ========================================

    @app.post(
        "/api/v1/predictions/yearly",
        response_model=DataResponse,
        tags=["Predictions"],
        dependencies=PROTECTED,
        responses={404: {"model": ErrorResponse}},
    )
    @limiter.limit(PREDICTION_LIMIT)
    @limiter.shared_limit(
        DAILY_PREDICTION_LIMIT,
        scope=PREDICTION_QUOTA_SCOPE,
    )
    def yearly(
        body: YearlyRequest,
        request: Request,
    ):
        return predict(
            request.app.state.predictor.predict_year,
            **body.model_dump(),
        )

    return app


app = create_app()