-- Migration: Expand roles table to support customizable authority limits, data scoping, and governance rules

ALTER TABLE public.roles 
  ADD COLUMN IF NOT EXISTS max_approval_limit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_order_limit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS site_scope_mode text DEFAULT 'ASSIGNED',
  ADD COLUMN IF NOT EXISTS allowed_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enforce_sod boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_role_id text REFERENCES public.roles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- Add check constraint for site_scope_mode if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_site_scope_mode_check'
  ) THEN
    ALTER TABLE public.roles 
      ADD CONSTRAINT roles_site_scope_mode_check 
      CHECK (site_scope_mode IN ('ALL', 'ASSIGNED', 'REGIONAL'));
  END IF;
END $$;

-- Ensure system roles have proper defaults
UPDATE public.roles
SET 
  site_scope_mode = 'ALL',
  max_approval_limit = 0,
  max_order_limit = 0,
  enforce_sod = false
WHERE id = 'ADMIN';

UPDATE public.roles
SET 
  site_scope_mode = 'ASSIGNED',
  max_approval_limit = 10000,
  max_order_limit = 5000,
  enforce_sod = true
WHERE id = 'APPROVER' AND max_approval_limit IS NULL;

UPDATE public.roles
SET 
  site_scope_mode = 'ASSIGNED',
  max_approval_limit = 0,
  max_order_limit = 2000,
  enforce_sod = true
WHERE id = 'SITE_USER' AND max_order_limit IS NULL;
