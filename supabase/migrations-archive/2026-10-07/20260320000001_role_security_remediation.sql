-- Fix user permissions and legacy role checks in one migration.
-- 1. Consolidated Source of Truth for roles to public.users.role_id
-- 2. Updated security functions is_admin() and get_user_permissions() to use users table
-- 3. Hardened RLS policies for 15+ core tables to prevent unauthorized public access
-- 4. Added APPROVED status check to common read policies

-- Part 1: Fix Core Security Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role_id = 'ADMIN'
    AND status = 'APPROVED'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    ARRAY(
      SELECT unnest(r.permissions)
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.id = auth.uid() OR u.auth_user_id = auth.uid())
    );
$$;

-- Part 2: Security Hardening (General Auth + Status Guarding)
-- For each core table, we replace or add a policy that prevents access for unapproved users

DO $$ 
DECLARE
    t TEXT;
    all_tables TEXT[] := ARRAY[
        'sites', 'suppliers', 'items', 'catalog_items', 'delivery_lines', 
        'notification_settings', 'deliveries', 'po_approvals', 'po_lines', 
        'workflow_steps', 'stock_snapshots', 'product_availability', 
        'supplier_product_map', 'attribute_options'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        -- Drop any "Allow all public access" policies
        EXECUTE format('DROP POLICY IF EXISTS "Allow all public access" ON public.%I', t);
        
        -- Create a new baseline policy for "Authenticated & Approved"
        EXECUTE format('CREATE POLICY "Authenticated users can view %I" ON public.%I 
            FOR SELECT TO authenticated 
            USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND status = ''APPROVED''))', t, t);
            
        -- Ensure admins can manage everything
        EXECUTE format('CREATE POLICY "Admins can manage %I" ON public.%I 
            FOR ALL TO authenticated 
            USING (is_admin()) 
            WITH CHECK (is_admin())', t, t);
    END LOOP;
END $$;

-- Specifically for po_requests, update the view policy to include status check
DROP POLICY IF EXISTS "Authenticated users can view requests" ON public.po_requests;
CREATE POLICY "Authenticated users can view requests" ON public.po_requests
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND status = 'APPROVED'));

-- Admins should manage users table too
DROP POLICY IF EXISTS "Admins can view and edit all users" ON public.users;
CREATE POLICY "Admins can view and edit all users" ON public.users
    FOR ALL TO authenticated
    USING (is_admin());

-- Cleanup user_roles table if it's not being used, but keep for now just in case.
-- We enable RLS on it as a precaution.
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (is_admin());
