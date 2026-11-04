-- Migration: 20261105000000_fix_po_requests_approval_rls.sql
-- Description: Fix po_requests UPDATE RLS policy to permit Site Managers and facility approvers
--              to approve, reject, escalate, and link orders for their designated facilities.
--              Enforces Segregation of Duties (requesters cannot approve own requests)
--              and strictly preserves site isolation boundaries.

DROP POLICY IF EXISTS "Users with permission can update requests" ON public.po_requests;

CREATE POLICY "Users with permission can update requests"
ON public.po_requests
FOR UPDATE
TO authenticated
USING (
  -- 1. System Admins have unrestricted update rights
  (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()) AND r.id = 'ADMIN'
  ))
  OR
  -- 2. Original requesters can update their own pending or active requests
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND u.id::text = po_requests.requester_id::text
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING'])
  )
  OR
  -- 3. Site Managers and Facility Approvers (with approve_requests permission or SITE_MANAGER role)
  -- Segregation of Duties: Approver cannot be the requester
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('approve_requests' = ANY (r.permissions) OR r.id = 'SITE_MANAGER')
        AND (
          po_requests.site_id::text = ANY (u.site_ids)
          OR u.site_ids IS NULL
          OR cardinality(u.site_ids) = 0
          OR EXISTS (
            SELECT 1 FROM public.site_approval_workflows saw
            WHERE saw.site_id::text = po_requests.site_id::text
              AND (saw.approval_manager_id::text = u.id::text OR saw.escalation_manager_id::text = u.id::text)
          )
          OR po_requests.assigned_approver_id::text = u.id::text
        )
    ))
    AND (
      po_requests.requester_id IS NULL 
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u 
        WHERE req_u.id::text = po_requests.requester_id::text 
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'ESCALATED', 'REJECTED'])
  )
  OR
  -- 4. Receiving staff can process deliveries for their assigned facility
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND 'receive_goods' = ANY (r.permissions)
        AND (
          po_requests.site_id::text = ANY (u.site_ids)
          OR u.site_ids IS NULL
          OR cardinality(u.site_ids) = 0
        )
    ))
    AND status = ANY (ARRAY['ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED'])
  )
  OR
  -- 5. Concur linkage permission holders or requesters linking Concur
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('link_concur' = ANY (r.permissions) OR u.id::text = po_requests.requester_id::text)
    ))
    AND status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR'])
  )
)
WITH CHECK (
  -- 1. System Admins have unrestricted update rights
  (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()) AND r.id = 'ADMIN'
  ))
  OR
  -- 2. Original requesters can maintain draft/pending requests or cancel
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND u.id::text = po_requests.requester_id::text
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'CANCELLED', 'CLOSED'])
  )
  OR
  -- 3. Site Managers and Facility Approvers can record approval, rejection, concur, active, or escalation
  -- Segregation of Duties: Approver cannot be the requester
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('approve_requests' = ANY (r.permissions) OR r.id = 'SITE_MANAGER')
        AND (
          po_requests.site_id::text = ANY (u.site_ids)
          OR u.site_ids IS NULL
          OR cardinality(u.site_ids) = 0
          OR EXISTS (
            SELECT 1 FROM public.site_approval_workflows saw
            WHERE saw.site_id::text = po_requests.site_id::text
              AND (saw.approval_manager_id::text = u.id::text OR saw.escalation_manager_id::text = u.id::text)
          )
          OR po_requests.assigned_approver_id::text = u.id::text
        )
    ))
    AND (
      po_requests.requester_id IS NULL 
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u 
        WHERE req_u.id::text = po_requests.requester_id::text 
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'REJECTED', 'ACTIVE', 'ESCALATED'])
  )
  OR
  -- 4. Receiving staff can advance delivery statuses
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND 'receive_goods' = ANY (r.permissions)
        AND (
          po_requests.site_id::text = ANY (u.site_ids)
          OR u.site_ids IS NULL
          OR cardinality(u.site_ids) = 0
        )
    ))
    AND status = ANY (ARRAY['ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED'])
  )
  OR
  -- 5. Concur linkage permission holders or requesters linking Concur
  (
    (EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('link_concur' = ANY (r.permissions) OR u.id::text = po_requests.requester_id::text)
    ))
    AND status = ANY (ARRAY['APPROVED_PENDING_CONCUR', 'ACTIVE'])
  )
);
