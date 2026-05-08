-- Migration: Phase 8 cutover checkpoint documentation
-- This migration records that all Phase 1-7 work is complete.
-- Feature flags are managed via app_config and should be enabled
-- only after the Cutover Readiness Checker confirms all checks pass.

INSERT INTO app_config (key, value, description)
VALUES (
  'phase8_cutover_ready',
  'false',
  'Set to true by admin after CutoverReadinessChecker confirms all systems ready. Informational only.'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_config IS
  'Application feature flags and configuration. '
  'Key flags: item_request_form_enabled, approved_catalogue_enforced, legacy_item_editing_locked. '
  'All flags default to false and must be manually enabled by Admin after readiness checks.';
