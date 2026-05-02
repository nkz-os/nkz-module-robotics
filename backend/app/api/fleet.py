"""Fleet management endpoints — robot CRUD, geofences, route history."""
import secrets
import logging
import httpx
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.orion_robots import get_orion_robots
from app.services.zenoh_client import create_user, delete_user, set_acl

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRobotBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    robot_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    robot_type: str = "AgriRobot"
    parcel_id: str | None = None


class RobotCredentials(BaseModel):
    username: str
    password: str
    endpoint: str


class RegisterRobotResponse(BaseModel):
    robot_id: str
    name: str
    credentials: RobotCredentials


class ProvisionRobotBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    robot_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    robot_type: str = "AgriRobot"
    parcel_id: str | None = None
    device_uuid: str = Field(..., description="Device UUID pre-registered in VPN factory")
    claim_code: str = Field(..., description="Claim Code printed on the robot chassis")


class ProvisionRobotResponse(BaseModel):
    robot_id: str
    name: str
    device_uuid: str
    credentials: RobotCredentials  # Zenoh
    tailscale_auth_key: str | None
    tailscale_login_server: str | None
    ngsi_entity_id: str | None


@router.get("/robots")
async def list_robots(request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robots = await client.list_robots()
    return {"robots": robots, "count": len(robots)}


@router.get("/robots/{robot_id}")
async def get_robot(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found in tenant {tenant_id}")
    return robot


@router.post("/robots", status_code=201)
async def register_robot(body: RegisterRobotBody, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)

    existing = await client.get_robot(body.robot_id)
    if existing:
        raise HTTPException(409, f"Robot {body.robot_id} already exists")

    await client.create_robot(body.robot_id, body.name, body.robot_type, body.parcel_id)

    username = f"robot-{tenant_id}-{body.robot_id}"
    password = secrets.token_urlsafe(24)
    await create_user(username, password)
    await set_acl(username, [f"nkz/{tenant_id}/{body.robot_id}/**"], "pubsub")

    return RegisterRobotResponse(
        robot_id=body.robot_id,
        name=body.name,
        credentials=RobotCredentials(
            username=username,
            password=password,
            endpoint="tcp/zenoh-service.nekazari.svc.cluster.local:7447",
        ),
    )


@router.patch("/robots/{robot_id}")
async def update_robot(robot_id: str, body: dict, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")
    await client.update_robot(robot_id, body)
    return {"status": "ok"}


@router.delete("/robots/{robot_id}")
async def decommission_robot(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")

    username = f"robot-{tenant_id}-{robot_id}"
    await delete_user(username)
    await client.delete_robot(robot_id)
    return {"status": "decommissioned"}


@router.post("/robots/{robot_id}/claim-control")
async def claim_control(robot_id: str, request: Request):
    """Claim exclusive control of a robot for teleoperation."""
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")

    current = robot.get("controlledBy", {}).get("value", "")
    if current and current != tenant_id:
        raise HTTPException(409, f"Robot {robot_id} is under control of {current}")

    await client.update_robot(robot_id, {"controlledBy": tenant_id})
    return {"status": "claimed", "robot_id": robot_id, "controlledBy": tenant_id}


@router.post("/robots/{robot_id}/release-control")
async def release_control(robot_id: str, request: Request):
    """Release exclusive control of a robot."""
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")

    current = robot.get("controlledBy", {}).get("value", "")
    if current and current != tenant_id:
        raise HTTPException(409, f"Control is held by {current}, cannot release")

    await client.update_robot(robot_id, {"controlledBy": ""})
    return {"status": "released", "robot_id": robot_id}


@router.post("/robots/provision", status_code=201)
async def provision_robot(body: ProvisionRobotBody, request: Request):
    """
    Unified provisioning wizard:
    1. Validate Claim Code against VPN module
    2. Generate Zenoh credentials
    3. Create/update AgriRobot in Orion-LD
    4. Consume Claim Code in VPN (final claim)
    5. Return all credentials
    """
    tenant_id = request.state.tenant_id

    # Extract JWT from cookie for VPN auth
    token = request.cookies.get("nkz_token", "")
    if not token:
        # Fallback to Authorization header
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()

    vpn_base = "http://nkz-network-controller-service/api/vpn"

    # Step 1: Validate Claim Code against VPN (read-only)
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            validate_resp = await client.post(
                f"{vpn_base}/devices/validate",
                json={"device_uuid": body.device_uuid, "claim_code": body.claim_code},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Tenant-ID": tenant_id,
                },
            )
            if validate_resp.status_code == 404:
                raise HTTPException(404, f"Device {body.device_uuid} not found in VPN")
            if validate_resp.status_code == 409:
                raise HTTPException(409, "This Claim Code has already been used")
            if validate_resp.status_code == 410:
                raise HTTPException(410, "This device has been revoked")
            if validate_resp.status_code >= 400:
                detail = "Invalid Claim Code"
                try:
                    detail = validate_resp.json().get("detail", detail)
                except Exception:
                    pass
                raise HTTPException(400, detail)
        except httpx.ConnectError:
            raise HTTPException(
                502,
                "VPN module is not reachable. Activate the 'Device Management' module first.",
            )

    # Step 2: Generate Zenoh credentials
    username = f"robot-{tenant_id}-{body.robot_id}"
    password = secrets.token_urlsafe(24)
    await create_user(username, password)
    await set_acl(username, [f"nkz/{tenant_id}/{body.robot_id}/**"], "pubsub")

    # Step 3: Create AgriRobot in Orion-LD
    client = get_orion_robots(tenant_id)
    existing = await client.get_robot(body.robot_id)
    if existing:
        await client.update_robot(body.robot_id, {
            "name": body.name,
            "robotType": body.robot_type,
            "controlledBy": "",
            "operationMode": "MONITOR",
        })
    else:
        await client.create_robot(body.robot_id, body.name, body.robot_type, body.parcel_id)

    # Step 4: Consume Claim Code in VPN (final claim)
    tailscale_key = None
    login_server = None
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            claim_body = {"device_uuid": body.device_uuid, "claim_code": body.claim_code}
            if body.name:
                claim_body["device_name"] = body.name
            claim_resp = await client.post(
                f"{vpn_base}/devices/claim",
                json=claim_body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Tenant-ID": tenant_id,
                },
            )
            if claim_resp.status_code == 200:
                claim_data = claim_resp.json()
                tailscale_key = claim_data.get("preauth_key")
                login_server = claim_data.get("login_server")
            else:
                logger.warning(
                    "VPN claim returned %s for device %s — credentials still generated",
                    claim_resp.status_code, body.device_uuid,
                )
        except Exception as e:
            logger.warning(
                "VPN claim failed for device %s: %s — credentials still generated",
                body.device_uuid, e,
            )

    return ProvisionRobotResponse(
        robot_id=body.robot_id,
        name=body.name,
        device_uuid=body.device_uuid,
        credentials=RobotCredentials(
            username=username,
            password=password,
            endpoint="tcp/zenoh-service.nekazari.svc.cluster.local:7447",
        ),
        tailscale_auth_key=tailscale_key,
        tailscale_login_server=login_server or "https://vpn.robotika.cloud",
        ngsi_entity_id=f"urn:ngsi-ld:AgriRobot:{body.robot_id}",
    )


@router.get("/vpn/check")
async def check_vpn_status():
    """Check if the VPN module (nkz-network-controller) is reachable."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://nkz-network-controller-service/health")
            return {
                "vpn_available": resp.status_code < 500,
                "vpn_url": "/devices",
                "vpn_status": resp.json() if resp.status_code == 200 else None,
            }
    except Exception:
        return {
            "vpn_available": False,
            "vpn_url": "/devices",
            "vpn_status": None,
            "hint": "Activate the 'Device Management' module in Settings → Modules.",
        }


@router.get("/robots/{robot_id}/route")
async def get_robot_route(
    robot_id: str,
    request: Request,
    from_ts: str = Query(None, alias="from"),
    to_ts: str = Query(None, alias="to"),
    limit: int = Query(1000, le=10000),
):
    """Query GPS trajectory from TimescaleDB. Returns GeoJSON LineString."""
    tenant_id = request.state.tenant_id
    import asyncpg
    from app.config import settings as s

    conn = await asyncpg.connect(s.TIMESCALE_URL)
    try:
        rows = await conn.fetch(
            """
            SELECT ST_AsGeoJSON(ST_MakeLine(location ORDER BY ts)) AS geom
            FROM (
                SELECT ts, location
                FROM telemetry.measurements
                WHERE tenant_id = $1
                  AND entity_id = $2
                  AND ($3::timestamptz IS NULL OR ts >= $3::timestamptz)
                  AND ($4::timestamptz IS NULL OR ts <= $4::timestamptz)
                ORDER BY ts
                LIMIT $5
            ) sub
            """,
            tenant_id,
            f"urn:ngsi-ld:AgriRobot:{robot_id}",
            from_ts,
            to_ts,
            limit,
        )
        geom = rows[0]["geom"] if rows and rows[0]["geom"] else None
        return {"robot_id": robot_id, "geometry": geom}
    finally:
        await conn.close()


# ── Fleet-wide actions ──────────────────────────────────────────────


@router.post("/actions/pause-all")
async def pause_all(request: Request):
    """Soft stop: set all tenant robots to MONITOR mode (gradual deceleration)."""
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robots = await client.list_robots()

    updated = 0
    for robot in robots:
        rid = robot.get("id", "").replace("urn:ngsi-ld:AgriRobot:", "")
        if not rid:
            continue
        await client.update_robot(rid, {"operationMode": "MONITOR"})
        # Send mode change via Zenoh if robot is online
        try:
            from app.services.zenoh_client import robot_topic, put
            await put(robot_topic(tenant_id, rid, "mode"), {"value": "MONITOR"}, timeout=1.0)
        except Exception:
            pass
        updated += 1

    logger.info("Pause All: %s robots set to MONITOR for tenant %s", updated, tenant_id)
    return {"action": "pause-all", "robots_affected": updated, "status": "ok"}


@router.post("/actions/estop-all")
async def estop_all(request: Request):
    """Emergency stop: cut traction on all tenant robots immediately."""
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robots = await client.list_robots()

    affected = 0
    for robot in robots:
        rid = robot.get("id", "").replace("urn:ngsi-ld:AgriRobot:", "")
        if not rid:
            continue
        # Send E-STOP via Zenoh
        try:
            from app.services.zenoh_client import robot_topic, put
            await put(robot_topic(tenant_id, rid, "cmd_vel"), {
                "linear": {"x": 0, "y": 0, "z": 0},
                "angular": {"x": 0, "y": 0, "z": 0},
                "estop": True,
            }, timeout=1.0)
            await put(robot_topic(tenant_id, rid, "mode"), {"value": "MONITOR"}, timeout=1.0)
        except Exception:
            pass
        await client.update_robot(rid, {"operationMode": "MONITOR"})
        affected += 1

    logger.warning("E-Stop All: %s robots emergency-stopped for tenant %s", affected, tenant_id)
    return {"action": "estop-all", "robots_affected": affected, "status": "ok"}
