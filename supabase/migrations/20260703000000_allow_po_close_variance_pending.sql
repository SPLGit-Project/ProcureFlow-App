-- Migration: 20260703000000_allow_po_close_variance_pending.sql
-- Description: Relaxes RLS on po_requests to allow requesters and receivers to manually close orders in VARIANCE_PENDING status.

BEGIN;

-- Drop the old policy
DROP POLICY IF EXISTS "Users with permission can update requests" ON public.po_requests;

-- Create the relaxed policy with correct WITH CHECK logic
CREATE POLICY "Users with permission can update requests"
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
    -- Requesters can update if current status is PENDING_APPROVAL, APPROVED_PENDING_CONCUR_REQUEST, APPROVED_PENDING_CONCUR, ACTIVE, RECEIVED, or VARIANCE_PENDING
    (
        auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
        AND status IN ('PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING')
    )
    OR
    -- Site Receivers can update if they have receive_goods permission for the PO's site
    (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND 'receive_goods' = ANY(r.permissions)
            AND public.po_requests.site_id::text = ANY(u.site_ids)
        )
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
    -- Requesters can keep it in permitted statuses or move it to CLOSED/CANCELLED
    (
        auth.uid() IN (SELECT auth_user_id FROM public.users WHERE id = requester_id)
        AND status IN ('PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED', 'CANCELLED')
    )
    OR
    -- Site Receivers can update to CLOSED or keep in permitted statuses
    (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND 'receive_goods' = ANY(r.permissions)
            AND public.po_requests.site_id::text = ANY(u.site_ids)
        )
        AND status IN ('ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED')
    )
);

COMMIT;
