-- Phase 0: Expansion Feature Flags + Beta Tester Role
-- Adds new feature flag keys, approve_item_requests permission, and Beta Tester role.
-- All flags default to false so production users see zero change.

-- ─────────────────────────────────────────────────────
-- 1. Feature flags in app_config
-- ─────────────────────────────────────────────────────
INSERT INTO app_config (key, value, updated_at)
VALUES
  ('ui_revamp_enabled',      'false', NOW()),
  ('smart_buying_v2_enabled','false', NOW()),
  ('integrations_enabled',   'false', NOW())
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 2. New permission: approve_item_requests
--    Used by Item Approval Queue (Phase 2d)
-- ─────────────────────────────────────────────────────
-- Permissions are stored in the roles.permissions TEXT[] column.
-- This comment documents the new ID so it can be added to roles via the UI.
-- PermissionId value: 'approve_item_requests'

-- ─────────────────────────────────────────────────────
-- 3. Beta Tester role
--    Has manage_development + basic view permissions.
--    Grants access to all gated expansion features.
-- ─────────────────────────────────────────────────────
INSERT INTO roles (id, name, description, is_system, permissions)
VALUES (
  'beta_tester',
  'Beta Tester',
  'Access to expansion features under development. Use for controlled testing before general release.',
  false,
  ARRAY[
    'view_dashboard',
    'view_items',
    'view_stock',
    'view_suppliers',
    'view_sites',
    'view_active_requests',
    'view_completed_requests',
    'create_request',
    'view_all_requests',
    'approve_requests',
    'receive_goods',
    'view_finance',
    'manage_development'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
