# Robotics Module — Cross-Module Interactions

Documenta las integraciones del módulo robotics con otros módulos de la plataforma Nekazari.

---

## n8n — Workflow Automation

El módulo n8n puede orquestar flujos de trabajo automatizados basados en eventos de robótica.

### Triggers implementables

| Evento | Webhook / Source | Acción n8n |
|--------|-----------------|------------|
| Robot E-STOP | `POST /api/robotics/fleet/robots/{id}` mode=ESTOP | Notificar a supervisor vía Zulip/email, crear incidente |
| Misión completada | Orion-LD subscription `AgriRobot.operationMode` → MONITOR tras AUTO | Generar reporte PDF, actualizar Odoo |
| Batería < 15% | SSE telemetry `battery_pct` < 15 | Notificar operador, crear ticket de mantenimiento |
| Robot sin comunicación > 60s | Poll `GET /fleet/robots` + dateModified check | Escalar alerta, notificar técnico |
| Nuevo robot registrado | `POST /api/robotics/fleet/robots` 201 | Provisionar en Odoo, crear canal Zulip |

### Endpoints expuestos para n8n

```
GET  /api/robotics/fleet/robots          → listar flota
POST /api/robotics/fleet/robots          → registrar robot programáticamente
PATCH /api/robotics/fleet/robots/{id}    → actualizar atributos
```

---

## Odoo — ERP & Mantenimiento

### Sincronización robot → Odoo

| Dato robotics | Modelo Odoo | Dirección |
|---------------|-------------|-----------|
| Robot ID + nombre | `maintenance.equipment` | robotics → Odoo |
| Horas de operación | `maintenance.equipment` odometer | robotics → Odoo |
| E-STOP / incidencias | `maintenance.request` | robotics → Odoo |
| Batería SOH | `maintenance.equipment` métrica | robotics → Odoo |
| Plan de mantenimiento | `maintenance.plan` | Odoo → robotics (read-only) |

### Flujo recomendado

1. Robot se registra en cockpit → n8n crea `maintenance.equipment` en Odoo
2. Cada E-STOP genera `maintenance.request` automáticamente
3. Odoo programa mantenimiento preventivo → recordatorio en Zulip
4. Técnico marca mantenimiento como completado en Odoo → estado visible en cockpit

---

## Zulip — Comunicaciones

### Canales recomendados

| Canal | Propósito | Integración |
|-------|-----------|-------------|
| `#robotics-alerts` | E-STOP, fallos críticos, sin comunicación | Webhook desde n8n |
| `#robotics-ops` | Cambios de modo, inicio/fin misión | Bot post |
| `#maintenance` | Recordatorios de mantenimiento | Webhook desde Odoo |
| `#fleet-status` | Resumen diario de flota (automático 08:00) | n8n cron + GET /fleet/robots |

### Formato de mensaje (E-STOP alert)

```
🔴 E-STOP — Pulverizador-04
📍 Parcela: Parcela-12 (42.1234, -1.5678)
🕐 2026-04-30 14:32:15
👤 Operador: j.agricultor@cooperativa.eus
🔗 https://nekazari.robotika.cloud/robotics/pulverizador-04
```

---

## LiDAR — Point Cloud Processing

### Interacción

- **Robot GPS → LiDAR coverage**: La posición GPS del robot (`AgriRobot.location`) alimenta la consulta de cobertura LiDAR para determinar si la parcela actual tiene datos PNOA disponibles.
- **Robot como plataforma de escaneo**: Si el robot lleva sensor LiDAR, los datos crudos se envían al módulo LiDAR para procesamiento (3D Tiles, detección de árboles).

### Entidades compartidas

```
AgriRobot.location  →  LiDAR coverage lookup (GeoJSON index)
AgriParcel           →  ámbito de procesamiento LiDAR
```

---

## DataHub — Analytics & Dashboards

### Telemetría en DataHub

Los datos de telemetría del robot (GPS, batería, velocidad) persisten en TimescaleDB vía el plano de gestión (MQTT → IoT Agent → Orion-LD → Timescale). DataHub puede consultar y visualizar:

- **Panel de flota**: batería media, uptime, distancia recorrida (agregado)
- **Panel de robot individual**: velocidad, heading, batería (serie temporal)
- **KPIs**: mission completion rate, mean time between E-STOPs, battery degradation trend

### Endpoints que DataHub puede consumir

```
GET /api/robotics/fleet/robots/{id}/route?from=&to= → GeoJSON para overlay en mapa
```

---

## Field-Operations — Agronomic work queue (DECIDED)

**Field-Operations owns what labour is needed** (`AgriParcelOperation`: sowing,
spraying, tillage, harvest, …). Crop-Health, Vegetation-Health, Soil, Weather and
peers **advise** Field-Operations; they do **not** dispatch robots directly.

```
Crop-Health / Vegetation / Soil / …  →  advise
        ↓
Field-Operations (AgriParcelOperation)
        ↓
GIS-Routing (route / coverage geometry)
        ↓
Robotics (AgriRobotMission + fleet assign + Zenoh dispatch)
        ↓
Edge rover (ROVER_NKZ executor) → actuals → FO completes operation
```

---

## GIS Routing — Geometry input (not mission owner)

- GIS-Routing proposes **routes and coverage geometry** (paths, swath hints,
  headland-aware products) for a Field-Operations job.
- Robotics turns FO operation + GIS geometry into `AgriRobotMission`, assigns
  robots, plans/replans under traversal policy, and dispatches via Zenoh.
- GIS is **not** the mission lifecycle owner.

### Geofences

```
Geofence (NGSI-LD) → GIS-Routing (planning constraints)
                  → Robotics (entry/exit alerts on fleet map)
```

---

## Mode & soft E-Stop alignment (cloud ↔ rover)

| Cloud `AgriRobot.operationMode` | Edge (ROVER_NKZ) | Notes |
|---------------------------------|------------------|-------|
| `MONITOR` | disarmed / idle | No motion authority |
| `MANUAL` | `MANUAL` + armed | Teleop via Zenoh / cockpit |
| `AUTO` | `AUTO` or active `FOLLOW` | Nav2 or person-follow |
| (mission active) | `MISSION` | Prefer cloud property `activeMission` + edge mode `MISSION` |
| `ESTOP` | SW_ESTOP | Must assert edge `/safety/estop` |

Fleet `estop-all` must publish **`safety/estop = true`** (Bool) on the robot
Zenoh namespace — same contract as the edge cockpit — not only zero `cmd_vel`.
Clear with `safety/estop = false` when re-arming is intentional.

---

## Vegetation-Health / Crop-Health — Advisors only

These modules publish agronomic state and risk. They may trigger **n8n / FO
workflows** that create or update an `AgriParcelOperation`. They must not call
robotics dispatch APIs as the primary path.

---

## Diagrama de integraciones

```
     Crop-Health / Vegetation / Soil / Weather
                        │ advise
                        ▼
              ┌───────────────────┐
              │ Field-Operations  │  AgriParcelOperation
              └─────────┬─────────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
         ┌─────┐   ┌─────────┐  ┌──────┐
         │ GIS │   │  Odoo   │  │ n8n  │
         │Route│   │  Zulip  │  │      │
         └──┬──┘   └────┬────┘  └──┬───┘
            │           │          │
            └───────────┼──────────┘
                        ▼
              ┌─────────────────┐
              │    ROBOTICS     │  AgriRobotMission + Zenoh
              └────────┬────────┘
                       ▼
                 Edge rovers (BASABOT)
```
