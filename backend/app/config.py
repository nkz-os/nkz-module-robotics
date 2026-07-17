"""Configuration for Robotics Module — loaded from environment."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Robotics Module API"
    VERSION: str = "1.0.0"

    # Zenoh REST API (put/get/subscribe — no admin API exists in 1.0)
    ZENOH_REST_URL: str = "http://zenoh-service:8000"

    # Orion-LD
    ORION_URL: str = "http://orion-ld-service:1026"

    # TimescaleDB for route history queries
    TIMESCALE_URL: str = "postgresql://postgres:postgres@timescaledb:5432/nekazari"

    # Auth
    KEYCLOAK_URL: str = "https://auth.robotika.cloud/auth"
    KEYCLOAK_REALM: str = "nekazari"
    JWT_ALGORITHM: str = "RS256"
    JWT_ISSUER: str = "https://auth.robotika.cloud/auth/realms/nekazari"
    JWKS_URL: str = "https://auth.robotika.cloud/auth/realms/nekazari/protocol/openid-connect/certs"

    # CORS
    CORS_ORIGINS: str = "https://nekazari.robotika.cloud"

    # GPS route history
    ROUTE_HISTORY_MAX_POINTS: int = 10000

    # Gateway HMAC (shared secret with api-gateway; seals X-Tenant-ID against
    # in-namespace forgery). Fail-closed: see app/middleware/hmac.py.
    HMAC_SECRET: str = ""
    REQUIRE_HMAC: bool = True

    # Zenoh endpoint handed to robots. The in-cluster DNS name is NOT
    # resolvable over the VPN (headscale has magic_dns disabled) — this must
    # be overridden at deploy time with the zenoh-service ClusterIP.
    ZENOH_ROBOT_ENDPOINT: str = "tcp/zenoh-service.nekazari.svc.cluster.local:7447"

    # Path to the Zenoh user:password dictionary file (mounted from the
    # zenoh-tenant-credentials Secret — same volume the router itself reads
    # via transport.auth.usrpwd.dictionary_file). One entry per tenant.
    ZENOH_CREDENTIALS_FILE: str = "/zenoh-credentials/credentials.txt"

    def enforce_required_secrets(self) -> None:
        """Fail fast at startup if security-critical secrets are missing."""
        if self.REQUIRE_HMAC and not self.HMAC_SECRET:
            raise RuntimeError(
                "HMAC_SECRET is required when REQUIRE_HMAC=true "
                "(fail-closed). Set it from the shared jwt-secret/secret."
            )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
