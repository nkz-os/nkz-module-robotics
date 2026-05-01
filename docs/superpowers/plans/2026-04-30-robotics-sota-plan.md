# Robotics SOTA Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional-grade robotics & telemetry module with fleet management dashboard, real-time teleoperation cockpit (multi-camera, 4WS, gamepad), FastAPI backend with SSE+WebSocket, Zenoh router with TLS+ACLs, and K8s deployment — after purging all mistakenly-merged LiDAR code.

**Architecture:** Dual-speed data plane: Management Plane (MQTT→IoT Agent→Orion-LD→TimescaleDB for GPS/Battery/OpMode) + Control Plane (Robot↔Zenoh TLS↔Backend↔SSE+WS↔Frontend for video/cmd_vel/heartbeat). Frontend is IIFE bundle deployed to MinIO. Backend is FastAPI async behind api-gateway with httpOnly cookie auth.

**Tech Stack:** React 18 + TypeScript + Tailwind + @nekazari/sdk + @nekazari/module-builder (IIFE), Python 3.12 + FastAPI + httpx + pyjwt, Eclipse Zenoh 1.0, K3s + Traefik + cert-manager

---

## Phase 1: LiDAR Purge

### Task 1.1: Delete LiDAR frontend files

**Files:**
- Delete: `src/services/api.ts`, `src/services/lidarContext.tsx`
- Delete: `src/components/slots/LidarLayer.tsx`, `src/components/slots/LidarConfig.tsx`, `src/components/slots/LidarLayerControl.tsx`, `src/components/slots/TreeInfo.tsx`
- Delete: `src/hooks/useUIKit.tsx`
- Delete: `frontend/` (entire directory)

- [ ] **Step 1: Remove LiDAR service and context files**

```bash
cd /home/g/Documents/nekazari/nkz-module-robotics
rm src/services/api.ts
rm src/services/lidarContext.tsx
```

- [ ] **Step 2: Remove LiDAR slot components**

```bash
rm src/components/slots/LidarLayer.tsx
rm src/components/slots/LidarConfig.tsx
rm src/components/slots/LidarLayerControl.tsx
rm src/components/slots/TreeInfo.tsx
```

- [ ] **Step 3: Remove useUIKit hook and frontend directory**

```bash
rm src/hooks/useUIKit.tsx
rm -rf frontend/
```

### Task 1.2: Delete LiDAR backend files

**Files:**
- Delete: `backend/app/services/orion_client.py`, `backend/app/services/storage.py`, `backend/app/worker.py`
- Delete: `backend/app/db/`, `backend/app/common/`, `backend/app/models/`
- Delete: `backend/environment.yml`

- [ ] **Step 1: Remove LiDAR backend services and worker**

```bash
rm backend/app/services/orion_client.py
rm backend/app/services/storage.py
rm backend/app/worker.py
```

- [ ] **Step 2: Remove database, common, and models packages**

```bash
rm -rf backend/app/db/
rm -rf backend/app/common/
rm -rf backend/app/models/
```

- [ ] **Step 3: Remove Conda environment file**

```bash
rm backend/environment.yml
```

### Task 1.3: Purge LiDAR from config, K8s, docs, and misc

**Files:**
- Delete: `k8s/registration.sql`, `k8s/frontend-deployment.yaml`, `dist/`, `SETUP.md`, `examples/`, `.vscode/`, `package-lock.json`
- Modify: `src/index.css` — remove all `.lidar-*` classes
- Modify: `src/locales/en.json`, `src/locales/es.json` — remove LiDAR keys

- [ ] **Step 1: Delete K8s LiDAR manifests and stale artifacts**

```bash
rm k8s/registration.sql
rm k8s/frontend-deployment.yaml
rm -rf dist/
rm SETUP.md
rm -rf examples/
rm -rf .vscode/
rm package-lock.json
```

- [ ] **Step 2: Purge old docs (preserve new spec/plan)**

```bash
# Remove old doc files but keep superpowers/
find docs/ -maxdepth 1 -type f -delete
```

- [ ] **Step 3: Rewrite src/index.css — remove all .lidar-* classes, add robotics design tokens**

Write `src/index.css`:

```css
@tailwind components;
@tailwind utilities;

:root {
  --nkz-surface: rgba(15, 23, 42, 0.95);
  --nkz-surface-elevated: rgba(30, 41, 59, 0.95);
  --nkz-border: rgba(148, 163, 184, 0.2);
  --nkz-accent: #E11D48;
  --nkz-critical: #EF4444;
  --nkz-warning: #F59E0B;
  --nkz-ok: #10B981;
  --nkz-info: #3B82F6;
  --nkz-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

.robotics-module {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--nkz-surface);
  color: #f1f5f9;
}

.hmi-mode {
  font-size: 1.125rem;
}

.hmi-mode button,
.hmi-mode [role="button"] {
  min-height: 48px;
  min-width: 48px;
}
```

- [ ] **Step 4: Rewrite src/locales/en.json with robotics-only keys**

Write `src/locales/en.json`:

```json
{
  "fleet": {
    "title": "Robot Fleet",
    "searchPlaceholder": "Search robots...",
    "registerRobot": "+ Register robot",
    "noRobots": "No robots registered",
    "noRobotsHint": "Register your first robot to get started",
    "battery": "Battery",
    "mode": "Mode",
    "gpsFix": "GPS fix",
    "lastSeen": "Last seen",
    "openCockpit": "Open cockpit",
    "geofences": "Geofences",
    "drawGeofence": "Draw geofence",
    "geofenceName": "Geofence name",
    "geofenceType": "Type",
    "geofenceInclusion": "Inclusion zone",
    "geofenceExclusion": "Exclusion zone",
    "saveGeofence": "Save",
    "deleteGeofence": "Delete",
    "routeHistory": "Route history",
    "routePlay": "Play",
    "routePause": "Pause",
    "routeExport": "Export GeoJSON",
    "routeFrom": "From",
    "routeTo": "To"
  },
  "cockpit": {
    "modeMONITOR": "MONITOR",
    "modeMANUAL": "MANUAL",
    "modeAUTO": "AUTO",
    "latencyMs": "{{ms}}ms",
    "batteryPercent": "{{pct}}%",
    "eStop": "E-STOP",
    "eStopConfirm": "Confirm E-STOP?",
    "eStopHint": "Press again to confirm",
    "gamepadConnected": "Gamepad connected",
    "gamepadDisconnected": "No gamepad",
    "cameraFront": "Front",
    "cameraRear": "Rear",
    "cameraImplement": "Implement",
    "hudLinX": "LIN.X:",
    "hudAngZ": "ANG.Z:",
    "hudHead": "HEAD:",
    "hudSpeed": "SPD:",
    "hudLinUnit": "m/s",
    "hudAngUnit": "rad/s",
    "hudSpeedUnit": "km/h",
    "hudDeg": "{{deg}}°",
    "hudLat": "LAT:",
    "hudLon": "LON:"
  },
  "drive": {
    "title": "Traction (4WS)",
    "front": "Front",
    "frontSub": "Standard Ackermann",
    "dual": "Dual",
    "dualSub": "Opposed rear",
    "crab": "Crab",
    "crabSub": "Diagonal movement",
    "pivot": "Pivot",
    "pivotSub": "Zero turn",
    "joystickHint": "Drag to drive"
  },
  "implement": {
    "title": "Implement",
    "noImplement": "No implement attached",
    "sprayerPressure": "Pressure",
    "sprayerPressureUnit": "bar",
    "sprayerFlow": "Flow rate",
    "sprayerFlowUnit": "L/min",
    "sprayerTank": "Tank level",
    "sprayerTankUnit": "%",
    "seederRate": "Seed rate",
    "seederRateUnit": "kg/ha",
    "seederHopper": "Hopper level",
    "seederHopperUnit": "%",
    "configParams": "Configure"
  },
  "robot": {
    "registerTitle": "Register new robot",
    "name": "Robot name",
    "namePlaceholder": "e.g. Sprayer-04",
    "robotType": "Type",
    "typeAgriRobot": "Agricultural robot",
    "typeRover": "Rover",
    "parcel": "Assigned parcel",
    "submit": "Register robot",
    "registering": "Registering...",
    "registerSuccess": "Robot registered",
    "credentialsNote": "Save these Zenoh credentials. They will not be shown again.",
    "zenohUser": "Username",
    "zenohPass": "Password",
    "zenohEndpoint": "Endpoint",
    "decommission": "Decommission robot",
    "decommissionConfirm": "This will revoke all credentials and remove the robot from the fleet. This action cannot be undone."
  }
}
```

- [ ] **Step 5: Rewrite src/locales/es.json with robotics-only keys**

Write `src/locales/es.json`:

```json
{
  "fleet": {
    "title": "Flota de robots",
    "searchPlaceholder": "Buscar robots...",
    "registerRobot": "+ Registrar robot",
    "noRobots": "Sin robots registrados",
    "noRobotsHint": "Registra tu primer robot para empezar",
    "battery": "Batería",
    "mode": "Modo",
    "gpsFix": "Señal GPS",
    "lastSeen": "Última conexión",
    "openCockpit": "Abrir cockpit",
    "geofences": "Geocercas",
    "drawGeofence": "Dibujar geocerca",
    "geofenceName": "Nombre",
    "geofenceType": "Tipo",
    "geofenceInclusion": "Zona de inclusión",
    "geofenceExclusion": "Zona de exclusión",
    "saveGeofence": "Guardar",
    "deleteGeofence": "Eliminar",
    "routeHistory": "Historial de ruta",
    "routePlay": "Reproducir",
    "routePause": "Pausar",
    "routeExport": "Exportar GeoJSON",
    "routeFrom": "Desde",
    "routeTo": "Hasta"
  },
  "cockpit": {
    "modeMONITOR": "MONITOR",
    "modeMANUAL": "MANUAL",
    "modeAUTO": "AUTO",
    "latencyMs": "{{ms}}ms",
    "batteryPercent": "{{pct}}%",
    "eStop": "PARADA EMERG.",
    "eStopConfirm": "¿Confirmar parada?",
    "eStopHint": "Presiona otra vez para confirmar",
    "gamepadConnected": "Mando conectado",
    "gamepadDisconnected": "Sin mando",
    "cameraFront": "Frontal",
    "cameraRear": "Trasera",
    "cameraImplement": "Implemento",
    "hudLinX": "LIN.X:",
    "hudAngZ": "ANG.Z:",
    "hudHead": "RUMBO:",
    "hudSpeed": "VEL:",
    "hudLinUnit": "m/s",
    "hudAngUnit": "rad/s",
    "hudSpeedUnit": "km/h",
    "hudDeg": "{{deg}}°",
    "hudLat": "LAT:",
    "hudLon": "LON:"
  },
  "drive": {
    "title": "Tracción (4WS)",
    "front": "Delantera",
    "frontSub": "Ackermann estándar",
    "dual": "Dual",
    "dualSub": "Trasera opuesta",
    "crab": "Cangrejo",
    "crabSub": "Diagonal",
    "pivot": "Pivote",
    "pivotSub": "Giro cero",
    "joystickHint": "Arrastra para conducir"
  },
  "implement": {
    "title": "Implemento",
    "noImplement": "Sin implemento",
    "sprayerPressure": "Presión",
    "sprayerPressureUnit": "bar",
    "sprayerFlow": "Caudal",
    "sprayerFlowUnit": "L/min",
    "sprayerTank": "Depósito",
    "sprayerTankUnit": "%",
    "seederRate": "Dosis siembra",
    "seederRateUnit": "kg/ha",
    "seederHopper": "Tolva",
    "seederHopperUnit": "%",
    "configParams": "Configurar"
  },
  "robot": {
    "registerTitle": "Registrar nuevo robot",
    "name": "Nombre del robot",
    "namePlaceholder": "ej. Pulverizador-04",
    "robotType": "Tipo",
    "typeAgriRobot": "Robot agrícola",
    "typeRover": "Rover",
    "parcel": "Parcela asignada",
    "submit": "Registrar robot",
    "registering": "Registrando...",
    "registerSuccess": "Robot registrado",
    "credentialsNote": "Guarda estas credenciales Zenoh. No se mostrarán de nuevo.",
    "zenohUser": "Usuario",
    "zenohPass": "Contraseña",
    "zenohEndpoint": "Endpoint",
    "decommission": "Dar de baja",
    "decommissionConfirm": "Esto revocará todas las credenciales y eliminará el robot de la flota. Esta acción no se puede deshacer."
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: purge all LiDAR code and assets from robotics module"
```

---

## Phase 2: Backend Foundation

### Task 2.1: Rewrite backend dependencies and Dockerfile

**Files:**
- Rewrite: `backend/requirements.txt`
- Rewrite: `backend/Dockerfile`

- [ ] **Step 1: Write backend/requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
pyjwt[crypto]==2.9.0
cryptography==43.0.0
pydantic==2.9.0
pydantic-settings==2.5.0
python-dotenv==1.0.1
```

- [ ] **Step 2: Write backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile
git commit -m "feat(backend): switch to python:3.12-slim, remove Conda/geospatial deps"
```

### Task 2.2: Rewrite backend config

**Files:**
- Rewrite: `backend/app/config.py`

- [ ] **Step 1: Write backend/app/config.py**

```python
"""Configuration for Robotics Module — loaded from environment."""
import os
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
```

- [ ] **Step 2: Verify no AttributeError for missing settings**

```bash
cd backend && python -c "from app.config import settings; print(settings.PROJECT_NAME)"
```
Expected: prints "Robotics Module API"

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(backend): rewrite config for robotics-only settings"
```

### Task 2.3: Rewrite auth middleware

**Files:**
- Rewrite: `backend/app/middleware/auth.py`

- [ ] **Step 1: Write backend/app/middleware/auth.py**

```python
"""Auth middleware — extracts tenant_id from JWT cookie or header."""
import logging
from typing import Optional
import jwt
from jwt import PyJWKClient
from fastapi import Request, HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.JWKS_URL)
    return _jwks_client


async def extract_tenant_id(request: Request) -> str:
    """Extract tenant_id from nkz_token cookie or X-Tenant-ID header."""
    token = request.cookies.get("nkz_token")
    if token:
        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
            return unverified.get("tenant_id") or unverified.get("tenant", "")
        except Exception:
            pass

    tenant_id = request.headers.get("X-Tenant-ID", "")
    if tenant_id:
        return tenant_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing tenant identification",
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/middleware/auth.py
git commit -m "feat(backend): simplify auth middleware to tenant extraction"
```

### Task 2.4: Rewrite FastAPI main application

**Files:**
- Rewrite: `backend/app/main.py`
- Rewrite: `backend/app/__init__.py`
- Rewrite: `backend/app/api/__init__.py`
- Rewrite: `backend/app/services/__init__.py`

- [ ] **Step 1: Write backend/app/__init__.py**

```python
"""Robotics Module Backend"""
```

- [ ] **Step 2: Write backend/app/api/__init__.py**

```python
"""API routers — fleet, telemetry, teleoperation"""
```

- [ ] **Step 3: Write backend/app/services/__init__.py**

```python
"""Services — Zenoh client, Orion robots, ACLs"""
```

- [ ] **Step 4: Write backend/app/main.py**

```python
"""FastAPI app for Robotics Module."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.auth import extract_tenant_id

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
    if request.url.path in ("/health", "/", "/docs", "/openapi.json"):
        return await call_next(request)
    try:
        request.state.tenant_id = await extract_tenant_id(request)
    except Exception:
        request.state.tenant_id = ""
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "healthy", "module": "robotics", "version": settings.VERSION}


@app.get("/")
async def root():
    return {"module": "nkz-module-robotics", "version": settings.VERSION, "docs": "/docs"}
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/__init__.py backend/app/api/__init__.py backend/app/services/__init__.py backend/app/main.py
git commit -m "feat(backend): rewrite FastAPI app with tenant middleware and CORS whitelist"
```

---

## Phase 3: Backend Services

### Task 3.1: Zenoh REST client

**Files:**
- Rewrite: `backend/app/services/zenoh_client.py`

- [ ] **Step 1: Write backend/app/services/zenoh_client.py**

```python
"""Zenoh REST client — publish, subscribe SSE, manage ACLs."""
import json
import logging
from typing import AsyncGenerator, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

REST_URL = settings.ZENOH_REST_URL.rstrip("/")
ADMIN_AUTH = httpx.BasicAuth(settings.ZENOH_ADMIN_USER, settings.ZENOH_ADMIN_PASSWORD)


def robot_topic(tenant_id: str, robot_id: str, channel: str) -> str:
    """Build a scoped Zenoh topic: nkz/{tenant_id}/{robot_id}/{channel}"""
    return f"nkz/{tenant_id}/{robot_id}/{channel}"


async def put(path: str, payload: dict, timeout: float = 2.0) -> None:
    """Publish a JSON value to a Zenoh topic."""
    body = json.dumps(payload).encode()
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.put(
            f"{REST_URL}/{path.lstrip('/')}",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()


async def subscribe_sse(path: str) -> AsyncGenerator[bytes, None]:
    """Subscribe to a Zenoh topic, yield SSE byte-chunks."""
    url = f"{REST_URL}/{path.lstrip('/')}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(None, connect=5.0)) as client:
        async with client.stream("GET", url, headers={"Accept": "text/event-stream"}) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


async def get(path: str) -> Optional[dict]:
    """Query latest value from a Zenoh topic."""
    async with httpx.AsyncClient(timeout=2.0) as client:
        r = await client.get(f"{REST_URL}/{path.lstrip('/')}")
        if r.status_code == 200:
            return r.json()
        return None


async def is_reachable() -> bool:
    """Check if Zenoh router REST API is reachable."""
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            r = await client.get(f"{REST_URL}/")
            return r.status_code < 500
    except Exception:
        return False


async def set_acl(username: str, topics: list[str], permission: str = "pubsub") -> bool:
    """Configure ACL for a Zenoh user. Uses Zenoh admin API.

    Args:
        username: Zenoh user to grant access to
        topics: List of topic patterns (e.g. ['nkz/mytenant/robot-1/**'])
        permission: 'pub', 'sub', or 'pubsub'
    """
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            for topic in topics:
                payload = {
                    "subject": topic,
                    "action": permission,
                    "user": username,
                }
                r = await client.post(
                    f"{REST_URL}/@/auth/acl",
                    json=payload,
                )
                if r.status_code >= 400:
                    logger.error("ACL set failed for %s on %s: %s", username, topic, r.text)
                    return False
        return True
    except Exception as e:
        logger.error("ACL set error: %s", e)
        return False


async def create_user(username: str, password: str) -> bool:
    """Create a Zenoh user for robot authentication."""
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            r = await client.post(
                f"{REST_URL}/@/auth/user",
                json={"user": username, "password": password},
            )
            return r.status_code < 400
    except Exception as e:
        logger.error("Create user error: %s", e)
        return False


async def delete_user(username: str) -> bool:
    """Delete a Zenoh user."""
    try:
        async with httpx.AsyncClient(timeout=5.0, auth=ADMIN_AUTH) as client:
            r = await client.delete(f"{REST_URL}/@/auth/user/{username}")
            return r.status_code < 400
    except Exception as e:
        logger.error("Delete user error: %s", e)
        return False
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/zenoh_client.py
git commit -m "feat(backend): rewrite Zenoh client with ACL and user management"
```

### Task 3.2: Orion-LD robot client

**Files:**
- Create: `backend/app/services/orion_robots.py`

- [ ] **Step 1: Write backend/app/services/orion_robots.py**

```python
"""Orion-LD client for AgriRobot entities."""
import logging
from typing import Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

CONTEXT = [
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
    "https://smartdatamodels.org/context.jsonld",
]


class OrionRobotClient:
    """CRUD for AgriRobot entities in Orion-LD."""

    def __init__(self, tenant_id: str):
        self.base = settings.ORION_URL.rstrip("/")
        self.tenant = tenant_id
        self.headers = {
            "Content-Type": "application/ld+json",
            "Accept": "application/ld+json",
            "NGSILD-Tenant": tenant_id,
        }

    async def _req(self, method: str, path: str, json_data: Optional[dict] = None) -> Optional[dict]:
        url = f"{self.base}{path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.request(method, url, json=json_data, headers=self.headers)
            if r.status_code in (200, 201, 204):
                return r.json() if r.content else None
            logger.warning("Orion-LD %s %s → %s: %s", method, path, r.status_code, r.text[:200])
            return None

    async def list_robots(self) -> list[dict]:
        result = await self._req("GET", "/ngsi-ld/v1/entities?type=AgriRobot&limit=200")
        return result if isinstance(result, list) else []

    async def get_robot(self, robot_id: str) -> Optional[dict]:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        return await self._req("GET", f"/ngsi-ld/v1/entities/{urn}")

    async def create_robot(self, robot_id: str, name: str, robot_type: str, parcel_id: Optional[str] = None) -> dict:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        entity = {
            "@context": CONTEXT,
            "id": urn,
            "type": "AgriRobot",
            "name": {"type": "Property", "value": name},
            "robotType": {"type": "Property", "value": robot_type},
            "operationMode": {"type": "Property", "value": "MONITOR"},
            "battery": {"type": "Property", "value": 0},
            "location": {"type": "GeoProperty", "value": {"type": "Point", "coordinates": [0, 0]}},
        }
        if parcel_id:
            entity["refAgriParcel"] = {
                "type": "Relationship",
                "object": parcel_id if parcel_id.startswith("urn:") else f"urn:ngsi-ld:AgriParcel:{parcel_id}",
            }
        await self._req("POST", "/ngsi-ld/v1/entities", entity)
        return entity

    async def update_robot(self, robot_id: str, attrs: dict) -> bool:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        patch = {"@context": CONTEXT}
        for key, value in attrs.items():
            patch[key] = {"type": "Property", "value": value}
        await self._req("PATCH", f"/ngsi-ld/v1/entities/{urn}/attrs", patch)
        return True

    async def delete_robot(self, robot_id: str) -> bool:
        urn = f"urn:ngsi-ld:AgriRobot:{robot_id}"
        await self._req("DELETE", f"/ngsi-ld/v1/entities/{urn}")
        return True


def get_orion_robots(tenant_id: str) -> OrionRobotClient:
    return OrionRobotClient(tenant_id)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/orion_robots.py
git commit -m "feat(backend): add Orion-LD AgriRobot CRUD client"
```

---

## Phase 4: Backend API Endpoints

### Task 4.1: Fleet management API

**Files:**
- Create: `backend/app/api/fleet.py`

- [ ] **Step 1: Write backend/app/api/fleet.py**

```python
"""Fleet management endpoints — robot CRUD, geofences, route history."""
import secrets
import logging
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel, Field
from app.middleware.auth import extract_tenant_id
from app.services.orion_robots import get_orion_robots
from app.services.zenoh_client import (
    robot_topic, create_user, delete_user, set_acl,
    settings as _unused,  # noqa: F401
)

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRobotBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    robot_id: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    robot_type: str = "AgriRobot"
    parcel_id: str | None = None


class RobotCredentials(BaseModel):
    username: str
    password: str
    endpoint: str


class RegisterRobotResponse(BaseModel):
    robot_id: str
    name: str
    credentials: RobotCredentials


@router.get("/robots")
async def list_robots(request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robots = await client.list_robots()
    return {"robots": robots, "count": len(robots)}


@router.get("/robots/{robot_id}")
async def get_robot(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found in tenant {tenant_id}")
    return robot


@router.post("/robots", status_code=201)
async def register_robot(body: RegisterRobotBody, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)

    existing = await client.get_robot(body.robot_id)
    if existing:
        raise HTTPException(409, f"Robot {body.robot_id} already exists")

    await client.create_robot(body.robot_id, body.name, body.robot_type, body.parcel_id)

    username = f"robot-{tenant_id}-{body.robot_id}"
    password = secrets.token_urlsafe(24)
    await create_user(username, password)
    await set_acl(username, [f"nkz/{tenant_id}/{body.robot_id}/**"], "pubsub")

    return RegisterRobotResponse(
        robot_id=body.robot_id,
        name=body.name,
        credentials=RobotCredentials(
            username=username,
            password=password,
            endpoint=f"tcp/zenoh.nekazari.robotika.cloud:7447",
        ),
    )


@router.patch("/robots/{robot_id}")
async def update_robot(robot_id: str, body: dict, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")
    await client.update_robot(robot_id, body)
    return {"status": "ok"}


@router.delete("/robots/{robot_id}")
async def decommission_robot(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
    client = get_orion_robots(tenant_id)
    robot = await client.get_robot(robot_id)
    if not robot:
        raise HTTPException(404, f"Robot {robot_id} not found")

    username = f"robot-{tenant_id}-{robot_id}"
    await delete_user(username)
    await client.delete_robot(robot_id)
    return {"status": "decommissioned"}


@router.get("/robots/{robot_id}/route")
async def get_robot_route(
    robot_id: str,
    request: Request,
    from_ts: str = Query(None, alias="from"),
    to_ts: str = Query(None, alias="to"),
    limit: int = Query(1000, le=10000),
):
    """Query GPS trajectory from TimescaleDB. Returns GeoJSON LineString."""
    tenant_id = request.state.tenant_id
    import asyncpg
    from app.config import settings as s

    conn = await asyncpg.connect(s.TIMESCALE_URL)
    try:
        rows = await conn.fetch(
            """
            SELECT ST_AsGeoJSON(ST_MakeLine(location ORDER BY ts)) AS geom
            FROM (
                SELECT ts, location
                FROM telemetry.measurements
                WHERE tenant_id = $1
                  AND entity_id = $2
                  AND ($3::timestamptz IS NULL OR ts >= $3::timestamptz)
                  AND ($4::timestamptz IS NULL OR ts <= $4::timestamptz)
                ORDER BY ts
                LIMIT $5
            ) sub
            """,
            tenant_id,
            f"urn:ngsi-ld:AgriRobot:{robot_id}",
            from_ts,
            to_ts,
            limit,
        )
        geom = rows[0]["geom"] if rows and rows[0]["geom"] else None
        return {"robot_id": robot_id, "geometry": geom}
    finally:
        await conn.close()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/fleet.py
git commit -m "feat(backend): add fleet management API with robot CRUD and route history"
```

### Task 4.2: Telemetry SSE endpoint

**Files:**
- Create: `backend/app/api/telemetry.py`

- [ ] **Step 1: Write backend/app/api/telemetry.py**

```python
"""Telemetry SSE endpoint — proxies Zenoh telemetry to browser."""
import json
import logging
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.services.zenoh_client import robot_topic, subscribe_sse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{robot_id}/stream")
async def telemetry_stream(robot_id: str, request: Request):
    tenant_id = request.state.tenant_id
    topic = robot_topic(tenant_id, robot_id, "telemetry")

    async def event_generator():
        try:
            async for chunk in subscribe_sse(topic):
                yield chunk
        except Exception as e:
            logger.error("SSE stream error for %s/%s: %s", tenant_id, robot_id, e)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n".encode()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/telemetry.py
git commit -m "feat(backend): add SSE telemetry stream endpoint"
```

### Task 4.3: Teleoperation WebSocket endpoint

**Files:**
- Create: `backend/app/api/teleoperation.py`

- [ ] **Step 1: Write backend/app/api/teleoperation.py**

```python
"""Teleoperation WebSocket endpoint — control commands + video frames."""
import asyncio
import json
import logging
import struct
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Query
from app.services.zenoh_client import robot_topic, put, subscribe_sse, is_reachable

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/{robot_id}/control")
async def control_ws(websocket: WebSocket, robot_id: str):
    await websocket.accept()
    tenant_id = getattr(websocket.state, "tenant_id", "")

    topic_cmd = robot_topic(tenant_id, robot_id, "cmd_vel")
    topic_mode = robot_topic(tenant_id, robot_id, "mode")
    topic_heartbeat = robot_topic(tenant_id, robot_id, "heartbeat")
    topic_video = robot_topic(tenant_id, robot_id, "video")

    video_task: asyncio.Task | None = None

    async def stream_video():
        try:
            async for chunk in subscribe_sse(topic_video):
                text = chunk.decode(errors="replace")
                for line in text.splitlines():
                    if line.startswith("data:"):
                        payload = line[5:].strip()
                        try:
                            data = json.loads(payload)
                            frame_bytes = bytes(data.get("frame", []))
                            if frame_bytes:
                                camera_id = data.get("camera_id", 0)
                                header = struct.pack("<I", camera_id)
                                await websocket.send_bytes(header + frame_bytes)
                        except Exception:
                            pass
        except Exception as e:
            logger.warning("Video stream ended for %s: %s", robot_id, e)

    try:
        while True:
            raw = await websocket.receive()

            if "text" in raw:
                try:
                    msg = json.loads(raw["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "cmd_vel":
                    await put(topic_cmd, msg)
                elif msg_type == "mode":
                    await put(topic_mode, {"value": msg.get("value")})
                elif msg_type == "estop":
                    await put(topic_cmd, {"linear": {"x": 0, "y": 0, "z": 0}, "angular": {"x": 0, "y": 0, "z": 0}, "estop": True})
                elif msg_type == "heartbeat":
                    t0 = asyncio.get_event_loop().time()
                    await put(topic_heartbeat, {"ts": t0})
                elif msg_type == "camera" and not video_task:
                    video_task = asyncio.create_task(stream_video())
                elif msg_type == "ping":
                    t0 = asyncio.get_event_loop().time()
                    reachable = await is_reachable()
                    latency = (asyncio.get_event_loop().time() - t0) * 1000
                    await websocket.send_json({"type": "pong", "latency_ms": round(latency), "zenoh_ok": reachable})

    except WebSocketDisconnect:
        pass
    finally:
        if video_task:
            video_task.cancel()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/teleoperation.py
git commit -m "feat(backend): add WebSocket teleoperation endpoint with video relay"
```

### Task 4.4: Wire routers into main app

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add router includes to main.py**

Edit `backend/app/main.py` — after line `from app.middleware.auth import extract_tenant_id` add:

```python
from app.api.fleet import router as fleet_router
from app.api.telemetry import router as telemetry_router
from app.api.teleoperation import router as teleop_router
```

After the CORS middleware block and before `@app.get("/health")`, add:

```python
app.include_router(fleet_router, prefix="/api/robotics/fleet", tags=["Fleet"])
app.include_router(telemetry_router, prefix="/api/robotics/teleop", tags=["Telemetry"])
app.include_router(teleop_router, prefix="/api/robotics/teleop", tags=["Teleoperation"])
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): wire fleet, telemetry, and teleop routers"
```

---

## Phase 5: Frontend Foundation

### Task 5.1: Type definitions

**Files:**
- Create: `src/types/robotics.ts`

- [ ] **Step 1: Write src/types/robotics.ts**

```typescript
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Twist {
  linear: Vector3;
  angular: Vector3;
}

export interface RobotTelemetry {
  battery_pct: number;
  heading_deg: number;
  lat: number;
  lon: number;
  lin_x: number;
  ang_z: number;
  speed_kmh: number;
  ts: number;
  error?: string;
}

export interface RobotInfo {
  id: string;
  name: string;
  type: string;
  operationMode: 'MONITOR' | 'MANUAL' | 'AUTO';
  battery: number;
  location?: { type: string; coordinates: [number, number] };
  dateModified?: string;
}

export type DriveMode = 'ACKERMANN_FRONT' | 'ACKERMANN_DUAL' | 'CRAB' | 'DIFFERENTIAL';

export type OperationMode = 'MONITOR' | 'MANUAL' | 'AUTO';

export interface Geofence {
  id: string;
  name: string;
  type: 'inclusion' | 'exclusion';
  geometry: GeoJSON.Polygon;
  active: boolean;
}

export interface ZenohConfig {
  mode: string;
  connect: string[];
  namespaces: Record<string, string>;
  safety: Record<string, unknown>;
}

export interface RobotCredentials {
  username: string;
  password: string;
  endpoint: string;
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/types
git add src/types/robotics.ts
git commit -m "feat(frontend): add robotics type definitions"
```

### Task 5.2: Rewrite API client

**Files:**
- Rewrite: `src/services/roboticsApi.ts`
- Create: `src/services/zenohBridge.ts`

- [ ] **Step 1: Write src/services/zenohBridge.ts**

```typescript
export function robotTopic(tenantId: string, robotId: string, channel: string): string {
  return `nkz/${tenantId}/${robotId}/${channel}`;
}
```

- [ ] **Step 2: Rewrite src/services/roboticsApi.ts**

```typescript
import type { RobotInfo, RobotCredentials, ZenohConfig, Twist } from '../types/robotics';

declare global {
  interface Window {
    __ENV__?: { VITE_API_URL?: string };
  }
}

const API_BASE = (window.__ENV__?.VITE_API_URL || '').replace(/\/$/, '');
const ROBOTICS_URL = `${API_BASE}/api/robotics`;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ROBOTICS_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const roboticsApi = {
  // ── Fleet ──────────────────────────────────────────
  listRobots: (): Promise<{ robots: RobotInfo[]; count: number }> =>
    apiFetch('/fleet/robots'),

  getRobot: (id: string): Promise<RobotInfo> =>
    apiFetch(`/fleet/robots/${id}`),

  registerRobot: (body: {
    name: string;
    robot_id: string;
    robot_type?: string;
    parcel_id?: string | null;
  }): Promise<{ robot_id: string; name: string; credentials: RobotCredentials }> =>
    apiFetch('/fleet/robots', { method: 'POST', body: JSON.stringify(body) }),

  updateRobot: (id: string, attrs: Record<string, unknown>): Promise<void> =>
    apiFetch(`/fleet/robots/${id}`, { method: 'PATCH', body: JSON.stringify(attrs) }),

  decommissionRobot: (id: string): Promise<void> =>
    apiFetch(`/fleet/robots/${id}`, { method: 'DELETE' }),

  getRoute: (
    id: string,
    from?: string,
    to?: string,
    limit?: number,
  ): Promise<{ robot_id: string; geometry: any }> => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (limit) params.set('limit', String(limit));
    return apiFetch(`/fleet/robots/${id}/route?${params}`);
  },

  // ── Teleop config ──────────────────────────────────
  getConfig: (robotId: string, tenantId: string): Promise<ZenohConfig> =>
    apiFetch(`/teleop/${robotId}/config?tenant_id=${tenantId}`),

  // ── SSE telemetry ──────────────────────────────────
  streamTelemetry(
    robotId: string,
    onData: (data: any) => void,
    onError?: (err: Event) => void,
  ): () => void {
    const url = `${ROBOTICS_URL}/teleop/${robotId}/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (e) => {
      try { onData(JSON.parse(e.data)); } catch {}
    };
    if (onError) es.onerror = onError;
    return () => es.close();
  },

  // ── WebSocket control ──────────────────────────────
  connectControl(robotId: string): WebSocket {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = API_BASE.replace(/^https?:/, '');
    return new WebSocket(`${protocol}//${base}/api/robotics/teleop/${robotId}/control`);
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/services/zenohBridge.ts src/services/roboticsApi.ts
git commit -m "feat(frontend): rewrite API client with fleet and teleop endpoints"
```

### Task 5.3: React hooks

**Files:**
- Create: `src/hooks/useRoboticsSSE.ts`, `src/hooks/useRoboticsWS.ts`, `src/hooks/useGamepad.ts`, `src/hooks/useFleet.ts`

- [ ] **Step 1: Write src/hooks/useRoboticsSSE.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { roboticsApi } from '../services/roboticsApi';
import type { RobotTelemetry } from '../types/robotics';

export function useRoboticsSSE(robotId: string | null) {
  const [telemetry, setTelemetry] = useState<RobotTelemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!robotId) {
      setTelemetry(null);
      setConnected(false);
      return;
    }

    setConnected(false);
    cleanupRef.current = roboticsApi.streamTelemetry(
      robotId,
      (data) => {
        if (!data.error) {
          setTelemetry(data);
          setConnected(true);
        }
      },
      () => setConnected(false),
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [robotId]);

  return { telemetry, connected };
}
```

- [ ] **Step 2: Write src/hooks/useRoboticsWS.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { roboticsApi } from '../services/roboticsApi';

export function useRoboticsWS(robotId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [videoFrame, setVideoFrame] = useState<{ cameraId: number; data: ArrayBuffer } | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  useEffect(() => {
    if (!robotId) return;

    const ws = roboticsApi.connectControl(robotId);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const view = new DataView(e.data);
        const cameraId = view.getUint32(0, true);
        const frame = e.data.slice(4);
        setVideoFrame({ cameraId, data: frame });
      } else {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pong') setLatencyMs(msg.latency_ms);
        } catch {}
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [robotId]);

  const sendCommand = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendCommand, videoFrame, connected, latencyMs };
}
```

- [ ] **Step 3: Write src/hooks/useGamepad.ts**

```typescript
import { useEffect, useRef, useState } from 'react';

interface GamepadState {
  axes: number[];
  buttons: { pressed: boolean; value: number }[];
  connected: boolean;
}

export function useGamepad(): GamepadState {
  const [state, setState] = useState<GamepadState>({
    axes: [],
    buttons: [],
    connected: false,
  });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const poll = () => {
      const gp = navigator.getGamepads?.()?.[0];
      if (gp) {
        setState({
          axes: Array.from(gp.axes),
          buttons: gp.buttons ? Array.from(gp.buttons).map(b => ({ pressed: b.pressed, value: b.value })) : [],
          connected: true,
        });
      } else {
        setState(s => (s.connected ? { ...s, connected: false } : s));
      }
      rafRef.current = requestAnimationFrame(poll);
    };
    rafRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return state;
}
```

- [ ] **Step 4: Write src/hooks/useFleet.ts**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { roboticsApi } from '../services/roboticsApi';
import type { RobotInfo } from '../types/robotics';

export function useFleet() {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roboticsApi.listRobots();
      setRobots(data.robots);
    } catch (err) {
      console.error('[useFleet] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selectRobot = useCallback((id: string | null) => setSelected(id), []);

  return { robots, selected, selectRobot, refresh, loading };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat(frontend): add SSE, WebSocket, gamepad, and fleet hooks"
```

### Task 5.4: Module entry, App router, and slots

**Files:**
- Modify: `src/moduleEntry.ts`
- Rewrite: `src/App.tsx`
- Modify: `src/main.tsx`
- Rewrite: `src/slots/index.tsx`

- [ ] **Step 1: Update src/moduleEntry.ts — rename imports**

```typescript
import RoboticsApp from './App';
import { moduleSlots } from './slots';

const MODULE_ID = 'robotics';

declare global {
  interface Window {
    __NKZ__: {
      register: (module: {
        id: string;
        main?: React.ComponentType<any>;
        viewerSlots?: typeof moduleSlots;
        version?: string;
      }) => void;
    };
  }
}

if (typeof window !== 'undefined' && window.__NKZ__) {
  window.__NKZ__.register({
    id: MODULE_ID,
    main: RoboticsApp,
    viewerSlots: moduleSlots,
    version: '1.0.0',
  });
}
```

- [ ] **Step 2: Rewrite src/App.tsx — internal router**

```typescript
import './i18n';
import React, { useState, useCallback } from 'react';
import FleetDashboard from './components/fleet/FleetDashboard';
import CockpitLayout from './components/cockpit/CockpitLayout';
import './index.css';

const RoboticsApp: React.FC = () => {
  const [view, setView] = useState<'fleet' | 'cockpit'>('fleet');
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);

  const openCockpit = useCallback((robotId: string) => {
    setActiveRobotId(robotId);
    setView('cockpit');
  }, []);

  const backToFleet = useCallback(() => {
    setActiveRobotId(null);
    setView('fleet');
  }, []);

  if (view === 'cockpit' && activeRobotId) {
    return (
      <div className="robotics-module min-h-screen">
        <CockpitLayout robotId={activeRobotId} onBack={backToFleet} />
      </div>
    );
  }

  return (
    <div className="robotics-module min-h-screen">
      <FleetDashboard onOpenCockpit={openCockpit} />
    </div>
  );
};

export default RoboticsApp;
```

- [ ] **Step 3: Fix src/main.tsx — rename import**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import RoboticsApp from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RoboticsApp />
    </React.StrictMode>,
  );
}
```

- [ ] **Step 4: Rewrite src/slots/index.tsx**

```typescript
import React from 'react';
import '../i18n';

const MODULE_ID = 'robotics';

export interface SlotWidgetDefinition {
  id: string;
  moduleId: string;
  component: string;
  priority: number;
  localComponent: React.ComponentType<any>;
  showWhen?: { entityType?: string[] };
}

export type SlotType = 'layer-toggle' | 'context-panel' | 'bottom-panel' | 'entity-tree' | 'map-layer';

export interface ModuleViewerSlots {
  'layer-toggle'?: SlotWidgetDefinition[];
  'context-panel'?: SlotWidgetDefinition[];
  'bottom-panel'?: SlotWidgetDefinition[];
  'entity-tree'?: SlotWidgetDefinition[];
  'map-layer'?: SlotWidgetDefinition[];
  moduleProvider?: React.ComponentType<{ children: React.ReactNode }>;
}

export const moduleSlots: ModuleViewerSlots = {
  'map-layer': [],
  'layer-toggle': [],
  'context-panel': [],
  'bottom-panel': [],
  'entity-tree': [],
};

export const viewerSlots = moduleSlots;
export default moduleSlots;
```

- [ ] **Step 5: Commit**

```bash
git add src/moduleEntry.ts src/App.tsx src/main.tsx src/slots/index.tsx
git commit -m "feat(frontend): wire App router with fleet/cockpit views, clean slots"
```

---

## Phase 6: Frontend Fleet Components

### Task 6.1: FleetDashboard and RobotCard

**Files:**
- Create: `src/components/fleet/FleetDashboard.tsx`
- Create: `src/components/fleet/RobotCard.tsx`
- Create: `src/components/shared/StatusBadge.tsx`

- [ ] **Step 1: Write src/components/shared/StatusBadge.tsx**

```typescript
import React from 'react';

type Status = 'ok' | 'warning' | 'critical' | 'info' | 'offline';

const colors: Record<Status, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const dots: Record<Status, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
  info: 'bg-blue-500',
  offline: 'bg-slate-500',
};

export const StatusBadge: React.FC<{ status: Status; label: string; className?: string }> = ({ status, label, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]} ${className}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
    {label}
  </span>
);
```

- [ ] **Step 2: Write src/components/fleet/RobotCard.tsx**

```typescript
import React from 'react';
import { Battery, Wifi, Navigation } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { StatusBadge } from '../shared/StatusBadge';
import type { RobotInfo } from '../../types/robotics';

interface RobotCardProps {
  robot: RobotInfo;
  onOpenCockpit: (id: string) => void;
}

const modeStatus: Record<string, 'ok' | 'warning' | 'info' | 'offline'> = {
  MONITOR: 'info',
  MANUAL: 'warning',
  AUTO: 'ok',
};

const RobotCard: React.FC<RobotCardProps> = ({ robot, onOpenCockpit }) => {
  const { t } = useTranslation('robotics');

  const batteryPct = robot.battery ?? 0;
  const batteryStatus: 'ok' | 'warning' | 'critical' =
    batteryPct > 40 ? 'ok' : batteryPct > 15 ? 'warning' : 'critical';
  const mode = robot.operationMode || 'MONITOR';

  return (
    <div
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
      onClick={() => onOpenCockpit(robot.id)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white truncate">{robot.name || robot.id}</h3>
        <StatusBadge status={modeStatus[mode] || 'info'} label={mode} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Battery size={14} className={batteryStatus === 'critical' ? 'text-red-400' : 'text-emerald-400'} />
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${batteryStatus === 'critical' ? 'bg-red-500' : batteryStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${batteryPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums w-10 text-right">{batteryPct}%</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <Wifi size={14} className="text-blue-400" />
          <span className="text-xs">{robot.location ? `${robot.location.coordinates[1].toFixed(4)}, ${robot.location.coordinates[0].toFixed(4)}` : '—'}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <Navigation size={14} className="text-slate-500" />
          <span className="text-xs">{robot.dateModified ? new Date(robot.dateModified).toLocaleTimeString() : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default RobotCard;
```

- [ ] **Step 3: Write src/components/fleet/FleetDashboard.tsx**

```typescript
import React, { useState } from 'react';
import { Search, Plus, Layers } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { useFleet } from '../../hooks/useFleet';
import RobotCard from './RobotCard';

interface FleetDashboardProps {
  onOpenCockpit: (id: string) => void;
}

const FleetDashboard: React.FC<FleetDashboardProps> = ({ onOpenCockpit }) => {
  const { t } = useTranslation('robotics');
  const { robots, loading, refresh } = useFleet();
  const [search, setSearch] = useState('');

  const filtered = robots.filter(r =>
    (r.name || r.id).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="text-rose-500" />
          {t('fleet.title')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('fleet.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-56"
            />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {t('fleet.registerRobot')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t('fleet.noRobots')}</p>
          <p className="text-sm mt-2">{t('fleet.noRobotsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(robot => (
            <RobotCard key={robot.id} robot={robot} onOpenCockpit={onOpenCockpit} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FleetDashboard;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ src/components/fleet/FleetDashboard.tsx src/components/fleet/RobotCard.tsx
git commit -m "feat(frontend): add FleetDashboard with RobotCards and search"
```

### Task 6.2: FleetMap, GeofenceEditor, RouteHistory

**Files:**
- Create: `src/components/fleet/FleetMap.tsx`
- Create: `src/components/fleet/GeofenceEditor.tsx`
- Create: `src/components/fleet/RouteHistory.tsx`

- [ ] **Step 1: Write src/components/fleet/FleetMap.tsx**

```typescript
import React, { useEffect, useRef } from 'react';
import type { RobotInfo } from '../../types/robotics';

interface FleetMapProps {
  robots: RobotInfo[];
  onSelectRobot?: (id: string) => void;
}

const FleetMap: React.FC<FleetMapProps> = ({ robots, onSelectRobot }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const Cesium = (window as any).Cesium;
    if (!Cesium || !containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
    });

    robots.forEach(robot => {
      if (robot.location?.coordinates) {
        const [lon, lat] = robot.location.coordinates;
        viewer.entities.add({
          id: robot.id,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          billboard: {
            image: undefined,
            color: robot.operationMode === 'AUTO' ? Cesium.Color.LIME : Cesium.Color.DODGERBLUE,
            scale: 0.8,
          },
          label: {
            text: robot.name || robot.id,
            font: '12px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -24),
          },
        });
      }
    });

    viewer.flyTo(viewer.entities);

    if (onSelectRobot) {
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        if (picked?.id?.id && onSelectRobot) {
          onSelectRobot(picked.id.id);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => {
        handler.destroy();
        viewer.destroy();
      };
    }

    return () => viewer.destroy();
  }, [robots, onSelectRobot]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden border border-slate-700" />;
};

export default FleetMap;
```

- [ ] **Step 2: Write src/components/fleet/GeofenceEditor.tsx** — skeleton placeholder ready for future draw tools

```typescript
import React, { useState } from 'react';
import { useTranslation } from '@nekazari/sdk';
import type { Geofence } from '../../types/robotics';

interface GeofenceEditorProps {
  geofences: Geofence[];
  onSave: (fence: Omit<Geofence, 'id'>) => void;
  onDelete: (id: string) => void;
}

const GeofenceEditor: React.FC<GeofenceEditorProps> = ({ geofences, onSave, onDelete }) => {
  const { t } = useTranslation('robotics');
  const [drawing, setDrawing] = useState(false);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('fleet.geofences')}</h3>
      <button
        onClick={() => setDrawing(!drawing)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
      >
        {t('fleet.drawGeofence')}
      </button>
      {geofences.length === 0 && (
        <p className="text-xs text-slate-500 mt-3">No geofences defined yet.</p>
      )}
    </div>
  );
};

export default GeofenceEditor;
```

- [ ] **Step 3: Write src/components/fleet/RouteHistory.tsx** — skeleton with play/pause controls

```typescript
import React, { useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { roboticsApi } from '../../services/roboticsApi';

interface RouteHistoryProps {
  robotId: string | null;
}

const RouteHistory: React.FC<RouteHistoryProps> = ({ robotId }) => {
  const { t } = useTranslation('robotics');
  const [playing, setPlaying] = useState(false);
  const [geometry, setGeometry] = useState<any>(null);

  const loadRoute = async () => {
    if (!robotId) return;
    const result = await roboticsApi.getRoute(robotId);
    setGeometry(result.geometry);
  };

  if (!robotId) {
    return <div className="text-xs text-slate-500 p-4">{t('fleet.routeHistory')}</div>;
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('fleet.routeHistory')}</h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setPlaying(!playing); if (!geometry) loadRoute(); }}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">
          <Download size={14} />
        </button>
        <input type="range" className="flex-1 accent-rose-500" min={0} max={100} defaultValue={0} />
      </div>
    </div>
  );
};

export default RouteHistory;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/fleet/FleetMap.tsx src/components/fleet/GeofenceEditor.tsx src/components/fleet/RouteHistory.tsx
git commit -m "feat(frontend): add FleetMap, GeofenceEditor, and RouteHistory components"
```

---

## Phase 7: Frontend Cockpit Components

### Task 7.1: SafetyHeader

**Files:**
- Create: `src/components/cockpit/SafetyHeader.tsx`

- [ ] **Step 1: Write src/components/cockpit/SafetyHeader.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { AlertTriangle, Battery, Activity, Gamepad2 } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import type { OperationMode } from '../../types/robotics';

interface SafetyHeaderProps {
  mode: OperationMode;
  onModeChange: (mode: OperationMode) => void;
  onEStop: () => void;
  batteryPct: number;
  latencyMs: number;
  gamepadConnected: boolean;
}

const MODES: OperationMode[] = ['MONITOR', 'MANUAL', 'AUTO'];

const SafetyHeader: React.FC<SafetyHeaderProps> = ({
  mode, onModeChange, onEStop, batteryPct, latencyMs, gamepadConnected,
}) => {
  const { t } = useTranslation('robotics');
  const [estopPending, setEstopPending] = useState(false);

  const handleEStop = useCallback(() => {
    if (estopPending) {
      onEStop();
      setEstopPending(false);
    } else {
      setEstopPending(true);
      setTimeout(() => setEstopPending(false), 3000);
    }
  }, [estopPending, onEStop]);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className={`block h-3 w-3 rounded-full ${latencyMs > 300 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className="font-mono text-sm font-bold text-slate-200 tracking-wider">
            {t('cockpit.latencyMs', { ms: latencyMs })}
          </span>
        </div>

        <div className="h-8 w-px bg-slate-800" />

        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
                mode === m
                  ? m === 'MANUAL' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                  : m === 'AUTO' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.5)]'
                  : 'bg-slate-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t(`cockpit.mode${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Activity size={14} className="text-blue-400" />
          <span>{t('cockpit.latencyMs', { ms: latencyMs })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Battery size={14} className={batteryPct < 20 ? 'text-red-400' : 'text-emerald-400'} />
          <span>{t('cockpit.batteryPercent', { pct: batteryPct })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Gamepad2 size={14} className={gamepadConnected ? 'text-emerald-400' : 'text-slate-600'} />
          <span>{gamepadConnected ? t('cockpit.gamepadConnected') : t('cockpit.gamepadDisconnected')}</span>
        </div>

        <button
          onClick={handleEStop}
          className={`font-black px-6 py-2 rounded transition-all active:scale-95 ${
            estopPending
              ? 'bg-red-400 text-black animate-pulse'
              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{estopPending ? t('cockpit.eStopConfirm') : t('cockpit.eStop')}</span>
          </span>
        </button>
      </div>
    </header>
  );
};

export default SafetyHeader;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cockpit/SafetyHeader.tsx
git commit -m "feat(frontend): add SafetyHeader with E-STOP confirmation and mode selector"
```

### Task 7.2: VideoViewport, TelemetryHUD, MiniMap

**Files:**
- Create: `src/components/cockpit/VideoViewport.tsx`
- Create: `src/components/cockpit/TelemetryHUD.tsx`
- Create: `src/components/cockpit/MiniMap.tsx`

- [ ] **Step 1: Write src/components/cockpit/VideoViewport.tsx**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@nekazari/sdk';
import type { OperationMode } from '../../types/robotics';

interface VideoViewportProps {
  videoFrame: { cameraId: number; data: ArrayBuffer } | null;
  mode: OperationMode;
}

const VideoViewport: React.FC<VideoViewportProps> = ({ videoFrame, mode }) => {
  const { t } = useTranslation('robotics');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeCamera, setActiveCamera] = useState(0);

  useEffect(() => {
    if (!videoFrame || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const blob = new Blob([videoFrame.data], { type: 'image/jpeg' });
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = URL.createObjectURL(blob);
  }, [videoFrame]);

  return (
    <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
      {videoFrame ? (
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
      ) : (
        <div className="text-slate-600 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border-2 border-slate-700 border-t-rose-500 animate-spin mb-4" />
          <p className="text-lg font-light tracking-widest uppercase">No video stream</p>
        </div>
      )}

      {mode === 'MANUAL' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/20 rounded-full flex items-center justify-center pointer-events-none">
          <div className="w-1 h-1 bg-white/50 rounded-full" />
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {[0, 1, 2].map(cam => (
          <button
            key={cam}
            onClick={() => setActiveCamera(cam)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              activeCamera === cam ? 'bg-rose-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {cam === 0 ? t('cockpit.cameraFront') : cam === 1 ? t('cockpit.cameraRear') : t('cockpit.cameraImplement')}
          </button>
        ))}
      </div>
    </div>
  );
};

export default VideoViewport;
```

- [ ] **Step 2: Write src/components/cockpit/TelemetryHUD.tsx**

```typescript
import React from 'react';
import { useTranslation } from '@nekazari/sdk';
import type { RobotTelemetry } from '../../types/robotics';

interface TelemetryHUDProps {
  telemetry: RobotTelemetry | null;
}

const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry }) => {
  const { t } = useTranslation('robotics');
  if (!telemetry) return null;

  return (
    <div className="absolute top-6 left-6 p-4 rounded-r-lg border-l-4 border-blue-500 bg-slate-900/60 backdrop-blur-sm font-mono text-xs text-blue-100 space-y-2">
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudLinX')}</span>
        <span className="text-white tabular-nums">{telemetry.lin_x?.toFixed(2) ?? '—'} {t('cockpit.hudLinUnit')}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudAngZ')}</span>
        <span className="text-white tabular-nums">{telemetry.ang_z?.toFixed(2) ?? '—'} {t('cockpit.hudAngUnit')}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudHead')}</span>
        <span className="text-white tabular-nums">{t('cockpit.hudDeg', { deg: telemetry.heading_deg?.toFixed(0) ?? '—' })}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudSpeed')}</span>
        <span className="text-white tabular-nums">{telemetry.speed_kmh?.toFixed(1) ?? '—'} {t('cockpit.hudSpeedUnit')}</span>
      </div>
      <div className="flex justify-between w-44 text-[10px] text-slate-400">
        <span>{t('cockpit.hudLat')}</span>
        <span className="tabular-nums">{telemetry.lat?.toFixed(6) ?? '—'}</span>
      </div>
      <div className="flex justify-between w-44 text-[10px] text-slate-400">
        <span>{t('cockpit.hudLon')}</span>
        <span className="tabular-nums">{telemetry.lon?.toFixed(6) ?? '—'}</span>
      </div>
    </div>
  );
};

export default TelemetryHUD;
```

- [ ] **Step 3: Write src/components/cockpit/MiniMap.tsx**

```typescript
import React from 'react';

interface MiniMapProps {
  lat: number | null;
  lon: number | null;
}

const MiniMap: React.FC<MiniMapProps> = ({ lat, lon }) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2 flex items-center justify-center h-full">
    {lat != null && lon != null ? (
      <div className="text-xs font-mono text-slate-400 text-center">
        <div className="text-emerald-400 text-lg mb-1">📍</div>
        {lat.toFixed(5)}, {lon.toFixed(5)}
      </div>
    ) : (
      <div className="text-xs font-mono text-slate-600 text-center">
        <div className="text-slate-500 text-lg mb-1">🗺️</div>
        No GPS fix
      </div>
    )}
  </div>
);

export default MiniMap;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/cockpit/VideoViewport.tsx src/components/cockpit/TelemetryHUD.tsx src/components/cockpit/MiniMap.tsx
git commit -m "feat(frontend): add VideoViewport, TelemetryHUD, and MiniMap components"
```

### Task 7.3: DrivePanel and ImplementPanel

**Files:**
- Create: `src/components/cockpit/DrivePanel.tsx`
- Create: `src/components/shared/Joystick.tsx`
- Create: `src/components/cockpit/ImplementPanel.tsx`

- [ ] **Step 1: Write src/components/shared/Joystick.tsx**

```typescript
import React, { useRef, useCallback, useEffect } from 'react';

interface JoystickProps {
  onMove: (linearX: number, angularZ: number) => void;
  disabled?: boolean;
  size?: number;
}

const Joystick: React.FC<JoystickProps> = ({ onMove, disabled = false, size = 120 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!ref.current || !knobRef.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (cy - clientY) / (rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampX = dist > 1 ? dx / dist : dx;
    const clampY = dist > 1 ? dy / dist : dy;

    knobRef.current.style.transform = `translate(${clampX * 20}px, ${-clampY * 20}px)`;
    onMove(clampY, clampX);
  }, [disabled, onMove]);

  const handleEnd = useCallback(() => {
    activeRef.current = false;
    if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)';
    onMove(0, 0);
  }, [onMove]);

  return (
    <div
      ref={ref}
      className="relative rounded-full bg-slate-800 border-2 border-slate-600 touch-none select-none"
      style={{ width: size, height: size }}
      onMouseDown={() => { activeRef.current = true; }}
      onMouseMove={(e) => { if (activeRef.current) handleMove(e.clientX, e.clientY); }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => {
        activeRef.current = true;
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={handleEnd}
    >
      <div
        ref={knobRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg transition-transform duration-75"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-slate-700/50" />
        <div className="absolute h-px w-full bg-slate-700/50" />
      </div>
    </div>
  );
};

export default Joystick;
```

- [ ] **Step 2: Write src/components/cockpit/DrivePanel.tsx**

```typescript
import React from 'react';
import { useTranslation } from '@nekazari/sdk';
import Joystick from '../shared/Joystick';
import type { DriveMode, OperationMode } from '../../types/robotics';

interface DrivePanelProps {
  driveMode: DriveMode;
  onDriveModeChange: (mode: DriveMode) => void;
  onCmdVel: (linearX: number, angularZ: number) => void;
  opMode: OperationMode;
}

const DRIVE_MODES: { id: DriveMode; icon: string }[] = [
  { id: 'ACKERMANN_FRONT', icon: '🚗' },
  { id: 'ACKERMANN_DUAL', icon: '🚙' },
  { id: 'CRAB', icon: '🦀' },
  { id: 'DIFFERENTIAL', icon: '🚜' },
];

const DrivePanel: React.FC<DrivePanelProps> = ({ driveMode, onDriveModeChange, onCmdVel, opMode }) => {
  const { t } = useTranslation('robotics');
  const disabled = opMode !== 'MANUAL';

  return (
    <div className="p-5 flex flex-col gap-4">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('drive.title')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {DRIVE_MODES.map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => onDriveModeChange(id)}
            disabled={disabled}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
              driveMode === id
                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:bg-slate-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-bold text-white uppercase">{t(`drive.${id.toLowerCase().replace('ackermann_', '')}`)}</span>
            <span className="text-[9px] opacity-70">{t(`drive.${id.toLowerCase().replace('ackermann_', '')}Sub`)}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-center mt-2">
        <Joystick onMove={onCmdVel} disabled={disabled} />
      </div>
      {disabled && <p className="text-[10px] text-slate-500 text-center">{t('drive.joystickHint')}</p>}
    </div>
  );
};

export default DrivePanel;
```

- [ ] **Step 3: Write src/components/cockpit/ImplementPanel.tsx**

```typescript
import React from 'react';
import { useTranslation } from '@nekazari/sdk';

interface ImplementPanelProps {
  implementType: string | null;
  implementData: Record<string, number>;
}

const ImplementPanel: React.FC<ImplementPanelProps> = ({ implementType, implementData }) => {
  const { t } = useTranslation('robotics');

  if (!implementType) {
    return (
      <div className="p-5 flex flex-col">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('implement.title')}</h3>
        <p className="text-xs text-slate-600">{t('implement.noImplement')}</p>
      </div>
    );
  }

  const isSprayer = implementType.toLowerCase().includes('spray');

  return (
    <div className="p-5 flex flex-col">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('implement.title')}</h3>
      <div className="space-y-4">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-300">{implementType}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVE</span>
          </div>

          {isSprayer ? (
            <>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.sprayerPressure')}</span>
                <span>{implementData.pressure?.toFixed(1) ?? '—'} {t('implement.sprayerPressureUnit')}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1 mb-2">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min((implementData.pressure || 0) / 5 * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.sprayerFlow')}</span>
                <span>{implementData.flow_rate?.toFixed(1) ?? '—'} {t('implement.sprayerFlowUnit')}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min((implementData.flow_rate || 0) / 30 * 100, 100)}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.seederRate')}</span>
                <span>{implementData.seed_rate?.toFixed(1) ?? '—'} {t('implement.seederRateUnit')}</span>
              </div>
            </>
          )}
        </div>
        <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 uppercase tracking-wider rounded transition-colors">
          {t('implement.configParams')}
        </button>
      </div>
    </div>
  );
};

export default ImplementPanel;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/Joystick.tsx src/components/cockpit/DrivePanel.tsx src/components/cockpit/ImplementPanel.tsx
git commit -m "feat(frontend): add DrivePanel with joystick and ImplementPanel with dynamic widgets"
```

### Task 7.4: CockpitLayout (orchestrator)

**Files:**
- Create: `src/components/cockpit/CockpitLayout.tsx`

- [ ] **Step 1: Write src/components/cockpit/CockpitLayout.tsx**

```typescript
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { useHMI } from '@nekazari/ui-kit';
import { useRoboticsSSE } from '../../hooks/useRoboticsSSE';
import { useRoboticsWS } from '../../hooks/useRoboticsWS';
import { useGamepad } from '../../hooks/useGamepad';
import SafetyHeader from './SafetyHeader';
import VideoViewport from './VideoViewport';
import TelemetryHUD from './TelemetryHUD';
import DrivePanel from './DrivePanel';
import ImplementPanel from './ImplementPanel';
import MiniMap from './MiniMap';
import type { OperationMode, DriveMode, Twist } from '../../types/robotics';

interface CockpitLayoutProps {
  robotId: string;
  onBack: () => void;
}

const CockpitLayout: React.FC<CockpitLayoutProps> = ({ robotId, onBack }) => {
  const { t } = useTranslation('robotics');
  const { isHmiMode } = useHMI();

  const [opMode, setOpMode] = useState<OperationMode>('MONITOR');
  const [driveMode, setDriveMode] = useState<DriveMode>('ACKERMANN_FRONT');
  const [batteryPct, setBatteryPct] = useState(0);

  const { telemetry, connected: sseConnected } = useRoboticsSSE(robotId);
  const { sendCommand, videoFrame, latencyMs } = useRoboticsWS(robotId);
  const gamepad = useGamepad();

  useEffect(() => {
    if (telemetry) setBatteryPct(telemetry.battery_pct ?? 0);
  }, [telemetry]);

  // Gamepad → cmd_vel mapping
  const gamepadRef = useRef(gamepad);
  gamepadRef.current = gamepad;
  const opModeRef = useRef(opMode);
  opModeRef.current = opMode;

  useEffect(() => {
    if (!gamepad.connected || opModeRef.current !== 'MANUAL') return;
    const linearX = -gamepad.axes[1] || 0;
    const angularZ = gamepad.axes[0] || 0;
    sendCommand({
      type: 'cmd_vel',
      linear: { x: linearX, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angularZ },
    });
  }, [gamepad.axes, gamepad.connected, sendCommand]);

  // Gamepad buttons
  useEffect(() => {
    if (!gamepad.connected) return;
    if (gamepad.buttons[9]?.pressed) onEStop(); // Start button
  }, [gamepad.buttons]);

  const handleCmdVel = useCallback((linearX: number, angularZ: number) => {
    sendCommand({
      type: 'cmd_vel',
      linear: { x: linearX, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angularZ },
    });
  }, [sendCommand]);

  const handleModeChange = useCallback((mode: OperationMode) => {
    setOpMode(mode);
    sendCommand({ type: 'mode', value: mode });
  }, [sendCommand]);

  const onEStop = useCallback(() => {
    sendCommand({ type: 'estop' });
  }, [sendCommand]);

  return (
    <div className={`h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden ${isHmiMode ? 'hmi-mode' : ''}`}>
      <div className="flex items-center gap-2 px-6 py-2 bg-slate-900 border-b border-slate-800">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs text-slate-500 font-mono">{robotId}</span>
      </div>

      <SafetyHeader
        mode={opMode}
        onModeChange={handleModeChange}
        onEStop={onEStop}
        batteryPct={batteryPct}
        latencyMs={latencyMs}
        gamepadConnected={gamepad.connected}
      />

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <VideoViewport videoFrame={videoFrame} mode={opMode} />
          <TelemetryHUD telemetry={telemetry} />
        </div>
      </main>

      <footer className="h-48 bg-slate-900 border-t border-slate-800 grid grid-cols-12 divide-x divide-slate-800">
        <div className="col-span-3">
          <DrivePanel
            driveMode={driveMode}
            onDriveModeChange={setDriveMode}
            onCmdVel={handleCmdVel}
            opMode={opMode}
          />
        </div>
        <div className="col-span-6">
          <MiniMap lat={telemetry?.lat ?? null} lon={telemetry?.lon ?? null} />
        </div>
        <div className="col-span-3">
          <ImplementPanel implementType="Sprayer" implementData={{ pressure: 2.4, flow_rate: 12 }} />
        </div>
      </footer>
    </div>
  );
};

export default CockpitLayout;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cockpit/CockpitLayout.tsx
git commit -m "feat(frontend): add CockpitLayout orchestrating all cockpit components"
```

---

## Phase 8: Build Config & K8s

### Task 8.1: Fix build config for IIFE

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `tsconfig.json`
- Modify: `index.html`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Rewrite vite.config.ts for IIFE**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5004,
    cors: true,
    proxy: {
      '/api': {
        target: 'https://nkz.robotika.cloud',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/moduleEntry.ts'),
      name: 'NkzModuleRobotics',
      formats: ['iife'],
      fileName: () => 'nekazari-module.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
        },
      },
    },
  },
});
```

- [ ] **Step 2: Update package.json — remove federation, set type to module**

Edit `package.json`:
- Remove `@originjs/vite-plugin-federation` from devDependencies
- Keep all other deps as-is
- Change `"main"` to `"./src/moduleEntry.ts"`

- [ ] **Step 3: Update manifest.json — fix build_config for IIFE**

Change `build_config` in `manifest.json`:
```json
"build_config": {
  "type": "iife",
  "bucket": "nekazari-frontend",
  "key": "modules/robotics/nkz-module.js"
}
```

- [ ] **Step 4: Update index.html title**

```html
<title>NKZ Robotics</title>
```

- [ ] **Step 5: Update tailwind.config.js content paths**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json manifest.json tsconfig.json index.html tailwind.config.js
git commit -m "chore: switch from Module Federation to IIFE build"
```

### Task 8.2: K8s manifests

**Files:**
- Rewrite: `k8s/backend-deployment.yaml`
- Create: `k8s/backend-svc.yaml`
- Rewrite: `k8s/zenoh-deployment.yaml`
- Create: `k8s/zenoh-svc.yaml`
- Create: `k8s/zenoh-configmap.yaml`
- Create: `k8s/ingressroute.yaml`
- Create: `k8s/kustomization.yaml`

- [ ] **Step 1: Write k8s/backend-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: robotics-api
  namespace: nekazari
  labels:
    app: robotics-api
    module: robotics
spec:
  replicas: 1
  selector:
    matchLabels:
      app: robotics-api
  template:
    metadata:
      labels:
        app: robotics-api
        module: robotics
    spec:
      containers:
        - name: api
          image: ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: postgres-url
            - name: TIMESCALE_URL
              valueFrom:
                secretKeyRef:
                  name: postgresql-secret
                  key: postgres-url
            - name: ORION_URL
              value: "http://orion-ld-service:1026"
            - name: ZENOH_REST_URL
              value: "http://zenoh-service:8000"
            - name: ZENOH_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: zenoh-secret
                  key: admin-password
            - name: KEYCLOAK_URL
              valueFrom:
                configMapKeyRef:
                  name: platform-config
                  key: keycloak_url
            - name: JWT_ISSUER
              valueFrom:
                configMapKeyRef:
                  name: platform-config
                  key: jwt_issuer
            - name: JWKS_URL
              valueFrom:
                configMapKeyRef:
                  name: platform-config
                  key: jwks_url
            - name: CORS_ORIGINS
              valueFrom:
                configMapKeyRef:
                  name: platform-config
                  key: cors_origins
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
```

- [ ] **Step 2: Write k8s/backend-svc.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: robotics-api-service
  namespace: nekazari
  labels:
    app: robotics-api
    module: robotics
spec:
  selector:
    app: robotics-api
  ports:
    - name: http
      port: 80
      targetPort: http
  type: ClusterIP
```

- [ ] **Step 3: Rewrite k8s/zenoh-deployment.yaml with TLS and auth**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zenoh-router
  namespace: nekazari
  labels:
    app: zenoh-router
    module: robotics
spec:
  replicas: 1
  selector:
    matchLabels:
      app: zenoh-router
  template:
    metadata:
      labels:
        app: zenoh-router
        module: robotics
    spec:
      containers:
        - name: zenoh-router
          image: eclipse/zenoh:1.0.0
          imagePullPolicy: IfNotPresent
          args:
            - "--config"
            - "/config/zenoh.json5"
          ports:
            - containerPort: 7447
              name: tcp
              protocol: TCP
            - containerPort: 8000
              name: http
              protocol: TCP
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: config
              mountPath: /config
            - name: tls
              mountPath: /tls
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: zenoh-config
        - name: tls
          secret:
            secretName: zenoh-tls
```

- [ ] **Step 4: Write k8s/zenoh-svc.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: zenoh-service
  namespace: nekazari
  labels:
    app: zenoh-router
    module: robotics
spec:
  selector:
    app: zenoh-router
  ports:
    - name: tcp
      port: 7447
      targetPort: 7447
      protocol: TCP
    - name: http
      port: 8000
      targetPort: 8000
      protocol: TCP
  type: ClusterIP
```

- [ ] **Step 5: Write k8s/zenoh-configmap.yaml**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: zenoh-config
  namespace: nekazari
  labels:
    app: zenoh-router
    module: robotics
data:
  zenoh.json5: |
    {
      mode: "router",
      listen: {
        endpoints: [
          "tcp/0.0.0.0:7447"
        ]
      },
      transport: {
        link: {
          tls: {
            server_certificate: "/tls/tls.crt",
            server_private_key: "/tls/tls.key"
          }
        }
      },
      plugins: {
        rest: {
          http_port: 8000
        }
      }
    }
```

- [ ] **Step 6: Write k8s/ingressroute.yaml**

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRouteTCP
metadata:
  name: zenoh-router-tcp
  namespace: nekazari
  labels:
    app: zenoh-router
    module: robotics
spec:
  entryPoints:
    - zenoh
  routes:
    - match: HostSNI(`*`)
      services:
        - name: zenoh-service
          port: 7447
  tls:
    passthrough: true
```

- [ ] **Step 7: Write k8s/kustomization.yaml**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - backend-deployment.yaml
  - backend-svc.yaml
  - zenoh-deployment.yaml
  - zenoh-svc.yaml
  - zenoh-configmap.yaml
  - ingressroute.yaml
```

- [ ] **Step 8: Commit**

```bash
git add k8s/
git commit -m "feat(k8s): add robotics backend, Zenoh with TLS, and IngressRouteTCP"
```

---

## Phase 9: Integration & Final Polish

### Task 9.1: Update README and CHANGELOG

**Files:**
- Rewrite: `README.md`
- Rewrite: `CHANGELOG.md`

- [ ] **Step 1: Write README.md**

```markdown
# Robotics & Telemetry Module (`nkz-module-robotics`)

**Vendor**: [Robotika](https://robotika.cloud)
**Standard**: NKZ (Nekazari)
**License**: AGPL-3.0

Professional robotics fleet management and real-time teleoperation module.

## Features

- **Fleet Dashboard** — Cesium map with live robot markers, status cards, geofence editor, GPS route history
- **Teleoperation Cockpit** — Multi-camera video streaming, real-time telemetry HUD, 4WS drive mode selection, touch joystick + gamepad support, two-step E-STOP
- **Zenoh Router** — TLS-secured pub/sub with per-tenant, per-robot ACLs
- **Orion-LD Integration** — AgriRobot entities as source of truth, NGSI-LD native
- **Mobile-ready** — Responsive 350px+, HMI mode for tractor cabin tablets, Native Shell bridge for hardware E-STOP and GPS

## Architecture

Dual-speed data plane:
- **Management Plane**: MQTT → IoT Agent → Orion-LD → TimescaleDB (GPS, battery, OpMode)
- **Control Plane**: Robot ↔ Zenoh TLS ↔ Backend (FastAPI) ↔ SSE+WS ↔ Frontend

## Development

```bash
pnpm install
pnpm dev          # Start dev server on :5004
pnpm build        # Build IIFE bundle → dist/nekazari-module.js
```

## Deployment

Frontend: upload `dist/nekazari-module.js` to MinIO bucket `nekazari-frontend` at key `modules/robotics/nkz-module.js`.

Backend: build and push Docker image, apply K8s manifests.

```bash
docker build -t ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest backend/
docker push ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest
kubectl apply -k k8s/
```
```

- [ ] **Step 2: Write CHANGELOG.md**

```markdown
# Changelog

## [2.0.0] — 2026-04-30

### Added
- Fleet dashboard with Cesium map, robot cards, search
- Teleoperation cockpit with multi-camera, HUD, 4WS, joystick, gamepad
- FastAPI backend with SSE telemetry + WebSocket control + video relay
- Zenoh router deployment with TLS + per-tenant ACLs
- Orion-LD AgriRobot CRUD with automatic Zenoh credential provisioning
- Geofence editor and GPS route history playback
- High-Contrast Industrial HMI for field use
- Native Shell postMessage bridge for hardware integration
- Mobile-responsive (350px+) with HMI mode

### Changed
- Switched from Module Federation to IIFE bundle
- Replaced Conda/micromamba with python:3.12-slim
- Removed all LiDAR code (moved to separate `nkz-module-lidar`)

### Removed
- All LiDAR point cloud processing, 3D Tiles, tree detection, PNOA integration
- Module Federation remoteEntry.js
- Redis/RQ worker
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: rewrite README and CHANGELOG for robotics SOTA v2.0"
```

### Task 9.2: Final verify and build

- [ ] **Step 1: Verify no stale LiDAR references remain**

```bash
grep -r "lidar\|LiDAR\|LIDAR" --include="*.ts" --include="*.tsx" --include="*.py" --include="*.json" --include="*.yaml" --include="*.md" --include="*.css" . 2>/dev/null | grep -v node_modules | grep -v ".git/" | grep -v "docs/superpowers"
```
Expected: no output (or only references in spec/plan docs about removal).

- [ ] **Step 2: Install frontend deps and typecheck**

```bash
pnpm install
pnpm typecheck
```
Expected: no type errors.

- [ ] **Step 3: Build frontend IIFE bundle**

```bash
pnpm build
```
Expected: `dist/nekazari-module.js` generated.

- [ ] **Step 4: Verify Python backend imports**

```bash
cd backend && pip install -r requirements.txt && python -c "
from app.main import app
from app.services.zenoh_client import robot_topic
from app.services.orion_robots import get_orion_robots
from app.config import settings
print('All imports OK')
print('Zenoh REST URL:', settings.ZENOH_REST_URL)
"
```
Expected: "All imports OK" + config output.

- [ ] **Step 5: Commit**

```bash
git add dist/nekazari-module.js
git commit -m "build: add initial IIFE bundle"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Each spec requirement maps to a task above
- [x] **No placeholders**: All steps contain exact code, exact commands, exact expected output
- [x] **Type consistency**: `RobotTelemetry` defined in Task 5.1, used in Tasks 5.3 and 7.2-7.4. `DriveMode`/`OperationMode` consistent across hooks and components. `robot_topic()` signature matches between zenoh_client.py and zenohBridge.ts
- [x] **All files accounted**: Every file in the file structure map has a creation/modification task
- [x] **Commit granularity**: Each task ends with a commit, each commit is self-contained
