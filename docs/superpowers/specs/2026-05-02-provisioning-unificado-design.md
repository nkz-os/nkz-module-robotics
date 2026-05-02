# Provisioning Unificado Robot — Design Spec

**Fecha**: 2026-05-02
**Módulos**: nkz-module-robotics + nkz-module-vpn

## Propósito

Unificar el alta de robots en un wizard de 3 pasos desde Robotics. VPN sigue existiendo como panel de gestión de dispositivos independiente.

## Flujo

```
Paso 1: Nombre + Tipo + Parcela (opcional)
Paso 2: Claim Code + validación VPN
Paso 3: Credenciales (Zenoh + Tailscale) + [Ir al cockpit]
```

## Endpoints nuevos

| Método | Ruta | Módulo |
|--------|------|--------|
| POST | /api/robotics/fleet/robots/provision | Robotics |
| GET | /api/robotics/fleet/vpn/check | Robotics |
| POST | /api/vpn/devices/validate | VPN |

## Orquestación

1. Validar Claim Code contra VPN (solo validar, no consumir)
2. Si válido → generar credenciales Zenoh
3. Crear AgriRobot en Orion-LD
4. Consumir Claim Code en VPN (claim definitivo)
5. Devolver credenciales Zenoh + Tailscale

## Dependencia

Robotics manifiesta `dependencies.modules: ["vpn"]` en manifest.json.
Si VPN no disponible → wizard muestra instrucciones para activarlo.
