
-- Phase 1: Add wizard-support columns to item_requests
ALTER TABLE item_requests
  ADD COLUMN IF NOT EXISTS wizard_draft         JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_to          UUID  REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by    UUID  REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS revision_requested_by UUID REFERENCES users(id);

COMMENT ON COLUMN item_requests.wizard_draft          IS 'Per-step form state, keyed by step ID. Auto-saved by useItemWizardDraft hook.';
COMMENT ON COLUMN item_requests.assigned_to           IS 'User currently responsible for actioning this request at its current stage.';
COMMENT ON COLUMN item_requests.status_changed_at     IS 'Timestamp of the most recent status transition.';
COMMENT ON COLUMN item_requests.status_changed_by     IS 'User who last changed the status.';
COMMENT ON COLUMN item_requests.revision_requested_by IS 'User who sent the request back for revision.';
;
