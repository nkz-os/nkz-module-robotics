"""Fleet management endpoints — robot CRUD, geofences, route history."""
import secrets
import logging
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
            endpoint="tcp/zenoh.nekazari.robotika.cloud:7447",
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
