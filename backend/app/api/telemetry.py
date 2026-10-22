"""Telemetry SSE endpoint — proxies Zenoh telemetry to browser."""
import json
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.middleware.ws_auth import verify_websocket_token
from app.services.zenoh_client import robot_topic, subscribe_sse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{robot_id}/stream")
async def telemetry_stream(robot_id: str, request: Request):
    # This endpoint is served via a Traefik direct-ingress BYPASS of the
    # api-gateway (the gateway's sync proxy cannot stream SSE:
    # safe_json_proxy_response rejects non-JSON with 502 and buffers the full
    # body, and the request times out at 30s). So it cannot rely on the
    # gateway's X-Auth-Signature; it self-authenticates the nkz_token cookie
    # against Keycloak JWKS — the same path the teleop WS uses (ws_auth.py).
    token = request.cookies.get("nkz_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")
    try:
        claims = verify_websocket_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    tenant_id = claims.get("tenant_id") or claims.get("tenant", "")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing tenant_id")

    topic = robot_topic(tenant_id, robot_id, "telemetry")

    async def event_generator():
        try:
            async for chunk in subscribe_sse(topic):
                yield chunk
        except Exception as e:
            logger.error("SSE stream error for %s/%s: %s", tenant_id, robot_id, e)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n".encode()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
