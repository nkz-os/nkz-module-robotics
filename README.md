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
pnpm typecheck    # TypeScript check
```

## Deployment

Frontend: upload `dist/nekazari-module.js` to MinIO bucket `nekazari-frontend` at key `modules/robotics/nkz-module.js`.

Backend: build and push Docker image, apply K8s manifests.

```bash
docker build -t ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest backend/
docker push ghcr.io/nkz-os/nkz-module-robotics/robotics-backend:latest
kubectl apply -k k8s/
```
