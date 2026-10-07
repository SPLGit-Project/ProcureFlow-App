-- Migration: 20260423000000_atomic_po_creation_and_rls.sql
-- Description: Fixes PO creation failure for non-admin users (like Lisa Wilson) by:
-- 1. Adding missing INSERT/UPDATE/DELETE policies for po_lines.
-- 2. Implementing an atomic RPC for PO creation to ensure database integrity.

DO $$ 
BEGIN
    -- 1. Add missing RLS policies for po_lines
    -- (Previous migration 20260318000002_rls_hardening.sql only allowed ADMIN write access)
    
    DROP POLICY IF EXISTS "Requesters can manage lines for their own POs" ON public.po_lines;
    CREATE POLICY "Requesters can manage lines for their own POs"
    ON public.po_lines
    FOR ALL -- Covers INSERT, UPDATE, DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.po_requests
            WHERE id = public.po_lines.po_request_id
            AND (
                auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
                OR
                EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role_id = 'ADMIN')
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.po_requests
            WHERE id = public.po_lines.po_request_id
            AND (
                auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
                OR
                EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role_id = 'ADMIN')
            )
        )
    );

    -- 2. Implement the atomic create_po RPC
    -- This ensures that Header, Lines, and Approval are created in a single transaction.
    CREATE OR REPLACE FUNCTION public.create_po_atomic(
        p_request_id UUID,
        p_header JSONB,
        p_lines JSONB,
        p_approval JSONB
    )
    RETURNS TEXT -- returns the display_id
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $function$
    DECLARE
        v_display_id TEXT;
        v_line JSONB;
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
            customer_name,
            reason_for_request,
            comments
        ) VALUES (
            p_request_id,
            (p_header->>'request_date')::TIMESTAMPTZ,
            (p_header->>'requester_id')::UUID,
            (p_header->>'site_id')::UUID,
            (p_header->>'supplier_id')::UUID,
            (p_header->>'status'),
            (p_header->>'total_amount')::NUMERIC,
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
                concur_po_number
            ) VALUES (
                COALESCE((v_line->>'id')::UUID, extensions.uuid_generate_v4()),
                p_request_id,
                (v_line->>'item_id')::UUID,
                (v_line->>'sku'),
                (v_line->>'item_name'),
                (v_line->>'quantity_ordered')::INTEGER,
                (v_line->>'unit_price')::NUMERIC,
                (v_line->>'total_price')::NUMERIC,
                (v_line->>'concur_po_number')
            );
        END LOOP;

        -- Insert Initial Approval History
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

        RETURN COALESCE(v_display_id, p_request_id::TEXT);
    END;
    $function$;

END $$;
