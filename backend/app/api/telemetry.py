"""Telemetry SSE endpoint — proxies Zenoh telemetry to browser."""
import json
import logging
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.zenoh_client import robot_topic, subscribe_sse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{robot_id}/stream")
async def telemetry_stream(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
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
