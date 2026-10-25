"""
Fleet routes (behind the api-gateway, signed tenant headers).

View and E-Stop: every role with access to the module — a safety stop is never
restricted. Enroll / rotate / unenroll: TenantAdmin, PlatformAdmin.
"""

import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from app.db.repo import EnrollmentRepo
from app.deps import Services, get_services
from app.middleware import AuthContext, require_roles
from app.services import enrollment
from app.services.zenoh_link import LinkDown

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fleet", tags=["fleet"])

_viewer = require_roles("Farmer", "TechnicalConsultant", "TenantAdmin", "PlatformAdmin")
_admin = require_roles("TenantAdmin", "PlatformAdmin")


class ZenohCredential(BaseModel):
    endpoint: str
    username: str
    password: str
    key_prefix: str


class EnrollOut(BaseModel):
    device_uuid: str
    state: str
    zenoh: ZenohCredential


class EnrollmentOut(BaseModel):
    device_uuid: str
    state: str


class EstopOut(BaseModel):
    published: bool
    robot_connected: bool
    sent_at: float


class EstopAllItem(EstopOut):
    device_uuid: str


class EstopAllOut(BaseModel):
    results: list[EstopAllItem]
    failed: list[str]


def _credential(svc: Services, tenant_id: str, issued: enrollment.IssuedCredential) -> EnrollOut:
    if not svc.settings.zenoh_robot_endpoint:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Robot endpoint not configured")
    return EnrollOut(device_uuid=issued.device_uuid, state="applying", zenoh=ZenohCredential(
        endpoint=svc.settings.zenoh_robot_endpoint, username=issued.device_uuid, password=issued.password,
        key_prefix=f"nkz/{tenant_id}/{issued.device_uuid}"))


async def _enrolled(svc: Services, tenant_id: str, device_uuid: str):
    async with svc.db.tenant_tx(tenant_id) as conn:
        row = await EnrollmentRepo(conn).get(device_uuid)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Robot not enrolled")
    return row


@router.get("/robots")
async def list_robots(auth: AuthContext = Depends(_viewer), svc: Services = Depends(get_services)):
    orion = svc.orion(auth.tenant_id)
    try:
        twins = await orion.query_entities(type="ManufacturingMachine", q='category=="robot"', limit=1000)
    finally:
        await orion.close()
    async with svc.db.tenant_tx(auth.tenant_id) as conn:
        enrolled = {e.device_uuid: e for e in await EnrollmentRepo(conn).list_tenant()}
    robots = []
    for twin in twins:
        uuid = twin.get("id", "").rsplit(":", 1)[-1]
        live = svc.link.state.get(auth.tenant_id, uuid)
        row = enrolled.get(uuid)
        robots.append({
            "device_uuid": uuid,
            "name": (twin.get("name") or {}).get("value") or uuid,
            "enrollment": {"state": row.state} if row else None,
            "live": svc.link.state.snapshot(live) if live else None,
        })
    return {"robots": robots, "link_up": svc.link.connected}


@router.post("/robots/{device_uuid}/enroll", response_model=EnrollOut, status_code=status.HTTP_202_ACCEPTED)
async def enroll_robot(device_uuid: UUID, auth: AuthContext = Depends(_admin), svc: Services = Depends(get_services)):
    issued = await enrollment.enroll(svc, tenant_id=auth.tenant_id, device_uuid=str(device_uuid), actor=auth.user_id)
    return _credential(svc, auth.tenant_id, issued)


@router.get("/robots/{device_uuid}/enrollment", response_model=EnrollmentOut)
async def get_enrollment(device_uuid: UUID, auth: AuthContext = Depends(_viewer),
                         svc: Services = Depends(get_services)):
    row = await _enrolled(svc, auth.tenant_id, str(device_uuid))
    return EnrollmentOut(device_uuid=row.device_uuid, state=row.state)


@router.post("/robots/{device_uuid}/rotate-credential", response_model=EnrollOut,
             status_code=status.HTTP_202_ACCEPTED)
async def rotate_credential(device_uuid: UUID, auth: AuthContext = Depends(_admin),
                            svc: Services = Depends(get_services)):
    issued = await enrollment.rotate(svc, tenant_id=auth.tenant_id, device_uuid=str(device_uuid), actor=auth.user_id)
    return _credential(svc, auth.tenant_id, issued)


@router.delete("/robots/{device_uuid}/enrollment", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_robot(device_uuid: UUID, auth: AuthContext = Depends(_admin),
                         svc: Services = Depends(get_services)):
    if not await enrollment.unenroll(svc, tenant_id=auth.tenant_id, device_uuid=str(device_uuid),
                                     actor=auth.user_id, reason="operator"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Robot not enrolled")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/robots/{device_uuid}/estop", response_model=EstopOut)
async def estop_robot(device_uuid: UUID, auth: AuthContext = Depends(_viewer), svc: Services = Depends(get_services)):
    await _enrolled(svc, auth.tenant_id, str(device_uuid))
    try:
        result = await svc.link.estop(auth.tenant_id, str(device_uuid))
    except LinkDown:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Robot link is down; use the local E-Stop") from None
    logger.warning("E-Stop requested", extra={"device_uuid": str(device_uuid), "tenant_id": auth.tenant_id,
                                              "actor": auth.user_id})
    return EstopOut(published=result.published, robot_connected=result.robot_connected, sent_at=result.sent_at)


@router.post("/actions/estop-all", response_model=EstopAllOut)
async def estop_all(auth: AuthContext = Depends(_viewer), svc: Services = Depends(get_services)):
    async with svc.db.tenant_tx(auth.tenant_id) as conn:
        rows = await EnrollmentRepo(conn).list_tenant()
    # all robots at once: one unreachable robot must not delay the stop of the others
    outcomes = await asyncio.gather(*(svc.link.estop(auth.tenant_id, row.device_uuid) for row in rows),
                                    return_exceptions=True)
    results, failed = [], []
    for row, r in zip(rows, outcomes, strict=True):
        if isinstance(r, LinkDown):
            failed.append(row.device_uuid)  # never folded into an "ok": the operator must see it
        elif isinstance(r, BaseException):
            raise r
        else:
            results.append(EstopAllItem(device_uuid=row.device_uuid, published=r.published,
                                        robot_connected=r.robot_connected, sent_at=r.sent_at))
    logger.warning("E-Stop all requested", extra={"tenant_id": auth.tenant_id, "actor": auth.user_id,
                                                  "sent": len(results), "failed": len(failed)})
    if rows and not results:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Robot link is down; use the local E-Stop")
    return EstopAllOut(results=results, failed=failed)
