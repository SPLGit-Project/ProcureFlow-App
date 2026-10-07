-- 🔒 ProcureFlow: Development Admin Security Migration
-- Description: Syncs the 'manage_development' permission and restricts sensitive tables.

-- 1. Add 'manage_development' to the system 'ADMIN' role
UPDATE public.roles
SET permissions = array_append(permissions, 'manage_development')
WHERE id = 'ADMIN' 
AND NOT (permissions @> ARRAY['manage_development']);

-- 2. Restrict BundleConnect Site Configuration
ALTER TABLE public.bundle_connect_site_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: Manage Site Config" ON public.bundle_connect_site_config;
CREATE POLICY "Development Admin: Manage Site Config" ON public.bundle_connect_site_config
    FOR ALL
    USING (public.has_permission('manage_development'));

-- 3. Restrict Short Supply Facts
ALTER TABLE public.short_supply_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: View Facts" ON public.short_supply_facts;
CREATE POLICY "Development Admin: View Facts" ON public.short_supply_facts
    FOR ALL
    USING (public.has_permission('manage_development'));

-- 4. Restrict Item Operational Metrics
ALTER TABLE public.item_operational_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: Manage Metrics" ON public.item_operational_metrics;
CREATE POLICY "Development Admin: Manage Metrics" ON public.item_operational_metrics
    FOR ALL
    USING (public.has_permission('manage_development'));

-- 5. Restrict BundleConnect Item Mappings
ALTER TABLE public.bundle_connect_item_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: Manage Mappings" ON public.bundle_connect_item_map;
CREATE POLICY "Development Admin: Manage Mappings" ON public.bundle_connect_item_map
    FOR ALL
    USING (public.has_permission('manage_development'));

-- 6. Harden System Audit Logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: View Audit Logs" ON public.system_audit_logs;
CREATE POLICY "Development Admin: View Audit Logs" ON public.system_audit_logs
    FOR SELECT
    USING (public.has_permission('manage_development'));

-- 7. Harden App Config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Development Admin: Manage Config" ON public.app_config;
CREATE POLICY "Development Admin: Manage Config" ON public.app_config
    FOR ALL
    USING (public.has_permission('manage_development'));
