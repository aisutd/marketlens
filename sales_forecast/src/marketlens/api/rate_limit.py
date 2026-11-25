import os

from fastapi import Request, Depends, HTTPException
from slowapi import Limiter

from .firebase_auth import verify_firebase_token


# ========================================
# STORAGE CONFIGURATION
# ========================================

RATE_LIMIT_STORAGE_URI = os.getenv(
    "MARKETLENS_RATE_LIMIT_STORAGE_URI",
    "memory://",
)


# ========================================
# RATE LIMIT CONFIGURATION
# ========================================

def get_positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))

    if value <= 0:
        raise ValueError(
            f"{name} must be a positive integer"
        )

    return value


PRODUCTS_PER_MINUTE = get_positive_int(
    "MARKETLENS_PRODUCTS_PER_MINUTE",
    60,
)

PREDICTIONS_PER_MINUTE = get_positive_int(
    "MARKETLENS_PREDICTIONS_PER_MINUTE",
    10,
)

PREDICTIONS_PER_DAY = get_positive_int(
    "MARKETLENS_PREDICTIONS_PER_DAY",
    200,
)

PRODUCTS_LIMIT = f"{PRODUCTS_PER_MINUTE}/minute"

PREDICTION_LIMIT = f"{PREDICTIONS_PER_MINUTE}/minute"

DAILY_PREDICTION_LIMIT = f"{PREDICTIONS_PER_DAY}/day"

PREDICTION_QUOTA_SCOPE = "forecasting_predictions"


# ========================================
# AUTHENTICATED USER IDENTIFICATION
# ========================================

def get_user_key(request: Request) -> str:
    uid = getattr(
        request.state,
        "firebase_uid",
        None,
    )

    if not isinstance(uid, str) or not uid:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    return uid


# ========================================
# FIREBASE AUTHENTICATION DEPENDENCY
# ========================================

def authenticate_rate_limit_user(
    request: Request,
    decoded_token: dict = Depends(verify_firebase_token),
):
    uid = decoded_token.get("uid")

    if not isinstance(uid, str) or not uid:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication identity",
        )

    request.state.firebase_uid = uid

    return decoded_token


# ========================================
# RATE LIMITER FACTORY
# ========================================

def create_limiter() -> Limiter:
    return Limiter(
        key_func=get_user_key,
        storage_uri=RATE_LIMIT_STORAGE_URI,
        key_prefix="marketlens:forecasting",
        strategy="moving-window",
        headers_enabled=False,
        swallow_errors=False,
    )