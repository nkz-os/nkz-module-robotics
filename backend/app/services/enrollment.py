"""
Robot enrollment: per-robot Zenoh credentials on top of a device claimed in vpn.

The database row is the source of truth (password Fernet-encrypted). After any
change the router's dynamic config is re-rendered from ALL rows and applied in
the background (a router restart outlasts the gateway timeout): the caller gets
202 with the password, shown once, and polls the enrollment state.
"""

import asyncio
import logging
from dataclasses import dataclass

from fastapi import HTTPException, status

from app.db.repo import AlreadyEnrolled, EnrollmentRepo
from app.deps import Services
from app.services.credentials import new_password
from app.services.vpn_client import VpnUnavailable
from app.services.zenoh_acl import RobotCred, check_robot, render

logger = logging.getLogger(__name__)

_apply_lock = asyncio.Lock()
READY_CHECK_S = 15.0  # router already on this config: only confirm it is up


@dataclass(frozen=True)
class IssuedCredential:
    device_uuid: str
    password: str


def _http(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


async def _check_vpn(svc: Services, tenant_id: str, device_uuid: str) -> None:
    try:
        device = await svc.vpn.get_device(device_uuid)
    except VpnUnavailable:
        raise _http(status.HTTP_502_BAD_GATEWAY, "Device registry unavailable, retry later") from None
    if device is None or device.tenant_id != tenant_id:
        raise _http(status.HTTP_404_NOT_FOUND, "Device not found")
    if device.device_type != "rover":
        raise _http(status.HTTP_409_CONFLICT, "Only robots can be enrolled")
    if device.state != "CLAIMED":
        raise _http(status.HTTP_409_CONFLICT, "Claim the device in Device Management first")


async def enroll(svc: Services, *, tenant_id: str, device_uuid: str, actor: str) -> IssuedCredential:
    await _check_vpn(svc, tenant_id, device_uuid)
    password = new_password()
    async with svc.db.tenant_tx(tenant_id) as conn:
        repo = EnrollmentRepo(conn)
        try:
            await repo.create(device_uuid, tenant_id, svc.box.encrypt(password), actor)
        except AlreadyEnrolled:
            raise _http(status.HTTP_409_CONFLICT, "Robot already enrolled") from None
        await repo.add_event(device_uuid, tenant_id, "ENROLLED", actor, None)
    schedule_apply(svc)
    logger.info("robot enrolled", extra={"device_uuid": device_uuid, "tenant_id": tenant_id})
    return IssuedCredential(device_uuid, password)


async def rotate(svc: Services, *, tenant_id: str, device_uuid: str, actor: str) -> IssuedCredential:
    password = new_password()
    async with svc.db.tenant_tx(tenant_id) as conn:
        repo = EnrollmentRepo(conn)
        if await repo.set_password(device_uuid, svc.box.encrypt(password), actor) is None:
            raise _http(status.HTTP_404_NOT_FOUND, "Robot not enrolled")
        await repo.add_event(device_uuid, tenant_id, "CREDENTIAL_ROTATED", actor, None)
    schedule_apply(svc)
    return IssuedCredential(device_uuid, password)


async def unenroll(svc: Services, *, tenant_id: str | None, device_uuid: str, actor: str, reason: str) -> bool:
    """Remove a robot's credential. tenant_id None = platform scope (reconciler)."""
    scope = svc.db.platform_tx() if tenant_id is None else svc.db.tenant_tx(tenant_id)
    async with scope as conn:
        repo = EnrollmentRepo(conn)
        row = await repo.get(device_uuid)
        if row is None:
            return False
        await repo.delete(device_uuid)
        await repo.add_event(device_uuid, row.tenant_id, "UNENROLLED", actor, {"reason": reason})
    schedule_apply(svc)
    logger.info("robot unenrolled", extra={"device_uuid": device_uuid, "reason": reason})
    return True


def _log_failure(task: asyncio.Task) -> None:
    if not task.cancelled() and task.exception() is not None:
        exc = task.exception()
        logger.error("zenoh-acl apply failed: %s", type(exc).__name__, exc_info=exc)


def schedule_apply(svc: Services) -> None:
    task = asyncio.create_task(apply_acl(svc), name="zenoh-acl-apply")
    svc.background.add(task)
    task.add_done_callback(svc.background.discard)
    task.add_done_callback(_log_failure)


async def apply_acl(svc: Services) -> bool:
    """Render the router config from every enrollment and apply it; mark rows active or pending."""
    async with _apply_lock:
        async with svc.db.platform_tx() as conn:
            rows = await EnrollmentRepo(conn).list_all()
        robots = []
        for row in rows:
            try:
                robot = RobotCred(row.device_uuid, row.tenant_id, svc.box.decrypt(row.password_enc))
                check_robot(robot)
            except ValueError:  # undecryptable (wrong key) or unrenderable: leave the robot out, flag it
                logger.error("enrollment credential unusable",
                             extra={"device_uuid": row.device_uuid, "tenant_id": row.tenant_id})
                continue
            robots.append(robot)
        bundle = render(robots, svc.settings.zenoh_service_user, svc.settings.zenoh_service_password)
        try:
            restarted = await svc.applier.apply(bundle)
            ok = await (svc.applier.wait_ready() if restarted else svc.applier.wait_ready(timeout=READY_CHECK_S))
        except Exception as exc:  # Kubernetes API failure: retried by the reconciler
            logger.error("router config apply failed: %s", type(exc).__name__)
            ok = False
        new_state = "active" if ok else "pending_acl"
        applied = {r.device_uuid for r in robots}
        async with svc.db.platform_tx() as conn:
            repo = EnrollmentRepo(conn)
            for row in rows:
                if row.state in ("applying", "pending_acl"):
                    # rows changed since the snapshot (rotated) keep their state for the next apply
                    await repo.set_state_if_unchanged(
                        row.device_uuid, new_state if row.device_uuid in applied else "failed", row.updated_at)
        return ok
