
import logging
import os

import firebase_admin
from firebase_admin import auth
from google.auth.exceptions import GoogleAuthError
from fastapi import Depends, HTTPException
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

log = logging.getLogger(__name__)

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

try:
    firebase_app = firebase_admin.get_app()
except ValueError:
    firebase_app = firebase_admin.initialize_app(options={"projectId": PROJECT_ID})


def _authentication_unavailable(error, guidance):
    log.error("Firebase authentication unavailable (%s). %s", type(error).__name__, guidance)
    return HTTPException(status_code=503, detail="Authentication service unavailable")

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

    # The SDK loads ADC lazily. Resolve it separately so malformed credentials
    # and unreadable files are reported as configuration failures.
    try:
        firebase_app.credential.get_credential()
    except (GoogleAuthError, OSError, ValueError, AttributeError) as error:
        raise _authentication_unavailable(
            error, "Check Application Default Credentials for the API runtime."
        ) from None

    try:
        decoded_token = auth.verify_id_token(
            credentials.credentials,
            app=firebase_app,
            check_revoked=False
        )

        return decoded_token

    except (auth.CertificateFetchError, GoogleAuthError) as error:
        raise _authentication_unavailable(
            error, "Check Firebase verification credentials and access to Google's public certificates."
        ) from None

    # ========================================
    # HANDLE INVALID OR EXPIRED TOKENS
    # ========================================

    except (
        ValueError,
        auth.InvalidIdTokenError,
        auth.ExpiredIdTokenError,
        auth.RevokedIdTokenError,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        ) from None
