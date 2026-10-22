"""Auth middleware — extracts and verifies tenant identity from gateway headers.

The api-gateway validates the user's JWT and injects X-Tenant-ID, X-User-ID,
X-User-Roles, X-Auth-Signature on every proxied request (see
services/common/keycloak_auth.py). This module trusts those headers ONLY
after verifying X-Auth-Signature (fail-closed — see hmac.py); a request that
reaches this service without a valid signature did not come through the
gateway and is rejected, not silently treated as tenant_id="".
"""
import logging
from dataclasses import dataclass

from fastapi import Request

from app.config import settings
from app.middleware.hmac import verify_gateway_hmac

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthContext:
    tenant_id: str
    user_id: str
    roles: tuple[str, ...]


def _bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[len("Bearer "):]
    return ""


def authenticate(request: Request) -> AuthContext | None:
    """Return AuthContext on success, None on any auth failure (fail-closed)."""
    tenant_id = request.headers.get("X-Tenant-ID", "").strip()
    user_id = request.headers.get("X-User-ID", "").strip()
    if not tenant_id or not user_id:
        return None

    signature = request.headers.get("X-Auth-Signature", "")
    token = _bearer_token(request)
    if not verify_gateway_hmac(
        signature,
        token,
        tenant_id,
        secret=settings.HMAC_SECRET,
        require=settings.REQUIRE_HMAC,
    ):
        return None

    roles_header = request.headers.get("X-User-Roles", "").strip()
    roles = tuple(r.strip() for r in roles_header.split(",") if r.strip())
    return AuthContext(tenant_id=tenant_id, user_id=user_id, roles=roles)
