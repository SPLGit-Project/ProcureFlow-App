-- Migration: 20260826000000_line_need_by_date.sql
-- Description: Add need_by_date (requested delivery date) to po_lines and update PO RPCs

DO $$
BEGIN
    -- 1. Add need_by_date column to po_lines if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'po_lines' 
          AND column_name = 'need_by_date'
    ) THEN
        ALTER TABLE public.po_lines ADD COLUMN need_by_date date;
    END IF;

    -- 2. Backfill existing lines from parent PO request_date
    UPDATE public.po_lines pl
    SET need_by_date = pr.request_date::date
    FROM public.po_requests pr
    WHERE pl.po_request_id = pr.id
      AND pl.need_by_date IS NULL
      AND pr.request_date IS NOT NULL;

    -- 3. Update create_po RPC
    CREATE OR REPLACE FUNCTION public.create_po(
        p_request_id   uuid,
        p_header       jsonb,
        p_lines        jsonb,
        p_approval     jsonb DEFAULT NULL
    )
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $function$
    DECLARE
        v_display_id text;
        v_line       jsonb;
    BEGIN
        -- Insert Header
        INSERT INTO public.po_requests (
            id,
            request_date,
            requester_id,
            site_id,
            supplier_id,
            status,
            total_amount,
            subtotal_amount,
            tax_total_amount,
            total_amount_inc_gst,
            customer_name,
            reason_for_request,
            comments
        ) VALUES (
            p_request_id,
            COALESCE((p_header->>'request_date')::TIMESTAMPTZ, NOW()),
            (p_header->>'requester_id')::UUID,
            (p_header->>'site_id')::UUID,
            (p_header->>'supplier_id')::UUID,
            COALESCE((p_header->>'status'), 'PENDING_APPROVAL'),
            (p_header->>'total_amount')::NUMERIC,
            COALESCE((p_header->>'subtotal_amount')::NUMERIC, (p_header->>'total_amount')::NUMERIC),
            COALESCE((p_header->>'tax_total_amount')::NUMERIC, ROUND((p_header->>'total_amount')::NUMERIC * 0.10, 2)),
            COALESCE((p_header->>'total_amount_inc_gst')::NUMERIC, (p_header->>'total_amount')::NUMERIC + ROUND((p_header->>'total_amount')::NUMERIC * 0.10, 2)),
            (p_header->>'customer_name'),
            (p_header->>'reason_for_request'),
            (p_header->>'comments')
        )
        RETURNING display_id INTO v_display_id;

        -- Insert Lines
        FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
            INSERT INTO public.po_lines (
                id,
                po_request_id,
                item_id,
                sku,
                item_name,
                quantity_ordered,
                unit_price,
                total_price,
                tax_code,
                tax_rate,
                tax_amount,
                total_price_inc_gst,
                concur_po_number,
                need_by_date
            ) VALUES (
                COALESCE((v_line->>'id')::UUID, extensions.uuid_generate_v4()),
                p_request_id,
                (v_line->>'item_id')::UUID,
                (v_line->>'sku'),
                (v_line->>'item_name'),
                (v_line->>'quantity_ordered')::NUMERIC,
                (v_line->>'unit_price')::NUMERIC,
                (v_line->>'total_price')::NUMERIC,
                COALESCE((v_line->>'tax_code'), 'GST'),
                COALESCE((v_line->>'tax_rate')::NUMERIC, 10.00),
                COALESCE((v_line->>'tax_amount')::NUMERIC, ROUND((v_line->>'total_price')::NUMERIC * 0.10, 2)),
                COALESCE((v_line->>'total_price_inc_gst')::NUMERIC, (v_line->>'total_price')::NUMERIC + ROUND((v_line->>'total_price')::NUMERIC * 0.10, 2)),
                (v_line->>'concur_po_number'),
                COALESCE((v_line->>'need_by_date')::DATE, (p_header->>'request_date')::DATE, CURRENT_DATE)
            );
        END LOOP;

        -- Insert Initial Approval History
        IF p_approval IS NOT NULL THEN
            INSERT INTO public.po_approvals (
                po_request_id,
                approver_id,
                approver_name,
                action,
                date,
                comments
            ) VALUES (
                p_request_id,
                (p_approval->>'approver_id')::UUID,
                (p_approval->>'approver_name'),
                (p_approval->>'action'),
                COALESCE((p_approval->>'date')::TIMESTAMPTZ, NOW()),
                (p_approval->>'comments')
            );
        END IF;

        RETURN COALESCE(v_display_id, p_request_id::TEXT);
    END;
    $function$;

    -- 4. Update update_pending_po_request RPC
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
        v_request_date        timestamptz;
        l_line                jsonb;
        v_is_admin            boolean;
        v_received_line_count integer;
        v_subtotal            numeric;
        v_tax_total           numeric;
        v_total_inc_gst       numeric;
    BEGIN
        v_is_admin := public.is_admin();

        SELECT status, requester_id, request_date
          INTO v_status, v_requester_id, v_request_date
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

        v_subtotal := COALESCE((p_header->>'subtotal_amount')::NUMERIC, (p_header->>'total_amount')::NUMERIC);
        v_tax_total := (p_header->>'tax_total_amount')::NUMERIC;
        v_total_inc_gst := (p_header->>'total_amount_inc_gst')::NUMERIC;

        -- Update header fields
        UPDATE public.po_requests SET
            total_amount          = COALESCE(v_subtotal, total_amount),
            subtotal_amount       = COALESCE(v_subtotal, subtotal_amount, total_amount),
            tax_total_amount      = COALESCE(v_tax_total, tax_total_amount, ROUND(COALESCE(v_subtotal, total_amount) * 0.10, 2)),
            total_amount_inc_gst  = COALESCE(v_total_inc_gst, total_amount_inc_gst, COALESCE(v_subtotal, total_amount) + COALESCE(v_tax_total, ROUND(COALESCE(v_subtotal, total_amount) * 0.10, 2))),
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
                quantity_ordered, unit_price, total_price,
                tax_code, tax_rate, tax_amount, total_price_inc_gst,
                concur_po_number, need_by_date
            ) VALUES (
                p_request_id,
                COALESCE((l_line->>'id')::UUID, gen_random_uuid()),
                (l_line->>'item_id')::UUID,
                l_line->>'sku',
                l_line->>'item_name',
                (l_line->>'quantity_ordered')::NUMERIC,
                (l_line->>'unit_price')::NUMERIC,
                (l_line->>'total_price')::NUMERIC,
                COALESCE(l_line->>'tax_code', 'GST'),
                COALESCE((l_line->>'tax_rate')::NUMERIC, 10.00),
                COALESCE((l_line->>'tax_amount')::NUMERIC, ROUND((l_line->>'total_price')::NUMERIC * 0.10, 2)),
                COALESCE((l_line->>'total_price_inc_gst')::NUMERIC, (l_line->>'total_price')::NUMERIC + ROUND((l_line->>'total_price')::NUMERIC * 0.10, 2)),
                l_line->>'concur_po_number',
                COALESCE((l_line->>'need_by_date')::DATE, v_request_date::DATE, CURRENT_DATE)
            )
            ON CONFLICT (id) DO UPDATE SET
                quantity_ordered    = EXCLUDED.quantity_ordered,
                unit_price          = EXCLUDED.unit_price,
                total_price         = EXCLUDED.total_price,
                tax_code            = EXCLUDED.tax_code,
                tax_rate            = EXCLUDED.tax_rate,
                tax_amount          = EXCLUDED.tax_amount,
                total_price_inc_gst = EXCLUDED.total_price_inc_gst,
                concur_po_number    = COALESCE(EXCLUDED.concur_po_number, po_lines.concur_po_number),
                need_by_date        = COALESCE(EXCLUDED.need_by_date, po_lines.need_by_date);
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

END $$;
