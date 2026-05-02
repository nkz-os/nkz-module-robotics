"""FastAPI app for Robotics Module."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.config import settings
from app.middleware.auth import extract_tenant_id
from app.api.fleet import router as fleet_router
from app.api.telemetry import router as telemetry_router
from app.api.teleoperation import router as teleop_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Robotics Module API v%s", settings.VERSION)
    yield
    logger.info("Shutting down Robotics Module API")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
)


@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/", "/docs", "/openapi.json", "/metrics"):
        return await call_next(request)
    try:
        request.state.tenant_id = await extract_tenant_id(request)
    except Exception:
        request.state.tenant_id = ""
    return await call_next(request)


app.include_router(fleet_router, prefix="/api/robotics/fleet", tags=["Fleet"])
app.include_router(telemetry_router, prefix="/api/robotics/teleop", tags=["Telemetry"])
app.include_router(teleop_router, prefix="/api/robotics/teleop", tags=["Teleoperation"])

# Prometheus metrics — exposed at /metrics (no auth required)
Instrumentator().instrument(app).expose(app, include_in_schema=True)


@app.get("/health")
async def health():
    return {"status": "healthy", "module": "robotics", "version": settings.VERSION}


@app.get("/")
async def root():
    return {"module": "nkz-module-robotics", "version": settings.VERSION, "docs": "/docs"}
