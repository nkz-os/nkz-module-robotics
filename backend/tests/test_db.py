"""Enrollment schema, forced RLS and repository against a real PostgreSQL."""

import asyncpg
import pytest

from app.db.migrate import run_migrations
from app.db.repo import AlreadyEnrolled, EnrollmentRepo

U1 = "3f1c2a9e-7b4d-4c1e-9a2b-1d2e3f4a5b6c"
U2 = "8a7b6c5d-4e3f-4a2b-9c1d-0e1f2a3b4c5d"


async def _enroll(db, uuid=U1, tenant="acme"):
    async with db.tenant_tx(tenant) as conn:
        return await EnrollmentRepo(conn).create(uuid, tenant, b"enc", "u1")


async def test_migrations_are_idempotent(pg_dsn):
    assert await run_migrations(pg_dsn) == []


async def test_create_returns_applying(db):
    e = await _enroll(db)
    assert (e.device_uuid, e.tenant_id, e.state, e.password_enc) == (U1, "acme", "applying", b"enc")


async def test_duplicate_raises(db):
    await _enroll(db)
    with pytest.raises(AlreadyEnrolled):
        await _enroll(db)


async def test_no_guc_sees_nothing(db, pg_dsn):
    await _enroll(db)
    conn = await asyncpg.connect(pg_dsn)
    try:
        assert await conn.fetchval("SELECT count(*) FROM robot_enrollments") == 0
    finally:
        await conn.close()


async def test_tenant_isolation_and_platform_scope(db):
    await _enroll(db, U1, "acme")
    await _enroll(db, U2, "tenant-b")
    async with db.tenant_tx("acme") as conn:
        repo = EnrollmentRepo(conn)
        assert [e.device_uuid for e in await repo.list_tenant()] == [U1]
        assert await repo.get(U2) is None
    async with db.platform_tx() as conn:
        assert {e.tenant_id for e in await EnrollmentRepo(conn).list_all()} == {"acme", "tenant-b"}


async def test_state_password_and_delete(db):
    await _enroll(db)
    async with db.tenant_tx("acme") as conn:
        repo = EnrollmentRepo(conn)
        assert (await repo.set_state(U1, "active")).state == "active"
        rotated = await repo.set_password(U1, b"enc2", "u2")
        assert rotated.password_enc == b"enc2" and rotated.state == "applying" and rotated.rotated_at
        await repo.add_event(U1, "acme", "ROTATED", "u2", {"why": "test"})
        assert [e.action for e in await repo.list_events(U1)] == ["ROTATED"]
        assert await repo.delete(U1) is True
        assert await repo.get(U1) is None
        assert await repo.delete(U1) is False


async def test_state_check_constraint(db):
    await _enroll(db)
    async with db.tenant_tx("acme") as conn:
        with pytest.raises(asyncpg.CheckViolationError):
            await EnrollmentRepo(conn).set_state(U1, "bogus")
