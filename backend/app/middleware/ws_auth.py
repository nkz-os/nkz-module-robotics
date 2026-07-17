"""WebSocket auth — cookie JWT, signature-verified via JWKS.

The browser cannot send the gateway's X-Auth-Signature header on a raw
WebSocket handshake, so this verifies the nkz_token cookie's RS256 signature
directly against Keycloak's JWKS instead (mirrors nkz-module-eu-elevation's
ws_auth.py — the one real WS-auth precedent in the platform). tenant_id/
user_id come from the VERIFIED token claims, never from a client-supplied
query param.
"""
import logging
from typing import Optional

import jwt
from jwt import PyJWKClient

from app.config import settings

logger = logging.getLogger(__name__)

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.JWKS_URL)
    return _jwks_client


def verify_websocket_token(token: str) -> dict:
    """Return verified claims, or raise jwt.PyJWTError on any failure."""
    signing_key = _get_jwks().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[settings.JWT_ALGORITHM],
        issuer=settings.JWT_ISSUER,
        options={"verify_aud": False},
    )
