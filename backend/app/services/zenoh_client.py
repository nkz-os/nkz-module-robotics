"""Zenoh REST client — publish, subscribe SSE, manage ACLs."""
import json
import logging
from typing import AsyncGenerator, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

REST_URL = settings.ZENOH_REST_URL.rstrip("/")
ADMIN_AUTH = httpx.BasicAuth(settings.ZENOH_ADMIN_USER, settings.ZENOH_ADMIN_PASSWORD)


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


async def set_acl(username: str, topics: list[str], permission: str = "pubsub") -> bool:
    """Configure ACL for a Zenoh user via Zenoh admin API."""
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            for topic in topics:
                payload = {"subject": topic, "action": permission, "user": username}
                r = await client.post(f"{REST_URL}/@/auth/acl", json=payload)
                if r.status_code >= 400:
                    logger.error("ACL set failed for %s on %s: %s", username, topic, r.text)
                    return False
        return True
    except Exception as e:
        logger.error("ACL set error: %s", e)
        return False


async def create_user(username: str, password: str) -> bool:
    """Create a Zenoh user for robot authentication."""
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            r = await client.post(
                f"{REST_URL}/@/auth/user",
                json={"user": username, "password": password},
            )
            return r.status_code < 400
    except Exception as e:
        logger.error("Create user error: %s", e)
        return False


async def delete_user(username: str) -> bool:
    """Delete a Zenoh user."""
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            r = await client.delete(f"{REST_URL}/@/auth/user/{username}")
            return r.status_code < 400
    except Exception as e:
        logger.error("Delete user error: %s", e)
        return False
