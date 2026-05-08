-- Migration: Procurement Review workflow step + spec columns on item_requests
-- NOTE: Applied as two separate migrations to Supabase because PostgreSQL requires
--       enum values to be committed before they can be referenced in indexes.
--       Part 1 (procurement_review_enum) adds the enum value.
--       Part 2 (procurement_review_columns_and_index) adds columns and index.

-- ── Part 1: Extend item_request_status enum ───────────────────────────────────
DO $$
BEGIN
  ALTER TYPE item_request_status ADD VALUE IF NOT EXISTS 'PROCUREMENT_REVIEW'
    AFTER 'DUPLICATE_REVIEW';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Part 2: Spec / technical columns ──────────────────────────────────────────
ALTER TABLE item_requests
  ADD COLUMN IF NOT EXISTS spec_gsm              INTEGER,
  ADD COLUMN IF NOT EXISTS spec_uom              TEXT,
  ADD COLUMN IF NOT EXISTS spec_upq              INTEGER,
  ADD COLUMN IF NOT EXISTS spec_material         TEXT,
  ADD COLUMN IF NOT EXISTS spec_grade            TEXT,
  ADD COLUMN IF NOT EXISTS spec_width_cm         NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS spec_height_cm        NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS spec_notes            TEXT,
  ADD COLUMN IF NOT EXISTS procurement_reviewed_at TIMESTAMPTZ;

-- ── Wizard helper columns ────────────────────────────────────────────────────
ALTER TABLE item_requests
  ADD COLUMN IF NOT EXISTS proposed_code         TEXT,
  ADD COLUMN IF NOT EXISTS item_code             TEXT,
  ADD COLUMN IF NOT EXISTS customer_code         TEXT,
  ADD COLUMN IF NOT EXISTS requestor_name        TEXT,
  ADD COLUMN IF NOT EXISTS metadata              JSONB    DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status_changed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by     UUID,
  ADD COLUMN IF NOT EXISTS assigned_to           UUID,
  ADD COLUMN IF NOT EXISTS assigned_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_requested_by UUID;

-- ── Recreate stage-timestamp trigger to handle PROCUREMENT_REVIEW ─────────────
CREATE OR REPLACE FUNCTION set_ir_stage_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'SUBMITTED'        AND OLD.status = 'DRAFT'     THEN NEW.submitted_at        := now(); END IF;
  IF NEW.status = 'DUPLICATE_REVIEW' AND OLD.status = 'SUBMITTED' THEN NEW.duplicate_review_at := now(); END IF;
  IF NEW.status = 'PROCUREMENT_REVIEW'                             THEN NEW.status_changed_at   := now(); END IF;
  IF NEW.status = 'DATA_REVIEW'                                    THEN NEW.data_review_at      := now(); END IF;
  IF NEW.status = 'PRICING_REVIEW'                                 THEN NEW.pricing_review_at   := now(); END IF;
  IF NEW.status = 'APPROVAL_PENDING'                               THEN NEW.approval_pending_at := now(); END IF;
  IF NEW.status = 'APPROVED'                                       THEN NEW.approved_at         := now(); END IF;
  IF NEW.status = 'ACTIVE'                                         THEN NEW.activated_at        := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ── Index for PROCUREMENT_REVIEW status ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ir_status_procurement
  ON item_requests(status)
  WHERE status = 'PROCUREMENT_REVIEW';
