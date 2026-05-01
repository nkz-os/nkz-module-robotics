"""Configuration for Robotics Module — loaded from environment."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Robotics Module API"
    VERSION: str = "1.0.0"

    # Zenoh
    ZENOH_REST_URL: str = "http://zenoh-service:8000"
    ZENOH_ROUTER_ENDPOINT: str = "tcp/zenoh-service:7447"
    ZENOH_ADMIN_USER: str = "admin"
    ZENOH_ADMIN_PASSWORD: str = ""

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
