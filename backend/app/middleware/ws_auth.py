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
        if not settings.JWKS_URL:
            raise jwt.PyJWKClientError("JWKS_URL is not configured; refusing WebSocket token verification")
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


def allowed_origins() -> list[str]:
    """Origins the UI is served from (the same CORS_ORIGINS the HTTP middleware uses)."""
    return [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]


def origin_allowed(origin: Optional[str], allowed: list[str]) -> bool:
    """Gate a WebSocket handshake on the page Origin.

    Browsers always send it and scripts cannot forge it; without this check a
    page on a sibling subdomain (same-site, so the session cookie travels with
    the handshake) could open the teleoperation socket. Non-browser clients
    send no Origin and carry no ambient cookie, so they pass.
    """
    if origin is None:
        return True
    return origin in allowed
