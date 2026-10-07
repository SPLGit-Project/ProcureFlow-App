-- Migration: Add administrative delete for item requests
-- Restores functionality to remove requests and all associated child records.

-- 1. Update RLS to allow Admins to delete any item_request
DROP POLICY IF EXISTS "ir_no_delete" ON item_requests;
CREATE POLICY "ir_admin_delete"
  ON item_requests FOR DELETE
  USING (is_admin());

-- 2. Create the cascading delete RPC
CREATE OR REPLACE FUNCTION public.delete_item_request_and_cascade(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_status TEXT;
    v_item_id UUID;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- Authorization Check
    v_is_admin := public.is_admin();
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only administrators can perform a hard delete on item requests.';
    END IF;

    -- Capture request info
    SELECT status::TEXT, resulting_item_id 
    INTO v_status, v_item_id 
    FROM item_requests 
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN; -- Already deleted or not found
    END IF;

    -- 1. Identify and delete price drafts linked to this request's resulting item
    IF v_item_id IS NOT NULL THEN
        DELETE FROM item_sell_prices 
        WHERE item_id = v_item_id 
          AND status IN ('DRAFT', 'PENDING_APPROVAL', 'REJECTED');
          
        DELETE FROM item_purchase_prices 
        WHERE item_id = v_item_id 
          AND status IN ('DRAFT', 'PENDING_APPROVAL', 'REJECTED');

        -- Clear current_request_id link on the item so the request can be deleted
        UPDATE items SET current_request_id = NULL WHERE id = v_item_id;
    END IF;

    -- 2. Delete completeness checks
    DELETE FROM item_completeness_checks WHERE request_id = p_request_id;

    -- 3. Delete approval decisions (requires bypassing immutability trigger)
    EXECUTE 'SET LOCAL session_replication_role = replica';
    
    DELETE FROM item_approval_decisions WHERE request_id = p_request_id;
    
    EXECUTE 'SET LOCAL session_replication_role = origin';

    -- 4. Delete publication events
    DELETE FROM item_publication_events WHERE correlation_id = p_request_id;

    -- 5. Delete the request (cascades to item_request_revisions, item_duplicate_checks, item_approval_instances)
    DELETE FROM item_requests WHERE id = p_request_id;

    -- 6. Delete associated audit logs
    DELETE FROM system_audit_logs 
    WHERE (summary->>'recordId' = p_request_id::text)
       OR (summary->>'table' = 'item_requests' AND summary->>'recordId' = p_request_id::text);

    -- 7. Log the administrative deletion itself
    INSERT INTO system_audit_logs (action_type, performed_by, summary, details)
    VALUES (
        'ITEM_REQUEST_HARD_DELETE',
        v_auth_uid,
        jsonb_build_object(
            'requestId', p_request_id,
            'statusAtDelete', v_status,
            'deletedByAdmin', true,
            'timestamp', now()
        ),
        '{}'::jsonb
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_item_request_and_cascade(UUID) TO authenticated;
;
