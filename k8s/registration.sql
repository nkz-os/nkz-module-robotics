-- =============================================================================
-- Robotics Module Registration for Nekazari Platform
-- =============================================================================
-- Execute:
--   kubectl exec -it -n nekazari deploy/postgresql -- psql -U nekazari -d nekazari
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
    '{"icon": "🤖", "color": "#E11D48", "shortDescription": "Robotics control and telemetry via Zenoh"}'::jsonb,
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
