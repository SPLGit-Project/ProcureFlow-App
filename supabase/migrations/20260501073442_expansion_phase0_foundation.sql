-- Phase 0: Expansion Feature Flags + Beta Tester Role
-- Adds new feature flag keys, approve_item_requests permission, and Beta Tester role.
-- All flags default to false so production users see zero change.

INSERT INTO app_config (key, value, updated_at)
VALUES
  ('ui_revamp_enabled',      'true',  NOW()),
  ('smart_buying_v2_enabled','false', NOW()),
  ('integrations_enabled',   'false', NOW())
ON CONFLICT (key) DO NOTHING;

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
  permissions = EXCLUDED.permissions;;
