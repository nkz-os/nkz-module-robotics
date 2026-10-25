"""
Robotics backend — FastAPI application.

Robots reach the platform over the VPN and the cluster's Zenoh router with a
per-robot credential. This service keeps their live state (one replica), sends
E-Stops, manages enrollments on top of the vpn module, and keeps the router's
per-robot ACL in sync.
"""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nkz_platform_sdk import OrionClient
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.fleet import router as fleet_router
from app.api.stream import router as stream_router
from app.config import Settings, get_settings
from app.db.session import Database
from app.deps import Services
from app.logging_setup import configure_logging
from app.services.acl_apply import AclApplier
from app.services.credentials import CredentialBox
from app.services.vpn_client import VpnClient
from app.services.zenoh_link import LiveState, ZenohLink

logger = logging.getLogger(__name__)


async def build_services(settings: Settings) -> Services:
    db = await Database.connect(settings.postgres_url)
    link = ZenohLink(settings.zenoh_router_endpoint, settings.zenoh_service_user, settings.zenoh_service_password,
                     LiveState())
    return Services(
        settings=settings, db=db, link=link,
        applier=AclApplier(settings.k8s_namespace, settings.zenoh_acl_secret, settings.zenoh_deployment),
        vpn=VpnClient(settings.vpn_internal_url, settings.internal_service_secret),
        box=CredentialBox(settings.credential_key),
        orion=lambda tenant: OrionClient(tenant),
    )


def create_app(services: Services | None = None) -> FastAPI:
    settings = services.settings if services else get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        tasks: list[asyncio.Task] = []
        built = None
        if services is None:
            settings.validate_required()
            built = await build_services(settings)
            app.state.services = built
            from app.services import enrollment, reconciler

            await built.link.start()
            await enrollment.apply_acl(built)  # bootstrap/refresh the router config from the database
            tasks = reconciler.start(built)
        logger.info("%s v%s starting", settings.app_name, settings.app_version)
        try:
            yield
        finally:
            for t in tasks:
                t.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await t
            if built is not None:
                await built.link.close()
                await built.db.close()

    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan,
                  docs_url=f"{settings.api_prefix}/docs", openapi_url=f"{settings.api_prefix}/openapi.json")
    if services is not None:
        app.state.services = services
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                       allow_methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Content-Type"])

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": settings.app_name, "version": settings.app_version}

    app.include_router(fleet_router, prefix=settings.api_prefix)
    app.include_router(stream_router, prefix=settings.api_prefix)
    Instrumentator().instrument(app).expose(app, include_in_schema=False)
    return app


app = create_app()
