-- Migration: item_publication_events, item_completeness_checks,
--            pricing_schedules, pricing_schedule_lines

-- ─── Publication target enum ─────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE publication_target AS ENUM ('BUNDLE', 'LINENHUB', 'SALESFORCE', 'SAP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE publication_event_status AS ENUM (
    'QUEUED', 'DISPATCHING', 'DISPATCHED', 'ACKNOWLEDGED',
    'FAILED', 'RETRYING', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── item_publication_events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_publication_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id          UUID NOT NULL,  -- = item_requests.id for traceability
  item_id                 UUID NOT NULL REFERENCES items(id),
  price_record_id         UUID,           -- FK to item_sell_prices (nullable for item-only events)
  target_system           publication_target NOT NULL,
  event_type              TEXT NOT NULL,  -- 'ItemPublished', 'PriceVersionActivated', etc.
  payload                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_hash            TEXT,           -- SHA-256 of payload for idempotency

  status                  publication_event_status NOT NULL DEFAULT 'QUEUED',
  retry_count             INTEGER NOT NULL DEFAULT 0,
  max_retries             INTEGER NOT NULL DEFAULT 5,
  last_attempted_at       TIMESTAMPTZ,
  next_retry_at           TIMESTAMPTZ,
  error_message           TEXT,

  dispatched_at           TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ,
  external_item_id        TEXT,   -- ID returned by downstream system
  external_price_id       TEXT,   -- Price ID returned by downstream system

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ipe_item_id ON item_publication_events(item_id);
CREATE INDEX IF NOT EXISTS idx_ipe_correlation_id ON item_publication_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ipe_status ON item_publication_events(status);
CREATE INDEX IF NOT EXISTS idx_ipe_queued ON item_publication_events(next_retry_at)
  WHERE status IN ('QUEUED', 'RETRYING');

CREATE OR REPLACE FUNCTION update_ipe_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_ipe_updated_at
  BEFORE UPDATE ON item_publication_events
  FOR EACH ROW EXECUTE FUNCTION update_ipe_updated_at();

ALTER TABLE item_publication_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipe_select_admin_master_data"
  ON item_publication_events FOR SELECT
  USING (is_admin() OR has_permission('publish_items') OR has_permission('manage_item_definition'));
CREATE POLICY "ipe_insert_system"
  ON item_publication_events FOR INSERT
  WITH CHECK (is_admin() OR has_permission('publish_items'));
CREATE POLICY "ipe_update_system"
  ON item_publication_events FOR UPDATE
  USING (is_admin() OR has_permission('publish_items'));

-- ─── item_completeness_checks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_completeness_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           UUID NOT NULL REFERENCES items(id),
  request_id        UUID REFERENCES item_requests(id),
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by        UUID REFERENCES auth.users(id),

  -- Results per target system (JSONB: [{field, required_for, passed, value_present}])
  check_results     JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Summary
  total_checks      INTEGER NOT NULL DEFAULT 0,
  passed_checks     INTEGER NOT NULL DEFAULT 0,
  failed_checks     INTEGER NOT NULL DEFAULT 0,
  is_complete       BOOLEAN GENERATED ALWAYS AS (failed_checks = 0 AND total_checks > 0) STORED,

  -- Failing fields for quick display (array of field names)
  failing_fields    TEXT[] DEFAULT '{}',

  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_icc_item_id ON item_completeness_checks(item_id);
CREATE INDEX IF NOT EXISTS idx_icc_is_complete ON item_completeness_checks(is_complete);

ALTER TABLE item_completeness_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icc_select_permitted"
  ON item_completeness_checks FOR SELECT
  USING (is_admin() OR has_permission('manage_item_definition') OR has_permission('publish_items'));
CREATE POLICY "icc_insert_master_data"
  ON item_completeness_checks FOR INSERT
  WITH CHECK (is_admin() OR has_permission('manage_item_definition'));

-- ─── pricing_schedules ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE pricing_schedule_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
    'SCHEDULED', 'EXECUTING', 'COMPLETED',
    'CANCELLED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_schedule_basis AS ENUM ('CPI', 'MWA', 'BUSINESS_DECISION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_schedule_method AS ENUM (
    'PERCENTAGE_INCREASE', 'PERCENTAGE_DECREASE',
    'FIXED_AMOUNT_INCREASE', 'FIXED_AMOUNT_DECREASE',
    'REPLACE_WITH_NEW_PRICE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pricing_schedules (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_number           TEXT UNIQUE NOT NULL,  -- PS-2026-0001
  schedule_name             TEXT NOT NULL,
  basis                     pricing_schedule_basis NOT NULL,
  basis_reference           TEXT,           -- e.g., ABS CPI index reference, MWA determination number
  justification             TEXT,           -- Mandatory for BUSINESS_DECISION basis

  uplift_method             pricing_schedule_method NOT NULL,
  uplift_value              NUMERIC(8,4) NOT NULL CHECK (uplift_value > 0),
                                            -- Percentage (e.g. 3.5 = 3.5%) or dollar amount

  -- Scope filters
  price_type_filter         sell_price_type[],  -- NULL = all price types
  item_category_filter      TEXT[],
  item_sub_category_filter  TEXT[],
  exclude_item_ids          UUID[],

  -- Date
  new_effective_from        DATE NOT NULL,
  rounding_rule             TEXT NOT NULL DEFAULT 'ROUND_TO_CENT',
                                            -- ROUND_UP, ROUND_TO_CENT, NO_ROUNDING
  minimum_margin_floor      NUMERIC(6,4) DEFAULT 25.0,

  status                    pricing_schedule_status NOT NULL DEFAULT 'DRAFT',

  -- Preview summary (populated after dry-run)
  preview_item_count        INTEGER DEFAULT 0,
  preview_prices_to_create  INTEGER DEFAULT 0,
  preview_flagged_count     INTEGER DEFAULT 0,  -- Items below margin floor
  preview_sample            JSONB DEFAULT '[]'::jsonb,  -- [{item_id, sku, old_price, new_price}]

  -- Execution results
  executed_at               TIMESTAMPTZ,
  executed_by               UUID REFERENCES auth.users(id),
  prices_created            INTEGER DEFAULT 0,
  execution_errors          JSONB DEFAULT '[]'::jsonb,
  execution_report_url      TEXT,

  created_by                UUID REFERENCES auth.users(id),
  approved_by               UUID REFERENCES auth.users(id),
  approved_at               TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ps_business_needs_justification CHECK (
    basis != 'BUSINESS_DECISION' OR (justification IS NOT NULL AND LENGTH(justification) >= 20)
  )
);

CREATE SEQUENCE IF NOT EXISTS pricing_schedule_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_pricing_schedule_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.schedule_number := 'PS-' || TO_CHAR(NOW(), 'YYYY') || '-'
    || LPAD(nextval('pricing_schedule_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ps_schedule_number
  BEFORE INSERT ON pricing_schedules
  FOR EACH ROW WHEN (NEW.schedule_number IS NULL OR NEW.schedule_number = '')
  EXECUTE FUNCTION generate_pricing_schedule_number();

CREATE OR REPLACE FUNCTION update_ps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_ps_updated_at
  BEFORE UPDATE ON pricing_schedules
  FOR EACH ROW EXECUTE FUNCTION update_ps_updated_at();

-- Immutability: APPROVED/COMPLETED schedules cannot be modified
CREATE OR REPLACE FUNCTION enforce_ps_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('COMPLETED', 'EXECUTING') THEN
    RAISE EXCEPTION 'Cannot modify a % pricing schedule.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ps_immutability
  BEFORE UPDATE ON pricing_schedules
  FOR EACH ROW EXECUTE FUNCTION enforce_ps_immutability();

CREATE INDEX IF NOT EXISTS idx_ps_status ON pricing_schedules(status);
CREATE INDEX IF NOT EXISTS idx_ps_effective_from ON pricing_schedules(new_effective_from);

ALTER TABLE pricing_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_select_finance"
  ON pricing_schedules FOR SELECT
  USING (is_admin() OR has_permission('manage_pricing_schedules'));
CREATE POLICY "ps_insert_finance"
  ON pricing_schedules FOR INSERT
  WITH CHECK (is_admin() OR has_permission('manage_pricing_schedules'));
CREATE POLICY "ps_update_finance"
  ON pricing_schedules FOR UPDATE
  USING ((is_admin() OR has_permission('manage_pricing_schedules')) AND status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'));

-- ─── pricing_schedule_lines ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_schedule_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id           UUID NOT NULL REFERENCES pricing_schedules(id) ON DELETE CASCADE,
  item_id               UUID NOT NULL REFERENCES items(id),
  sell_price_id         UUID NOT NULL REFERENCES item_sell_prices(id),

  old_price             NUMERIC(12,4) NOT NULL,
  calculated_new_price  NUMERIC(12,4) NOT NULL,
  new_sell_price_id     UUID REFERENCES item_sell_prices(id),  -- Set after execution

  old_margin_percent    NUMERIC(7,4),
  new_margin_percent    NUMERIC(7,4),

  is_flagged            BOOLEAN NOT NULL DEFAULT false,  -- Below margin floor
  flag_reason           TEXT,

  executed              BOOLEAN NOT NULL DEFAULT false,
  execution_error       TEXT,
  executed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_psl_schedule_id ON pricing_schedule_lines(schedule_id);
CREATE INDEX IF NOT EXISTS idx_psl_item_id ON pricing_schedule_lines(item_id);

ALTER TABLE pricing_schedule_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psl_select_finance"
  ON pricing_schedule_lines FOR SELECT
  USING (is_admin() OR has_permission('manage_pricing_schedules'));
CREATE POLICY "psl_insert_finance"
  ON pricing_schedule_lines FOR INSERT
  WITH CHECK (is_admin() OR has_permission('manage_pricing_schedules'));
CREATE POLICY "psl_update_finance"
  ON pricing_schedule_lines FOR UPDATE
  USING (is_admin() OR has_permission('manage_pricing_schedules'));

COMMENT ON TABLE pricing_schedules IS
  'Governed batch price update operations (CPI, MWA, Business Decision). '
  'Requires approval before execution. Execution is atomic. '
  'Does NOT modify existing price records — creates new item_sell_prices versions.';
