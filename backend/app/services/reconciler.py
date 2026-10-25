"""
Background reconciliation.

* Every robot enrolled here must still be a CLAIMED robot of the same tenant in
  vpn; a revoked, removed or moved device loses its Zenoh credential. A vpn
  outage removes nothing.
* The router config is re-applied every cycle: a no-op when the router already
  runs it, and the repair when an earlier apply (enroll, rotate, unenroll)
  failed half-way.
* The twin's `location` follows live telemetry, at most once per robot every
  LOCATION_SYNC seconds (the only attribute this module writes on the twin).
"""

import asyncio
import logging
import math
import time

from app.db.repo import EnrollmentRepo
from app.deps import Services
from app.services import enrollment
from app.services.vpn_client import VpnUnavailable

logger = logging.getLogger(__name__)


async def reconcile_once(svc: Services) -> dict:
    async with svc.db.platform_tx() as conn:
        rows = await EnrollmentRepo(conn).list_all()
    unenrolled: list[str] = []
    for row in rows:
        try:
            device = await svc.vpn.get_device(row.device_uuid)
        except VpnUnavailable:
            logger.warning("vpn unavailable during reconcile; keeping enrollments")
            return {"unenrolled": unenrolled, "applied": None}
        if device is None or device.state != "CLAIMED" or device.tenant_id != row.tenant_id:
            reason = "vpn_missing" if device is None else f"vpn_{device.state.lower()}"
            async with svc.db.platform_tx() as conn:
                repo = EnrollmentRepo(conn)
                await repo.delete(row.device_uuid)
                await repo.add_event(row.device_uuid, row.tenant_id, "UNENROLLED", "reconciler", {"reason": reason})
            unenrolled.append(row.device_uuid)
            logger.warning("robot unenrolled by reconciler", extra={"device_uuid": row.device_uuid, "reason": reason})
    applied = await enrollment.apply_acl(svc)
    return {"unenrolled": unenrolled, "applied": applied}


def _valid(lat, lon) -> bool:
    return (isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and math.isfinite(lat)
            and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180)


async def sync_locations_once(svc: Services, last_sync: dict, now: float | None = None) -> int:
    now = time.time() if now is None else now
    written = 0
    for (tenant, uuid), robot in list(svc.link.state.robots.items()):
        t = robot.telemetry
        if not t or robot.telemetry_at is None:
            continue
        prev = last_sync.get((tenant, uuid))
        if prev is not None and (robot.telemetry_at <= prev or now - prev < svc.settings.location_sync_seconds):
            continue
        lat, lon = t.get("lat"), t.get("lon")
        if not _valid(lat, lon):
            continue
        orion = svc.orion(tenant)
        try:  # POST /attrs: the twin is created without a location, and PATCH only updates existing ones
            await orion.append_entity_attrs(f"urn:ngsi-ld:ManufacturingMachine:{tenant}:{uuid}", {
                "location": {"type": "GeoProperty", "value": {"type": "Point", "coordinates": [lon, lat]}}})
            last_sync[(tenant, uuid)] = now
            written += 1
        except Exception as exc:  # broker hiccup: retried on the next tick
            logger.warning("twin location update failed: %s", type(exc).__name__, extra={"device_uuid": uuid})
        finally:
            await orion.close()
    return written


async def _loop(name: str, fn, interval: float):
    while True:
        try:
            await fn()
        except Exception:  # keep the loop alive, but never hide the failure
            logger.exception("%s iteration failed", name)
        await asyncio.sleep(interval)


def start(svc: Services) -> list[asyncio.Task]:
    last: dict = {}
    return [
        asyncio.create_task(_loop("reconcile", lambda: reconcile_once(svc), svc.settings.reconcile_interval_seconds),
                            name="robotics-reconcile"),
        asyncio.create_task(_loop("location sync", lambda: sync_locations_once(svc, last), 5.0),
                            name="robotics-location-sync"),
    ]
