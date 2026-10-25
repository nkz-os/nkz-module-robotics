"""
Robotics backend — configuration (environment only; empty defaults so nothing
here names a real installation). The service refuses to start half-configured.
"""

import json
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "Robotics"
    app_version: str = "3.0.0"
    log_level: str = "INFO"
    api_prefix: str = "/api/robotics"
    cors_origins: str = ""  # CSV or JSON list; also the Origin allowlist of the SSE stream

    # Own database nkz_robotics. Kubernetes injects DATABASE_URL.
    postgres_url: str = Field(default="", validation_alias=AliasChoices("POSTGRES_URL", "DATABASE_URL"))

    # Gateway signature on user routes (the SDK reads REQUIRE_HMAC_SIGNATURE/HMAC_SECRET
    # itself; these make startup fail when the check would silently be off).
    require_hmac_signature: bool = True
    hmac_secret: str = ""

    # Cookie verification for the direct SSE route (no gateway in front of it).
    jwks_url: str = ""
    jwt_issuer: str = ""
    jwt_algorithm: str = "RS256"

    # vpn module internal API (device lookup) and the shared internal secret.
    vpn_internal_url: str = ""
    internal_service_secret: str = ""

    # Zenoh: the backend's own session, and the endpoint handed to robots.
    zenoh_router_endpoint: str = ""
    zenoh_robot_endpoint: str = ""
    zenoh_service_user: str = "robotics-api"
    zenoh_service_password: str = ""

    # Robot passwords are stored encrypted with this Fernet key.
    credential_key: str = Field(default="", validation_alias=AliasChoices("ROBOTICS_CREDENTIAL_KEY", "CREDENTIAL_KEY"))

    # Router dynamic configuration (Secret written by this service, router restarted on change).
    k8s_namespace: str = "nekazari"
    zenoh_acl_secret: str = "zenoh-acl"
    zenoh_deployment: str = "zenoh-router"

    reconcile_interval_seconds: int = 60
    location_sync_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if not raw:
            return []
        if raw.startswith("["):
            return [str(o).strip() for o in json.loads(raw) if str(o).strip()]
        return [o.strip() for o in raw.split(",") if o.strip()]

    def validate_required(self) -> None:
        required = {
            "POSTGRES_URL": self.postgres_url,
            "VPN_INTERNAL_URL": self.vpn_internal_url,
            "INTERNAL_SERVICE_SECRET": self.internal_service_secret,
            "ZENOH_ROUTER_ENDPOINT": self.zenoh_router_endpoint,
            "ZENOH_ROBOT_ENDPOINT": self.zenoh_robot_endpoint,
            "ZENOH_SERVICE_PASSWORD": self.zenoh_service_password,
            "ROBOTICS_CREDENTIAL_KEY": self.credential_key,
            "JWKS_URL": self.jwks_url,
            "JWT_ISSUER": self.jwt_issuer,
            "CORS_ORIGINS": self.cors_origins,  # also the Origin allowlist of the stream: empty = every 403
        }
        if self.require_hmac_signature:
            # require_auth reads these from the SDK module, which parses the environment itself:
            # check what it will actually enforce, not this model's copy.
            import nkz_platform_sdk.auth as sdk_auth

            required["HMAC_SECRET"] = self.hmac_secret and sdk_auth.HMAC_SECRET
            if not sdk_auth.REQUIRE_HMAC:
                required["REQUIRE_HMAC_SIGNATURE=true"] = ""
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError("Missing required configuration: " + ", ".join(missing))


@lru_cache
def get_settings() -> Settings:
    return Settings()
