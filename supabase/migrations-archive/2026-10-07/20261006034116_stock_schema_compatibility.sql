-- Use optional legacy fields without requiring columns absent from production.
CREATE OR REPLACE FUNCTION private.assert_reservation_capacity(p_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_po public.po_requests%ROWTYPE; v_line record; v_pool record; v_reserved numeric; v_committed numeric;
 v_requested numeric; v_seen text[] := '{}';
BEGIN
 SELECT * INTO STRICT v_po FROM public.po_requests WHERE id=p_po_id;
 -- Serialize reinstatements sharing a supplier, including legacy supplier aliases.
 PERFORM pg_advisory_xact_lock(hashtext('stock:'||(SELECT private.stock_supplier_key(name) FROM public.suppliers WHERE id=v_po.supplier_id)));
 IF NOT EXISTS (SELECT 1 FROM public.po_lines WHERE po_request_id=p_po_id) THEN
   RAISE EXCEPTION 'This request has no stock lines.';
 END IF;
 FOR v_line IN SELECT * FROM public.po_lines WHERE po_request_id=p_po_id LOOP
   SELECT * INTO v_pool FROM private.stock_pool(v_line.item_id,v_po.supplier_id);
   IF v_pool.snapshot_at IS NULL THEN RAISE EXCEPTION 'No verified supplier stock baseline for %.',v_line.sku; END IF;
   IF v_pool.pool_key=ANY(v_seen) THEN CONTINUE; END IF;
   v_seen := array_append(v_seen,v_pool.pool_key);
   SELECT coalesce(sum(greatest(0,quantity_ordered)),0) INTO v_requested FROM public.po_lines
     WHERE po_request_id=p_po_id AND item_id=ANY(v_pool.item_ids);
   SELECT
     coalesce(sum(CASE WHEN p.status IN ('APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
       AND nullif(btrim(coalesce(p.concur_po_number,'')),'') IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.po_lines issued WHERE issued.po_request_id=p.id AND nullif(btrim(issued.concur_po_number),'') IS NOT NULL)
       AND (nullif(btrim(coalesce(p.concur_request_number,'')),'') IS NOT NULL
         OR coalesce(p.reservation_expires_at,coalesce(p.approved_at,(to_jsonb(p)->>'updated_at')::timestamptz,p.request_date)+interval '48 hours')>now())
       THEN greatest(0,l.quantity_ordered) ELSE 0 END),0),
     coalesce(sum(CASE WHEN p.status IN ('ACTIVE','VARIANCE_PENDING','APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
       AND (nullif(btrim(coalesce(p.concur_po_number,'')),'') IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.po_lines issued WHERE issued.po_request_id=p.id AND nullif(btrim(issued.concur_po_number),'') IS NOT NULL))
       AND coalesce(p.concur_linked_at,(to_jsonb(p)->>'updated_at')::timestamptz,p.request_date)>=v_pool.snapshot_at
       THEN greatest(0,l.quantity_ordered-coalesce(l.quantity_received,0)) ELSE 0 END),0)
   INTO v_reserved,v_committed
   FROM public.po_lines l JOIN public.po_requests p ON p.id=l.po_request_id JOIN public.suppliers s ON s.id=p.supplier_id
   WHERE p.id<>p_po_id AND l.item_id=ANY(v_pool.item_ids) AND NOT coalesce(l.is_force_closed,false)
     AND private.stock_supplier_key(s.name)=v_pool.supplier_key;
   IF v_requested>greatest(0,v_pool.baseline-v_reserved-v_committed) THEN
     RAISE EXCEPTION 'Insufficient supplier stock for %: requested %, available %.',v_pool.supplier_sku,v_requested,greatest(0,v_pool.baseline-v_reserved-v_committed);
   END IF;
 END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_supplier_stock_allocations()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND status IN ('APPROVED','ACTIVE')) THEN
   RAISE EXCEPTION 'An approved user is required to view stock allocations.';
 END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
   'supplierId',p.supplier_id,'status',p.status,'approvedAt',p.approved_at,
   'reservationExpiresAt',p.reservation_expires_at,'requestDate',p.request_date,'updatedAt',(to_jsonb(p)->>'updated_at')::timestamptz,'concurLinkedAt',p.concur_linked_at,
   'concurRequestNumber',CASE WHEN nullif(btrim(p.concur_request_number),'') IS NOT NULL THEN 'linked' ELSE NULL END,
   'concurPoNumber',CASE WHEN nullif(btrim(p.concur_po_number),'') IS NOT NULL OR EXISTS(SELECT 1 FROM public.po_lines l WHERE l.po_request_id=p.id AND nullif(btrim(l.concur_po_number),'') IS NOT NULL) THEN 'issued' ELSE NULL END,
   'lines',(SELECT coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'quantityOrdered',l.quantity_ordered,
     'quantityReceived',l.quantity_received,'isForceClosed',coalesce(l.is_force_closed,false))), '[]'::jsonb) FROM public.po_lines l WHERE l.po_request_id=p.id)
 )) FROM public.po_requests p WHERE p.status IN ('ACTIVE','VARIANCE_PENDING','APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION private.re_reserve_po_stock(p_po_id uuid,p_user_name text DEFAULT 'User')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_po public.po_requests%ROWTYPE; v_name text; v_expiry timestamptz:=now()+interval '48 hours';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('re_reserve_po_stock_'||p_po_id::text));
 SELECT * INTO STRICT v_po FROM public.po_requests WHERE id=p_po_id FOR UPDATE;
 SELECT u.name INTO v_name FROM public.users u
 WHERE u.auth_user_id=auth.uid() AND u.status IN ('APPROVED','ACTIVE') AND
 (u.id=v_po.requester_id OR EXISTS (
   SELECT 1 FROM public.roles r WHERE (r.id=u.role_id OR r.id IN (SELECT role_id FROM public.user_roles WHERE user_id=u.id))
   AND (r.id='ADMIN' OR ('approve_requests'=ANY(coalesce(r.permissions,'{}'::text[]))
     AND (v_po.site_id::text=ANY(coalesce(u.site_ids,'{}'::text[])) OR coalesce(to_jsonb(r)->>'site_scope_mode','ASSIGNED')='ALL')))
 ));
 IF v_name IS NULL THEN RAISE EXCEPTION 'You do not have permission to re-reserve this request.'; END IF;
 IF v_po.status<>'CANCELLED' OR v_po.auto_cancelled_at IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.po_approvals WHERE po_request_id=p_po_id AND action='APPROVED') THEN
   RAISE EXCEPTION 'Only an expired, previously approved reservation can be re-reserved.';
 END IF;
 PERFORM private.assert_reservation_capacity(p_po_id);
 UPDATE public.po_requests SET status='APPROVED_PENDING_CONCUR_REQUEST',reservation_expires_at=v_expiry,
   auto_cancelled_at=NULL,cancellation_reason=NULL WHERE id=p_po_id;
 INSERT INTO public.po_approvals(id,po_request_id,approver_name,action,date,comments)
 VALUES(gen_random_uuid(),p_po_id,v_name,'STOCK_RE_RESERVED',now(),'Supplier stock re-reserved for 48 hours. Link the Concur Request / PR #.');
 RETURN jsonb_build_object('success',true,'po_id',p_po_id,'display_id',v_po.display_id,
   'status','APPROVED_PENDING_CONCUR_REQUEST','reservation_expires_at',v_expiry);
END;
$$;

-- Apply the same elapsed-time fallback to legacy requests during Concur handover.
CREATE OR REPLACE FUNCTION private.link_concur_request_number(
    p_po_id uuid,
    p_concur_request_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_trimmed_request_number text;
    v_can_link boolean;
    v_has_po_number boolean;
    v_user_name text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('re_reserve_po_stock_'||p_po_id::text));
    v_trimmed_request_number := btrim(coalesce(p_concur_request_number, ''));

    IF v_trimmed_request_number = '' THEN
        RAISE EXCEPTION 'A valid Concur Request number is required.';
    END IF;

    SELECT requester_id, status
    INTO v_requester_id, v_status
    FROM public.po_requests
    WHERE id = p_po_id FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Request % not found.', p_po_id;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN'
            OR 'link_concur' = ANY(COALESCE(r.permissions, '{}'::text[]))
            OR u.id = v_requester_id
        )
    ) INTO v_can_link;

    IF NOT v_can_link THEN
        RAISE EXCEPTION 'You do not have permission to link this Concur Request.';
    END IF;

    IF v_status NOT IN ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'CANCELLED') THEN
        RAISE EXCEPTION 'Concur Request numbers can only be linked during active entry steps or cancelled reservations (current status: %).', v_status;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND status IN ('APPROVED','ACTIVE')) THEN
        RAISE EXCEPTION 'An approved user is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.po_requests WHERE id=p_po_id AND
        (status='CANCELLED' OR (status IN ('APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND coalesce(reservation_expires_at,coalesce(approved_at,(to_jsonb(po_requests)->>'updated_at')::timestamptz,request_date)+interval '48 hours','-infinity'::timestamptz)<=now()))) THEN
        IF v_status='CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.po_requests WHERE id=p_po_id AND auto_cancelled_at IS NOT NULL) THEN
            RAISE EXCEPTION 'A manually cancelled request cannot be reinstated by linking Concur.';
        END IF;
        PERFORM private.assert_reservation_capacity(p_po_id);
    END IF;

    -- Check if PO numbers are already populated
    SELECT EXISTS (
        SELECT 1 FROM public.po_lines
        WHERE po_request_id = p_po_id
        AND concur_po_number IS NOT NULL AND btrim(concur_po_number) <> ''
    ) INTO v_has_po_number;

    -- Get linking user name
    SELECT COALESCE(name, 'User') INTO v_user_name
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    UPDATE public.po_requests
    SET
        concur_request_number = v_trimmed_request_number,
        status = CASE 
            WHEN v_has_po_number THEN 'ACTIVE'
            ELSE 'APPROVED_PENDING_CONCUR'
        END,
        cancellation_reason = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE cancellation_reason END,
        auto_cancelled_at = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE auto_cancelled_at END
    WHERE id = p_po_id;

    -- Audit history
    INSERT INTO public.po_approvals (
        id,
        po_request_id,
        approver_name,
        action,
        date,
        comments
    ) VALUES (
        gen_random_uuid(),
        p_po_id,
        COALESCE(v_user_name, 'User'),
        'CONCUR_REQUEST_LINKED',
        NOW(),
        CASE 
            WHEN v_status = 'CANCELLED' THEN 'Concur Request #' || v_trimmed_request_number || ' linked. Stock reservation reinstated (Cancelled state removed).'
            ELSE 'Concur Request #' || v_trimmed_request_number || ' linked. Awaiting Concur PO #.'
        END
    );
END;
$$;
CREATE OR REPLACE FUNCTION private.link_concur_po_number(
    p_po_id uuid,
    p_concur_po_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_requester_id uuid;
    v_status text;
    v_concur_req_num text;
    v_trimmed_po_number text;
    v_can_link boolean;
    v_user_name text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('re_reserve_po_stock_'||p_po_id::text));
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    IF v_trimmed_po_number = '' THEN
        RAISE EXCEPTION 'A valid Concur PO number is required.';
    END IF;

    SELECT requester_id, status, concur_request_number
    INTO v_requester_id, v_status, v_concur_req_num
    FROM public.po_requests
    WHERE id = p_po_id FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Request % not found.', p_po_id;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.auth_user_id = auth.uid()
        AND (
            r.id = 'ADMIN'
            OR 'link_concur' = ANY(COALESCE(r.permissions, '{}'::text[]))
            OR u.id = v_requester_id
        )
    ) INTO v_can_link;

    IF NOT v_can_link THEN
        RAISE EXCEPTION 'You do not have permission to link this Concur PO.';
    END IF;

    IF v_status NOT IN ('APPROVED_PENDING_CONCUR_REQUEST', 'APPROVED_PENDING_CONCUR', 'ACTIVE', 'CANCELLED') THEN
        RAISE EXCEPTION 'Concur PO numbers can only be linked during active entry steps or cancelled reservations (current status: %).', v_status;
    END IF;

    -- Get linking user name
    SELECT COALESCE(name, 'User') INTO v_user_name
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id=auth.uid() AND status IN ('APPROVED','ACTIVE')) THEN
        RAISE EXCEPTION 'An approved user is required.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.po_requests WHERE id=p_po_id AND
        (status='CANCELLED' OR (status IN ('APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND coalesce(reservation_expires_at,coalesce(approved_at,(to_jsonb(po_requests)->>'updated_at')::timestamptz,request_date)+interval '48 hours','-infinity'::timestamptz)<=now()))) THEN
        IF v_status='CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.po_requests WHERE id=p_po_id AND auto_cancelled_at IS NOT NULL) THEN
            RAISE EXCEPTION 'A manually cancelled request cannot be reinstated by linking Concur.';
        END IF;
        PERFORM private.assert_reservation_capacity(p_po_id);
    END IF;

    UPDATE public.po_lines
    SET concur_po_number = v_trimmed_po_number
    WHERE po_request_id = p_po_id;

    UPDATE public.po_requests
    SET 
        concur_po_number = v_trimmed_po_number,
        concur_linked_at = NOW(),
        reservation_expires_at = NULL,
        cancellation_reason = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE cancellation_reason END,
        auto_cancelled_at = CASE WHEN v_status = 'CANCELLED' THEN NULL ELSE auto_cancelled_at END,
        status = 'ACTIVE'
    WHERE id = p_po_id;

    INSERT INTO public.po_approvals (
        id,
        po_request_id,
        approver_name,
        action,
        date,
        comments
    ) VALUES (
        gen_random_uuid(),
        p_po_id,
        COALESCE(v_user_name, 'User'),
        'CONCUR_PO_LINKED',
        NOW(),
        'Concur PO #' || v_trimmed_po_number || ' linked. Order is now Active.'
    );
END;
$$;
