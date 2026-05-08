-- Migration: item_requests + item_request_revisions
-- The lifecycle spine for governed item creation

-- Item request status enum — full lifecycle
DO $$ BEGIN
  CREATE TYPE item_request_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'DUPLICATE_REVIEW',
    'DATA_REVIEW',
    'PRICING_REVIEW',
    'APPROVAL_PENDING',
    'REVISION_REQUIRED',
    'APPROVED',
    'PUBLISHING',
    'PARTIALLY_PUBLISHED',
    'FULLY_PUBLISHED',
    'ACTIVE',
    'REPLACED',
    'RETIRED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Item request type enum
DO $$ BEGIN
  CREATE TYPE item_request_type AS ENUM (
    'PURCHASE_AND_SALE',
    'PURCHASE_ONLY',
    'SALE_ONLY',
    'COG',
    'BUNDLE_LINENHUB_ONLY',
    'REPLACEMENT',
    'CUSTOMER_SPECIFIC',
    'SHARED_CATALOGUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS item_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number            TEXT UNIQUE NOT NULL,  -- Human-readable: IR-2026-0001
  request_type              item_request_type NOT NULL,
  status                    item_request_status NOT NULL DEFAULT 'DRAFT',

  -- Requestor details
  requestor_id              UUID NOT NULL REFERENCES auth.users(id),
  department                TEXT,
  business_unit             TEXT,

  -- What they need
  item_description          TEXT NOT NULL,
  business_reason           TEXT NOT NULL,
  required_activation_date  DATE,

  -- References
  replacement_for_item_id   UUID REFERENCES items(id),
  customer_reference        TEXT,  -- Customer name/ID for customer-specific items
  contract_reference        TEXT,  -- Contract number for contract-specific items

  -- Target systems (which systems need this item)
  target_bundle             BOOLEAN NOT NULL DEFAULT false,
  target_linenhub           BOOLEAN NOT NULL DEFAULT false,
  target_salesforce         BOOLEAN NOT NULL DEFAULT false,
  target_sap                BOOLEAN NOT NULL DEFAULT false,

  -- Link to the resulting item (set when Stage 3 is complete)
  resulting_item_id         UUID REFERENCES items(id),

  -- Revision tracking
  revision_number           INTEGER NOT NULL DEFAULT 1,
  revision_reason           TEXT,  -- Populated when status = REVISION_REQUIRED

  -- Urgency (auto-calculated: required_activation_date within 5 business days)
  is_urgent                 BOOLEAN NOT NULL DEFAULT false,

  -- Attachments stored as JSONB array: [{name, url, uploaded_at, uploaded_by}]
  attachments               JSONB DEFAULT '[]'::jsonb,

  -- Stage timestamps (for SLA tracking)
  submitted_at              TIMESTAMPTZ,
  duplicate_review_at       TIMESTAMPTZ,
  data_review_at            TIMESTAMPTZ,
  pricing_review_at         TIMESTAMPTZ,
  approval_pending_at       TIMESTAMPTZ,
  approved_at               TIMESTAMPTZ,
  activated_at              TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate request_number: IR-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS item_request_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_item_request_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.request_number := 'IR-' || TO_CHAR(NOW(), 'YYYY') || '-'
    || LPAD(nextval('item_request_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ir_request_number
  BEFORE INSERT ON item_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION generate_item_request_number();

-- Auto-set is_urgent based on required_activation_date
CREATE OR REPLACE FUNCTION set_ir_urgency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.required_activation_date IS NOT NULL THEN
    NEW.is_urgent := (NEW.required_activation_date - CURRENT_DATE) <= 5;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ir_urgency
  BEFORE INSERT OR UPDATE OF required_activation_date ON item_requests
  FOR EACH ROW EXECUTE FUNCTION set_ir_urgency();

-- Stage timestamp trigger
CREATE OR REPLACE FUNCTION set_ir_stage_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'SUBMITTED'          AND OLD.status = 'DRAFT'           THEN NEW.submitted_at := now(); END IF;
  IF NEW.status = 'DUPLICATE_REVIEW'   AND OLD.status = 'SUBMITTED'       THEN NEW.duplicate_review_at := now(); END IF;
  IF NEW.status = 'DATA_REVIEW'                                            THEN NEW.data_review_at := now(); END IF;
  IF NEW.status = 'PRICING_REVIEW'                                         THEN NEW.pricing_review_at := now(); END IF;
  IF NEW.status = 'APPROVAL_PENDING'                                       THEN NEW.approval_pending_at := now(); END IF;
  IF NEW.status = 'APPROVED'                                               THEN NEW.approved_at := now(); END IF;
  IF NEW.status = 'ACTIVE'                                                 THEN NEW.activated_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ir_stage_timestamps
  BEFORE UPDATE OF status ON item_requests
  FOR EACH ROW EXECUTE FUNCTION set_ir_stage_timestamps();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ir_requestor_id ON item_requests(requestor_id);
CREATE INDEX IF NOT EXISTS idx_ir_status ON item_requests(status);
CREATE INDEX IF NOT EXISTS idx_ir_request_type ON item_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_ir_resulting_item ON item_requests(resulting_item_id);
CREATE INDEX IF NOT EXISTS idx_ir_created_at ON item_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ir_is_urgent ON item_requests(is_urgent) WHERE is_urgent = true;

-- RLS
ALTER TABLE item_requests ENABLE ROW LEVEL SECURITY;

-- Requestors can see their own requests
CREATE POLICY "ir_select_own"
  ON item_requests FOR SELECT
  USING (requestor_id = auth.uid() OR is_admin() OR has_permission('view_all_requests'));

-- Any authenticated user can create a request
CREATE POLICY "ir_insert_any"
  ON item_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Requestor can update their own DRAFT requests; privileged roles can update in their stage
CREATE POLICY "ir_update_requestor_draft"
  ON item_requests FOR UPDATE
  USING (
    (requestor_id = auth.uid() AND status = 'DRAFT')
    OR has_permission('manage_item_definition')
    OR has_permission('manage_purchase_pricing')
    OR has_permission('manage_sell_pricing')
    OR has_permission('approve_item_requests')
    OR is_admin()
  );

-- No deletes (requests are permanent audit records)
CREATE POLICY "ir_no_delete"
  ON item_requests FOR DELETE
  USING (is_admin() AND status = 'DRAFT');

-- ─── item_request_revisions ────────────────────────────────────────────────
-- Full snapshot of request state at each revision point

CREATE TABLE IF NOT EXISTS item_request_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES item_requests(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  status_at_revision item_request_status NOT NULL,
  snapshot        JSONB NOT NULL,  -- Full JSON snapshot of item_requests row at this point
  revision_reason TEXT,
  revised_by      UUID REFERENCES auth.users(id),
  revised_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(request_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_irr_request_id ON item_request_revisions(request_id);

ALTER TABLE item_request_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "irr_select_permitted"
  ON item_request_revisions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM item_requests ir WHERE ir.id = request_id
            AND (ir.requestor_id = auth.uid() OR is_admin() OR has_permission('view_all_requests')))
  );

CREATE POLICY "irr_insert_system"
  ON item_request_revisions FOR INSERT
  WITH CHECK (is_admin() OR has_permission('manage_item_definition') OR has_permission('approve_item_requests'));

-- Auto-snapshot trigger: on REVISION_REQUIRED, save current state
CREATE OR REPLACE FUNCTION snapshot_item_request_revision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'REVISION_REQUIRED' THEN
    INSERT INTO item_request_revisions (request_id, revision_number, status_at_revision, snapshot, revision_reason, revised_by)
    VALUES (
      OLD.id,
      OLD.revision_number,
      OLD.status,
      row_to_json(OLD)::jsonb,
      NEW.revision_reason,
      auth.uid()
    );
    NEW.revision_number := OLD.revision_number + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ir_snapshot_revision
  BEFORE UPDATE OF status ON item_requests
  FOR EACH ROW EXECUTE FUNCTION snapshot_item_request_revision();

COMMENT ON TABLE item_requests IS
  'Lifecycle spine for governed item creation. Every new item starts here. '
  'Status transitions are the authoritative record of workflow position.';

COMMENT ON TABLE item_request_revisions IS
  'Immutable snapshots of item_requests state at each revision point. '
  'Auto-populated when status transitions to REVISION_REQUIRED.';
