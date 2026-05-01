"""Teleoperation WebSocket endpoint — control commands + video frames."""
import asyncio
import json
import logging
import struct
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.zenoh_client import robot_topic, put, subscribe_sse, is_reachable

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/{robot_id}/control")
async def control_ws(websocket: WebSocket, robot_id: str):
    await websocket.accept()

    # Extract tenant_id from query params or cookies (WebSocket doesn't go through HTTP middleware)
    tenant_id = websocket.query_params.get("tenant_id", "")
    if not tenant_id:
        token = websocket.cookies.get("nkz_token")
        if token:
            try:
                import jwt
                unverified = jwt.decode(token, options={"verify_signature": False})
                tenant_id = unverified.get("tenant_id") or unverified.get("tenant", "")
            except Exception:
                pass

    topic_cmd = robot_topic(tenant_id, robot_id, "cmd_vel")
    topic_mode = robot_topic(tenant_id, robot_id, "mode")
    topic_heartbeat = robot_topic(tenant_id, robot_id, "heartbeat")
    topic_video = robot_topic(tenant_id, robot_id, "video")

    video_task: asyncio.Task | None = None

    async def stream_video():
        try:
            async for chunk in subscribe_sse(topic_video):
                text = chunk.decode(errors="replace")
                for line in text.splitlines():
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        try:
                            data = json.loads(payload)
                            frame_bytes = bytes(data.get("frame", []))
                            if frame_bytes:
                                camera_id = data.get("camera_id", 0)
                                header = struct.pack("<I", camera_id)
                                await websocket.send_bytes(header + frame_bytes)
                        except Exception:
                            pass
        except Exception as e:
            logger.warning("Video stream ended for %s: %s", robot_id, e)

    try:
        while True:
            raw = await websocket.receive()

            if "text" in raw:
                try:
                    msg = json.loads(raw["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "estop":
                    # E-STOP is priority 0 — must be sent immediately
                    # Use a fire-and-forget approach with minimal timeout
                    asyncio.create_task(put(topic_cmd, {
                        "linear": {"x": 0, "y": 0, "z": 0},
                        "angular": {"x": 0, "y": 0, "z": 0},
                        "estop": True,
                    }, timeout=1.0))
                    # Also set mode to MONITOR
                    asyncio.create_task(put(topic_mode, {"value": "MONITOR"}, timeout=1.0))
                elif msg_type == "cmd_vel":
                    await put(topic_cmd, msg)
                elif msg_type == "mode":
                    await put(topic_mode, {"value": msg.get("value")})
                elif msg_type == "heartbeat":
                    await put(topic_heartbeat, {"ts": asyncio.get_event_loop().time()})
                elif msg_type == "camera" and not video_task:
                    video_task = asyncio.create_task(stream_video())
                elif msg_type == "ping":
                    t0 = asyncio.get_event_loop().time()
                    reachable = await is_reachable()
                    latency = (asyncio.get_event_loop().time() - t0) * 1000
                    await websocket.send_json({
                        "type": "pong",
                        "latency_ms": round(latency),
                        "zenoh_ok": reachable,
                    })

    except WebSocketDisconnect:
        pass
    finally:
        if video_task:
            video_task.cancel()
