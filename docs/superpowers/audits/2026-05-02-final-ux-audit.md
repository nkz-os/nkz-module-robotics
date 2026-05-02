# UX Workflow Audit — Robotics Module (2026-05-02)

## Flujo completo del usuario

### 1. Entrada al módulo — FleetDashboard

**Camino feliz**: Usuario abre /robotics → FleetDashboard con robots registrados ✅

**Camino vacío**: Sin robots → mensaje "No robots registered" + botón "+ Registrar robot"

**Fricción**: El botón "+ Registrar robot" era originalmente un botón de "refresh". Se cambió para abrir el wizard, pero ya no hay forma de refrescar manualmente la lista sin el botón. El refresh automático ocurre solo al montar useFleet.

**Severidad**: Baja. El refresh ocurre al volver del cockpit o al cerrar el wizard.

### 2. Wizard "Añadir Robot" (3 pasos)

**Paso 1**: Nombre + Tipo + Parcela ✅
- **Fricción**: El `robot_id` se auto-genera a partir del nombre (lowercase, replace spaces) pero el usuario no ve el ID generado. Si dos robots tienen el mismo nombre, colisionan.

**Paso 2**: Claim Code + UUID ✅
- **Fricción media**: El usuario tiene que escribir un UUID manualmente. No hay escaneo QR ni helper visual de dónde encontrar el UUID en el chasis.
- **Fricción baja**: La validación VPN ocurre al entrar al paso 2, no mientras el usuario escribe. Si el módulo VPN no está activo, el mensaje aparece pero no hay un enlace directo a la página de módulos.

**Paso 3**: Credenciales ✅
- Botón "Copiar todo" y "Descargar .env" funcionales.
- **Fricción baja**: El usuario podría salir sin copiar las credenciales. No hay advertencia de "¿Seguro que quieres salir sin guardar las credenciales?"

### 3. Flota con robots — Dashboard

- Grid de cards ✅ 
- Vista tabla ✅ 
- Filtros rápidos ✅ 
- Ordenación inteligente (alertas primero) ✅
- Pause All / E-Stop All con confirmación ✅

**Fricción media**: FleetMap + sidebar (GeofenceEditor + RouteHistory) están debajo de las cards. En pantalla de portátil, el usuario tiene que hacer scroll para ver el mapa.

**Fricción baja**: Los botones Pause All / E-Stop All son visibles incluso con 0 robots.

### 4. Selección de robot → Cockpit

- Transición inmediata sin loading state ✅ (el estado es local)
- SafetyHeader con modo, latencia, batería, E-STOP ✅
- VideoViewport con selector de cámara ✅
- TelemetryHUD con GNSS quality ✅
- DrivePanel con 4WS + joystick ✅
- Gamepad support ✅

**Fricción media**: ImplementPanel muestra "Sprayer" hardcoded con valores mock (pressure: 2.4, flow_rate: 12). Debería leer del SSE o mostrar "Sin implemento" por defecto.

### 5. E-STOP + Re-armado

- Doble confirmación en SafetyHeader ✅
- Overlay de re-armado (causa → resolver → confirmar → MONITOR) ✅

**Fricción baja**: El re-arm flow funciona pero el mensaje de "causa" es genérico ("Parada de emergencia remota desde cockpit"). Si el robot reportara la causa real (seta física, bumper, pérdida radio), el overlay debería mostrarlo.

### 6. GeofenceEditor

- Botón "Draw geofence" → click en mapa para poner puntos → name + type → save ✅
- Lista de geofences con delete ✅

**Fricción baja**: No se muestra el número de puntos colocados durante el dibujo. El usuario no sabe si tiene 2 o 15 puntos.

### 7. RouteHistory

- Carga al hacer play, export GeoJSON ✅

**Fricción baja**: No hay feedback visual durante la carga de la ruta (solo el loader del botón play).

## Resumen de fricciones

| # | Severidad | Descripción |
|---|-----------|-------------|
| 1 | Media | ImplementPanel hardcoded, no lee telemetría real |
| 2 | Baja | Sin botón de refresh manual en FleetDashboard |
| 3 | Baja | robot_id generado invisible al usuario en wizard |
| 4 | Baja | Sin escaneo QR ni helper para UUID en wizard paso 2 |
| 5 | Baja | Sin advertencia al salir del wizard sin copiar credenciales |
| 6 | Baja | Mapa y sidebar abajo del scroll en FleetDashboard |
| 7 | Baja | Pause All / E-Stop All visibles con 0 robots |
| 8 | Baja | Sin contador de puntos en GeofenceEditor durante dibujo |
| 9 | Baja | Causa de E-STOP genérica en re-arm overlay |

## Backend endpoints vs Frontend

| Endpoint | Consumido por | Estado |
|----------|--------------|--------|
| GET /fleet/robots | useFleet hook | ✅ |
| GET /fleet/robots/{id} | RobotContextPanel, CockpitLayout | ✅ |
| POST /fleet/robots | (legacy, reemplazado por /provision) | ⚠️ Sin consumidor |
| PATCH /fleet/robots/{id} | useFleet (no expuesto en UI) | ⚠️ Sin consumidor |
| DELETE /fleet/robots/{id} | useFleet (no expuesto en UI) | ⚠️ Sin consumidor |
| POST /fleet/robots/provision | AddRobotWizard | ✅ |
| POST /fleet/robots/{id}/claim-control | CockpitLayout (exclusive control) | ✅ |
| POST /fleet/robots/{id}/release-control | CockpitLayout | ✅ |
| GET /fleet/vpn/check | AddRobotWizard | ✅ |
| GET /fleet/robots/{id}/route | RouteHistory | ✅ |
| POST /fleet/actions/pause-all | FleetDashboard | ✅ |
| POST /fleet/actions/estop-all | FleetDashboard | ✅ |
| GET /teleop/{id}/stream | useRoboticsSSE | ✅ |
| WS /teleop/{id}/control | useRoboticsWS | ✅ |
| GET /devices/{id}/config | Robot onboard (no UI) | ✅ Justificado |
| GET /health | K8s probes | ✅ |
| GET /metrics | Prometheus | ✅ |
