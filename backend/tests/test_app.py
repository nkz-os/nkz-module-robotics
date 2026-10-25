"""Process-level behaviour: refuse to start half-configured; migration entrypoint; routes."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import migrate
from app.main import create_app

REQUIRED = ["POSTGRES_URL", "DATABASE_URL", "VPN_INTERNAL_URL", "INTERNAL_SERVICE_SECRET", "HMAC_SECRET",
            "ZENOH_ROUTER_ENDPOINT", "ZENOH_ROBOT_ENDPOINT", "ZENOH_SERVICE_PASSWORD", "ROBOTICS_CREDENTIAL_KEY",
            "JWKS_URL", "JWT_ISSUER", "REQUIRE_HMAC_SIGNATURE"]


@pytest.fixture
def bare_env(monkeypatch):
    for name in REQUIRED:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir("/")
    get_settings.cache_clear()
    yield monkeypatch
    get_settings.cache_clear()


def test_startup_fails_without_required_config(bare_env):
    with pytest.raises(RuntimeError, match="ROBOTICS_CREDENTIAL_KEY"), TestClient(create_app()):
        pass


def test_migrate_main_without_dsn_exits_1(bare_env):
    assert migrate.main() == 1


async def test_health_and_routes(api):
    assert (await api.get("/health")).json()["status"] == "healthy"
    paths = (await api.get("/api/robotics/openapi.json")).json()["paths"]
    for p in ["/api/robotics/fleet/robots", "/api/robotics/fleet/robots/{device_uuid}/enroll",
              "/api/robotics/fleet/robots/{device_uuid}/enrollment", "/api/robotics/fleet/robots/{device_uuid}/estop",
              "/api/robotics/fleet/robots/{device_uuid}/rotate-credential", "/api/robotics/fleet/actions/estop-all",
              "/api/robotics/teleop/{device_uuid}/stream"]:
        assert p in paths, p
