-- Migration: item_duplicate_checks
-- One record per item request. Stores duplicate check outcome.
-- Locked (immutable) once outcome is recorded.

DO $$ BEGIN
  CREATE TYPE duplicate_check_outcome AS ENUM (
    'PENDING',          -- Check not yet performed
    'NO_DUPLICATE',     -- No matching item found — create new
    'USE_EXISTING',     -- Existing item satisfies the need — no new item
    'SIMILAR_NEW_REQUIRED'  -- Similar exists but new item justified — must provide reason
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS item_duplicate_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id            UUID NOT NULL UNIQUE REFERENCES item_requests(id) ON DELETE CASCADE,

  -- Search performed
  search_terms          TEXT[] NOT NULL DEFAULT '{}',  -- Terms searched
  performed_by          UUID REFERENCES auth.users(id),
  performed_at          TIMESTAMPTZ,

  -- Candidates found (JSONB array: [{item_id, sku, name, similarity_score}])
  candidate_items       JSONB DEFAULT '[]'::jsonb,
  candidate_count       INTEGER NOT NULL DEFAULT 0,
  highest_similarity    NUMERIC(5,4) DEFAULT 0,  -- 0.0 to 1.0

  -- Outcome
  outcome               duplicate_check_outcome NOT NULL DEFAULT 'PENDING',
  existing_item_id      UUID REFERENCES items(id),  -- Set when outcome = USE_EXISTING
  justification         TEXT,  -- MANDATORY when outcome = SIMILAR_NEW_REQUIRED

  -- Lock: once outcome != PENDING, record is frozen
  is_locked             BOOLEAN NOT NULL DEFAULT false,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Justification required for SIMILAR_NEW_REQUIRED
  CONSTRAINT idc_similar_needs_justification CHECK (
    outcome != 'SIMILAR_NEW_REQUIRED' OR (justification IS NOT NULL AND LENGTH(justification) >= 20)
  ),
  -- existing_item_id required for USE_EXISTING
  CONSTRAINT idc_use_existing_needs_item CHECK (
    outcome != 'USE_EXISTING' OR existing_item_id IS NOT NULL
  )
);

-- Immutability: once locked, no updates allowed
CREATE OR REPLACE FUNCTION enforce_idc_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Duplicate check record % is locked and cannot be modified.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_idc_immutability
  BEFORE UPDATE ON item_duplicate_checks
  FOR EACH ROW EXECUTE FUNCTION enforce_idc_immutability();

-- Auto-lock when outcome is set to a final value
CREATE OR REPLACE FUNCTION auto_lock_idc_on_outcome()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome != 'PENDING' AND OLD.outcome = 'PENDING' THEN
    NEW.is_locked := true;
    NEW.performed_at := COALESCE(NEW.performed_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_idc_auto_lock
  BEFORE UPDATE OF outcome ON item_duplicate_checks
  FOR EACH ROW EXECUTE FUNCTION auto_lock_idc_on_outcome();

-- Auto-create a PENDING duplicate check record when an item_request is submitted
CREATE OR REPLACE FUNCTION create_pending_duplicate_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'SUBMITTED' AND OLD.status = 'DRAFT' THEN
    INSERT INTO item_duplicate_checks (request_id)
    VALUES (NEW.id)
    ON CONFLICT (request_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ir_create_dup_check
  AFTER UPDATE OF status ON item_requests
  FOR EACH ROW EXECUTE FUNCTION create_pending_duplicate_check();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idc_request_id ON item_duplicate_checks(request_id);
CREATE INDEX IF NOT EXISTS idx_idc_outcome ON item_duplicate_checks(outcome);

-- RLS
ALTER TABLE item_duplicate_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idc_select_permitted"
  ON item_duplicate_checks FOR SELECT
  USING (
    is_admin()
    OR has_permission('manage_item_definition')
    OR has_permission('approve_item_requests')
    OR EXISTS (SELECT 1 FROM item_requests ir
               WHERE ir.id = request_id AND ir.requestor_id = auth.uid())
  );

CREATE POLICY "idc_insert_system"
  ON item_duplicate_checks FOR INSERT
  WITH CHECK (is_admin() OR has_permission('manage_item_definition'));

CREATE POLICY "idc_update_master_data"
  ON item_duplicate_checks FOR UPDATE
  USING (
    (is_admin() OR has_permission('manage_item_definition'))
    AND is_locked = false
  );

COMMENT ON TABLE item_duplicate_checks IS
  'One record per item request. Stores the structured outcome of the duplicate search. '
  'Immutable once locked (outcome set to non-PENDING value). '
  'Auto-created when an item_request transitions from DRAFT to SUBMITTED.';
