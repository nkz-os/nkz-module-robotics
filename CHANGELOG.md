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

## [1.0.0] — December 2025

### Added
- Initial template with SDK packages from NPM
- Real SDK usage in App.tsx
- UI-Kit components
- Full TypeScript support
