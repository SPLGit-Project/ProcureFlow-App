-- Migration: Create 'Site Manager' role for facility supervisors
-- Authorizes managing, monitoring, and approving procurement requests and deliveries for assigned sites

-- 0. Ensure roles table schema columns exist
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID,
    role_id TEXT,
    PRIMARY KEY (user_id, role_id)
);

-- 1. Insert or update the 'SITE_MANAGER' role in public.roles
INSERT INTO public.roles (
    id,
    name,
    description,
    is_system,
    permissions
) VALUES (
    'SITE_MANAGER',
    'Site Manager',
    'Facility supervisor authorized to manage, monitor, and approve procurement requests, goods receipt, and operational tracking for assigned site(s).',
    true,
    ARRAY[
        'view_dashboard',
        'view_active_requests',
        'view_completed_requests',
        'view_items',
        'view_stock',
        'view_purchase_pricing',
        'view_suppliers',
        'view_sites',
        'view_reports',
        'view_finance',
        'view_audit_logs',
        'view_workflow',
        'view_notifications',
        'export_orders',
        'export_reports',
        'create_request',
        'receive_goods',
        'edit_po_lines',
        'cancel_po',
        'delete_requests',
        'link_concur',
        'manage_item_requests',
        'approve_requests'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    permissions = EXCLUDED.permissions;

-- 2. Assign 'SITE_MANAGER' role to designated facility site managers
UPDATE public.users
SET role_id = 'SITE_MANAGER'
WHERE id IN (
    '83b2c907-f3eb-4e3a-989f-aebea981500c', -- Paul Phillips (Adelaide)
    '805b9626-1779-43ae-bb8f-970bbb1503f7', -- Teegan Paterson (Albury)
    'a9bc57a2-ef69-411b-a8a5-f5f5179c2423', -- Lisa Wilson (Brisbane)
    'e520848f-c4dd-4862-a7ad-335c65ede405', -- Jason Waight (Cairns)
    'd593571a-c4bd-4627-8b03-33704226e826', -- David You (Sydney & Classic Linen)
    'be5428f4-8658-4c15-8b51-13119217311a', -- Hamoun Adelinik (Holdings)
    '5dbebdad-7944-442f-8544-e9b6ebba52d4', -- Bronwen Glover (Mackay)
    '460a44d0-5237-4e59-aad3-93619d6d50cd', -- Matthew Mancuso (Melbourne)
    '8821acdf-3089-422f-843c-9919a9439640'  -- Rob Callaghan (Perth Belmont & Maddington)
) AND role_id <> 'ADMIN';

-- 3. Ensure public.user_roles reflects the assignment
INSERT INTO public.user_roles (user_id, role_id)
SELECT id, 'SITE_MANAGER'
FROM public.users
WHERE id IN (
    '83b2c907-f3eb-4e3a-989f-aebea981500c',
    '805b9626-1779-43ae-bb8f-970bbb1503f7',
    'a9bc57a2-ef69-411b-a8a5-f5f5179c2423',
    'e520848f-c4dd-4862-a7ad-335c65ede405',
    'd593571a-c4bd-4627-8b03-33704226e826',
    'be5428f4-8658-4c15-8b51-13119217311a',
    '5dbebdad-7944-442f-8544-e9b6ebba52d4',
    '460a44d0-5237-4e59-aad3-93619d6d50cd',
    '8821acdf-3089-422f-843c-9919a9439640'
)
ON CONFLICT (user_id, role_id) DO NOTHING;
