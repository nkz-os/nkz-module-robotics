"""Auth middleware — extracts tenant_id from JWT cookie or header."""
import logging
from typing import Optional
import jwt
from jwt import PyJWKClient
from fastapi import Request, HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.JWKS_URL)
    return _jwks_client


async def extract_tenant_id(request: Request) -> str:
    """Extract tenant_id from nkz_token cookie or X-Tenant-ID header."""
    token = request.cookies.get("nkz_token")
    if token:
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            return unverified.get("tenant_id") or unverified.get("tenant", "")
        except Exception:
            pass

    tenant_id = request.headers.get("X-Tenant-ID", "")
    if tenant_id:
        return tenant_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing tenant identification",
    )
