-- Migration: Add non_default_supplier tracking columns to po_requests
-- Author: Aaron Bell
-- Date: 2026-09-24

ALTER TABLE public.po_requests
    ADD COLUMN IF NOT EXISTS is_non_default_supplier BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS non_default_supplier_reason TEXT;

CREATE OR REPLACE FUNCTION public.create_po_atomic(
    p_request_id uuid,
    p_header jsonb,
    p_lines jsonb,
    p_approval jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_display_id TEXT;
    v_line JSONB;
    v_subtotal NUMERIC;
    v_tax_total NUMERIC;
    v_total_inc_gst NUMERIC;
BEGIN
    v_subtotal := COALESCE((p_header->>'subtotal_amount')::NUMERIC, (p_header->>'total_amount')::NUMERIC, 0);
    v_tax_total := COALESCE((p_header->>'tax_total_amount')::NUMERIC, ROUND(v_subtotal * 0.10, 2));
    v_total_inc_gst := COALESCE((p_header->>'total_amount_inc_gst')::NUMERIC, v_subtotal + v_tax_total);

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
        comments,
        is_non_default_supplier,
        non_default_supplier_reason
    ) VALUES (
        p_request_id,
        COALESCE((p_header->>'request_date')::TIMESTAMPTZ, NOW()),
        (p_header->>'requester_id')::UUID,
        (p_header->>'site_id')::UUID,
        (p_header->>'supplier_id')::UUID,
        COALESCE((p_header->>'status'), 'PENDING_APPROVAL'),
        v_subtotal,
        v_subtotal,
        v_tax_total,
        v_total_inc_gst,
        (p_header->>'customer_name'),
        (p_header->>'reason_for_request'),
        (p_header->>'comments'),
        COALESCE((p_header->>'is_non_default_supplier')::BOOLEAN, FALSE),
        (p_header->>'non_default_supplier_reason')
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
