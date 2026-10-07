-- Migration: Core database functions and views for pricing resolution
-- Created: 2026-05-04
-- Description: Implements resolve_item_price, resolve_purchase_cost,
--              v_current_item_prices, evaluate_item_approval_rules,
--              and check_item_completeness.

-- NOTE: workflow_status is added to items in migration 20260504000009_permissions_and_migration.sql
-- as item_workflow_status enum type with DEFAULT 'LEGACY'. That migration also recreates this
-- view to include the column. Do NOT add it here — the enum type does not exist yet at this point.

-- ─── resolve_item_price ───────────────────────────────────────────────────────
-- Returns the most specific applicable sell price for a given item, customer, and date.
-- Specificity hierarchy: CONTRACT > CUSTOMER_SPECIFIC > GROUP > STANDARD
-- Returns NULL if no active price found.

CREATE OR REPLACE FUNCTION resolve_item_price(
  p_item_id     UUID,
  p_customer_id UUID DEFAULT NULL,
  p_as_of_date  DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  price_record_id   UUID,
  price_type        sell_price_type,
  sell_price_ex_gst NUMERIC(12,4),
  cost_basis        NUMERIC(12,4),
  margin_percent    NUMERIC(7,4),
  effective_from    DATE,
  effective_to      DATE,
  sale_uom          TEXT,
  tax_code          TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH ranked_prices AS (
    SELECT
      isp.id AS price_record_id,
      isp.price_type,
      isp.sell_price_ex_gst,
      isp.cost_basis,
      isp.margin_percent,
      isp.effective_from,
      isp.effective_to,
      isp.sale_uom,
      isp.tax_code,
      -- Specificity rank: CONTRACT=1 (highest), CUSTOMER_SPECIFIC=2, GROUP=3, STANDARD=4
      CASE isp.price_type
        WHEN 'CONTRACT'         THEN 1
        WHEN 'CUSTOMER_SPECIFIC' THEN 2
        WHEN 'GROUP'            THEN 3
        WHEN 'STANDARD'         THEN 4
        ELSE 5
      END AS specificity_rank
    FROM item_sell_prices isp
    WHERE
      isp.item_id = p_item_id
      AND isp.status = 'ACTIVE'
      AND isp.effective_from <= p_as_of_date
      AND (isp.effective_to IS NULL OR isp.effective_to >= p_as_of_date)
      AND (
        -- STANDARD: applies to all customers
        isp.price_type = 'STANDARD'
        -- CUSTOMER_SPECIFIC: only for this exact customer
        OR (isp.price_type = 'CUSTOMER_SPECIFIC' AND isp.customer_id = p_customer_id)
        -- GROUP/CONTRACT: checked by caller with group resolution; simplified here
        OR (isp.price_type IN ('GROUP', 'CONTRACT') AND p_customer_id IS NOT NULL)
        -- PROMOTIONAL: treat same as STANDARD for resolution
        OR isp.price_type = 'PROMOTIONAL'
      )
  )
  SELECT
    ranked_prices.price_record_id, ranked_prices.price_type, ranked_prices.sell_price_ex_gst, ranked_prices.cost_basis,
    ranked_prices.margin_percent, ranked_prices.effective_from, ranked_prices.effective_to, ranked_prices.sale_uom, ranked_prices.tax_code
  FROM ranked_prices
  ORDER BY specificity_rank ASC, effective_from DESC
  LIMIT 1;
END;
$$;

-- ─── resolve_purchase_cost ────────────────────────────────────────────────────
-- Returns the landed cost for the preferred supplier for a given item and date.

CREATE OR REPLACE FUNCTION resolve_purchase_cost(
  p_item_id     UUID,
  p_supplier_id UUID DEFAULT NULL,
  p_as_of_date  DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  price_record_id       UUID,
  supplier_id           UUID,
  purchase_price_ex_gst NUMERIC(12,4),
  landed_cost           NUMERIC(12,4),
  currency              CHAR(3),
  purchase_uom          TEXT,
  effective_from        DATE,
  effective_to          DATE
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ipp.id,
    ipp.supplier_id,
    ipp.purchase_price_ex_gst,
    ipp.landed_cost,
    ipp.currency,
    ipp.purchase_uom,
    ipp.effective_from,
    ipp.effective_to
  FROM item_purchase_prices ipp
  WHERE
    ipp.item_id = p_item_id
    AND ipp.status = 'ACTIVE'
    AND ipp.effective_from <= p_as_of_date
    AND (ipp.effective_to IS NULL OR ipp.effective_to >= p_as_of_date)
    AND (p_supplier_id IS NULL OR ipp.supplier_id = p_supplier_id)
  ORDER BY
    ipp.is_preferred_supplier DESC,  -- preferred supplier first
    ipp.effective_from DESC
  LIMIT 1;
END;
$$;

-- ─── v_current_item_prices ────────────────────────────────────────────────────
-- One row per item showing its current STANDARD active sell price and
-- preferred purchase cost. Used for catalogue display and PO item selection.

-- NOTE: workflow_status is intentionally excluded here — it does not exist until
-- migration 000009 adds it as item_workflow_status enum. Migration 000009 recreates
-- this view after the column is properly created.
CREATE OR REPLACE VIEW v_current_item_prices AS
SELECT
  i.id AS item_id,
  i.sku,
  i.name AS item_name,
  i.category,
  i.sub_category,
  i.uom,
  i.active_flag,

  -- Current STANDARD sell price
  isp.id AS sell_price_record_id,
  isp.sell_price_ex_gst,
  isp.tax_code,
  isp.margin_percent AS standard_margin_percent,
  isp.effective_from AS sell_effective_from,
  isp.effective_to AS sell_effective_to,
  isp.publish_to_bundle,
  isp.publish_to_linenhub,
  isp.publish_to_salesforce,

  -- Current preferred purchase cost
  ipp.id AS purchase_price_record_id,
  ipp.landed_cost AS current_landed_cost,
  ipp.supplier_id AS preferred_supplier_id,
  ipp.purchase_price_ex_gst AS current_purchase_price

FROM items i
LEFT JOIN item_sell_prices isp ON
  isp.item_id = i.id
  AND isp.price_type = 'STANDARD'
  AND isp.status = 'ACTIVE'
  AND isp.effective_from <= CURRENT_DATE
  AND (isp.effective_to IS NULL OR isp.effective_to >= CURRENT_DATE)
LEFT JOIN item_purchase_prices ipp ON
  ipp.item_id = i.id
  AND ipp.is_preferred_supplier = true
  AND ipp.status = 'ACTIVE'
  AND ipp.effective_from <= CURRENT_DATE
  AND (ipp.effective_to IS NULL OR ipp.effective_to >= CURRENT_DATE)
WHERE i.active_flag = true;

-- ─── v_future_price_changes ──────────────────────────────────────────────────
-- All APPROVED_FUTURE sell price records with countdown

CREATE OR REPLACE VIEW v_future_price_changes AS
SELECT
  isp.id AS price_record_id,
  isp.item_id,
  i.sku,
  i.name AS item_name,
  isp.price_type,
  isp.sell_price_ex_gst AS future_price,
  isp.effective_from,
  (isp.effective_from - CURRENT_DATE) AS days_until_effective,
  isp.margin_percent,
  isp.created_by,
  isp.created_at
FROM item_sell_prices isp
JOIN items i ON i.id = isp.item_id
WHERE isp.status = 'APPROVED_FUTURE'
ORDER BY isp.effective_from ASC, i.name ASC;

-- ─── evaluate_item_approval_rules ────────────────────────────────────────────
-- Evaluates active approval rules against an item request.
-- Returns the set of approval tasks to create for that request.

CREATE OR REPLACE FUNCTION evaluate_item_approval_rules(p_request_id UUID)
RETURNS TABLE (
  rule_id         UUID,
  rule_name       TEXT,
  approver_type   TEXT,
  approver_id     TEXT,
  stage_order     INTEGER,
  sla_hours       INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_request         item_requests%ROWTYPE;
  v_margin_percent  NUMERIC;
  v_threshold       NUMERIC := 25.0;
BEGIN
  SELECT * INTO v_request FROM item_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item request % not found', p_request_id;
  END IF;

  -- Get configured margin threshold
  SELECT COALESCE((value::numeric), 25.0) INTO v_threshold
  FROM app_config WHERE key = 'margin_approval_threshold' LIMIT 1;

  -- Get lowest margin_percent on sell prices for this request
  SELECT MIN(isp.margin_percent) INTO v_margin_percent
  FROM item_sell_prices isp
  JOIN items it ON it.id = isp.item_id
  WHERE it.id = v_request.resulting_item_id AND isp.status IN ('DRAFT', 'PENDING_APPROVAL');

  RETURN QUERY
  SELECT
    iar.id,
    iar.rule_name,
    iar.approver_type,
    iar.approver_id,
    iar.sequential_stage_order,
    iar.sla_hours
  FROM item_approval_rules iar
  WHERE iar.is_active = true
  AND (
    -- DEFAULT: always fires
    iar.condition_type = 'DEFAULT'
    -- MARGIN_BELOW: sell price margin below threshold
    OR (iar.condition_type = 'MARGIN_BELOW'
        AND v_margin_percent IS NOT NULL
        AND v_margin_percent < COALESCE(iar.condition_value::numeric, v_threshold))
    -- PURCHASE_ONLY
    OR (iar.condition_type = 'PURCHASE_ONLY' AND v_request.request_type = 'PURCHASE_ONLY')
    -- SALE_ONLY (maps to condition check on request_type)
    OR (iar.condition_type = 'SALE_ONLY' AND v_request.request_type = 'SALE_ONLY')
    -- CUSTOMER_SPECIFIC
    OR (iar.condition_type = 'CUSTOMER_SPECIFIC' AND v_request.request_type = 'CUSTOMER_SPECIFIC')
    -- CONTRACT
    OR (iar.condition_type = 'CONTRACT' AND v_request.contract_reference IS NOT NULL)
    -- COG
    OR (iar.condition_type = 'COG' AND v_request.request_type = 'COG')
    -- URGENT
    OR (iar.condition_type = 'URGENT' AND v_request.is_urgent = true)
    -- REPLACEMENT
    OR (iar.condition_type = 'REPLACEMENT' AND v_request.request_type = 'REPLACEMENT')
  )
  ORDER BY iar.sequential_stage_order ASC;
END;
$$;

-- ─── check_item_completeness ─────────────────────────────────────────────────
-- Checks an item against required fields for each enabled target system.
-- Returns JSONB array of check results for storage in item_completeness_checks.

CREATE OR REPLACE FUNCTION check_item_completeness(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_item        items%ROWTYPE;
  v_results     JSONB := '[]'::jsonb;
  v_passed      INTEGER := 0;
  v_failed      INTEGER := 0;
  v_check       RECORD;
BEGIN
  SELECT * INTO v_item FROM items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  -- Define checks using a CTE or simple loops for standard PL/pgSQL compatibility
  FOR v_check IN 
    SELECT 'sku' as field, 'ALL' as target, (v_item.sku IS NOT NULL AND v_item.sku != '') as passed
    UNION ALL SELECT 'name', 'ALL', (v_item.name IS NOT NULL AND v_item.name != '')
    UNION ALL SELECT 'category', 'ALL', (v_item.category IS NOT NULL)
    UNION ALL SELECT 'uom', 'ALL', (v_item.uom IS NOT NULL)
    UNION ALL SELECT 'unit_price', 'ALL', (v_item.unit_price IS NOT NULL AND v_item.unit_price > 0)
    UNION ALL SELECT 'sap_item_code_norm', 'SAP', (v_item.sap_item_code_norm IS NOT NULL)
    UNION ALL SELECT 'item_weight', 'SAP', (v_item.item_weight IS NOT NULL)
    UNION ALL SELECT 'item_type', 'BUNDLE,LINENHUB', (v_item.item_type IS NOT NULL)
    UNION ALL SELECT 'description', 'BUNDLE,LINENHUB', (v_item.description IS NOT NULL AND LENGTH(v_item.description) >= 5)
    UNION ALL SELECT 'active_sell_price', 'ALL', EXISTS (
      SELECT 1 FROM item_sell_prices isp
      WHERE isp.item_id = p_item_id
        AND isp.status = 'ACTIVE'
        AND isp.effective_from <= CURRENT_DATE
        AND (isp.effective_to IS NULL OR isp.effective_to >= CURRENT_DATE)
    )
    UNION ALL SELECT 'active_purchase_price', 'PROCUREMENT', EXISTS (
      SELECT 1 FROM item_purchase_prices ipp
      WHERE ipp.item_id = p_item_id
        AND ipp.status = 'ACTIVE'
        AND ipp.effective_from <= CURRENT_DATE
    )
  LOOP
    v_results := v_results || jsonb_build_object(
      'field', v_check.field,
      'required_for', v_check.target,
      'passed', v_check.passed
    );
    IF v_check.passed THEN v_passed := v_passed + 1;
    ELSE v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'results', v_results,
    'total_checks', v_passed + v_failed,
    'passed_checks', v_passed,
    'failed_checks', v_failed,
    'is_complete', v_failed = 0
  );
END;
$$;

COMMENT ON FUNCTION resolve_item_price IS
  'Returns the most specific active sell price for an item/customer/date combination. '
  'All application code needing a sell price must use this function.';

COMMENT ON FUNCTION evaluate_item_approval_rules IS
  'Evaluates active item_approval_rules against a request. '
  'Returns the ordered set of approval tasks to create. Called by the approval engine service.';

COMMENT ON VIEW v_current_item_prices IS
  'One row per active item. Shows current STANDARD sell price and preferred purchase cost. '
  'Used for PO item selection — replaces raw items.unit_price reads.';
