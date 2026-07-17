"""Teleoperation WebSocket endpoint — control commands + video frames."""
import asyncio
import json
import logging
import struct
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.zenoh_client import robot_topic, put, subscribe_sse, is_reachable
from app.services.orion_robots import get_orion_robots
from app.middleware.ws_auth import verify_websocket_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/{robot_id}/control")
async def control_ws(websocket: WebSocket, robot_id: str):
    await websocket.accept()

    # The browser can't send X-Auth-Signature on a raw WS handshake, so this
    # verifies the nkz_token cookie's RS256 signature directly against JWKS
    # (mirrors nkz-module-eu-elevation's ws_auth.py). tenant_id comes from the
    # VERIFIED claims — never from the old ?tenant_id= query param, which let
    # any caller impersonate any tenant and teleoperate its robots.
    token = websocket.cookies.get("nkz_token")
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return
    try:
        claims = verify_websocket_token(token)
    except Exception as e:
        await websocket.close(code=4001, reason=f"Invalid token: {e}")
        return
    tenant_id = claims.get("tenant_id") or claims.get("tenant", "")
    if not tenant_id:
        await websocket.close(code=4001, reason="Token missing tenant_id")
        return

    topic_cmd = robot_topic(tenant_id, robot_id, "cmd_vel")
    topic_mode = robot_topic(tenant_id, robot_id, "mode")
    topic_heartbeat = robot_topic(tenant_id, robot_id, "heartbeat")
    topic_video = robot_topic(tenant_id, robot_id, "video")
    topic_estop = robot_topic(tenant_id, robot_id, "safety/estop")

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
                    # E-STOP is priority 0 — must be sent immediately.
                    # Edge system_monitor's authoritative E-Stop is
                    # /safety/estop (Bool) — MODULE_INTERACTIONS.md requires
                    # this be asserted explicitly, not just a zeroed cmd_vel
                    # (a guidance source could still hold mux priority).
                    asyncio.create_task(put(topic_estop, {"data": True}, timeout=1.0))
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
                    orion = get_orion_robots(tenant_id)
                    if msg.get("value") == "MANUAL":
                        await orion.update_robot(robot_id, {"controlledBy": tenant_id, "operationMode": "MANUAL"})
                    else:
                        await orion.update_robot(robot_id, {"controlledBy": "", "operationMode": msg.get("value", "MONITOR")})
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
        # Release control on disconnect
        try:
            orion = get_orion_robots(tenant_id)
            await orion.update_robot(robot_id, {"controlledBy": "", "operationMode": "MONITOR"})
        except Exception:
            pass
