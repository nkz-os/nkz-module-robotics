# Robotics SOTA — Remaining Work Plan (2026-04-30)

## Wave 1: Backend + Frontend independents (parallel, no conflicts)

### 1A — Backend: controlledBy attribute
- Add `controlledBy` Property to `AgriRobot` entity creation in `orion_robots.py`
- Add `PATCH /robots/{id}/claim-control` and `PATCH /robots/{id}/release-control` endpoints in `fleet.py`
- Update teleoperation WS to set `controlledBy` on MANUAL, clear on MONITOR

### 1B — Frontend: FleetMap directional arrows + GeofenceEditor + RouteHistory
- Unify `FleetMap.tsx` to use same arrow canvas logic as `RobotMapLayer.tsx`
- `GeofenceEditor.tsx`: wire Cesium draw tools (polygon drawing)
- `RouteHistory.tsx`: render GeoJSON on Cesium map + animate playback

### 1C — Frontend: Phase B fleet experience
- New `FleetTable.tsx` component (columns: ID, Estado, SOC%, ETA, Apero, Operador, Última)
- Quick filter chips in FleetDashboard
- Smart sorting (alerts → stopped → running → idle)
- `GNSSQualityBadge` in TelemetryHUD
- Semantic palette consistency pass across all components

---

## Wave 2: Integration (after Wave 1 completes)

### 2A — FleetDashboard integration
- Add FleetMap, FleetTable (toggleable with cards), GeofenceEditor, RouteHistory to FleetDashboard layout
- Wire filter chips + search + sort

### 2B — Cockpit improvements
- ImplementPanel reads from SSE telemetry instead of hardcoded
- Pause All / E-Stop All buttons in FleetDashboard header
- E-STOP re-arm flow in CockpitLayout (overlay with cause → resolve → confirm → waiting state)

### 2C — Polish
- VideoViewport: timestamp + latency overlay on canvas
- WCAG basics: ARIA roles on critical buttons (E-STOP, mode selector), keyboard nav
- eu.json (Euskera)

---

## Wave 3: Infrastructure

### 3A — ArgoCD + K8s
- Create ArgoCD app manifest in nkz repo
- Document zenoh-secret creation + cert-manager TLS setup
