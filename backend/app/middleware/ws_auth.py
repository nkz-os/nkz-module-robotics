"""Cookie auth for the direct (non-gateway) stream route — JWT verified via JWKS.

The browser cannot send the gateway's X-Auth-Signature header on a raw
WebSocket handshake, so this verifies the nkz_token cookie's RS256 signature
directly against Keycloak's JWKS instead (mirrors nkz-module-eu-elevation's
ws_auth.py — the one real WS-auth precedent in the platform). tenant_id/
user_id come from the VERIFIED token claims, never from a client-supplied
query param.
"""
import logging

import jwt
from jwt import PyJWKClient

from app.config import get_settings

logger = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None


def _get_jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = get_settings().jwks_url
        if not url:
            raise jwt.PyJWKClientError("JWKS_URL is not configured; refusing token verification")
        _jwks_client = PyJWKClient(url)
    return _jwks_client


def verify_websocket_token(token: str) -> dict:
    """Return verified claims, or raise jwt.PyJWTError on any failure."""
    signing_key = _get_jwks().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[get_settings().jwt_algorithm],
        issuer=get_settings().jwt_issuer,
        options={"verify_aud": False},
    )


def allowed_origins() -> list[str]:
    """Origins the UI is served from (the same CORS_ORIGINS the HTTP middleware uses)."""
    return get_settings().cors_origin_list


def origin_allowed(origin: str | None, allowed: list[str]) -> bool:
    """Gate a WebSocket handshake on the page Origin.

    Browsers always send it and scripts cannot forge it; without this check a
    page on a sibling subdomain (same-site, so the session cookie travels with
    the handshake) could open the teleoperation socket. Non-browser clients
    send no Origin and carry no ambient cookie, so they pass.
    """
    if origin is None:
        return True
    return origin in allowed
