CREATE OR REPLACE FUNCTION public.submit_draft_po(
    p_request_id   uuid,
    p_approver_name text,
    p_date          date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status       text;
    v_requester_id uuid;
    v_is_admin     boolean;
BEGIN
    v_is_admin := public.is_admin();

    SELECT status, requester_id
      INTO v_status, v_requester_id
      FROM public.po_requests
     WHERE id = p_request_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    IF v_status != 'DRAFT' THEN
        RAISE EXCEPTION 'Request is not a draft (current status: %)', v_status;
    END IF;

    IF NOT v_is_admin THEN
        IF auth.uid() NOT IN (SELECT auth_user_id FROM public.users WHERE id = v_requester_id) THEN
            RAISE EXCEPTION 'Only the requester can submit their draft for approval.';
        END IF;
    END IF;

    UPDATE public.po_requests
       SET status = 'PENDING_APPROVAL'
     WHERE id = p_request_id;

    INSERT INTO public.po_approvals (po_request_id, approver_name, action, date)
    VALUES (p_request_id, p_approver_name, 'SUBMITTED', p_date);
END;
$$;;
