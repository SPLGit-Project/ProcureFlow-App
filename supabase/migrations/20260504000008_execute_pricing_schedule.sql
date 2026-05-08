-- Migration: execute_pricing_schedule() atomic function

CREATE OR REPLACE FUNCTION execute_pricing_schedule(p_schedule_id UUID)
RETURNS TABLE (
  prices_created    INTEGER,
  prices_flagged    INTEGER,
  errors_count      INTEGER,
  execution_status  TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_schedule          pricing_schedules%ROWTYPE;
  v_line              pricing_schedule_lines%ROWTYPE;
  v_current_price     item_sell_prices%ROWTYPE;
  v_new_price         NUMERIC(12,4);
  v_new_price_id      UUID;
  v_prices_created    INTEGER := 0;
  v_prices_flagged    INTEGER := 0;
  v_errors_count      INTEGER := 0;
  v_error_msg         TEXT;
  v_margin_floor      NUMERIC;
  v_new_margin        NUMERIC;
BEGIN
  -- Load and validate the schedule
  SELECT * INTO v_schedule FROM pricing_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing schedule % not found', p_schedule_id;
  END IF;

  IF v_schedule.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Pricing schedule must be in APPROVED status to execute. Current status: %', v_schedule.status;
  END IF;

  -- Mark as EXECUTING
  UPDATE pricing_schedules SET status = 'EXECUTING', updated_at = now() WHERE id = p_schedule_id;

  v_margin_floor := COALESCE(v_schedule.minimum_margin_floor, 25.0);

  -- Process each schedule line
  FOR v_line IN
    SELECT * FROM pricing_schedule_lines
    WHERE schedule_id = p_schedule_id AND executed = false
    ORDER BY item_id
  LOOP
    BEGIN
      -- Load the current sell price record
      SELECT * INTO v_current_price FROM item_sell_prices WHERE id = v_line.sell_price_id;
      IF NOT FOUND THEN
        v_errors_count := v_errors_count + 1;
        UPDATE pricing_schedule_lines
        SET execution_error = 'Source sell price record not found', executed_at = now()
        WHERE id = v_line.id;
        CONTINUE;
      END IF;

      -- Verify it's still ACTIVE (could have changed since schedule was built)
      IF v_current_price.status != 'ACTIVE' THEN
        v_errors_count := v_errors_count + 1;
        UPDATE pricing_schedule_lines
        SET execution_error = 'Source price no longer ACTIVE (status: ' || v_current_price.status || ')',
            executed_at = now()
        WHERE id = v_line.id;
        CONTINUE;
      END IF;

      -- Calculate new price based on uplift method
      v_new_price := CASE v_schedule.uplift_method
        WHEN 'PERCENTAGE_INCREASE' THEN
          v_current_price.sell_price_ex_gst * (1 + v_schedule.uplift_value / 100)
        WHEN 'PERCENTAGE_DECREASE' THEN
          v_current_price.sell_price_ex_gst * (1 - v_schedule.uplift_value / 100)
        WHEN 'FIXED_AMOUNT_INCREASE' THEN
          v_current_price.sell_price_ex_gst + v_schedule.uplift_value
        WHEN 'FIXED_AMOUNT_DECREASE' THEN
          GREATEST(0, v_current_price.sell_price_ex_gst - v_schedule.uplift_value)
        ELSE v_schedule.uplift_value  -- REPLACE_WITH_NEW_PRICE
      END;

      -- Apply rounding rule
      v_new_price := CASE v_schedule.rounding_rule
        WHEN 'ROUND_UP'       THEN CEIL(v_new_price * 100) / 100
        WHEN 'NO_ROUNDING'    THEN v_new_price
        ELSE                       ROUND(v_new_price, 2)  -- ROUND_TO_CENT (default)
      END;

      -- Check margin floor
      v_new_margin := CASE WHEN v_new_price > 0
        THEN ((v_new_price - v_current_price.cost_basis) / v_new_price) * 100
        ELSE 0 END;

      IF v_new_margin < v_margin_floor THEN
        -- Flag but still create the price — it will require separate approval
        v_prices_flagged := v_prices_flagged + 1;
        UPDATE pricing_schedule_lines
        SET is_flagged = true,
            flag_reason = 'New margin ' || ROUND(v_new_margin, 2) || '% is below floor of ' || v_margin_floor || '%'
        WHERE id = v_line.id;
      END IF;

      -- Create the new sell price record (future version)
      INSERT INTO item_sell_prices (
        item_id, price_type, customer_id, customer_group_id, contract_id,
        sale_uom, sell_price_ex_gst, tax_code, cost_basis,
        publish_to_salesforce, publish_to_bundle, publish_to_linenhub,
        effective_from, effective_to, status, created_by
      ) VALUES (
        v_current_price.item_id,
        v_current_price.price_type,
        v_current_price.customer_id,
        v_current_price.customer_group_id,
        v_current_price.contract_id,
        v_current_price.sale_uom,
        v_new_price,
        v_current_price.tax_code,
        v_current_price.cost_basis,  -- cost_basis preserved from current version
        v_current_price.publish_to_salesforce,
        v_current_price.publish_to_bundle,
        v_current_price.publish_to_linenhub,
        v_schedule.new_effective_from,
        NULL,  -- open-ended
        'ACTIVE',  -- New version is immediately ACTIVE from its effective_from date
        auth.uid()
      ) RETURNING id INTO v_new_price_id;

      -- Set effective_to on the outgoing current price (one day before new effective_from)
      -- NOTE: SECURITY DEFINER bypasses RLS only — it does NOT bypass triggers.
      -- This UPDATE succeeds because enforce_isp_immutability() only raises an exception
      -- when OLD.status is SUPERSEDED or EXPIRED. Here OLD.status = 'ACTIVE', so the
      -- trigger allows the transition ACTIVE → SUPERSEDED. This is by design.
      UPDATE item_sell_prices
      SET effective_to = v_schedule.new_effective_from - INTERVAL '1 day',
          status = 'SUPERSEDED',
          superseded_by = v_new_price_id,
          updated_at = now()
      WHERE id = v_current_price.id;

      -- Update the schedule line as executed
      UPDATE pricing_schedule_lines
      SET executed = true,
          new_sell_price_id = v_new_price_id,
          new_margin_percent = v_new_margin,
          executed_at = now()
      WHERE id = v_line.id;

      v_prices_created := v_prices_created + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      v_errors_count := v_errors_count + 1;
      UPDATE pricing_schedule_lines
      SET execution_error = v_error_msg, executed_at = now()
      WHERE id = v_line.id;
      -- Continue processing remaining lines (partial completion is tracked)
    END;
  END LOOP;

  -- Update schedule with results
  UPDATE pricing_schedules SET
    status          = CASE WHEN v_errors_count = 0 THEN 'COMPLETED' ELSE 'FAILED' END,
    prices_created  = v_prices_created,
    executed_at     = now(),
    executed_by     = auth.uid(),
    execution_errors = (
      SELECT jsonb_agg(jsonb_build_object('line_id', id, 'error', execution_error))
      FROM pricing_schedule_lines
      WHERE schedule_id = p_schedule_id AND execution_error IS NOT NULL
    ),
    updated_at = now()
  WHERE id = p_schedule_id;

  RETURN QUERY SELECT v_prices_created, v_prices_flagged, v_errors_count,
    CASE WHEN v_errors_count = 0 THEN 'COMPLETED' ELSE 'COMPLETED_WITH_ERRORS' END;
END;
$$;

-- No trigger override needed.
-- enforce_isp_immutability() blocks updates only when OLD.status IN ('SUPERSEDED','EXPIRED').
-- All updates made by this function transition from ACTIVE status, so the trigger permits them.
-- SECURITY DEFINER grants this function elevated RLS permissions but does NOT affect trigger execution.

COMMENT ON FUNCTION execute_pricing_schedule IS
  'Atomic execution of a pricing schedule. Creates new sell price versions and supersedes current ones. '
  'Must be called on an APPROVED schedule. Partial failures are tracked per line. '
  'Entire function runs in a single transaction — caller should COMMIT or ROLLBACK.';
