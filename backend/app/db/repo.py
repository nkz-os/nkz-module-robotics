"""Robot enrollment repository. Runs on a connection already scoped by
Database.tenant_tx / platform_tx; which rows are visible is decided by RLS."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg

_COLUMNS = "device_uuid, tenant_id, state, password_enc, created_at, created_by, rotated_at, updated_at"


class AlreadyEnrolled(Exception):
    pass


@dataclass(frozen=True)
class Enrollment:
    device_uuid: str
    tenant_id: str
    state: str
    password_enc: bytes
    created_at: datetime
    created_by: str
    rotated_at: datetime | None
    updated_at: datetime


@dataclass(frozen=True)
class RobotEvent:
    action: str
    actor_sub: str
    details: dict[str, Any] | None
    created_at: datetime


def _row(r: asyncpg.Record) -> Enrollment:
    d = dict(r)
    d["device_uuid"] = str(d["device_uuid"])
    d["password_enc"] = bytes(d["password_enc"])
    return Enrollment(**d)


class EnrollmentRepo:
    def __init__(self, conn: asyncpg.Connection):
        self._conn = conn

    async def create(self, device_uuid: str, tenant_id: str, password_enc: bytes, actor: str) -> Enrollment:
        try:
            r = await self._conn.fetchrow(
                f"INSERT INTO robot_enrollments (device_uuid, tenant_id, state, password_enc, created_by) "
                f"VALUES ($1, $2, 'applying', $3, $4) RETURNING {_COLUMNS}",
                device_uuid, tenant_id, password_enc, actor,
            )
        except asyncpg.UniqueViolationError as exc:
            raise AlreadyEnrolled(device_uuid) from exc
        return _row(r)

    async def get(self, device_uuid: str) -> Enrollment | None:
        r = await self._conn.fetchrow(f"SELECT {_COLUMNS} FROM robot_enrollments WHERE device_uuid = $1", device_uuid)
        return _row(r) if r else None

    async def list_tenant(self) -> list[Enrollment]:
        return [_row(r) for r in await self._conn.fetch(
            f"SELECT {_COLUMNS} FROM robot_enrollments ORDER BY created_at, device_uuid")]

    list_all = list_tenant  # same query; the platform scope makes RLS return every tenant

    async def set_state(self, device_uuid: str, state: str) -> Enrollment | None:
        r = await self._conn.fetchrow(
            f"UPDATE robot_enrollments SET state = $2, updated_at = now() WHERE device_uuid = $1 RETURNING {_COLUMNS}",
            device_uuid, state,
        )
        return _row(r) if r else None

    async def set_state_if_unchanged(self, device_uuid: str, state: str, seen_updated_at: datetime) -> bool:
        """Set the state only if the row was not modified since it was read (e.g. rotated meanwhile)."""
        status = await self._conn.execute(
            "UPDATE robot_enrollments SET state = $2, updated_at = now() WHERE device_uuid = $1 AND updated_at = $3",
            device_uuid, state, seen_updated_at,
        )
        return status != "UPDATE 0"

    async def set_password(self, device_uuid: str, password_enc: bytes, actor: str) -> Enrollment | None:
        r = await self._conn.fetchrow(
            f"UPDATE robot_enrollments SET password_enc = $2, state = 'applying', rotated_at = now(), "
            f"updated_at = now() WHERE device_uuid = $1 RETURNING {_COLUMNS}",
            device_uuid, password_enc,
        )
        return _row(r) if r else None

    async def delete(self, device_uuid: str) -> bool:
        status = await self._conn.execute("DELETE FROM robot_enrollments WHERE device_uuid = $1", device_uuid)
        return status != "DELETE 0"

    async def add_event(self, device_uuid: str, tenant_id: str, action: str, actor: str,
                        details: dict[str, Any] | None) -> None:
        await self._conn.execute(
            "INSERT INTO robot_events (device_uuid, tenant_id, action, actor_sub, details) VALUES ($1, $2, $3, $4, $5)",
            device_uuid, tenant_id, action, actor, details,
        )

    async def list_events(self, device_uuid: str) -> list[RobotEvent]:
        rows = await self._conn.fetch(
            "SELECT action, actor_sub, details, created_at FROM robot_events "
            "WHERE device_uuid = $1 ORDER BY created_at, id",
            device_uuid,
        )
        return [RobotEvent(**dict(r)) for r in rows]
