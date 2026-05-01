# Auditoría UX/Workflow — Robotics Module vs BasaBot Cockpit Spec

**Fecha**: 2026-04-30
**Referencia**: BasaBot Cockpit v2.0 — Especificación de Interfaz de Gestión de Flotas

---

## 0. Resumen ejecutivo

El módulo robotics implementa **~35%** de las capacidades descritas en el spec de referencia. Los aciertos están en la arquitectura de transporte (SSE+WS dual) y la estructura base del cockpit. Las carencias principales están en seguridad funcional (deadman, latency lockout, re-arm procedure), gestión de flota avanzada (tabla de estado, filtros, acciones globales), y post-misión (inexistente).

---

## 1. Roles y permisos — Comparativa

### Lo que tenemos

| Aspecto | Estado | Nota |
|---------|--------|------|
| RBAC | ✅ Parcial | La plataforma (Keycloak) define roles: PlatformAdmin, TenantAdmin, Farmer. El módulo no aplica diferenciación visual ni funcional por rol. |
| Auth | ✅ | httpOnly cookie `nkz_token`, SSO Keycloak |
| MFA | ⚠️ | Delegado a Keycloak — no forzado desde el módulo |
| Sesión única por robot | ❌ | No hay bloqueo de control. Dos operadores pueden abrir el cockpit del mismo robot simultáneamente. |
| Caducidad por inactividad | ⚠️ | Delegado a la plataforma (cookie expiry). No hay timeout específico del módulo. |

### Lo adoptable del spec BasaBot (§1)

| Requisito | Prioridad | Esfuerzo |
|-----------|-----------|----------|
| Bloqueo pesimista de control por robot (solo un operador a la vez) | **Alta** | Medio — requiere estado compartido (Redis/Orion-LD) |
| Separación Admin no teleopera / Operador no configura | **Media** | Bajo — ocultar botones según rol |
| Timeout de inactividad en cockpit (15 min → volver a flota) | **Media** | Bajo — timer en CockpitLayout |

---

## 2. Vista Macro — Gestión de Flota

### Lo que tenemos

| Componente | Estado | Nota |
|-----------|--------|------|
| Grid de tarjetas | ✅ | RobotCard con batería, modo, GPS, timestamp |
| Búsqueda por nombre | ✅ | Filtro de texto en FleetDashboard |
| Mapa GIS | ✅ | FleetMap con Cesium, puntos coloreados por modo |
| Click en mapa → cockpit | ✅ | ScreenSpaceEventHandler |
| Filtros por estado | ❌ | Solo búsqueda textual. Sin "Solo con alertas", "Detenidos", "Sin comunicación" |
| Tabla de estado | ❌ | Solo vista de tarjetas. Sin columnas ordenables: ID, Estado, SOC, ETA, Apero, Operador |
| Ordenación inteligente | ❌ | Sin priorización: fallos → detenidos → ejecutando → espera |
| Acciones globales | ❌ | Sin "Pause All" ni "E-Stop All" |
| Capa meteorológica | ❌ | Sin API de viento/precipitación/temperatura |
| Gestor de misiones | ❌ | Sin carga de waypoints ni polígonos de cobertura |
| Vectores direccionales | ❌ | FleetMap usa puntos, no flechas con heading RTK |
| Capas dinámicas | ❌ | Sin zonas de exclusión temporales ni coordinación de enjambre |

### Lo adoptable del spec BasaBot (§2)

| Requisito | Prioridad | Esfuerzo |
|-----------|-----------|----------|
| Tabla de estado con columnas mínimas + filtros rápidos preconfigurados | **Alta** | Medio — nueva vista de tabla + useFleet enriquecido |
| Ordenación: fallos primero, nunca paginar ocultando alertas | **Alta** | Bajo — lógica en useFleet |
| Flechas direccionales con heading RTK en FleetMap | **Alta** | Bajo — cambiar `point` por `billboard` con rotación |
| Colores semánticos estrictos: Verde=Nominal, Amarillo=Aviso, Naranja=Advertencia, Rojo=Fallo, Gris=Sin datos | **Alta** | Bajo — CSS variables ya definidas, falta usarlas consistentemente |
| Botón "Pause All" + "E-Stop All" con confirmación doble paso | **Media** | Medio — nuevo endpoint batch + UI |
| Capa meteorológica | **Baja** | Alto — integración API externa |
| Gestor de misiones (waypoints, cobertura) | **Baja** | Alto — spec pendiente |

---

## 3. Vista Micro — Teleoperación y Diagnóstico

### 3.1 Módulo de Cinemática y Tracción (4WS)

| Requisito BasaBot | Tenemos | Gap |
|-------------------|---------|-----|
| Selector de modo 4WS (5 modos) | ✅ 4 modos (falta Ackermann Trasero) | Añadir ACKERMANN_REAR |
| Joystick virtual | ✅ | |
| Soporte gamepad físico | ✅ | |
| Monitor de deslizamiento (slip) | ❌ | Nuevo: gráfico odometría vs GNSS |
| Visor cenital del chasis con ángulos reales | ❌ | Nuevo: SVG interactivo de 4 ruedas |
| Estado de tracción por rueda (par, RPM, temp, consumo) | ❌ | Nuevo: 4 widgets de rueda |
| Hold-to-drive (deadman) | ❌ **CRÍTICO** | Sin deadman, soltar joystick NO detiene el robot |
| Limitador de velocidad en modo manual (1.0 m/s) | ❌ **CRÍTICO** | Joystick puede enviar linear.x ilimitado |
| Fail-safe de latencia (>200ms por 2s → lockout) | ❌ **CRÍTICO** | El header muestra latencia pero no bloquea |
| Indicador de "En intervención por <usuario>" | ❌ | Sin estado compartido de control |

### 3.2 Módulo de Energía

| Requisito BasaBot | Tenemos | Gap |
|-------------------|---------|-----|
| SOC % | ✅ | battery_pct en HUD |
| Voltaje de bus, consumo instantáneo (kW) | ❌ | Solo porcentaje |
| SOH % | ❌ | Sin degradación de batería |
| Diagnóstico de celdas (ΔV balanceo) | ❌ | Sin datos de BMS |
| Temperaturas (pack, inversores, conector) | ❌ | |
| Predicción de autonomía vs misión | ❌ | |

### 3.3 Módulo de Implementos

| Requisito BasaBot | Tenemos | Gap |
|-------------------|---------|-----|
| Reconocimiento del apero activo | ⚠️ | Hardcoded "Sprayer" con valores mock |
| Tripuntal (posición 0-100%, fuerza) | ❌ | |
| PTO eléctrica (ON/OFF, RPM, par) | ❌ | |
| Compatibilidad ISOBUS TIM | ❌ | |

### 3.4 Percepción y Navegación

| Requisito BasaBot | Tenemos | Gap |
|-------------------|---------|-----|
| Video multi-cámara | ✅ | Selector front/rear/implement |
| Latencia y timestamp en pantalla | ❌ | El canvas no muestra timestamp ni latencia |
| Adaptación de calidad (1080p/720p/480p) | ❌ | Sin control de perfil |
| Visor Nav2 / costmaps | ❌ | Sin representación de navegación autónoma |
| Calidad GNSS (RTK Fix → No Fix) | ❌ | Solo coordenadas, sin indicador de calidad |
| Correcciones NTRIP (latencia, mountpoint) | ❌ | |
| EKF health indicator | ❌ | |

### 3.5 Seguridad Funcional y Hardware (§5 BasaBot)

| Requisito BasaBot | Tenemos | Gap |
|-------------------|---------|-----|
| Topología visual del lazo E-Stop | ❌ | Sin representación de setas, bumpers, cortinas |
| Categorías de parada (Cat 0 vs Cat 1) | ❌ | Solo un tipo de E-STOP indiferenciado |
| Procedimiento de re-armado (4 pasos) | ❌ | Sin flujo de re-armado |
| Estado de contactores (precarga, tracción, PTO) | ❌ | |
| Salud de red (RSSI, RSRP, failover) | ❌ | |
| Watchdogs y heartbeats por subsistema | ❌ | Solo heartbeat del robot completo |

---

## 4. Vista Post-Misión — Analítica y Mantenimiento (§6 BasaBot)

**Estado actual: Inexistente (0% implementado)**

| Requisito | Prioridad |
|-----------|-----------|
| Mapa de compactación / dureza | Baja (fase 2) |
| Mapa de cobertura efectiva | Baja (fase 2) |
| Mapa de calidad RTK | Baja (fase 2) |
| Mapa de velocidad real | Baja (fase 2) |
| Visor de logs (rosbag2) | Baja (fase 2) |
| Mantenimiento predictivo (alertas por horas/ciclos) | Media (fase 2) |

---

## 5. Diseño Visual y Accesibilidad

| Requisito BasaBot | Estado actual | Gap |
|-------------------|---------------|-----|
| Dark mode por defecto | ✅ | bg-slate-950 |
| Diseño responsivo 3 breakpoints (1024, 1440, 2560) | ⚠️ | Solo responsive genérico + HMI mode. Sin bloqueo de teleop < 1024px |
| Paleta semántica estricta | ⚠️ | Variables CSS definidas (`--nkz-critical`, `--nkz-warning`, `--nkz-ok`) pero NO se usan consistentemente en componentes |
| Operabilidad con guantes (≥48px) | ⚠️ | HMI mode lo aplica. Modo normal: botones de 36-40px |
| WCAG 2.1 AA | ❌ | Sin contraste verificado, sin roles ARIA, sin navegación por teclado |
| Información no codificada solo por color | ❌ | StatusBadge usa solo color + icono pequeño. El indicador de latencia es solo color (verde/rojo) |
| i18n (es, eu, en) | ✅ es + en; ❌ eu | Falta euskera |

---

## 6. Ciberseguridad y Auditoría (§8 BasaBot)

| Requisito | Tenemos | Gap |
|-----------|---------|-----|
| TLS 1.3 en transporte | ✅ | Zenoh sobre TLS |
| mTLS robot-broker | ❌ | Solo TLS servidor. Decisión de diseño documentada (campo agrícola) |
| Certificado X.509 por robot | ❌ | User/password en lugar de certificados |
| AuthN OIDC con refresh | ✅ | Vía plataforma |
| RBAC server-side | ⚠️ | Tenant middleware extrae rol. No se aplica en UI |
| Audit log inmutable (12 meses) | ❌ | Sin trazabilidad de acciones |
| Segmentación de red | ❌ | Delegado a K8s NetworkPolicy (no definido) |
| OTA con firma criptográfica | ❌ | Fuera de scope del módulo |

---

## 7. Presupuesto de Latencias y SLA (§9 BasaBot)

Comparativa de nuestros valores actuales vs el spec:

| Función | Objetivo BasaBot | Nuestro valor | Estado |
|--------|------------------|---------------|--------|
| Telemetría no crítica | ≤ 1 s | Depende de Zenoh SSE | ✅ Implementado, no verificado |
| Vídeo (glass-to-glass) | ≤ 300 ms | MJPEG sobre WS | ⚠️ Sin medición |
| Comando teleoperación RTT | ≤ 150 ms | WebSocket ping | ✅ Medimos latencia |
| **E-STOP remoto (clic→corte)** | ≤ 200 ms | **Sin garantía** | ❌ Sin medición ni SLA |
| Heartbeat watchdog interno | 100 ms | Configurable | ⚠️ Sin enforce |
| **Fail-safe latencia** | 200 ms/2s → lockout | **NO IMPLEMENTADO** | ❌ **CRÍTICO** |

---

## 8. Resumen de puntos de fricción y bloqueo

### Bloqueantes (impiden uso seguro en producción)

| # | Issue | Ubicación | Impacto |
|---|-------|-----------|---------|
| 1 | **Sin deadman (hold-to-drive)** | CockpitLayout, Joystick | Soltar joystick NO detiene el robot. Riesgo de seguridad grave. |
| 2 | **Sin limitador de velocidad en modo manual** | CockpitLayout.handleCmdVel | Joystick puede enviar linear.x = 100.0 sin límite. |
| 3 | **Sin fail-safe por latencia** | SafetyHeader | El operador no sabe que perdió control. Si latency > 200ms por 2s, debe lockout. |
| 4 | **Sin bloqueo de control exclusivo** | App.tsx | Dos operadores pueden teleoperar el mismo robot simultáneamente. |
| 5 | **E-STOP sin latencia garantizada** | teleoperation.py | Sin medición ni SLA de 200ms para el E-STOP remoto. |

### Fricción alta (degradan la experiencia significativamente)

| # | Issue | Ubicación |
|---|-------|-----------|
| 6 | FleetDashboard sin tabla de estado ordenable ni filtros rápidos | FleetDashboard |
| 7 | Marcadores en mapa son puntos, no flechas con heading | FleetMap |
| 8 | Sin indicador de calidad GNSS (RTK Fix vs Single) | TelemetryHUD |
| 9 | Valores de implemento hardcodeados (presión=2.4, caudal=12) | ImplementPanel |
| 10 | Sin timestamp ni latencia en el video | VideoViewport |
| 11 | Paleta semántica definida pero no usada consistentemente | Todos los componentes |
| 12 | Sin flujo de re-armado post E-STOP | CockpitLayout |

### Fricción media (mejoras de usabilidad)

| # | Issue |
|---|-------|
| 13 | Sin modo solo-consulta en viewports < 1024px (bloquear teleop) |
| 14 | Sin indicador visual de "En intervención por <usuario>" en fleet |
| 15 | E-STOP indiferenciado (Cat 0 vs Cat 1 según origen) |
| 16 | Sin representación visual del lazo de seguridad (qué disparó el E-STOP) |
| 17 | Sin SOH de batería ni balanceo de celdas |
| 18 | Sin monitor de deslizamiento (slip odometría vs GNSS) |
| 19 | Sin visor cenital del chasis con ángulos reales de ruedas |
| 20 | Sin accesibilidad WCAG AA (sin roles ARIA, sin teclado) |

---

## 9. Plan de acción recomendado (orden de prioridad)

### Fase A — Seguridad funcional (obligatorio antes de producción)

1. **Deadman (hold-to-drive)**: Modificar Joystick y gamepad para que requieran presión continua. Soltar → `cmd_vel` cero + transición a MONITOR.
2. **Limitador de velocidad**: Clamp `linear.x ∈ [-1.0, 1.0]` y `angular.z ∈ [-1.0, 1.0]` en CockpitLayout.handleCmdVel.
3. **Fail-safe de latencia**: En useRoboticsWS, si `latencyMs > 200` durante 2s continuos → bloquear controles + mostrar overlay "Control bloqueado — latencia excesiva".
4. **Bloqueo de control exclusivo**: Estado en Orion-LD (`AgriRobot.controlledBy`) consultado antes de entrar a MANUAL. Si ya está controlado, mostrar "Robot bajo control de <usuario>".
5. **Garantía E-STOP**: Medir round-trip real del E-STOP en teleoperation.py. Priorizar el mensaje sobre cualquier otro tráfico en el WebSocket.

### Fase B — Experiencia de flota

6. **Tabla de estado con filtros rápidos**: Alternar entre vista grid (actual) y tabla con columnas + filtros "Solo advertencias", "Detenidos", "Sin comunicación".
7. **Flechas direccionales en FleetMap**: Cambiar `point` por `billboard` con imagen de flecha rotada según `heading`.
8. **Indicador GNSS**: Añadir al HUD: `RTK Fix ✓`, `RTK Float ~`, `DGPS`, `Single ⚠`, `No Fix ✗`.
9. **Paleta semántica**: Refactorizar todos los componentes para usar `--nkz-ok`, `--nkz-warning`, `--nkz-critical` consistentemente.

### Fase C — Pulido profesional

10. **Flujo de re-armado**: Post E-STOP → overlay "Causa: E-STOP remoto por <usuario>. Resolver causa → Confirmar → Robot en espera".
11. **WCAG AA**: roles ARIA, navegación por teclado, contraste verificado.
12. **Euskera**: Añadir `eu.json`.
13. **Valores de implemento desde telemetría real**: Conectar ImplementPanel a datos del SSE en lugar de hardcoded.
