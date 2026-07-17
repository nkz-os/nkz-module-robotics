-- =============================================================================
-- Robotics Module Registration for Nekazari Platform
-- =============================================================================
-- Execute:
--   kubectl exec -it -n nekazari deploy/postgresql -- psql -U nekazari -d nekazari
--
-- metadata.api_prefix/backend_service/backend_mount/requires_auth are what
-- api-gateway's _refresh_route_registry() (fiware_api_gateway.py) reads to
-- build the auto-proxy route table — without them every /api/robotics/*
-- request 404s. This INSERT is now idempotent with
-- nkz/config/timescaledb/migrations/092_module_auto_proxy_routing.sql (keep
-- both in sync if either changes; 092 is a JSONB merge, this is a full
-- replace, so re-running THIS file used to silently wipe 092's routing keys
-- when they weren't listed here too).
-- =============================================================================

INSERT INTO marketplace_modules (
    id, name, display_name, description, remote_entry_url,
    scope, version, author, category, is_active, required_roles,
    metadata, module_type, required_plan_type, pricing_tier,
    route_path, label
) VALUES (
    'robotics',
    'robotics',
    'Robotics & Telemetry',
    'Advanced Robotics Module for Nekazari Platform. Fleet management, real-time teleoperation, multi-camera video, 4WS drive control, Zenoh-powered telemetry, and gamepad support.',
    '/modules/robotics/nkz-module.js',
    'robotics_module',
    '2.0.0',
    'Robotika Engineering',
    'robotics',
    true,
    ARRAY['Farmer', 'TenantAdmin', 'PlatformAdmin'],
    '{"icon": "🤖", "color": "#E11D48", "shortDescription": "Robotics control and telemetry via Zenoh", "api_prefix": "/api/robotics", "backend_service": "http://robotics-api-service:80", "backend_mount": "/api/robotics", "requires_auth": true}'::jsonb,
    'CORE',
    'basic',
    'FREE',
    '/robotics',
    'Robotics'
) ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    remote_entry_url = EXCLUDED.remote_entry_url,
    version = EXCLUDED.version,
    metadata = EXCLUDED.metadata,
    module_type = EXCLUDED.module_type,
    route_path = EXCLUDED.route_path,
    label = EXCLUDED.label,
    updated_at = NOW();

-- Verify
SELECT id, display_name, remote_entry_url, route_path, is_active
FROM marketplace_modules
WHERE id = 'robotics';
