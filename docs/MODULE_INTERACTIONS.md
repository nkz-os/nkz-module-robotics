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

## GIS Routing — Path Planning

### Integración futura (fase 2)

- GIS Routing genera waypoints y polígonos de cobertura para misiones
- El módulo robotics carga estas rutas en `AgriRobotMission` (entidad NGSI-LD)
- El cockpit muestra la ruta planificada vs trayectoria real en el visor de navegación

### Geocercas compartidas

```
Geofence (entidad NGSI-LD) → usado por GIS Routing para planificar rutas
                            → usado por Robotics para alertas de entrada/salida
```

---

## Vegetation Prime — Crop Monitoring

### Interacción

- Vegetation Prime analiza índices de vegetación (NDVI, NDRE) por parcela
- Si detecta zona con estrés hídrico o plaga → recomienda misión de pulverización
- El módulo robotics recibe la misión y la asigna a un robot

---

## Diagrama de integraciones

```
                    ┌──────────────┐
                    │    n8n       │ ← orquestador central
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┼───┼───┼────────────┐
          │            │   │   │            │
          ▼            ▼   ▼   ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐
    │  Odoo   │  │  Zulip  │  │ DataHub │  │   GIS    │
    │  (ERP)  │  │ (Chat)  │  │  (BI)   │  │ (Routing)│
    └────┬─────┘  └─────────┘  └────┬─────┘  └────┬─────┘
         │                          │              │
         └──────────────────────────┼──────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │    ROBOTICS     │
                          │  (este módulo)  │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌─────────┐  ┌──────────┐  ┌──────────────┐
              │  LiDAR  │  │Vegetation│  │    Otros     │
              │(3D maps)│  │  Prime   │  │  (futuros)   │
              └─────────┘  └──────────┘  └──────────────┘
```
