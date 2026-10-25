"""Shared fixtures.

Database tests run against a real PostgreSQL (RLS cannot be mocked). Set
TEST_POSTGRES_URL to a superuser DSN; the fixtures create a dedicated
non-superuser role that owns a throwaway database — the same shape as
production, where the module role owns nkz_robotics and FORCE RLS applies to it.
"""

import asyncio
import os
from urllib.parse import urlparse, urlunparse

import asyncpg
import pytest

TEST_ROLE = "nkz_module_robotics_test"
TEST_ROLE_PASSWORD = "test"
TEST_DB = "nkz_robotics_test"


def _admin_dsn() -> str | None:
    return os.environ.get("TEST_POSTGRES_URL")


def _module_dsn(admin_dsn: str) -> str:
    u = urlparse(admin_dsn)
    netloc = f"{TEST_ROLE}:{TEST_ROLE_PASSWORD}@{u.hostname}:{u.port or 5432}"
    return urlunparse(u._replace(netloc=netloc, path=f"/{TEST_DB}"))


async def _recreate_database(admin_dsn: str) -> None:
    conn = await asyncpg.connect(admin_dsn)
    try:
        await conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        exists = await conn.fetchval("SELECT 1 FROM pg_roles WHERE rolname = $1", TEST_ROLE)
        if not exists:
            await conn.execute(
                f"CREATE ROLE {TEST_ROLE} LOGIN PASSWORD '{TEST_ROLE_PASSWORD}' "
                "NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE"
            )
        await conn.execute(f"CREATE DATABASE {TEST_DB} OWNER {TEST_ROLE}")
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def pg_dsn() -> str:
    """Module-role DSN of a freshly created, migrated database."""
    admin = _admin_dsn()
    if not admin:
        pytest.skip("TEST_POSTGRES_URL not set: database tests need a real PostgreSQL")
    from app.db.migrate import run_migrations

    asyncio.run(_recreate_database(admin))
    dsn = _module_dsn(admin)
    asyncio.run(run_migrations(dsn))
    return dsn


@pytest.fixture
async def db(pg_dsn):
    """A connected Database on empty tables."""
    from app.db.session import Database

    database = await Database.connect(pg_dsn)
    async with database.raw() as conn:
        await conn.execute("TRUNCATE robot_enrollments, robot_events RESTART IDENTITY")
    try:
        yield database
    finally:
        await database.close()




# --------------------------------------------------------------------------
# Application fixtures: injected services, gateway headers, fakes for the
# parts that need a cluster (router restarts) or a robot (the Zenoh link).
# --------------------------------------------------------------------------

import httpx  # noqa: E402
from cryptography.fernet import Fernet  # noqa: E402

ORION_URL = "http://orion.test:1026"
CONTEXT_URL = "http://ctx.test/context.json"
VPN_URL = "http://vpn.test:8000"


def gateway_headers(tenant: str = "acme", roles: str = "TenantAdmin", user: str = "u1") -> dict[str, str]:
    return {"X-Tenant-ID": tenant, "X-User-ID": user, "X-User-Roles": roles}


class FakeApplier:
    def __init__(self, ok: bool = True):
        self.bundles, self.ok = [], ok
        self.fail_next = False   # the next apply raises (Kubernetes API failure)
        self.during_wait = None  # coroutine run while "waiting" for the rollout

    async def apply(self, bundle):
        if self.fail_next:
            self.fail_next = False
            raise RuntimeError("kubernetes api unavailable")
        changed = not self.bundles or self.bundles[-1].digest != bundle.digest
        self.bundles.append(bundle)
        return changed

    async def wait_ready(self, timeout: float = 120.0, interval: float = 2.0):
        if self.during_wait is not None:
            hook, self.during_wait = self.during_wait, None
            await hook()
        return self.ok


class FakeLink:
    def __init__(self):
        from app.services.zenoh_link import LiveState

        self.state = LiveState()
        self.connected = True
        self.estops: list[tuple[str, str]] = []
        self.robot_connected = True
        self.delay = 0.0

    async def estop(self, tenant_id, device_uuid):
        import time

        from app.services.zenoh_link import EstopResult, LinkDown

        if not self.connected:
            raise LinkDown("down")
        if self.delay:
            await asyncio.sleep(self.delay)
        self.estops.append((tenant_id, device_uuid))
        return EstopResult(published=True, robot_connected=self.robot_connected, sent_at=time.time())


@pytest.fixture(autouse=True)
def _gateway_signature_off(monkeypatch):
    import nkz_platform_sdk.auth as sdk_auth

    monkeypatch.setattr(sdk_auth, "REQUIRE_HMAC", False)
    monkeypatch.setattr(sdk_auth, "HMAC_SECRET", "")


@pytest.fixture
def settings():
    from app.config import Settings

    return Settings(_env_file=None, vpn_internal_url=VPN_URL, internal_service_secret="internal-secret",
                    zenoh_router_endpoint="tcp/zenoh.test:7447", zenoh_robot_endpoint="tcp/192.0.2.10:7447",
                    zenoh_service_password="svc-pass", credential_key=Fernet.generate_key().decode(),
                    jwks_url="http://kc.test/certs", jwt_issuer="http://kc.test/realms/x",
                    cors_origins="https://app.example.test")


@pytest.fixture
async def services(db, settings):
    from nkz_platform_sdk import OrionClient

    from app.deps import Services
    from app.services.credentials import CredentialBox
    from app.services.vpn_client import VpnClient

    return Services(settings=settings, db=db, link=FakeLink(), applier=FakeApplier(),
                    vpn=VpnClient(VPN_URL, "internal-secret"), box=CredentialBox(settings.credential_key),
                    orion=lambda t: OrionClient(t, base_url=ORION_URL, context_url=CONTEXT_URL))


@pytest.fixture
async def api(services):
    from app.main import create_app

    app = create_app(services=services)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://robotics.test") as client:
        yield client
