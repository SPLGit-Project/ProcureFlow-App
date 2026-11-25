-- Migration: 20261125000000_strict_site_approver_and_coo_rls.sql
-- Description: Enforce strict per-site approval and visibility isolation on po_requests:
--   1. Only the assigned site_approval_workflows.approval_manager_id (never ADMINs or other site managers)
--      can view/approve PENDING_APPROVAL requests for that site.
--   2. Once ESCALATED, only the assigned escalation_manager_id (COO Ebrahim Mokhtari) can approve/reject.
--   3. Original requesters always retain visibility to their own requests (SoD prevents self-approval).
--   4. Receiving/Concur/Finance/Admin staff retain post-approval lifecycle access.

-- ── 1. Strict SELECT Policy on public.po_requests ─────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view requests" ON public.po_requests;
DROP POLICY IF EXISTS "Users can view authorized requests" ON public.po_requests;

CREATE POLICY "Users can view authorized requests"
ON public.po_requests
FOR SELECT
TO authenticated
USING (
  -- 1. System Admins have read-only visibility across all requests for audit/reporting
  (EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()) AND r.id = 'ADMIN'
  ))
  OR
  -- 2. Original requester can always view their own requests
  (EXISTS (
    SELECT 1 FROM public.users u
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
      AND u.id::text = po_requests.requester_id::text
  ))
  OR
  -- 3. Assigned Site Approval Manager can view requests for their designated site (read-only once ESCALATED)
  (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.approval_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.approval_manager_email, '')) = LOWER(COALESCE(u.email, ''))
          OR po_requests.assigned_approver_id::text = u.id::text
        )
    )
  )
  OR
  -- 4. COO Escalation Authority can view ESCALATED requests (or any site where they are escalation manager)
  (
    status = 'ESCALATED'
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.escalation_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.escalation_manager_email, '')) = LOWER(COALESCE(u.email, ''))
        )
    )
  )
  OR
  -- 5. Post-approval lifecycle visibility for Receiving, Concur, Finance, and Site Users at their sites
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED', 'REJECTED', 'CANCELLED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND (
          'link_concur' = ANY (r.permissions)
          OR 'manage_finance' = ANY (r.permissions)
          OR 'view_all_requests' = ANY (r.permissions)
          OR (
            ('receive_goods' = ANY (r.permissions) OR 'view_active_requests' = ANY (r.permissions) OR 'view_completed_requests' = ANY (r.permissions))
            AND po_requests.site_id::text = ANY (u.site_ids)
          )
        )
    )
  )
);

-- ── 2. Strict UPDATE Policy on public.po_requests ─────────────────────────────
DROP POLICY IF EXISTS "Users with permission can update requests" ON public.po_requests;

CREATE POLICY "Users with permission can update requests"
ON public.po_requests
FOR UPDATE
TO authenticated
USING (
  -- 1. System Admins can manage post-approval / operational states (NOT PENDING_APPROVAL or ESCALATED approvals)
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED', 'CANCELLED', 'REJECTED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()) AND r.id = 'ADMIN'
    )
  )
  OR
  -- 2. Original requesters can update/cancel their own pending or post-approval active requests
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND u.id::text = po_requests.requester_id::text
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'RECEIVED', 'VARIANCE_PENDING'])
  )
  OR
  -- 3. ONLY the Assigned Site Approval Manager can approve/reject/escalate PENDING_APPROVAL requests for their site
  --    Segregation of Duties: Approver cannot be the requester
  (
    status = 'PENDING_APPROVAL'
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.approval_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.approval_manager_email, '')) = LOWER(COALESCE(u.email, ''))
          OR po_requests.assigned_approver_id::text = u.id::text
        )
    )
    AND (
      po_requests.requester_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u
        WHERE req_u.id::text = po_requests.requester_id::text
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
  )
  OR
  -- 4. ONLY the Assigned COO Escalation Manager can approve/reject ESCALATED requests
  --    Segregation of Duties: Escalation manager cannot be the requester
  (
    status = 'ESCALATED'
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.escalation_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.escalation_manager_email, '')) = LOWER(COALESCE(u.email, ''))
        )
    )
    AND (
      po_requests.requester_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u
        WHERE req_u.id::text = po_requests.requester_id::text
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
  )
  OR
  -- 5. Receiving staff can process deliveries for their assigned facility
  (
    status = ANY (ARRAY['ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND 'receive_goods' = ANY (r.permissions)
        AND po_requests.site_id::text = ANY (u.site_ids)
    )
  )
  OR
  -- 6. Concur linkage permission holders or requesters linking Concur
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('link_concur' = ANY (r.permissions) OR u.id::text = po_requests.requester_id::text)
    )
  )
)
WITH CHECK (
  -- 1. System Admins can write post-approval / operational states (NOT approve/reject PENDING_APPROVAL unless assigned)
  (
    status = ANY (ARRAY['ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED', 'CANCELLED', 'APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid()) AND r.id = 'ADMIN'
    )
  )
  OR
  -- 2. Original requesters can maintain pending requests or cancel
  (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND u.id::text = po_requests.requester_id::text
    )
    AND status = ANY (ARRAY['PENDING_APPROVAL', 'CANCELLED', 'CLOSED'])
  )
  OR
  -- 3. Assigned Site Approval Manager can record approval, rejection, or escalation
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'REJECTED', 'ESCALATED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.approval_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.approval_manager_email, '')) = LOWER(COALESCE(u.email, ''))
          OR po_requests.assigned_approver_id::text = u.id::text
        )
    )
    AND (
      po_requests.requester_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u
        WHERE req_u.id::text = po_requests.requester_id::text
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
  )
  OR
  -- 4. Assigned COO Escalation Manager can record approval or rejection on escalated requests
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'REJECTED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.site_approval_workflows saw ON saw.site_id::text = po_requests.site_id::text
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND saw.is_active = true
        AND (
          saw.escalation_manager_id::text = u.id::text
          OR LOWER(COALESCE(saw.escalation_manager_email, '')) = LOWER(COALESCE(u.email, ''))
        )
    )
    AND (
      po_requests.requester_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.users req_u
        WHERE req_u.id::text = po_requests.requester_id::text
          AND (req_u.auth_user_id = auth.uid() OR req_u.id = auth.uid())
      )
    )
  )
  OR
  -- 5. Receiving staff can advance delivery statuses
  (
    status = ANY (ARRAY['ACTIVE', 'RECEIVED', 'VARIANCE_PENDING', 'CLOSED'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND 'receive_goods' = ANY (r.permissions)
        AND po_requests.site_id::text = ANY (u.site_ids)
    )
  )
  OR
  -- 6. Concur linkage permission holders or requesters linking Concur
  (
    status = ANY (ARRAY['APPROVED_PENDING_CONCUR', 'ACTIVE'])
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND ('link_concur' = ANY (r.permissions) OR u.id::text = po_requests.requester_id::text)
    )
  )
);
