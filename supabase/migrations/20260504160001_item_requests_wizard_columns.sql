
ALTER TABLE item_requests
  ADD COLUMN IF NOT EXISTS wizard_draft         JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_to          UUID         REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by    UUID         REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS revision_requested_by UUID        REFERENCES users(id);

COMMENT ON COLUMN item_requests.wizard_draft IS
  'Per-step draft state keyed by step ID. Written by useItemWizardDraft hook on each step advance. Allows resuming a wizard mid-flight without data loss.';
COMMENT ON COLUMN item_requests.assigned_to IS
  'User currently responsible for actioning this request (set per stage by the routing logic).';
COMMENT ON COLUMN item_requests.status_changed_at IS
  'Timestamp of the most recent status transition. Updated by itemWorkflowService.transitionRequest.';
COMMENT ON COLUMN item_requests.status_changed_by IS
  'User who performed the most recent status transition.';
COMMENT ON COLUMN item_requests.revision_requested_by IS
  'User who triggered the REVISION_REQUIRED transition (approver or master data team member).';
;
