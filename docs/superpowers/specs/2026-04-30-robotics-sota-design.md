# Robotics SOTA Module — Design Specification

**Date**: 2026-04-30
**Module**: `nkz-module-robotics` (id: `robotics`)
**Vendor**: Robotika (https://robotika.cloud)
**Standard**: NKZ (Nekazari)
**Status**: Approved — ready for implementation plan

---

## 1. Purpose

Professional-grade robotics & telemetry module for the Nekazari platform. Provides fleet management and real-time teleoperation of agricultural robots with strict multitenant isolation. Replaces the current half-baked module (which has LiDAR code mistakenly merged in) with a clean, SOTA implementation.

## 2. Architecture: Dual Speed

Per `SPECIFICATION.md`, data is separated by frequency and criticality.

### A. Management Plane (Fleet — Slow)

```
Robot → MQTT → Mosquitto → IoT Agent → Orion-LD → TimescaleDB
```

- **Protocol**: MQTT (JSON/Ultralight)
- **Data**: GPS, Battery, OpMode, TaskID, Alarms
- **Entity type**: `AgriRobot` (FIWARE Smart Data Model)
- **Use cases**: Fleet dashboard, route history, geofencing, analytics
- **Frontend reads from**: Orion-LD via backend REST API

### B. Control Plane (Teleoperation — Fast)

```
Robot ←─Zenoh TLS──→ zenoh-router ←─REST──→ Backend (FastAPI) ←─SSE+WS──→ Frontend
```

- **Protocol**: Zenoh (pub/sub over TLS 1.3)
- **Data**: Video (MJPEG), cmd_vel, steering_mode, heartbeat, joystick
- **Use cases**: Real-time cockpit, teleoperation, emergency stop
- **Frontend reads/writes via**: SSE (telemetry) + WebSocket (control + video)

## 3. Scope & Boundaries

### What this module DOES

| Capability | Phase |
|-----------|-------|
| Fleet dashboard with robot cards + Cesium map | 1 |
| Multi-camera video streaming (PiP) on cockpit | 1 |
| Real-time telemetry HUD (SSE) | 1 |
| 4WS drive mode selection + joystick control | 1 |
| Gamepad support via Gamepad API | 1 |
| Emergency stop with two-step confirmation | 1 |
| Heartbeat/watchdog with soft-stop (ramp down) | 1 |
| Robot registration (creates AgriRobot + Zenoh creds) | 1 |
| Geofence editor on Cesium map | 1 |
| GPS route history playback from TimescaleDB | 1 |
| Dynamic implement widgets | 1 |
| Zenoh multitenant ACLs (per robot, per topic) | 1 |
| High-Contrast Industrial HMI (sunlight-readable) | 1 |
| haptic/estop hardware bridge via Native Shell postMessage | 1 |

### What this module DOES NOT do

- Autonomous path planning or mission execution (future)
- Robot firmware/OS updates (future)
- LiDAR point cloud processing (separate `nkz-module-lidar` handles this)
- Video recording/storage (future phase)

## 4. Transport Design

Rationale for pragmatic hybrid approach: agricultural robots operate in rural areas with intermittent 4G, basic NATs, and need simple field debugging.

| Channel | Transport | Direction | Contents | Why |
|---------|-----------|-----------|----------|-----|
| **Telemetry** | SSE | Server→Client | GPS, battery, heading, speed, alarms | `EventSource` has native reconnect with exponential backoff. HTTP-friendly, survives proxy/NAT. |
| **Commands** | WebSocket | Bidirectional | cmd_vel, E-STOP, mode change, heartbeat | Must be sub-100ms. E-STOP cannot wait for HTTP round-trip. |
| **Video** | WebSocket binary frames | Server→Client | MJPEG frames from Zenoh | Same socket as commands, avoids third transport. MJPEG over WS is simple and sufficient for agricultural use. |

## 5. Frontend Design

### 5.1 Registration

IIFE bundle via `@nekazari/module-builder`. `moduleEntry.ts` calls `window.__NKZ__.register()` with:
- `id`: `"robotics"`
- `main`: `RoboticsApp` (internal router)
- `viewerSlots`: map-layer + context-panel widgets

No Module Federation. No `remoteEntry.js`.

### 5.2 Views (2 internal routes)

| Route | Component | Description |
|-------|-----------|-------------|
| `/robotics` | `FleetDashboard` | Fleet overview, map, robot cards, geofences |
| `/robotics/:robotId` | `CockpitLayout` | Teleoperation cockpit for one robot |

### 5.3 FleetDashboard

```
┌──────────────────────────────────────────────────────────┐
│  [Search robots...]  │  + Register robot  │ [Filters]    │
│──────────────────────────────────────────────────────────│
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ RobotCard│ │ RobotCard│ │ RobotCard│ │ RobotCard│     │
│ │ battery  │ │ battery  │ │ battery  │ │ battery  │     │
│ │ mode     │ │ mode     │ │ mode     │ │ mode     │     │
│ │ gps      │ │ gps      │ │ gps      │ │ gps      │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│──────────────────────────────────────────────────────────│
│              ┌─────────────────────────┐                 │
│              │    Cesium Map           │                 │
│              │  markers + geocercas    │                 │
│              └─────────────────────────┘                 │
│──────────────────────────────────────────────────────────│
│  Route history timeline: [slider] [play] [export]       │
└──────────────────────────────────────────────────────────┘
```

**Components**:
- **RobotCard**: Color-coded status card (battery bar, mode badge, GPS fix indicator, heading arrow). Click navigates to cockpit.
- **FleetMap**: CesiumJS with `AgriRobot` markers (orientation arrow, mode color). Geofences as polygons with entry/exit alert styling.
- **GeofenceEditor**: Cesium draw tools for perimeter/zone definition. Stored as NGSI-LD `Geofence` entities (custom type) linked to `AgriParcel` via `refAgriParcel` Relationship. Each geofence has a GeoProperty for the polygon and Properties for name, type (inclusion/exclusion), and active status.
- **RouteHistory**: Timeline slider. Queries TimescaleDB via `GET /api/robotics/fleet/robots/{id}/route`. Animated playback of historical GPS path.

### 5.4 CockpitLayout

```
┌──────────────────────────────────────────────────────────┐
│ SAFETY HEADER                                            │
│ [MONITOR|MANUAL|AUTO]  Lat:12ms  Bat:78%  [ BIG E-STOP ]│
│──────────────────────────────────────────────────────────│
│                     │  ┌──────────────────┐              │
│  VIDEO VIEWPORT     │  │ TELEMETRY HUD    │              │
│  (main camera)      │  │ LIN.X  0.45 m/s  │              │
│                     │  │ ANG.Z  0.12 r/s  │              │
│  ┌───────┐          │  │ HEAD   234° SW   │              │
│  │PiP cam│          │  │ GPS  42.1, -1.8  │              │
│  └───────┘          │  └──────────────────┘              │
│  crosshair overlay  │  ┌──────────────────┐              │
│  (manual mode)      │  │ DRIVE PANEL 4WS  │              │
│                     │  │ [Front][Dual]    │              │
│                     │  │ [Crab][Pivot]    │              │
│─────────────────────│──│ [  Joystick   ]  │──────────────│
│ IMPLEMENT PANEL     │  └──────────────────┘              │
│ Sprayer: ACTIVE     │  ┌──────────────────┐              │
│ Pressure: 2.4 bar   │  │ MINIMAP (OSM)    │              │
│ Flow: 12 L/min      │  │ robot + trail    │              │
│ [Configure]         │  └──────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

**Key components**:

- **SafetyHeader**: Mode selector (MONITOR/MANUAL/AUTO), real-time Zenoh ping latency, battery indicator. E-STOP button requires press-then-confirm gesture. Gamepad connection indicator.
- **VideoViewport**: MJPEG stream from WebSocket binary frames. Main camera fills center. PiP overlay for secondary camera (draggable). Camera selector buttons. Crosshair overlay appears in MANUAL mode.
- **TelemetryHUD**: Semi-transparent overlay on video. Shows live SSE data (linear.x, angular.z, heading, GPS coords). Auto-hides after 5s of inactivity.
- **DrivePanel**: 4WS mode selector (4 pill buttons with SVG steering diagrams). Touch joystick publishing `cmd_vel` via WebSocket. Mapped: vertical drag = linear.x, horizontal drag = angular.z.
- **ImplementPanel**: Dynamic widgets keyed by `AgriRobot.refImplement` type. Sprayer shows pressure + flow rate bars. Seeder shows rate + hopper level. Plow shows depth + draft force.
- **MiniMap**: 2D local map (Leaflet/OSM tiles) centered on robot position with orientation marker and last 500m breadcrumb trail.

### 5.5 Mobile / Native Shell Integration

The module is 95% web. Four native capabilities are bridged via `postMessage`:

| Direction | Message Type | Data | Purpose |
|-----------|-------------|------|---------|
| WebView→Native | `NKZ_GPS_REQUEST` | — | Request high-precision GPS from device |
| WebView→Native | `NKZ_HAPTIC_ALERT` | `level: 'warning'\|'critical'` | Haptic feedback for alerts |
| Native→WebView | `NKZ_GPS_POSITION` | `lat, lon, heading, speed, accuracy` | GPS position update |
| Native→WebView | `NKZ_HARDWARE_EVENT` | `event: 'estop_button'\|'mode_toggle'` | Physical button events |

When `postMessage` bridge is unavailable (desktop browser), the module falls back to `navigator.geolocation` and visual-only alerts.

### 5.6 Hooks

| Hook | Source | Returns |
|------|--------|---------|
| `useRoboticsSSE(robotId)` | `EventSource GET /api/robotics/teleop/{id}/stream` | `{ telemetry, connected, error }` |
| `useRoboticsWS(robotId)` | `WebSocket ws://.../api/robotics/teleop/{id}/control` | `{ sendCommand, videoFrame, connected }` |
| `useGamepad()` | `navigator.getGamepads()` polling (60Hz rAF) | `{ axes, buttons, connected }` |
| `useFleet()` | `fetch GET /api/robotics/fleet/robots` | `{ robots, selected, select }` |

### 5.7 Gamepad

Standard Gamepad API. Left stick → `cmd_vel` (linear.x + angular.z). Triggers → speed multiplier. A/B/X/Y → camera switch. Start → E-STOP. Icon in header shows connection status.

### 5.8 CSS: High-Contrast Industrial HMI

Design tokens via CSS custom properties:

- `--nkz-surface`, `--nkz-surface-elevated` — panel backgrounds
- `--nkz-border` — high-visibility borders
- `--nkz-accent` — module primary (`#E11D48`, rose-600)
- `--nkz-critical`, `--nkz-warning`, `--nkz-ok` — status colors
- `--nkz-font-mono` — JetBrains Mono for telemetry data

Dual theme via CSS media queries + `.hmi-mode` class (from `useHMI()`):
- **Light (field)**: high contrast, sunlight-readable, maximum saturation
- **Dark (cab)**: low glare, reduced blue light, night vision friendly

When `isHmiMode` is true: larger touch targets (min 48px), bigger fonts, reduced information density, vibration-tolerant layout.

### 5.9 i18n

Namespace: `robotics`. Minimum: `es` + `en`. Key groups:

- `fleet.*` — dashboard, cards, geofences, route player
- `cockpit.*` — safety header, HUD labels, E-STOP, gamepad status
- `drive.*` — 4WS modes, joystick hints, steering labels
- `implement.*` — widget labels, units, dynamic keys by implement type
- `robot.*` — registration form, attributes, provisioning

## 6. Backend Design

### 6.1 Stack

- **Python 3.12** on `python:3.12-slim` Docker image
- **FastAPI** (async, uvicorn)
- **httpx** (async HTTP to Zenoh REST API + Orion-LD)
- **pyjwt** (JWT decode, RS256, JWKS from Keycloak)
- **No SQLAlchemy, no Redis, no Conda, no RQ**

### 6.2 Endpoints

#### Fleet (Management Plane)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/robotics/fleet/robots` | List `AgriRobot` entities for tenant (from Orion-LD) |
| `GET` | `/api/robotics/fleet/robots/{id}` | Get single robot detail |
| `POST` | `/api/robotics/fleet/robots` | Register new robot: creates AgriRobot in Orion-LD, generates Zenoh credentials, configures ACLs |
| `PATCH` | `/api/robotics/fleet/robots/{id}` | Update robot attributes (name, assigned parcel) |
| `DELETE` | `/api/robotics/fleet/robots/{id}` | Decommission robot: revokes Zenoh credentials, removes ACLs, marks entity |
| `GET` | `/api/robotics/fleet/robots/{id}/route` | GPS trajectory from TimescaleDB (time range, limit params) |
| `POST` | `/api/robotics/fleet/geofences` | Create geofence for tenant |
| `GET` | `/api/robotics/fleet/geofences` | List geofences for tenant |
| `DELETE` | `/api/robotics/fleet/geofences/{id}` | Delete geofence |

#### Teleoperation (Control Plane)

| Method | Path | Transport | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/robotics/teleop/{robot_id}/stream` | **SSE** | Real-time telemetry stream |
| `WS` | `/api/robotics/teleop/{robot_id}/control` | **WebSocket** | Bidirectional: commands + video frames |
| `POST` | `/api/robotics/teleop/{robot_id}/config` | HTTP | Get Zenoh connection config for a robot |

### 6.3 WebSocket Protocol

**Client→Server (commands)** — JSON text frames:

```json
{ "type": "cmd_vel", "linear": { "x": 0.5, "y": 0, "z": 0 }, "angular": { "x": 0, "y": 0, "z": 0.1 } }
{ "type": "mode", "value": "MANUAL" }
{ "type": "estop" }
{ "type": "heartbeat" }
{ "type": "camera", "select": "rear" }
```

**Server→Client (events)** — JSON text frames:
```json
{ "type": "pong", "latency_ms": 12 }
{ "type": "mode_changed", "value": "AUTO" }
{ "type": "estop_ack" }
```

**Server→Client (video)** — Binary frames:
- MJPEG JPEG frames, one per message
- Frame header in first 4 bytes: `{camera_id}` as uint32 LE
- Rest of frame: raw JPEG bytes

### 6.4 Zenoh ACLs Management

On robot registration (`POST /fleet/robots`):

1. Generate random username + password (32-char alphanumeric)
2. Push ACL rule to Zenoh Router via REST API:
   ```
   nkz/{tenant_id}/{robot_id}/* → pub+sub allowed for user {robot_username}
   nkz/{tenant_id}/*            → sub only (fleet-wide topics)
   ```
3. Return credentials in response (shown once to operator)

On robot deletion (`DELETE /fleet/robots/{id}`):
1. Remove ACL rule from Zenoh Router
2. Remove user from Zenoh credential store

### 6.5 Auth Middleware

Requests arrive behind `api-gateway` (which already does JWT validation).

Middleware extracts:
1. Cookie `nkz_token` → decode JWT → extract `tenant_id` claim
2. Header `X-Tenant-ID` as fallback
3. Injects `request.state.tenant_id` for all downstream handlers

All Orion-LD queries include `NGSILD-Tenant` header.
All Zenoh topics are scoped to `nkz/{tenant_id}/{robot_id}/`.

CORS: explicit origin whitelist from `CORS_ORIGINS` env var. Never `*`.

### 6.6 Error Handling

| Scenario | Response |
|----------|----------|
| Robot not found in Orion-LD | 404 `{ "detail": "Robot {id} not found in tenant {tid}" }` |
| Zenoh router unreachable | 502 `{ "detail": "Zenoh router unavailable" }` |
| Invalid mode transition | 409 `{ "detail": "Cannot switch from {current} to {requested}" }` |
| Tenant mismatch | 403 `{ "detail": "Robot {id} does not belong to tenant {tid}" }` |
| E-STOP while in MONITOR | 200 (ignored — not an error, just no-op) |

## 7. Security

| Layer | Mechanism |
|-------|-----------|
| Frontend ↔ Backend | httpOnly cookie `nkz_token`, CORS explicit whitelist |
| Backend ↔ Orion-LD | `NGSILD-Tenant` header |
| Backend ↔ Zenoh Router | HTTP Basic (admin credentials from K8s Secret) |
| Robot ↔ Zenoh Router | TLS 1.3 (cert-manager) + Zenoh user/password + ACLs per topic |
| Zenoh namespace | `nkz/{tenant_id}/{robot_id}/{channel}` — strict prefix per robot |
| E-STOP | Unauthenticated at Zenoh level (any frame with estop=true on heartbeat topic triggers stop), but topic itself is ACL-protected |
| Backend ↔ TimescaleDB | K8s Secret credentials, queries always filtered by tenant_id |
| Secrets | K8s Secrets (`zenoh-secret`, `postgresql-secret`, `nekazari-config` ConfigMap) |
| CORS | `CORS_ORIGINS` from platform-config, never wildcard |

## 8. Deployment

### 8.1 Docker Images

| Image | Registry | Dockerfile |
|-------|----------|------------|
| `robotics-backend` | `ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest` | `backend/Dockerfile` (python:3.12-slim) |

Frontend is IIFE bundle uploaded to MinIO bucket `nekazari-frontend` at key `modules/robotics/nkz-module.js`.

### 8.2 K8s Resources

**Backend**: Deployment `robotics-api` (1 replica, ClusterIP service `robotics-api-service:80`). Health probes on `/health`. No worker sidecar.

**Zenoh Router**: Deployment `zenoh-router` (1 replica, ClusterIP services for 7447/TCP + 8000/HTTP). ConfigMap with `zenoh.json5` and `zenoh_acls.json5`. TLS cert from cert-manager Certificate → `zenoh-tls` Secret.

**Ingress**: Traefik IngressRouteTCP for Zenoh TCP port 7447 with TLS passthrough.

### 8.3 ArgoCD

App manifest at `nkz/gitops/modules/robotics.yaml` pointing to this repo's `k8s/` path. No overlay needed — all environment-specific values come from existing Secrets/ConfigMaps.

## 9. Cleanup: LiDAR Removal

All LiDAR-related code must be purged. The following files are deleted (not refactored):

- `src/services/api.ts` — LidarApiClient
- `src/services/lidarContext.tsx` — LidarContext/Provider
- `src/components/slots/LidarLayer.tsx`
- `src/components/slots/LidarConfig.tsx`
- `src/components/slots/LidarLayerControl.tsx`
- `src/components/slots/TreeInfo.tsx`
- `src/hooks/useUIKit.tsx`
- `backend/app/services/orion_client.py` (rewritten for AgriRobot, not trees)
- `backend/app/services/storage.py`
- `backend/app/worker.py`
- `backend/app/db/`
- `backend/app/common/`
- `backend/environment.yml`
- `frontend/`
- `k8s/registration.sql`
- `k8s/frontend-deployment.yaml`
- `dist/`
- `docs/` (old docs)
- `SETUP.md`
- `examples/`
- `.vscode/`
- `package-lock.json` (keep only pnpm-lock.yaml)
- All `.lidar-*` CSS classes in `src/index.css`
- i18n keys: `lidarPanel.*`, `lidarControl.*`, `tree.*`
