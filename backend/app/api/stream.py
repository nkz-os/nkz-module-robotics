"""
Live robot stream for the cockpit (Server-Sent Events).

Served through a direct Traefik route (the api-gateway cannot stream), so it
authenticates the nkz_token cookie itself against Keycloak's JWKS; the tenant
comes from the verified token. Only robots enrolled in that tenant are served.
Events: `state` (telemetry, heartbeat age, mode) and `link` (`up` | `down`).
Without new samples a `state` is still sent every KEEPALIVE_S, so a robot that
goes silent shows as offline instead of keeping its last "online".
"""

import asyncio
import json
import logging
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.db.repo import EnrollmentRepo
from app.deps import Services, get_services
from app.middleware.ws_auth import allowed_origins, origin_allowed, verify_websocket_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teleop", tags=["stream"])

KEEPALIVE_S = 2.0


def _sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()


async def _tenant_from_cookie(request: Request) -> str:
    if not origin_allowed(request.headers.get("origin"), allowed_origins()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Origin not allowed")
    token = request.cookies.get("nkz_token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing auth token")
    try:
        claims = await asyncio.to_thread(verify_websocket_token, token)
    except (jwt.PyJWTError, jwt.PyJWKClientError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from None
    tenant = claims.get("tenant_id") or claims.get("tenant") or ""
    if not tenant:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has no tenant")
    return tenant


@router.get("/{device_uuid}/stream")
async def robot_stream(device_uuid: UUID, request: Request, svc: Services = Depends(get_services)):
    tenant = await _tenant_from_cookie(request)
    uuid = str(device_uuid)
    async with svc.db.tenant_tx(tenant) as conn:
        if await EnrollmentRepo(conn).get(uuid) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Robot not enrolled")
    return StreamingResponse(stream_events(svc, tenant, uuid, request.is_disconnected),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def stream_events(svc: Services, tenant: str, uuid: str, is_disconnected, keepalive: float = KEEPALIVE_S):
    """SSE body for one robot of one tenant; ends when the client goes away."""
    state = svc.link.state
    queue = state.subscribe(tenant, uuid)
    try:
        yield _sse("link", {"state": "up" if svc.link.connected else "down"})
        live = state.get(tenant, uuid)
        if live:
            yield _sse("state", state.snapshot(live))
        while not await is_disconnected():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=keepalive)
            except TimeoutError:
                live = state.get(tenant, uuid)
                yield _sse("state", state.snapshot(live)) if live else b": keepalive\n\n"
                continue
            event = dict(event)
            kind = event.pop("type")
            yield _sse(kind, event)
    finally:
        state.unsubscribe(tenant, uuid, queue)
