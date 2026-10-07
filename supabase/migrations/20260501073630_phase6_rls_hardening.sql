-- Phase 6: RLS hardening on preview tables + approved_items view + margin_thresholds config

DROP POLICY IF EXISTS "preview_requests_select" ON preview_item_requests;
CREATE POLICY "preview_requests_select" ON preview_item_requests
    FOR SELECT TO authenticated USING (
        created_by = auth.uid()
        OR public.has_permission('approve_item_requests') OR public.has_permission('manage_development') OR public.is_admin()
    );

DROP POLICY IF EXISTS "preview_approval_instances_insert" ON preview_item_approval_instances;
CREATE POLICY "preview_approval_instances_insert" ON preview_item_approval_instances
    FOR INSERT TO authenticated WITH CHECK (
        public.has_permission('approve_item_requests') OR public.has_permission('manage_development') OR public.is_admin()
    );

CREATE OR REPLACE VIEW approved_items AS
    SELECT * FROM preview_item_requests
    WHERE lifecycle_status = 'Approved';

GRANT SELECT ON approved_items TO authenticated;

INSERT INTO app_config (key, value, updated_at)
VALUES (
    'margin_thresholds',
    '{"defaultPercent": 25, "standard": 25, "contract": 20, "customerSpecific": 20, "promotional": 15, "customerGroup": 25}'::jsonb,
    NOW()
)
ON CONFLICT (key) DO NOTHING;;
