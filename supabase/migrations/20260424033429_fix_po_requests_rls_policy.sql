-- 1. Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Requesters can update pending requests" ON public.po_requests;

-- 2. Create a new, more permissive update policy
-- This allows requesters to manage their POs through the lifecycle (up to RECEIVED/VARIANCE)
-- and allows Users with 'receive_goods' permission for the site to process deliveries.
CREATE POLICY "Users with permission can update requests" ON public.po_requests
FOR UPDATE
USING (
  -- Admin bypass
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND r.id = 'ADMIN'
  )
  OR
  -- Requester can update their own PO if it's not closed/rejected
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = po_requests.requester_id
    )
    AND status IN ('PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING')
  )
  OR
  -- User with receive_goods permission for this site
  (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND 'receive_goods' = ANY(r.permissions)
      AND (po_requests.site_id::text = ANY(u.site_ids))
    )
  )
);

-- 3. Also fix DELETE policy (similar logic)
DROP POLICY IF EXISTS "Admins and requesters can delete requests" ON public.po_requests;
CREATE POLICY "Admins and requesters can delete requests" ON public.po_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid() AND r.id = 'ADMIN'
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid() AND u.id = po_requests.requester_id
    )
    AND status = 'PENDING_APPROVAL'
  )
);
;
