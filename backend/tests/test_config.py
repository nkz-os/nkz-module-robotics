"""Settings: every value the service cannot run without is checked at startup."""

import pytest

from app.config import Settings

REQUIRED = {
    "POSTGRES_URL": "postgresql://u:p@db:5432/nkz_robotics",
    "VPN_INTERNAL_URL": "http://vpn-api:8000",
    "INTERNAL_SERVICE_SECRET": "internal",
    "HMAC_SECRET": "hmac",
    "ZENOH_ROUTER_ENDPOINT": "tcp/zenoh:7447",
    "ZENOH_ROBOT_ENDPOINT": "tcp/192.0.2.10:7447",
    "ZENOH_SERVICE_PASSWORD": "svc",
    "ROBOTICS_CREDENTIAL_KEY": "k" * 44,
    "JWKS_URL": "http://kc/certs",
    "JWT_ISSUER": "http://kc/realms/x",
    "CORS_ORIGINS": "https://app.example.test",
}


@pytest.fixture
def clean_env(monkeypatch):
    for name in list(REQUIRED) + ["REQUIRE_HMAC_SIGNATURE", "DATABASE_URL"]:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_validate_required_lists_all_missing(clean_env):
    with pytest.raises(RuntimeError) as exc:
        Settings(_env_file=None).validate_required()
    for name in REQUIRED:
        assert name in str(exc.value)


def test_validate_required_passes_with_all_set(clean_env):
    import nkz_platform_sdk.auth as sdk_auth

    for k, v in REQUIRED.items():
        clean_env.setenv(k, v)
    clean_env.setattr(sdk_auth, "REQUIRE_HMAC", True)
    clean_env.setattr(sdk_auth, "HMAC_SECRET", "hmac")
    Settings(_env_file=None).validate_required()


def test_signature_check_must_be_on_in_the_sdk(clean_env):
    # the SDK reads REQUIRE_HMAC_SIGNATURE itself; with it unset the gateway signature is never checked
    import nkz_platform_sdk.auth as sdk_auth

    for k, v in REQUIRED.items():
        clean_env.setenv(k, v)
    clean_env.setattr(sdk_auth, "REQUIRE_HMAC", False)
    clean_env.setattr(sdk_auth, "HMAC_SECRET", "hmac")
    with pytest.raises(RuntimeError) as exc:
        Settings(_env_file=None).validate_required()
    assert "REQUIRE_HMAC_SIGNATURE" in str(exc.value)


def test_database_url_alias(clean_env):
    clean_env.setenv("DATABASE_URL", "postgresql://u:p@db/x")
    assert Settings(_env_file=None).postgres_url == "postgresql://u:p@db/x"


def test_defaults_match_the_spec(clean_env):
    s = Settings(_env_file=None)
    assert s.api_prefix == "/api/robotics"
    assert s.zenoh_service_user == "robotics-api"
    assert (s.reconcile_interval_seconds, s.location_sync_seconds) == (60, 30)
    assert (s.zenoh_acl_secret, s.zenoh_deployment) == ("zenoh-acl", "zenoh-router")
