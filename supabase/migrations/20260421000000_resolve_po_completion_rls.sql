-- Migration: 20260421000000_resolve_po_completion_rls.sql
-- Resolution for Lisa Wilson's PO completion failure.
-- Relaxes RLS policies on po_requests to allow transitioning to CLOSED/CANCELLED statuses.

DO $$ 
BEGIN
    -- 1. Replace the restrictive requester update policy
    DROP POLICY IF EXISTS "Requesters can update pending requests" ON public.po_requests;
    
    CREATE POLICY "Users can update POs based on role and status"
    ON public.po_requests
    FOR UPDATE
    TO authenticated
    USING (
        -- Admins can update anything
        EXISTS (
            SELECT 1 FROM public.users u 
            JOIN public.roles r ON u.role_id = r.id 
            WHERE u.auth_user_id = auth.uid() AND r.id = 'ADMIN'
        )
        OR
        -- Requesters can update if PENDING_APPROVAL
        (
            auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
            AND status = 'PENDING_APPROVAL'
        )
        OR
        -- Requesters can transition ACTIVE/RECEIVED orders towards completion
        (
            auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
            AND status IN ('ACTIVE', 'RECEIVED')
        )
        OR
        -- Site Receivers can transition ACTIVE/RECEIVED orders to CLOSED
        (
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.roles r ON u.role_id = r.id
                WHERE u.auth_user_id = auth.uid()
                AND ('receive_goods' = ANY(r.permissions))
                AND (public.po_requests.site_id::text = ANY(u.site_ids))
            )
            AND status IN ('ACTIVE', 'RECEIVED')
        )
    )
    WITH CHECK (
        -- Admins can transition to any status
        EXISTS (
            SELECT 1 FROM public.users u 
            JOIN public.roles r ON u.role_id = r.id 
            WHERE u.auth_user_id = auth.uid() AND r.id = 'ADMIN'
        )
        OR
        -- Requesters can keep it PENDING_APPROVAL or move to CANCELLED/CLOSED
        (
            auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
            AND (status IN ('PENDING_APPROVAL', 'CANCELLED', 'CLOSED'))
        )
        OR
        -- Receivers can move to CLOSED
        (
            EXISTS (
                SELECT 1 FROM public.users u
                JOIN public.roles r ON u.role_id = r.id
                WHERE u.auth_user_id = auth.uid()
                AND ('receive_goods' = ANY(r.permissions))
                AND (public.po_requests.site_id::text = ANY(u.site_ids))
            )
            AND status = 'CLOSED'
        )
    );

    -- 2. Audit check: Ensure consistent naming for select policy if needed
    -- (We leave select policy as is since it allows all authenticated users to read)
END $$;
