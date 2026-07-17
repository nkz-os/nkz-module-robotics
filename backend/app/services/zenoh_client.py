"""Zenoh REST client — publish, subscribe SSE, and tenant credential lookup.

Auth model: Zenoh 1.0's REST plugin has no admin API for dynamic user/ACL
provisioning (confirmed against upstream docs — no /@/auth/user, /@/auth/acl).
Auth is a static per-TENANT usrpwd dictionary configured directly on the
router (zenoh-configmap.yaml's transport.auth.usrpwd.dictionary_file +
access_control, mounted from the zenoh-tenant-credentials Secret). This
backend only READS that same mounted file to hand a tenant's credential to
an operator once, at robot provisioning time — it never creates or deletes
Zenoh users.
"""
import json
import logging
from typing import AsyncGenerator, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

REST_URL = settings.ZENOH_REST_URL.rstrip("/")


def robot_topic(tenant_id: str, robot_id: str, channel: str) -> str:
    """Build a scoped Zenoh topic: nkz/{tenant_id}/{robot_id}/{channel}"""
    return f"nkz/{tenant_id}/{robot_id}/{channel}"


async def put(path: str, payload: dict, timeout: float = 2.0) -> None:
    """Publish a JSON value to a Zenoh topic."""
    body = json.dumps(payload).encode()
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.put(
            f"{REST_URL}/{path.lstrip('/')}",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()


async def subscribe_sse(path: str) -> AsyncGenerator[bytes, None]:
    """Subscribe to a Zenoh topic, yield SSE byte-chunks."""
    url = f"{REST_URL}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=5.0)) as client:
        async with client.stream("GET", url, headers={"Accept": "text/event-stream"}) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


async def get(path: str) -> Optional[dict]:
    """Query latest value from a Zenoh topic."""
    async with httpx.AsyncClient(timeout=2.0) as client:
        r = await client.get(f"{REST_URL}/{path.lstrip('/')}")
        if r.status_code == 200:
            return r.json()
        return None


async def is_reachable() -> bool:
    """Check if Zenoh router REST API is reachable."""
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            r = await client.get(f"{REST_URL}/")
            return r.status_code < 500
    except Exception:
        return False


def get_tenant_credential(tenant_id: str) -> Optional[str]:
    """Read this tenant's Zenoh password from the mounted credentials file.

    Returns None if the tenant has not been provisioned yet (fail-safe: the
    caller must reject with a clear error, never fabricate a credential).
    File format: one `tenant_id:password` per line, same file the router
    reads via transport.auth.usrpwd.dictionary_file (see zenoh-configmap.yaml).
    """
    try:
        with open(settings.ZENOH_CREDENTIALS_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line or ":" not in line:
                    continue
                user, _, password = line.partition(":")
                if user == tenant_id:
                    return password
    except OSError as exc:
        logger.error("Cannot read Zenoh credentials file: %s", exc)
        return None
    return None
