-- Draft PO support
-- 1. Extend update_pending_po_request so non-admins can edit DRAFT requests
--    (previously only PENDING_APPROVAL was allowed for non-admins).
-- 2. Add submit_draft_po RPC that atomically promotes DRAFT → PENDING_APPROVAL.

CREATE OR REPLACE FUNCTION public.update_pending_po_request(
    p_request_id uuid,
    p_header     jsonb,
    p_lines      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status              text;
    v_requester_id        uuid;
    l_line                jsonb;
    v_is_admin            boolean;
    v_received_line_count integer;
BEGIN
    v_is_admin := public.is_admin();

    SELECT status, requester_id
      INTO v_status, v_requester_id
      FROM public.po_requests
     WHERE id = p_request_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Request % not found', p_request_id;
    END IF;

    -- Non-admins may only edit their own DRAFT or PENDING_APPROVAL requests
    IF NOT v_is_admin THEN
        IF v_status NOT IN ('PENDING_APPROVAL', 'DRAFT') THEN
            RAISE EXCEPTION 'Only PENDING_APPROVAL or DRAFT requests can be edited (current status: %)', v_status;
        END IF;
        IF auth.uid() NOT IN (SELECT auth_user_id FROM public.users WHERE id = v_requester_id) THEN
            RAISE EXCEPTION 'Only the requester can edit their requests.';
        END IF;
    END IF;

    -- Guard: delivery-line removal check is irrelevant for DRAFTs (no deliveries possible)
    IF v_status != 'DRAFT' THEN
        SELECT count(*) INTO v_received_line_count
          FROM public.delivery_lines dl
          JOIN public.po_lines pl ON dl.po_line_id = pl.id
         WHERE pl.po_request_id = p_request_id
           AND pl.id NOT IN (
               SELECT (value->>'id')::uuid
                 FROM jsonb_array_elements(p_lines)
                WHERE (value->>'id') IS NOT NULL
           );

        IF v_received_line_count > 0 THEN
            RAISE EXCEPTION
                'Cannot remove % PO line(s) that already have delivery records. '
                'To correct received quantities, edit or delete the relevant delivery first.',
                v_received_line_count;
        END IF;
    END IF;

    -- Update header fields (COALESCE preserves existing values when key absent)
    UPDATE public.po_requests SET
        total_amount          = COALESCE((p_header->>'total_amount')::NUMERIC,  total_amount),
        reason_for_request    = COALESCE(p_header->>'reason_for_request',       reason_for_request),
        comments              = COALESCE(p_header->>'comments',                 comments),
        customer_name         = COALESCE(p_header->>'customer_name',            customer_name),
        supplier_id           = COALESCE((p_header->>'supplier_id')::UUID,      supplier_id),
        site_id               = COALESCE((p_header->>'site_id')::UUID,          site_id),
        concur_request_number = COALESCE(p_header->>'concur_request_number',    concur_request_number)
    WHERE id = p_request_id;

    -- Lines: remove lines not in payload, upsert those that are
    DELETE FROM public.po_lines
     WHERE po_request_id = p_request_id
       AND id NOT IN (
           SELECT (value->>'id')::uuid
             FROM jsonb_array_elements(p_lines)
            WHERE (value->>'id') IS NOT NULL
       );

    FOR l_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO public.po_lines (
            po_request_id, id, item_id, sku, item_name,
            quantity_ordered, unit_price, total_price, concur_po_number
        ) VALUES (
            p_request_id,
            COALESCE((l_line->>'id')::UUID, gen_random_uuid()),
            (l_line->>'item_id')::UUID,
            l_line->>'sku',
            l_line->>'item_name',
            (l_line->>'quantity_ordered')::NUMERIC,
            (l_line->>'unit_price')::NUMERIC,
            (l_line->>'total_price')::NUMERIC,
            l_line->>'concur_po_number'
        )
        ON CONFLICT (id) DO UPDATE SET
            quantity_ordered = EXCLUDED.quantity_ordered,
            unit_price       = EXCLUDED.unit_price,
            total_price      = EXCLUDED.total_price,
            concur_po_number = COALESCE(EXCLUDED.concur_po_number, po_lines.concur_po_number);
    END LOOP;

    -- Audit log for admin edits on already-submitted/active POs
    IF v_is_admin AND v_status NOT IN ('DRAFT', 'PENDING_APPROVAL') THEN
        BEGIN
            INSERT INTO public.system_audit_logs (action_type, performed_by, summary, details)
            VALUES (
                'ADMIN_PO_EDIT',
                auth.uid()::TEXT,
                jsonb_build_object('po_id', p_request_id, 'po_status_at_edit', v_status),
                p_header
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- non-fatal
        END;
    END IF;
END;
$$;


-- Atomically promote a DRAFT to PENDING_APPROVAL with requester/admin ownership check
CREATE OR REPLACE FUNCTION public.submit_draft_po(p_request_id uuid)
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
END;
$$;
