-- Phase 6: RLS hardening on preview tables + approved_items view + margin_thresholds config

-- ── 1. RLS hardening on preview_item_requests ────────────────────────────────
-- Requestors can read own rows; approve_item_requests/manage_development read all

DROP POLICY IF EXISTS "preview_requests_select" ON preview_item_requests;
CREATE POLICY "preview_requests_select" ON preview_item_requests
    FOR SELECT TO authenticated USING (
        created_by = auth.uid()
        OR exists (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
              AND p.name IN ('approve_item_requests', 'manage_development', 'system_admin')
        )
    );

-- ── 2. Preview approval instances — restrict insert ───────────────────────────
DROP POLICY IF EXISTS "preview_approval_instances_insert" ON preview_item_approval_instances;
CREATE POLICY "preview_approval_instances_insert" ON preview_item_approval_instances
    FOR INSERT TO authenticated WITH CHECK (
        exists (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            JOIN role_permissions rp ON r.id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
              AND p.name IN ('approve_item_requests', 'manage_development', 'system_admin')
        )
    );

-- ── 3. Approved items view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW approved_items AS
    SELECT * FROM preview_item_requests
    WHERE lifecycle_status = 'Approved';

GRANT SELECT ON approved_items TO authenticated;

-- ── 4. Seed margin_thresholds in app_config ───────────────────────────────────
INSERT INTO app_config (key, value, updated_at)
VALUES (
    'margin_thresholds',
    '{"defaultPercent": 25, "standard": 25, "contract": 20, "customerSpecific": 20, "promotional": 15, "customerGroup": 25}'::jsonb,
    NOW()
)
ON CONFLICT (key) DO NOTHING;
