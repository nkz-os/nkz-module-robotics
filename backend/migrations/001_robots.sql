-- Robotics — robot enrollments (per-robot Zenoh credentials) and audit trail.
-- Applied by `python -m app.db.migrate` (initContainer) as the module's own role,
-- which owns this database. Idempotent. Row-level security is FORCED: the owner
-- role is subject to the policies too.

CREATE TABLE IF NOT EXISTS robot_enrollments (
    device_uuid  uuid PRIMARY KEY,           -- = vpn device_uuid = Zenoh username
    tenant_id    text NOT NULL,
    state        text NOT NULL CHECK (state IN ('applying', 'active', 'failed', 'pending_acl')),
    password_enc bytea NOT NULL,             -- Fernet; plaintext exists only in the router Secret
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   text NOT NULL,
    rotated_at   timestamptz,
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS robot_enrollments_tenant_idx ON robot_enrollments (tenant_id);

CREATE TABLE IF NOT EXISTS robot_events (
    id          bigserial PRIMARY KEY,
    device_uuid uuid NOT NULL,
    tenant_id   text NOT NULL,
    action      text NOT NULL,
    actor_sub   text NOT NULL,
    details     jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS robot_events_device_idx ON robot_events (device_uuid, created_at);

ALTER TABLE robot_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE robot_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON robot_enrollments;
CREATE POLICY tenant_isolation ON robot_enrollments
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
DROP POLICY IF EXISTS platform_scope ON robot_enrollments;
CREATE POLICY platform_scope ON robot_enrollments
    USING (current_setting('app.current_tenant_id', true) = '__platform__');

DROP POLICY IF EXISTS tenant_isolation ON robot_events;
CREATE POLICY tenant_isolation ON robot_events
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
DROP POLICY IF EXISTS platform_scope ON robot_events;
CREATE POLICY platform_scope ON robot_events
    USING (current_setting('app.current_tenant_id', true) = '__platform__');
