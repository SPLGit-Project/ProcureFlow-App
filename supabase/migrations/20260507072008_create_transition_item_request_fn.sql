
CREATE OR REPLACE FUNCTION public.transition_item_request(
  p_request_id  uuid,
  p_to_status   text,
  p_actor_id    uuid,
  p_notes       text    DEFAULT NULL,
  p_metadata    jsonb   DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_status text;
  v_now         timestamptz := now();
BEGIN
  -- Fetch current status (bypasses RLS via SECURITY DEFINER)
  SELECT status::text INTO v_from_status
  FROM item_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  -- Apply status update
  UPDATE item_requests
  SET
    status             = p_to_status::item_request_status,
    status_changed_at  = v_now,
    status_changed_by  = p_actor_id
  WHERE id = p_request_id;

  -- Write audit log (best-effort, swallowed on error)
  BEGIN
    INSERT INTO item_request_audit_log (
      request_id, action, from_status, to_status,
      performed_by, performed_at, notes, metadata
    ) VALUES (
      p_request_id, 'STATUS_TRANSITION', v_from_status, p_to_status,
      p_actor_id, v_now, p_notes, p_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort; don't block the transition
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_item_request TO anon, authenticated;
;
