-- Robotics module registration (marketplace_modules). Idempotent; one transaction.
-- Apply on the platform database as a superuser. The production copy lives in
-- the deployment configuration repository. defineModule() (src/Module.tsx) is
-- the runtime source of truth: every publish overwrites roles, route and version.

\echo '--- before'
SELECT id, version, route_path, required_roles, metadata ? 'source_repo' AS publishable
  FROM marketplace_modules WHERE id = 'robotics';

BEGIN;

INSERT INTO marketplace_modules (
    id, name, display_name, description, remote_entry_url, scope, exposed_module, version, author,
    category, icon_url, route_path, label, required_plan_level, is_local, is_active,
    required_roles, metadata
) VALUES (
    'robotics', 'robotics', 'Robotics',
    'Fleet view, live robot state and E-Stop over the platform VPN.',
    '/modules/robotics/mf-manifest.json', 'robotics', './Module', '3.0.0', 'Robotika Engineering',
    'robotics', 'bot', '/robotics', 'Robots', 0, false, true,
    ARRAY['Farmer', 'TechnicalConsultant', 'TenantAdmin', 'PlatformAdmin'],
    '{
      "icon": "bot",
      "color": "#DC2626",
      "api_prefix": "/api/robotics",
      "backend_service": "http://robotics-api-service:80",
      "backend_mount": "/api/robotics",
      "requires_auth": true,
      "source_repo": "nkz-os/nkz-module-robotics",
      "deploy_method": "dist_endpoint",
      "hostApiVersion": "^2.0.0",
      "description_i18n": {
        "es": "Vista de la flota, estado en vivo de los robots y parada de emergencia a través de la VPN de la plataforma.",
        "en": "Fleet view, live robot state and E-Stop over the platform VPN.",
        "eu": "Flotaren ikuspegia, roboten egoera zuzenean eta larrialdiko geldialdia plataformaren VPNaren bidez.",
        "fr": "Vue de la flotte, état des robots en direct et arrêt d''urgence via le VPN de la plateforme.",
        "pt": "Vista da frota, estado dos robôs em tempo real e paragem de emergência através da VPN da plataforma.",
        "ca": "Vista de la flota, estat dels robots en directe i aturada d''emergència a través de la VPN de la plataforma."
      }
    }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    display_name     = EXCLUDED.display_name,
    description      = EXCLUDED.description,
    remote_entry_url = EXCLUDED.remote_entry_url,
    scope            = EXCLUDED.scope,
    exposed_module   = EXCLUDED.exposed_module,
    icon_url         = EXCLUDED.icon_url,
    route_path       = EXCLUDED.route_path,
    label            = EXCLUDED.label,
    required_roles   = EXCLUDED.required_roles,
    is_active        = true,
    -- drop keys that described the previous teleoperation module
    metadata         = (COALESCE(marketplace_modules.metadata, '{}'::jsonb) - 'features' - 'shortDescription')
                       || EXCLUDED.metadata,
    updated_at       = NOW();

COMMIT;

\echo '--- after'
SELECT id, version, route_path, required_roles,
       metadata->>'api_prefix' AS api_prefix, metadata->>'backend_service' AS backend, metadata->>'source_repo' AS repo
  FROM marketplace_modules WHERE id = 'robotics';
