
import os

import firebase_admin
from firebase_admin import auth
from fastapi import Depends, HTTPException
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

# ========================================
# FIREBASE CONFIGURATION
# ========================================

PROJECT_ID = os.environ.get(
    "FIREBASE_PROJECT_ID",
    "marketlens-backend"
)

# ========================================
# FIREBASE INITIALIZATION
# ========================================

if not firebase_admin._apps:
    firebase_admin.initialize_app(
        options={
            "projectId": PROJECT_ID
        }
    )

# ========================================
# BEARER TOKEN SECURITY
# ========================================

bearer_scheme = HTTPBearer(
    auto_error=False
)

# ========================================
# VERIFY FIREBASE ID TOKEN
# ========================================

def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    )
):
    # ========================================
    # CHECK FOR MISSING TOKEN
    # ========================================

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    # ========================================
    # VERIFY TOKEN WITH FIREBASE
    # ========================================

    try:
        decoded_token = auth.verify_id_token(
            credentials.credentials,
            check_revoked=False
        )

        return decoded_token

    # ========================================
    # HANDLE INVALID OR EXPIRED TOKENS
    # ========================================

    except (
        ValueError,
        firebase_admin.auth.InvalidIdTokenError,
        firebase_admin.auth.ExpiredIdTokenError,
        firebase_admin.auth.RevokedIdTokenError,
        firebase_admin.auth.CertificateFetchError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        ) from None
