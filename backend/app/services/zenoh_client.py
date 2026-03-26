"""
Zenoh REST Client

Publishes to and subscribes from the Zenoh router via its built-in HTTP REST
plugin (port 8000). This keeps the API service decoupled from the Zenoh SDK
binary and lets us run standard uvicorn containers without native libs.

Zenoh REST API:
  PUT  /<path>           → publish a value
  GET  /<path>           → query the latest value
  GET  /<path>           → SSE stream when Accept: text/event-stream

Topic naming: nkz/{tenant_id}/{robot_id}/{channel}

Configuration (env vars):
  ZENOH_REST_URL   URL of the Zenoh router REST plugin
                   (default: http://zenoh-service:8000)
"""

import json
import logging
import time
from typing import AsyncGenerator, Union

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# The Zenoh router REST plugin URL — set ZENOH_REST_URL env var in K8s
_REST_URL = settings.ZENOH_REST_URL.rstrip("/")


async def put(path: str, payload: Union[dict, str, bytes]) -> None:
    """
    Publish a value to a Zenoh topic.

    Raises httpx.HTTPError on network failure — callers decide whether
    to propagate (safety-critical) or suppress (best-effort).
    """
    if isinstance(payload, dict):
        body = json.dumps(payload).encode()
        content_type = "application/json"
    elif isinstance(payload, str):
        body = payload.encode()
        content_type = "text/plain"
    else:
        body = payload
        content_type = "application/octet-stream"

    async with httpx.AsyncClient(timeout=2.0) as client:
        r = await client.put(
            f"{_REST_URL}/{path.lstrip('/')}",
            content=body,
            headers={"Content-Type": content_type},
        )
        r.raise_for_status()
    logger.debug("Zenoh PUT %s (%d bytes)", path, len(body))


async def subscribe_sse(path: str) -> AsyncGenerator[bytes, None]:
    """
    Subscribe to a Zenoh topic and yield raw SSE byte-chunks as they arrive.

    The caller wraps this in a StreamingResponse (media_type="text/event-stream").
    Each Zenoh publication appears as a standard SSE "data:" event.
    """
    url = f"{_REST_URL}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=5.0)) as client:
        async with client.stream(
            "GET", url, headers={"Accept": "text/event-stream"}
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                yield chunk


async def is_reachable() -> bool:
    """Quick health check: can we reach the Zenoh router REST API?"""
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            r = await client.get(f"{_REST_URL}/")
            return r.status_code < 500
    except Exception:
        return False
