from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, List
from pydantic import BaseModel

from app.config import settings

router = APIRouter()


class ZenohConfig(BaseModel):
    mode: str
    connect: List[str]
    namespaces: Dict[str, str]
    safety: Dict[str, Any]


@router.get("/robots/{robot_id}/zenoh-config", response_model=ZenohConfig)
async def get_robot_config(robot_id: str, request: Request):
    """
    Generate Zenoh configuration for a specific robot.

    This includes:
    - Connection endpoint (Zenoh Router — ClusterIP, see ZENOH_ROBOT_ENDPOINT:
      the in-cluster DNS name is NOT resolvable over the VPN, headscale has
      magic_dns disabled)
    - Strict namespacing (nkz/{tenant_id}/{robot_id})
    - Safety parameters (Watchdog timeout)

    tenant_id comes from the gateway-verified auth context (tenant_middleware),
    never from a caller-supplied param — a robot/operator authenticated for
    tenant A must not be able to read tenant B's config by passing its id.
    """
    tenant_id = request.state.tenant_id
    if not tenant_id:
        raise HTTPException(401, "Missing tenant identification")

    base_prefix = f"nkz/{tenant_id}/{robot_id}"

    return ZenohConfig(
        mode="client",
        connect=[settings.ZENOH_ROBOT_ENDPOINT],
        namespaces={
            "prefix": base_prefix,
            "cmd_vel": f"{base_prefix}/cmd_vel",
            "video": f"{base_prefix}/video",
            "telemetry": f"{base_prefix}/telemetry",
            "heartbeat": f"{base_prefix}/heartbeat",
            "safety_estop": f"{base_prefix}/safety/estop",
        },
        safety={
            "watchdog_timeout_ms": 1000,
            "watchdog_topic": f"{base_prefix}/heartbeat",
            "safe_stop_behavior": "ramp_down_0.5s",
        },
    )
