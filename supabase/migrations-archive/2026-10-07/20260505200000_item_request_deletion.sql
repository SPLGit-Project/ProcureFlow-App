-- Migration: Item Request Deletion Logic
-- Restores functionality to remove requests and all associated child records.
-- Supports owner deletion prior to approval and admin-only deletion post-approval.

-- 1. Update RLS
DROP POLICY IF EXISTS "ir_no_delete" ON item_requests;
DROP POLICY IF EXISTS "ir_admin_delete" ON item_requests;
CREATE POLICY "ir_delete_policy"
  ON item_requests FOR DELETE
  USING (
    is_admin() 
    OR (
      auth.uid() = requestor_id 
      AND status::text NOT IN ('APPROVED', 'PUBLISHING', 'PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED', 'ACTIVE')
    )
  );

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
    v_requester_id UUID;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- Capture request info
    SELECT status::TEXT, resulting_item_id, requestor_id 
    INTO v_status, v_item_id, v_requester_id
    FROM item_requests 
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN; -- Already deleted or not found
    END IF;

    -- Authorization Guard
    v_is_admin := public.is_admin();
    IF NOT v_is_admin THEN
        -- Non-admin check: must be owner AND not approved/active
        IF v_auth_uid != v_requester_id THEN
            RAISE EXCEPTION 'You can only delete your own requests.';
        END IF;
        
        IF v_status IN ('APPROVED', 'PUBLISHING', 'PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED', 'ACTIVE') THEN
            RAISE EXCEPTION 'Once a request is approved or active, it can only be deleted by an administrator.';
        END IF;
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

    -- 7. Log the administrative/user deletion event
    INSERT INTO system_audit_logs (action_type, performed_by, summary, details)
    VALUES (
        CASE WHEN v_is_admin THEN 'ITEM_REQUEST_ADMIN_DELETE' ELSE 'ITEM_REQUEST_USER_DELETE' END,
        v_auth_uid,
        jsonb_build_object(
            'requestId', p_request_id,
            'statusAtDelete', v_status,
            'deletedByAdmin', v_is_admin,
            'timestamp', now()
        ),
        '{}'::jsonb
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_item_request_and_cascade(UUID) TO authenticated;
