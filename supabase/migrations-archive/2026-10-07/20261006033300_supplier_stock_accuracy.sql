CREATE SCHEMA IF NOT EXISTS private;
ALTER TABLE public.stock_snapshots ADD COLUMN IF NOT EXISTS source_supplier_sku text;
CREATE OR REPLACE FUNCTION private.replace_stock_snapshot(p_supplier_id uuid, p_date text, p_rows jsonb, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    r jsonb;
    v_existing_max timestamptz;
    v_incoming     timestamptz;
begin
    if not exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.auth_user_id = auth.uid()
        and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
    ) then
        raise exception 'Permission denied: manage_items or ADMIN role required to import stock snapshots.';
    end if;

    perform pg_advisory_xact_lock(hashtext('replace_stock_snapshot:' || p_supplier_id::text));

    PERFORM pg_advisory_xact_lock(hashtext('stock:'||(SELECT private.stock_supplier_key(name) FROM public.suppliers WHERE id=p_supplier_id)));
    v_incoming := p_date::timestamptz;

    select max(snapshot_date) into v_existing_max
    from public.stock_snapshots
    where supplier_id = p_supplier_id;

    if not p_force
       and v_existing_max is not null
       and v_incoming is not null
       and v_incoming < date_trunc('day', v_existing_max) then
        raise exception 'STALE_REPORT|%|%',
            to_char(v_existing_max, 'YYYY-MM-DD'),
            to_char(v_incoming, 'YYYY-MM-DD')
            using errcode = 'P0001';
    end if;

    delete from public.stock_snapshots
    where supplier_id = p_supplier_id;

    for r in select * from jsonb_array_elements(p_rows) loop
        insert into public.stock_snapshots (
            id, supplier_id, supplier_sku, source_supplier_sku, incoming_stock, product_name, available_qty, stock_on_hand,
            snapshot_date, source_report_name, range_name, stock_type, carton_qty,
            category, sub_category, committed_qty, back_ordered_qty, soh_value_at_sell,
            sell_price, total_stock_qty, customer_stock_code_raw, customer_stock_code_norm,
            customer_stock_code_alt_norm
        ) values (
            coalesce((r->>'id')::uuid, gen_random_uuid()),
            p_supplier_id,
            r->>'supplier_sku',
            r->>'source_supplier_sku',
            coalesce(r->'incoming_stock','[]'::jsonb),
            r->>'product_name',
            (r->>'available_qty')::integer,
            (r->>'stock_on_hand')::integer,
            (r->>'snapshot_date')::timestamptz,
            r->>'source_report_name',
            r->>'range_name',
            r->>'stock_type',
            (r->>'carton_qty')::integer,
            r->>'category',
            r->>'sub_category',
            (r->>'committed_qty')::integer,
            (r->>'back_ordered_qty')::integer,
            (r->>'soh_value_at_sell')::numeric,
            (r->>'sell_price')::numeric,
            (r->>'total_stock_qty')::integer,
            r->>'customer_stock_code_raw',
            r->>'customer_stock_code_norm',
            r->>'customer_stock_code_alt_norm'
        );
    end loop;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.replace_stock_snapshot(p_supplier_id uuid,p_date text,p_rows jsonb,p_force boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.replace_stock_snapshot(p_supplier_id,p_date,p_rows,p_force); $$;
REVOKE ALL ON FUNCTION private.replace_stock_snapshot(uuid,text,jsonb,boolean),public.replace_stock_snapshot(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.replace_stock_snapshot(uuid,text,jsonb,boolean),public.replace_stock_snapshot(uuid,text,jsonb,boolean) TO authenticated;

-- Supplier-wide allocations and atomic capacity checks. No business records are rewritten.


CREATE OR REPLACE FUNCTION private.stock_supplier_key(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT btrim(regexp_replace(regexp_replace(replace(lower(coalesce(p_name,'')), '&', ' and '),
 '\m(pty|ltd|limited|proprietary|p\s*l|pl|australia|australian)\M', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION private.stock_code(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT upper(regexp_replace(coalesce(p_value,''), '^\s+|\s+$', '', 'g')); $$;
REVOKE ALL ON FUNCTION private.stock_code(text) FROM PUBLIC,anon;

CREATE OR REPLACE FUNCTION private.stock_pool(p_item uuid, p_supplier uuid)
RETURNS TABLE(pool_key text, supplier_key text, supplier_sku text, snapshot_at timestamptz, baseline numeric, item_ids uuid[])
LANGUAGE sql STABLE SET search_path = '' AS $$
 WITH supplier AS (SELECT private.stock_supplier_key(name) AS key FROM public.suppliers WHERE id=p_supplier),
 ids AS (SELECT s.id FROM public.suppliers s,supplier t WHERE private.stock_supplier_key(s.name)=t.key),
 mapping AS (
   SELECT m.* FROM public.supplier_product_map m WHERE m.product_id=p_item
   AND m.supplier_id IN (SELECT id FROM ids) AND m.mapping_status='CONFIRMED'
   ORDER BY coalesce(m.manual_override,false) DESC, coalesce(m.match_priority,0) DESC, m.id LIMIT 1
 ), candidates AS (
   SELECT s.*, (private.stock_code(s.supplier_sku)=private.stock_code(m.supplier_sku)) AS exact_sku,
     (private.stock_code(s.product_name)=private.stock_code(i.name)) AS exact_name
   FROM public.stock_snapshots s, mapping m LEFT JOIN public.items i ON i.id=m.product_id
   WHERE s.supplier_id IN (SELECT id FROM ids)
   AND (private.stock_code(s.supplier_sku)=private.stock_code(m.supplier_sku)
     OR private.stock_code(s.customer_stock_code_raw) IN (private.stock_code(m.supplier_sku),private.stock_code(m.supplier_customer_stock_code),private.stock_code(i.sku))
     OR private.stock_code(s.customer_stock_code_norm) IN (private.stock_code(m.supplier_sku),private.stock_code(m.supplier_customer_stock_code),private.stock_code(i.sku)))
 ), sku_filtered AS (
   SELECT * FROM candidates WHERE NOT EXISTS(SELECT 1 FROM candidates WHERE exact_sku) OR exact_sku
 ), filtered AS (
   SELECT * FROM sku_filtered WHERE NOT EXISTS(SELECT 1 FROM sku_filtered WHERE exact_name) OR exact_name
 ), snapshot AS (
   SELECT * FROM filtered ORDER BY snapshot_date DESC NULLS LAST,
     (CASE WHEN (SELECT key FROM supplier) LIKE '%ncc%' THEN stock_type='CUSTOM' ELSE false END) DESC NULLS LAST,id LIMIT 1
 ), conflicts AS (
   SELECT EXISTS(SELECT 1 FROM filtered f,snapshot s WHERE f.snapshot_date=s.snapshot_date
     AND ((SELECT key FROM supplier) NOT LIKE '%ncc%' OR coalesce(f.stock_type,'')=coalesce(s.stock_type,''))
     AND private.stock_code(coalesce(f.source_supplier_sku,f.supplier_sku))<>private.stock_code(coalesce(s.source_supplier_sku,s.supplier_sku)))
     OR (SELECT count(DISTINCT coalesce(f.available_qty,f.stock_on_hand,0))>1
       FROM public.stock_snapshots f,snapshot s,supplier t
       WHERE f.supplier_id IN(SELECT id FROM ids) AND f.snapshot_date=s.snapshot_date
       AND private.stock_code(coalesce(f.source_supplier_sku,f.supplier_sku))=private.stock_code(coalesce(s.source_supplier_sku,s.supplier_sku))
       AND (t.key NOT LIKE '%ncc%' OR private.stock_code(coalesce(f.customer_stock_code_raw,f.customer_stock_code_norm,''))=private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm,'')))) AS conflicted
 )
 SELECT t.key||':'||private.stock_code(coalesce(s.source_supplier_sku,s.supplier_sku,m.supplier_sku,p_item::text))
     ||CASE WHEN t.key LIKE '%ncc%' AND coalesce(nullif(s.customer_stock_code_raw,''),nullif(s.customer_stock_code_norm,'')) IS NOT NULL THEN ':'||private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm,'')) ELSE '' END,
   t.key,coalesce(s.supplier_sku,m.supplier_sku),CASE WHEN c.conflicted THEN NULL ELSE s.snapshot_date END,
   CASE WHEN c.conflicted THEN 0 ELSE greatest(0,coalesce(s.available_qty,s.stock_on_hand,0)) * CASE WHEN m.pack_conversion_factor>0 THEN m.pack_conversion_factor ELSE 1 END END,
   ARRAY(SELECT DISTINCT m2.product_id FROM public.supplier_product_map m2 LEFT JOIN public.items i2 ON i2.id=m2.product_id
     WHERE m2.supplier_id IN (SELECT id FROM ids) AND m2.mapping_status='CONFIRMED'
       AND CASE WHEN t.key LIKE '%ncc%' THEN
         private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm))<>'' AND (private.stock_code(m2.supplier_customer_stock_code)=private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm))
           OR private.stock_code(m2.supplier_sku)=private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm))
           OR private.stock_code(i2.sku)=private.stock_code(coalesce(s.customer_stock_code_raw,s.customer_stock_code_norm)))
         ELSE private.stock_code(m2.supplier_sku)=private.stock_code(coalesce(s.supplier_sku,m.supplier_sku))
           AND (s.source_supplier_sku IS NULL OR i2.name IS NULL OR private.stock_code(i2.name)=private.stock_code(s.product_name)) END
     UNION SELECT p_item)
 FROM supplier t LEFT JOIN mapping m ON true LEFT JOIN snapshot s ON true CROSS JOIN conflicts c;
$$;

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
         OR coalesce(p.reservation_expires_at,coalesce(p.approved_at,p.updated_at,p.request_date)+interval '48 hours')>now())
       THEN greatest(0,l.quantity_ordered) ELSE 0 END),0),
     coalesce(sum(CASE WHEN p.status IN ('ACTIVE','VARIANCE_PENDING','APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')
       AND (nullif(btrim(coalesce(p.concur_po_number,'')),'') IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.po_lines issued WHERE issued.po_request_id=p.id AND nullif(btrim(issued.concur_po_number),'') IS NOT NULL))
       AND coalesce(p.concur_linked_at,p.updated_at,p.request_date)>=v_pool.snapshot_at
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
   'reservationExpiresAt',p.reservation_expires_at,'requestDate',p.request_date,'updatedAt',p.updated_at,'concurLinkedAt',p.concur_linked_at,
   'concurRequestNumber',CASE WHEN nullif(btrim(p.concur_request_number),'') IS NOT NULL THEN 'linked' ELSE NULL END,
   'concurPoNumber',CASE WHEN nullif(btrim(p.concur_po_number),'') IS NOT NULL OR EXISTS(SELECT 1 FROM public.po_lines l WHERE l.po_request_id=p.id AND nullif(btrim(l.concur_po_number),'') IS NOT NULL) THEN 'issued' ELSE NULL END,
   'lines',(SELECT coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'quantityOrdered',l.quantity_ordered,
     'quantityReceived',l.quantity_received,'isForceClosed',coalesce(l.is_force_closed,false))), '[]'::jsonb) FROM public.po_lines l WHERE l.po_request_id=p.id)
 )) FROM public.po_requests p WHERE p.status IN ('ACTIVE','VARIANCE_PENDING','APPROVED_PENDING_CONCUR','APPROVED_PENDING_CONCUR_REQUEST')), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_supplier_stock_allocations()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.get_supplier_stock_allocations(); $$;

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
     AND (v_po.site_id::text=ANY(coalesce(u.site_ids,'{}'::text[])) OR r.site_scope_mode='ALL')))
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

CREATE OR REPLACE FUNCTION public.re_reserve_po_stock(p_po_id uuid,p_user_name text DEFAULT 'User')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.re_reserve_po_stock(p_po_id,p_user_name); $$;

REVOKE ALL ON FUNCTION private.stock_supplier_key(text),private.stock_pool(uuid,uuid),private.assert_reservation_capacity(uuid),
 private.get_supplier_stock_allocations(),private.re_reserve_po_stock(uuid,text),public.get_supplier_stock_allocations(),public.re_reserve_po_stock(uuid,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_supplier_stock_allocations(),private.re_reserve_po_stock(uuid,text),
 public.get_supplier_stock_allocations(),public.re_reserve_po_stock(uuid,text) TO authenticated;

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
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND reservation_expires_at<=now()))) THEN
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
CREATE OR REPLACE FUNCTION public.link_concur_request_number(p_po_id uuid,p_concur_request_number text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.link_concur_request_number(p_po_id,p_concur_request_number); $$;
REVOKE ALL ON FUNCTION private.link_concur_request_number(uuid,text),public.link_concur_request_number(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.link_concur_request_number(uuid,text),public.link_concur_request_number(uuid,text) TO authenticated;

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
          AND nullif(btrim(coalesce(concur_request_number,'')),'') IS NULL AND reservation_expires_at<=now()))) THEN
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
CREATE OR REPLACE FUNCTION public.link_concur_po_number(p_po_id uuid,p_concur_po_number text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.link_concur_po_number(p_po_id,p_concur_po_number); $$;
REVOKE ALL ON FUNCTION private.link_concur_po_number(uuid,text),public.link_concur_po_number(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.link_concur_po_number(uuid,text),public.link_concur_po_number(uuid,text) TO authenticated;
