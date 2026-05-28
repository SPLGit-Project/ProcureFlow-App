


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."approval_decision_type" AS ENUM (
    'APPROVED',
    'REJECTED',
    'ESCALATED',
    'DELEGATED'
);


ALTER TYPE "public"."approval_decision_type" OWNER TO "postgres";


CREATE TYPE "public"."approval_instance_status" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'APPROVED',
    'REJECTED',
    'ESCALATED',
    'SUPERSEDED'
);


ALTER TYPE "public"."approval_instance_status" OWNER TO "postgres";


CREATE TYPE "public"."duplicate_check_outcome" AS ENUM (
    'PENDING',
    'NO_DUPLICATE',
    'USE_EXISTING',
    'SIMILAR_NEW_REQUIRED'
);


ALTER TYPE "public"."duplicate_check_outcome" OWNER TO "postgres";


CREATE TYPE "public"."item_request_status" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'DUPLICATE_REVIEW',
    'PROCUREMENT_REVIEW',
    'DATA_REVIEW',
    'PRICING_REVIEW',
    'APPROVAL_PENDING',
    'REVISION_REQUIRED',
    'APPROVED',
    'PUBLISHING',
    'PARTIALLY_PUBLISHED',
    'FULLY_PUBLISHED',
    'ACTIVE',
    'REPLACED',
    'RETIRED',
    'REJECTED'
);


ALTER TYPE "public"."item_request_status" OWNER TO "postgres";


CREATE TYPE "public"."item_request_type" AS ENUM (
    'PURCHASE_AND_SALE',
    'PURCHASE_ONLY',
    'SALE_ONLY',
    'COG',
    'BUNDLE_LINENHUB_ONLY',
    'REPLACEMENT',
    'CUSTOMER_SPECIFIC',
    'SHARED_CATALOGUE'
);


ALTER TYPE "public"."item_request_type" OWNER TO "postgres";


CREATE TYPE "public"."item_workflow_status" AS ENUM (
    'LEGACY',
    'DRAFT',
    'DATA_REVIEW',
    'PRICING_REVIEW',
    'APPROVAL_PENDING',
    'APPROVED',
    'ACTIVE',
    'REPLACED',
    'RETIRED'
);


ALTER TYPE "public"."item_workflow_status" OWNER TO "postgres";


CREATE TYPE "public"."pricing_schedule_basis" AS ENUM (
    'CPI',
    'MWA',
    'BUSINESS_DECISION'
);


ALTER TYPE "public"."pricing_schedule_basis" OWNER TO "postgres";


CREATE TYPE "public"."pricing_schedule_method" AS ENUM (
    'PERCENTAGE_INCREASE',
    'PERCENTAGE_DECREASE',
    'FIXED_AMOUNT_INCREASE',
    'FIXED_AMOUNT_DECREASE',
    'REPLACE_WITH_NEW_PRICE'
);


ALTER TYPE "public"."pricing_schedule_method" OWNER TO "postgres";


CREATE TYPE "public"."pricing_schedule_status" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SCHEDULED',
    'EXECUTING',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
);


ALTER TYPE "public"."pricing_schedule_status" OWNER TO "postgres";


CREATE TYPE "public"."publication_event_status" AS ENUM (
    'QUEUED',
    'DISPATCHING',
    'DISPATCHED',
    'ACKNOWLEDGED',
    'FAILED',
    'RETRYING',
    'CANCELLED'
);


ALTER TYPE "public"."publication_event_status" OWNER TO "postgres";


CREATE TYPE "public"."publication_target" AS ENUM (
    'BUNDLE',
    'LINENHUB',
    'SALESFORCE',
    'SAP'
);


ALTER TYPE "public"."publication_target" OWNER TO "postgres";


CREATE TYPE "public"."purchase_price_status" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED_FUTURE',
    'ACTIVE',
    'SUPERSEDED',
    'EXPIRED',
    'REJECTED'
);


ALTER TYPE "public"."purchase_price_status" OWNER TO "postgres";


CREATE TYPE "public"."sell_price_status" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED_FUTURE',
    'ACTIVE',
    'SUPERSEDED',
    'EXPIRED',
    'REJECTED'
);


ALTER TYPE "public"."sell_price_status" OWNER TO "postgres";


CREATE TYPE "public"."sell_price_type" AS ENUM (
    'STANDARD',
    'GROUP',
    'CUSTOMER_SPECIFIC',
    'CONTRACT',
    'PROMOTIONAL'
);


ALTER TYPE "public"."sell_price_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_token_hash TEXT;
BEGIN
  -- Hash the provided token (SHA256 hex) to match DB storage
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_invite 
  FROM public.invites 
  WHERE token_hash = v_token_hash 
  AND accepted_at IS NULL 
  AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Link user by email
  SELECT * INTO v_user FROM public.users WHERE lower(email) = lower(v_invite.email);

  IF FOUND THEN
    UPDATE public.users
    SET 
      auth_user_id = auth.uid(), 
      status = 'APPROVED',
      site_ids = array_append(site_ids, v_invite.site_id::text)
    WHERE id = v_user.id;
    
    UPDATE public.users 
    SET site_ids = array(select distinct unnest(site_ids))
    WHERE id = v_user.id;
    
  ELSE
    INSERT INTO public.users (
      auth_user_id, email, status, site_ids, created_at, name
    ) VALUES (
      auth.uid(), v_invite.email, 'APPROVED', ARRAY[v_invite.site_id::text], NOW(), split_part(v_invite.email, '@', 1)
    )
    RETURNING * INTO v_user;
  END IF;

  UPDATE public.invites 
  SET accepted_at = NOW() 
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user.id, 'site_name', 'ProcureFlow');
END;
$$;


ALTER FUNCTION "public"."accept_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_po_line_id uuid;
    v_po_request_id uuid;
    v_site_id uuid;
    v_total_received numeric;
    v_variance_triggered boolean := false;
    v_new_status text := 'ACTIVE';
    l_line record;
    v_is_admin boolean;
    v_has_receive_permission boolean;
    v_user_sites text[]; 
    v_can_edit boolean;
BEGIN
    -- 1. Permission Check
    SELECT 
        (r.id = 'ADMIN'),
        ('receive_goods' = ANY(r.permissions)),
        u.site_ids
    INTO v_is_admin, v_has_receive_permission, v_user_sites
    FROM public.users u 
    JOIN public.roles r ON u.role_id = r.id 
    WHERE u.auth_user_id = auth.uid();

    -- 2. Get References and Site Context
    SELECT dl.po_line_id, pl.po_request_id, pqr.site_id
    INTO v_po_line_id, v_po_request_id, v_site_id
    FROM public.delivery_lines dl
    JOIN public.po_lines pl ON dl.po_line_id = pl.id
    JOIN public.po_requests pqr ON pl.po_request_id = pqr.id
    WHERE dl.id = p_line_id;

    IF v_po_line_id IS NULL THEN
        RAISE EXCEPTION 'Delivery line not found';
    END IF;

    -- 3. Authorization logic
    v_can_edit := COALESCE(v_is_admin, false) OR (
        COALESCE(v_has_receive_permission, false) AND (v_site_id::text = ANY(v_user_sites))
    );

    IF NOT v_can_edit THEN
        RAISE EXCEPTION 'You do not have permission to edit this delivery record.';
    END IF;

    -- 4. Update delivery_lines
    UPDATE public.delivery_lines SET quantity = p_new_qty WHERE id = p_line_id;

    -- 5. Recalculate and update po_lines received_quantity
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_received
    FROM public.delivery_lines WHERE po_line_id = v_po_line_id;

    UPDATE public.po_lines SET quantity_received = v_total_received WHERE id = v_po_line_id;

    -- 6. Re-evaluate PO Request status
    v_new_status := 'RECEIVED';

    FOR l_line IN (SELECT quantity_ordered, quantity_received, is_force_closed FROM public.po_lines WHERE po_request_id = v_po_request_id) LOOP
        IF l_line.quantity_received > l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;
        
        IF COALESCE(l_line.is_force_closed, false) AND l_line.quantity_received < l_line.quantity_ordered THEN
            v_variance_triggered := true;
        END IF;

        IF l_line.quantity_received < l_line.quantity_ordered AND NOT COALESCE(l_line.is_force_closed, false) THEN
            v_new_status := 'ACTIVE';
        END IF;
    END LOOP;

    IF v_variance_triggered THEN
        v_new_status := 'VARIANCE_PENDING';
    END IF;

    -- 7. Update the PO status
    UPDATE public.po_requests SET status = v_new_status WHERE id = v_po_request_id;
END;
$$;


ALTER FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_changed_fields"("old_row" "jsonb", "new_row" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    AS $$
    select coalesce(
        jsonb_object_agg(diff.key, jsonb_build_object('old', diff.old_value, 'new', diff.new_value)),
        '{}'::jsonb
    )
    from (
        select
            coalesce(old_data.key, new_data.key) as key,
            old_data.value as old_value,
            new_data.value as new_value
        from jsonb_each(old_row) old_data
        full outer join jsonb_each(new_row) new_data
            on old_data.key = new_data.key
        where old_data.value is distinct from new_data.value
    ) diff;
$$;


ALTER FUNCTION "public"."audit_changed_fields"("old_row" "jsonb", "new_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_lock_idc_on_outcome"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.outcome != 'PENDING' AND OLD.outcome = 'PENDING' THEN
    NEW.is_locked := true;
    NEW.performed_at := COALESCE(NEW.performed_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_lock_idc_on_outcome"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_system_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    actor_id uuid;
    old_payload jsonb;
    new_payload jsonb;
    changed_fields jsonb := '{}'::jsonb;
    summary_payload jsonb := '{}'::jsonb;
    details_payload jsonb := '{}'::jsonb;
    row_id text := '';
    action_label text;
    changed_count int := 0;
begin
    actor_id := auth.uid();

    if tg_op = 'INSERT' then
        new_payload := to_jsonb(new);
        row_id := coalesce(new_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'INSERT',
            'recordId', row_id
        );
        details_payload := jsonb_build_object('new', new_payload);
    elsif tg_op = 'UPDATE' then
        old_payload := to_jsonb(old);
        new_payload := to_jsonb(new);
        changed_fields := public.audit_changed_fields(old_payload, new_payload);

        if changed_fields = '{}'::jsonb then
            return new;
        end if;

        select count(*) into changed_count from jsonb_each(changed_fields);

        row_id := coalesce(new_payload ->> 'id', old_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'UPDATE',
            'recordId', row_id,
            'changedCount', changed_count
        );
        details_payload := jsonb_build_object(
            'changedFields', changed_fields,
            'old', old_payload,
            'new', new_payload
        );
    elsif tg_op = 'DELETE' then
        old_payload := to_jsonb(old);
        row_id := coalesce(old_payload ->> 'id', '');
        summary_payload := jsonb_build_object(
            'table', tg_table_name,
            'operation', 'DELETE',
            'recordId', row_id
        );
        details_payload := jsonb_build_object('old', old_payload);
    end if;

    action_label := upper(tg_table_name || '_' || tg_op);

    insert into public.system_audit_logs (
        action_type,
        performed_by,
        summary,
        details
    ) values (
        action_label,
        actor_id,
        summary_payload,
        details_payload
    );

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
exception
    when others then
        raise warning 'capture_system_audit failed for %.%: %', tg_table_name, tg_op, sqlerrm;
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
end;
$$;


ALTER FUNCTION "public"."capture_system_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_item_completeness"("p_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_item        items%ROWTYPE;
  v_results     JSONB := '[]'::jsonb;
  v_passed      INTEGER := 0;
  v_failed      INTEGER := 0;
  v_check       RECORD;
BEGIN
  SELECT * INTO v_item FROM items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % not found', p_item_id;
  END IF;

  -- Define checks using a CTE or simple loops for standard PL/pgSQL compatibility
  FOR v_check IN 
    SELECT 'sku' as field, 'ALL' as target, (v_item.sku IS NOT NULL AND v_item.sku != '') as passed
    UNION ALL SELECT 'name', 'ALL', (v_item.name IS NOT NULL AND v_item.name != '')
    UNION ALL SELECT 'category', 'ALL', (v_item.category IS NOT NULL)
    UNION ALL SELECT 'uom', 'ALL', (v_item.uom IS NOT NULL)
    UNION ALL SELECT 'unit_price', 'ALL', (v_item.unit_price IS NOT NULL AND v_item.unit_price > 0)
    UNION ALL SELECT 'sap_item_code_norm', 'SAP', (v_item.sap_item_code_norm IS NOT NULL)
    UNION ALL SELECT 'item_weight', 'SAP', (v_item.item_weight IS NOT NULL)
    UNION ALL SELECT 'item_type', 'BUNDLE,LINENHUB', (v_item.item_type IS NOT NULL)
    UNION ALL SELECT 'description', 'BUNDLE,LINENHUB', (v_item.description IS NOT NULL AND LENGTH(v_item.description) >= 5)
    UNION ALL SELECT 'active_sell_price', 'ALL', EXISTS (
      SELECT 1 FROM item_sell_prices isp
      WHERE isp.item_id = p_item_id
        AND isp.status = 'ACTIVE'
        AND isp.effective_from <= CURRENT_DATE
        AND (isp.effective_to IS NULL OR isp.effective_to >= CURRENT_DATE)
    )
    UNION ALL SELECT 'active_purchase_price', 'PROCUREMENT', EXISTS (
      SELECT 1 FROM item_purchase_prices ipp
      WHERE ipp.item_id = p_item_id
        AND ipp.status = 'ACTIVE'
        AND ipp.effective_from <= CURRENT_DATE
    )
  LOOP
    v_results := v_results || jsonb_build_object(
      'field', v_check.field,
      'required_for', v_check.target,
      'passed', v_check.passed
    );
    IF v_check.passed THEN v_passed := v_passed + 1;
    ELSE v_failed := v_failed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'results', v_results,
    'total_checks', v_passed + v_failed,
    'passed_checks', v_passed,
    'failed_checks', v_failed,
    'is_complete', v_failed = 0
  );
END;
$$;


ALTER FUNCTION "public"."check_item_completeness"("p_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."colour_options_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."colour_options_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_pending_duplicate_check"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'SUBMITTED' AND OLD.status = 'DRAFT' THEN
    INSERT INTO item_duplicate_checks (request_id)
    VALUES (NEW.id)
    ON CONFLICT (request_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_pending_duplicate_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_po_atomic"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb", "p_approval" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    $$;


ALTER FUNCTION "public"."create_po_atomic"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb", "p_approval" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_item_request_and_cascade"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_status TEXT;
    v_item_id UUID;
    v_requester_id UUID;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- Capture request info
    SELECT status::TEXT, resulting_item_id, requestor_id 
    INTO v_status, v_item_id, v_requester_id
    FROM item_requests 
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN; -- Already deleted or not found
    END IF;

    -- Authorization Guard
    v_is_admin := public.is_admin();
    IF NOT v_is_admin THEN
        -- Non-admin check: must be owner AND not approved/active
        IF v_auth_uid != v_requester_id THEN
            RAISE EXCEPTION 'You can only delete your own requests.';
        END IF;
        
        IF v_status IN ('APPROVED', 'PUBLISHING', 'PARTIALLY_PUBLISHED', 'FULLY_PUBLISHED', 'ACTIVE') THEN
            RAISE EXCEPTION 'Once a request is approved or active, it can only be deleted by an administrator.';
        END IF;
    END IF;

    -- 1. Identify and delete price drafts linked to this request's resulting item
    IF v_item_id IS NOT NULL THEN
        DELETE FROM item_sell_prices 
        WHERE item_id = v_item_id 
          AND status IN ('DRAFT', 'PENDING_APPROVAL', 'REJECTED');
          
        DELETE FROM item_purchase_prices 
        WHERE item_id = v_item_id 
          AND status IN ('DRAFT', 'PENDING_APPROVAL', 'REJECTED');

        UPDATE items SET current_request_id = NULL WHERE id = v_item_id;
    END IF;

    -- 2. Delete completeness checks
    DELETE FROM item_completeness_checks WHERE request_id = p_request_id;

    -- 3. Delete approval decisions (requires bypassing immutability trigger)
    EXECUTE 'SET LOCAL session_replication_role = replica';
    DELETE FROM item_approval_decisions WHERE request_id = p_request_id;
    EXECUTE 'SET LOCAL session_replication_role = origin';

    -- 4. Delete publication events
    DELETE FROM item_publication_events WHERE correlation_id = p_request_id;

    -- 5. Delete the request (cascades to child tables)
    DELETE FROM item_requests WHERE id = p_request_id;

    -- 6. Delete associated audit logs
    DELETE FROM system_audit_logs 
    WHERE (summary->>'recordId' = p_request_id::text)
       OR (summary->>'table' = 'item_requests' AND summary->>'recordId' = p_request_id::text);

    -- 7. Log the administrative/user deletion event
    INSERT INTO system_audit_logs (action_type, performed_by, summary, details)
    VALUES (
        CASE WHEN v_is_admin THEN 'ITEM_REQUEST_ADMIN_DELETE' ELSE 'ITEM_REQUEST_USER_DELETE' END,
        v_auth_uid,
        jsonb_build_object(
            'requestId', p_request_id,
            'statusAtDelete', v_status,
            'deletedByAdmin', v_is_admin,
            'timestamp', now()
        ),
        '{}'::jsonb
    );
END;
$$;


ALTER FUNCTION "public"."delete_item_request_and_cascade"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_po_and_cascade"("p_po_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_status text;
    v_requester_id uuid;
    v_is_admin boolean;
    v_auth_uid uuid := auth.uid();
begin
    -- Initialize admin check and capture PO details
    v_is_admin := public.is_admin();

    select status, requester_id
    into v_status, v_requester_id
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'PO not found: %', p_po_id;
    end if;

    -- Authentication/Authorization Guard
    if not v_is_admin then
        if v_status not in ('DRAFT', 'PENDING_APPROVAL', 'REJECTED') then
            raise exception 'Cannot delete a PO with status %. Only DRAFT, PENDING_APPROVAL, or REJECTED POs can be deleted by users.', v_status;
        end if;

        -- Ownership check for non-admins
        if not exists (
            select 1 from public.users u 
            where u.id = v_requester_id 
            and u.auth_user_id = v_auth_uid
        ) then
            raise exception 'You can only delete your own requests.';
        end if;
    end if;

    -- Atomic cascade: delete child records first, then parent.
    delete from public.delivery_lines
    where delivery_id in (
        select id from public.deliveries where po_request_id = p_po_id
    );

    delete from public.deliveries
    where po_request_id = p_po_id;

    delete from public.po_lines
    where po_request_id = p_po_id;

    delete from public.po_approvals
    where po_request_id = p_po_id;

    delete from public.po_requests
    where id = p_po_id;

    -- Write audit record
    begin
        insert into public.system_audit_logs (action_type, performed_by, summary, details)
        values (
            'PO_DELETED',
            v_auth_uid,
            jsonb_build_object(
                'po_id', p_po_id,
                'status_at_delete', v_status,
                'deleted_by_admin', v_is_admin
            ),
            '{}'::jsonb
        );
    exception when others then
        null;
    end;
end;
$$;


ALTER FUNCTION "public"."delete_po_and_cascade"("p_po_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_iad_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'Approval decisions are immutable and cannot be modified or deleted.';
END;
$$;


ALTER FUNCTION "public"."enforce_iad_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_idc_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Duplicate check record % is locked and cannot be modified.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_idc_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_ipp_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IN ('SUPERSEDED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Cannot modify a % purchase price record. Create a new version instead.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_ipp_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_isp_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IN ('SUPERSEDED', 'EXPIRED') THEN
    RAISE EXCEPTION 'Cannot modify a % sell price record. Create a new version instead.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_isp_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_ps_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IN ('COMPLETED', 'EXECUTING') THEN
    RAISE EXCEPTION 'Cannot modify a % pricing schedule.', OLD.status;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_ps_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") RETURNS TABLE("rule_id" "uuid", "rule_name" "text", "approver_type" "text", "approver_id" "text", "stage_order" integer, "sla_hours" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_request         item_requests%ROWTYPE;
  v_margin_percent  NUMERIC;
  v_threshold       NUMERIC := 25.0;
BEGIN
  SELECT * INTO v_request FROM item_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item request % not found', p_request_id;
  END IF;

  -- Get configured margin threshold
  SELECT COALESCE((value::numeric), 25.0) INTO v_threshold
  FROM app_config WHERE key = 'margin_approval_threshold' LIMIT 1;

  -- Get lowest margin_percent on sell prices for this request
  SELECT MIN(isp.margin_percent) INTO v_margin_percent
  FROM item_sell_prices isp
  JOIN items it ON it.id = isp.item_id
  WHERE it.id = v_request.resulting_item_id AND isp.status IN ('DRAFT', 'PENDING_APPROVAL');

  RETURN QUERY
  SELECT
    iar.id,
    iar.rule_name,
    iar.approver_type,
    iar.approver_id,
    iar.sequential_stage_order,
    iar.sla_hours
  FROM item_approval_rules iar
  WHERE iar.is_active = true
  AND (
    -- DEFAULT: always fires
    iar.condition_type = 'DEFAULT'
    -- MARGIN_BELOW: sell price margin below threshold
    OR (iar.condition_type = 'MARGIN_BELOW'
        AND v_margin_percent IS NOT NULL
        AND v_margin_percent < COALESCE(iar.condition_value::numeric, v_threshold))
    -- PURCHASE_ONLY
    OR (iar.condition_type = 'PURCHASE_ONLY' AND v_request.request_type = 'PURCHASE_ONLY')
    -- SALE_ONLY (maps to condition check on request_type)
    OR (iar.condition_type = 'SALE_ONLY' AND v_request.request_type = 'SALE_ONLY')
    -- CUSTOMER_SPECIFIC
    OR (iar.condition_type = 'CUSTOMER_SPECIFIC' AND v_request.request_type = 'CUSTOMER_SPECIFIC')
    -- CONTRACT
    OR (iar.condition_type = 'CONTRACT' AND v_request.contract_reference IS NOT NULL)
    -- COG
    OR (iar.condition_type = 'COG' AND v_request.request_type = 'COG')
    -- URGENT
    OR (iar.condition_type = 'URGENT' AND v_request.is_urgent = true)
    -- REPLACEMENT
    OR (iar.condition_type = 'REPLACEMENT' AND v_request.request_type = 'REPLACEMENT')
  )
  ORDER BY iar.sequential_stage_order ASC;
END;
$$;


ALTER FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") IS 'Evaluates active item_approval_rules against a request. Returns the ordered set of approval tasks to create. Called by the approval engine service.';



CREATE OR REPLACE FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") RETURNS TABLE("prices_created" integer, "prices_flagged" integer, "errors_count" integer, "execution_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_schedule          pricing_schedules%ROWTYPE;
  v_line              pricing_schedule_lines%ROWTYPE;
  v_current_price     item_sell_prices%ROWTYPE;
  v_new_price         NUMERIC(12,4);
  v_new_price_id      UUID;
  v_prices_created    INTEGER := 0;
  v_prices_flagged    INTEGER := 0;
  v_errors_count      INTEGER := 0;
  v_error_msg         TEXT;
  v_margin_floor      NUMERIC;
  v_new_margin        NUMERIC;
BEGIN
  -- Load and validate the schedule
  SELECT * INTO v_schedule FROM pricing_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing schedule % not found', p_schedule_id;
  END IF;

  IF v_schedule.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Pricing schedule must be in APPROVED status to execute. Current status: %', v_schedule.status;
  END IF;

  -- Mark as EXECUTING
  UPDATE pricing_schedules SET status = 'EXECUTING', updated_at = now() WHERE id = p_schedule_id;

  v_margin_floor := COALESCE(v_schedule.minimum_margin_floor, 25.0);

  -- Process each schedule line
  FOR v_line IN
    SELECT * FROM pricing_schedule_lines
    WHERE schedule_id = p_schedule_id AND executed = false
    ORDER BY item_id
  LOOP
    BEGIN
      -- Load the current sell price record
      SELECT * INTO v_current_price FROM item_sell_prices WHERE id = v_line.sell_price_id;
      IF NOT FOUND THEN
        v_errors_count := v_errors_count + 1;
        UPDATE pricing_schedule_lines
        SET execution_error = 'Source sell price record not found', executed_at = now()
        WHERE id = v_line.id;
        CONTINUE;
      END IF;

      -- Verify it's still ACTIVE (could have changed since schedule was built)
      IF v_current_price.status != 'ACTIVE' THEN
        v_errors_count := v_errors_count + 1;
        UPDATE pricing_schedule_lines
        SET execution_error = 'Source price no longer ACTIVE (status: ' || v_current_price.status || ')',
            executed_at = now()
        WHERE id = v_line.id;
        CONTINUE;
      END IF;

      -- Calculate new price based on uplift method
      v_new_price := CASE v_schedule.uplift_method
        WHEN 'PERCENTAGE_INCREASE' THEN
          v_current_price.sell_price_ex_gst * (1 + v_schedule.uplift_value / 100)
        WHEN 'PERCENTAGE_DECREASE' THEN
          v_current_price.sell_price_ex_gst * (1 - v_schedule.uplift_value / 100)
        WHEN 'FIXED_AMOUNT_INCREASE' THEN
          v_current_price.sell_price_ex_gst + v_schedule.uplift_value
        WHEN 'FIXED_AMOUNT_DECREASE' THEN
          GREATEST(0, v_current_price.sell_price_ex_gst - v_schedule.uplift_value)
        ELSE v_schedule.uplift_value  -- REPLACE_WITH_NEW_PRICE
      END;

      -- Apply rounding rule
      v_new_price := CASE v_schedule.rounding_rule
        WHEN 'ROUND_UP'       THEN CEIL(v_new_price * 100) / 100
        WHEN 'NO_ROUNDING'    THEN v_new_price
        ELSE                       ROUND(v_new_price, 2)  -- ROUND_TO_CENT (default)
      END;

      -- Check margin floor
      v_new_margin := CASE WHEN v_new_price > 0
        THEN ((v_new_price - v_current_price.cost_basis) / v_new_price) * 100
        ELSE 0 END;

      IF v_new_margin < v_margin_floor THEN
        -- Flag but still create the price — it will require separate approval
        v_prices_flagged := v_prices_flagged + 1;
        UPDATE pricing_schedule_lines
        SET is_flagged = true,
            flag_reason = 'New margin ' || ROUND(v_new_margin, 2) || '% is below floor of ' || v_margin_floor || '%'
        WHERE id = v_line.id;
      END IF;

      -- Create the new sell price record (future version)
      INSERT INTO item_sell_prices (
        item_id, price_type, customer_id, customer_group_id, contract_id,
        sale_uom, sell_price_ex_gst, tax_code, cost_basis,
        publish_to_salesforce, publish_to_bundle, publish_to_linenhub,
        effective_from, effective_to, status, created_by
      ) VALUES (
        v_current_price.item_id,
        v_current_price.price_type,
        v_current_price.customer_id,
        v_current_price.customer_group_id,
        v_current_price.contract_id,
        v_current_price.sale_uom,
        v_new_price,
        v_current_price.tax_code,
        v_current_price.cost_basis,  -- cost_basis preserved from current version
        v_current_price.publish_to_salesforce,
        v_current_price.publish_to_bundle,
        v_current_price.publish_to_linenhub,
        v_schedule.new_effective_from,
        NULL,  -- open-ended
        'ACTIVE',  -- New version is immediately ACTIVE from its effective_from date
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      ) RETURNING id INTO v_new_price_id;

      -- Set effective_to on the outgoing current price (one day before new effective_from)
      -- IMPORTANT: This bypasses the immutability trigger for this specific field update
      -- by using a direct status-preserving update via SECURITY DEFINER
      UPDATE item_sell_prices
      SET effective_to = v_schedule.new_effective_from - INTERVAL '1 day',
          status = 'SUPERSEDED',
          superseded_by = v_new_price_id,
          updated_at = now()
      WHERE id = v_current_price.id;

      -- Update the schedule line as executed
      UPDATE pricing_schedule_lines
      SET executed = true,
          new_sell_price_id = v_new_price_id,
          new_margin_percent = v_new_margin,
          executed_at = now()
      WHERE id = v_line.id;

      v_prices_created := v_prices_created + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      v_errors_count := v_errors_count + 1;
      UPDATE pricing_schedule_lines
      SET execution_error = v_error_msg, executed_at = now()
      WHERE id = v_line.id;
      -- Continue processing remaining lines (partial completion is tracked)
    END;
  END LOOP;

  -- Update schedule with results
  UPDATE pricing_schedules SET
    status          = CASE WHEN v_errors_count = 0 THEN 'COMPLETED' ELSE 'FAILED' END,
    prices_created  = v_prices_created,
    executed_at     = now(),
    executed_by     = auth.uid(),
    execution_errors = (
      SELECT jsonb_agg(jsonb_build_object('line_id', id, 'error', execution_error))
      FROM pricing_schedule_lines
      WHERE schedule_id = p_schedule_id AND execution_error IS NOT NULL
    ),
    updated_at = now()
  WHERE id = p_schedule_id;

  RETURN QUERY SELECT v_prices_created, v_prices_flagged, v_errors_count,
    CASE WHEN v_errors_count = 0 THEN 'COMPLETED' ELSE 'COMPLETED_WITH_ERRORS' END;
END;
$$;


ALTER FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") IS 'Atomic execution of a pricing schedule. Creates new sell price versions and supersedes current ones. Must be called on an APPROVED schedule. Partial failures are tracked per line. Entire function runs in a single transaction — caller should COMMIT or ROLLBACK.';



CREATE OR REPLACE FUNCTION "public"."generate_item_request_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.request_number := 'IR-' || TO_CHAR(NOW(), 'YYYY') || '-'
    || LPAD(nextval('item_request_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_item_request_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_po_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  current_ym TEXT;
  next_seq INTEGER;
BEGIN
  current_ym := to_char(COALESCE(NEW.request_date, NOW()), 'YYYYMM');
  INSERT INTO public.po_sequences (year_month, last_seq) VALUES (current_ym, 0) ON CONFLICT (year_month) DO NOTHING;
  UPDATE public.po_sequences SET last_seq = last_seq + 1 WHERE year_month = current_ym RETURNING last_seq INTO next_seq;
  NEW.display_id := 'POR-' || current_ym || '-' || lpad(next_seq::text, 6, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_po_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_pricing_schedule_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.schedule_number := 'PS-' || TO_CHAR(NOW(), 'YYYY') || '-'
    || LPAD(nextval('pricing_schedule_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_pricing_schedule_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_count"() RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT count(*) FROM public.users;
$$;


ALTER FUNCTION "public"."get_user_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_permissions"() RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT 
    ARRAY(
      SELECT unnest(r.permissions)
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."get_user_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role_id FROM user_roles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_perms TEXT[];
BEGIN
  -- Get user's permissions as array
  SELECT get_user_permissions() INTO user_perms;
  
  IF user_perms IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if permission is in the array
  RETURN permission = ANY(user_perms);
END;
$$;


ALTER FUNCTION "public"."has_permission"("permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_smart_buying_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    select public.is_admin() or public.has_permission('manage_development')
$$;


ALTER FUNCTION "public"."has_smart_buying_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_item_request_draft"("p_requestor_id" "uuid", "p_request_type" "text", "p_item_description" "text", "p_business_reason" "text", "p_target_sap" boolean, "p_target_bundle" boolean, "p_target_linenhub" boolean, "p_target_salesforce" boolean, "p_department" "text" DEFAULT NULL::"text", "p_customer_reference" "text" DEFAULT NULL::"text", "p_contract_reference" "text" DEFAULT NULL::"text", "p_replacement_for_item_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_row item_requests;
BEGIN
  INSERT INTO item_requests (
    requestor_id, request_type, item_description, business_reason,
    target_sap, target_bundle, target_linenhub, target_salesforce,
    department, customer_reference, contract_reference,
    replacement_for_item_id, status
  ) VALUES (
    p_requestor_id,
    p_request_type::item_request_type,
    p_item_description,
    p_business_reason,
    p_target_sap, p_target_bundle, p_target_linenhub, p_target_salesforce,
    p_department, p_customer_reference, p_contract_reference,
    p_replacement_for_item_id,
    'DRAFT'
  )
  RETURNING * INTO new_row;

  RETURN row_to_json(new_row);
END;
$$;


ALTER FUNCTION "public"."insert_item_request_draft"("p_requestor_id" "uuid", "p_request_type" "text", "p_item_description" "text", "p_business_reason" "text", "p_target_sap" boolean, "p_target_bundle" boolean, "p_target_linenhub" boolean, "p_target_salesforce" boolean, "p_department" "text", "p_customer_reference" "text", "p_contract_reference" "text", "p_replacement_for_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role_id = 'ADMIN' FROM user_roles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_concur_po_number"("p_po_id" "uuid", "p_concur_po_number" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_requester_id uuid;
    v_status text;
    v_trimmed_po_number text;
    v_can_link boolean;
begin
    v_trimmed_po_number := btrim(coalesce(p_concur_po_number, ''));

    if v_trimmed_po_number = '' then
        raise exception 'A valid Concur PO number is required.';
    end if;

    select requester_id, status
    into v_requester_id, v_status
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'Request % not found.', p_po_id;
    end if;

    select exists (
        select 1
        from public.users u
        join public.roles r on r.id = u.role_id
        where u.auth_user_id = auth.uid()
        and (
            r.id = 'ADMIN'
            or 'link_concur' = any(coalesce(r.permissions, '{}'::text[]))
            or u.id = v_requester_id
        )
    ) into v_can_link;

    if not v_can_link then
        raise exception 'You do not have permission to link this Concur PO.';
    end if;

    if v_status <> 'APPROVED_PENDING_CONCUR' then
        raise exception 'Concur PO numbers can only be linked from APPROVED_PENDING_CONCUR (current status: %).', v_status;
    end if;

    update public.po_lines
    set concur_po_number = v_trimmed_po_number
    where po_request_id = p_po_id;

    update public.po_requests
    set status = 'ACTIVE'
    where id = p_po_id;
end;
$$;


ALTER FUNCTION "public"."link_concur_po_number"("p_po_id" "uuid", "p_concur_po_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_concur_request_number"("p_po_id" "uuid", "p_concur_request_number" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_requester_id uuid;
    v_status text;
    v_trimmed_request_number text;
    v_can_link boolean;
begin
    v_trimmed_request_number := btrim(coalesce(p_concur_request_number, ''));

    if v_trimmed_request_number = '' then
        raise exception 'A valid Concur Request number is required.';
    end if;

    select requester_id, status
    into v_requester_id, v_status
    from public.po_requests
    where id = p_po_id;

    if v_status is null then
        raise exception 'Request % not found.', p_po_id;
    end if;

    select exists (
        select 1
        from public.users u
        join public.roles r on r.id = u.role_id
        where u.auth_user_id = auth.uid()
        and (
            r.id = 'ADMIN'
            or 'link_concur' = any(coalesce(r.permissions, '{}'::text[]))
            or u.id = v_requester_id
        )
    ) into v_can_link;

    if not v_can_link then
        raise exception 'You do not have permission to link this Concur Request.';
    end if;

    if v_status <> 'APPROVED_PENDING_CONCUR_REQUEST' then
        raise exception 'Concur Request numbers can only be linked from APPROVED_PENDING_CONCUR_REQUEST (current status: %).', v_status;
    end if;

    update public.po_requests
    set
        concur_request_number = v_trimmed_request_number,
        status = 'APPROVED_PENDING_CONCUR'
    where id = p_po_id;
end;
$$;


ALTER FUNCTION "public"."link_concur_request_number"("p_po_id" "uuid", "p_concur_request_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_user_identity"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_email TEXT := auth.email();
  v_user_id UUID;
BEGIN
  IF v_auth_id IS NULL OR v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify if public user exists by email
  SELECT id INTO v_user_id
  FROM public.users
  WHERE lower(email) = lower(v_email);

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No public user profile found');
  END IF;

  -- Update the link
  UPDATE public.users
  SET auth_user_id = v_auth_id,
      email = v_email -- Ensure casing matches auth
  WHERE id = v_user_id
  AND (auth_user_id IS NULL OR auth_user_id != v_auth_id);

  RETURN jsonb_build_object('success', true, 'linked_id', v_user_id);
END;
$$;


ALTER FUNCTION "public"."link_user_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lowercase_email_trigger_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.email = LOWER(NEW.email);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."lowercase_email_trigger_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_sla_breached"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.sla_deadline IS NOT NULL AND NOW() > NEW.sla_deadline
     AND NEW.status = 'PENDING' AND NEW.sla_breached = false THEN
    NEW.sla_breached := true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_sla_breached"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  RETURN lower(trim(email));
END;
$$;


ALTER FUNCTION "public"."normalize_email"("email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer DEFAULT 90) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    delete from public.system_audit_logs
    where created_at < now() - (days_to_keep || ' days')::interval;
end;
$$;


ALTER FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_as_of_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("price_record_id" "uuid", "price_type" "public"."sell_price_type", "sell_price_ex_gst" numeric, "cost_basis" numeric, "margin_percent" numeric, "effective_from" "date", "effective_to" "date", "sale_uom" "text", "tax_code" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH ranked_prices AS (
    SELECT
      isp.id AS price_record_id,
      isp.price_type,
      isp.sell_price_ex_gst,
      isp.cost_basis,
      isp.margin_percent,
      isp.effective_from,
      isp.effective_to,
      isp.sale_uom,
      isp.tax_code,
      -- Specificity rank: CONTRACT=1 (highest), CUSTOMER_SPECIFIC=2, GROUP=3, STANDARD=4
      CASE isp.price_type
        WHEN 'CONTRACT'         THEN 1
        WHEN 'CUSTOMER_SPECIFIC' THEN 2
        WHEN 'GROUP'            THEN 3
        WHEN 'STANDARD'         THEN 4
        ELSE 5
      END AS specificity_rank
    FROM item_sell_prices isp
    WHERE
      isp.item_id = p_item_id
      AND isp.status = 'ACTIVE'
      AND isp.effective_from <= p_as_of_date
      AND (isp.effective_to IS NULL OR isp.effective_to >= p_as_of_date)
      AND (
        -- STANDARD: applies to all customers
        isp.price_type = 'STANDARD'
        -- CUSTOMER_SPECIFIC: only for this exact customer
        OR (isp.price_type = 'CUSTOMER_SPECIFIC' AND isp.customer_id = p_customer_id)
        -- GROUP/CONTRACT: checked by caller with group resolution; simplified here
        OR (isp.price_type IN ('GROUP', 'CONTRACT') AND p_customer_id IS NOT NULL)
        -- PROMOTIONAL: treat same as STANDARD for resolution
        OR isp.price_type = 'PROMOTIONAL'
      )
  )
  SELECT
    ranked_prices.price_record_id, ranked_prices.price_type, ranked_prices.sell_price_ex_gst, ranked_prices.cost_basis,
    ranked_prices.margin_percent, ranked_prices.effective_from, ranked_prices.effective_to, ranked_prices.sale_uom, ranked_prices.tax_code
  FROM ranked_prices
  ORDER BY specificity_rank ASC, effective_from DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid", "p_as_of_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid", "p_as_of_date" "date") IS 'Returns the most specific active sell price for an item/customer/date combination. All application code needing a sell price must use this function.';



CREATE OR REPLACE FUNCTION "public"."resolve_purchase_cost"("p_item_id" "uuid", "p_supplier_id" "uuid" DEFAULT NULL::"uuid", "p_as_of_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("price_record_id" "uuid", "supplier_id" "uuid", "purchase_price_ex_gst" numeric, "landed_cost" numeric, "currency" character, "purchase_uom" "text", "effective_from" "date", "effective_to" "date")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ipp.id,
    ipp.supplier_id,
    ipp.purchase_price_ex_gst,
    ipp.landed_cost,
    ipp.currency,
    ipp.purchase_uom,
    ipp.effective_from,
    ipp.effective_to
  FROM item_purchase_prices ipp
  WHERE
    ipp.item_id = p_item_id
    AND ipp.status = 'ACTIVE'
    AND ipp.effective_from <= p_as_of_date
    AND (ipp.effective_to IS NULL OR ipp.effective_to >= p_as_of_date)
    AND (p_supplier_id IS NULL OR ipp.supplier_id = p_supplier_id)
  ORDER BY
    ipp.is_preferred_supplier DESC,  -- preferred supplier first
    ipp.effective_from DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."resolve_purchase_cost"("p_item_id" "uuid", "p_supplier_id" "uuid", "p_as_of_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "display_name" "text", "email" "text", "job_title" "text", "department" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check permission
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND (p_site_id = ANY(site_ids) OR role_id = 'ADMIN')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.display_name,
    d.email,
    d.job_title,
    d.department
  FROM public.directory_users d
  WHERE (d.site_id IS NULL OR d.site_id = p_site_id)
  AND (
    d.search_text ILIKE '%' || p_query || '%'
    OR
    d.email ILIKE p_query || '%'
    OR
    d.display_name ILIKE '%' || p_query || '%'
  )
  ORDER BY 
    CASE WHEN d.email ILIKE p_query || '%' THEN 0 ELSE 1 END,
    d.display_name
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_approval_sla_deadline"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.sla_deadline := NEW.created_at + (NEW.sla_hours || ' hours')::interval;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_approval_sla_deadline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ir_stage_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'SUBMITTED'        AND OLD.status = 'DRAFT'     THEN NEW.submitted_at        := now(); END IF;
  IF NEW.status = 'DUPLICATE_REVIEW' AND OLD.status = 'SUBMITTED' THEN NEW.duplicate_review_at := now(); END IF;
  IF NEW.status = 'PROCUREMENT_REVIEW'                             THEN NEW.status_changed_at   := now(); END IF;
  IF NEW.status = 'DATA_REVIEW'                                    THEN NEW.data_review_at      := now(); END IF;
  IF NEW.status = 'PRICING_REVIEW'                                 THEN NEW.pricing_review_at   := now(); END IF;
  IF NEW.status = 'APPROVAL_PENDING'                               THEN NEW.approval_pending_at := now(); END IF;
  IF NEW.status = 'APPROVED'                                       THEN NEW.approved_at         := now(); END IF;
  IF NEW.status = 'ACTIVE'                                         THEN NEW.activated_at        := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ir_stage_timestamps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ir_urgency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.required_activation_date IS NOT NULL THEN
    NEW.is_urgent := (NEW.required_activation_date - CURRENT_DATE) <= 5;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ir_urgency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_isp_margin_approval_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  threshold NUMERIC;
BEGIN
  -- Read threshold from app_config if available
  SELECT (value::numeric) INTO threshold
  FROM app_config WHERE key = 'margin_approval_threshold' LIMIT 1;
  
  -- Fallback if no config row exists
  IF threshold IS NULL THEN
    threshold := 25.0;
  END IF;

  IF NEW.sell_price_ex_gst > 0 AND NEW.cost_basis > 0 THEN
    NEW.requires_margin_approval :=
      (((NEW.sell_price_ex_gst - NEW.cost_basis) / NEW.sell_price_ex_gst) * 100) < threshold;
  ELSE
    NEW.requires_margin_approval := false;
  END IF;
  
  -- Ensure it's never NULL to satisfy NOT NULL constraint
  IF NEW.requires_margin_approval IS NULL THEN
    NEW.requires_margin_approval := false;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_isp_margin_approval_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_item_request_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'REVISION_REQUIRED' THEN
    INSERT INTO item_request_revisions (request_id, revision_number, status_at_revision, snapshot, revision_reason, revised_by)
    VALUES (
      OLD.id,
      OLD.revision_number,
      OLD.status,
      row_to_json(OLD)::jsonb,
      NEW.revision_reason,
      auth.uid()
    );
    NEW.revision_number := OLD.revision_number + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."snapshot_item_request_revision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_item_unit_price_from_sell"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NEW.price_type = 'STANDARD' THEN
    UPDATE items
    SET unit_price = NEW.sell_price_ex_gst,
        updated_at = now()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_item_unit_price_from_sell"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_item_request"("p_request_id" "uuid", "p_to_status" "text", "p_actor_id" "uuid", "p_notes" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_from_status text;
  v_now         timestamptz := now();
BEGIN
  -- Fetch current status (bypasses RLS via SECURITY DEFINER)
  SELECT status::text INTO v_from_status
  FROM item_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  -- Apply status update
  UPDATE item_requests
  SET
    status             = p_to_status::item_request_status,
    status_changed_at  = v_now,
    status_changed_by  = p_actor_id
  WHERE id = p_request_id;

  -- Write audit log (best-effort, swallowed on error)
  BEGIN
    INSERT INTO item_request_audit_log (
      request_id, action, from_status, to_status,
      performed_by, performed_at, notes, metadata
    ) VALUES (
      p_request_id, 'STATUS_TRANSITION', v_from_status, p_to_status,
      p_actor_id, v_now, p_notes, p_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort; don't block the transition
    NULL;
  END;
END;
$$;


ALTER FUNCTION "public"."transition_item_request"("p_request_id" "uuid", "p_to_status" "text", "p_actor_id" "uuid", "p_notes" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_iai_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_iai_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_instance_on_decision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE item_approval_instances
  SET status = NEW.decision::TEXT::approval_instance_status,
      decision_id = NEW.id,
      updated_at = now()
  WHERE id = NEW.instance_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_instance_on_decision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ipe_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_ipe_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ipp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_ipp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_isp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_isp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_status text;
    v_requester_id uuid;
    l_line jsonb;
    v_is_admin boolean;
begin
    -- Check if user is an ADMIN
    select exists (
        select 1 from public.users u 
        join public.roles r on u.role_id = r.id 
        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
    ) into v_is_admin;

    -- Verify request exists and get details
    select status, requester_id into v_status, v_requester_id from public.po_requests where id = p_request_id;
    if v_status is null then
        raise exception 'Request % not found', p_request_id;
    end if;

    -- Enforce status and ownership rules for non-admins
    if not v_is_admin then
        if v_status != 'PENDING_APPROVAL' then
            raise exception 'Only PENDING_APPROVAL requests can be edited (current status: %)', v_status;
        end if;
        if auth.uid() not in (select auth_user_id from public.users where id = v_requester_id) then
            raise exception 'Only the requester can edit their pending requests.';
        end if;
    end if;

    -- Update Header (concur_po_number is per-line, NOT on po_requests)
    update public.po_requests
    set
        total_amount = coalesce((p_header->>'total_amount')::numeric, total_amount),
        reason_for_request = coalesce(p_header->>'reason_for_request', reason_for_request),
        comments = coalesce(p_header->>'comments', comments),
        customer_name = coalesce(p_header->>'customer_name', customer_name),
        supplier_id = coalesce((p_header->>'supplier_id')::uuid, supplier_id),
        site_id = coalesce((p_header->>'site_id')::uuid, site_id),
        concur_request_number = coalesce(p_header->>'concur_request_number', concur_request_number)
    where id = p_request_id;

    -- Lines processing: UPSERT approach
    -- Only delete lines that are NOT in the provided payload
    delete from public.po_lines
    where po_request_id = p_request_id
    and id not in (
        select (value->>'id')::uuid
        from jsonb_array_elements(p_lines)
        where (value->>'id') is not null
    );

    -- Insert or Update lines
    for l_line in select * from jsonb_array_elements(p_lines) loop
        insert into public.po_lines (
            po_request_id,
            id,
            item_id,
            sku,
            item_name,
            quantity_ordered,
            unit_price,
            total_price,
            concur_po_number
        ) values (
            p_request_id,
            coalesce((l_line->>'id')::uuid, gen_random_uuid()),
            (l_line->>'item_id')::uuid,
            l_line->>'sku',
            l_line->>'item_name',
            (l_line->>'quantity_ordered')::numeric,
            (l_line->>'unit_price')::numeric,
            (l_line->>'total_price')::numeric,
            l_line->>'concur_po_number'
        )
        on conflict (id) do update set
            quantity_ordered = excluded.quantity_ordered,
            unit_price = excluded.unit_price,
            total_price = excluded.total_price,
            concur_po_number = coalesce(excluded.concur_po_number, po_lines.concur_po_number);
    end loop;
end;
$$;


ALTER FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ps_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_ps_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "text",
    "description" "text"
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_number" "text" NOT NULL,
    "request_type" "text" NOT NULL,
    "lifecycle_status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "requestor_user_id" "uuid",
    "requestor_name" "text",
    "department" "text",
    "business_unit" "text",
    "branch_site_id" "uuid",
    "branch_site_name" "text",
    "required_activation_date" "date",
    "business_reason" "text",
    "business_reason_detail" "text",
    "new_or_replacement" "text" DEFAULT 'New Item'::"text" NOT NULL,
    "existing_item_id" "uuid",
    "customer_reference" "text",
    "proposed_description" "text" NOT NULL,
    "item_group" "text",
    "division" "text",
    "purchase_enabled" boolean DEFAULT false NOT NULL,
    "sale_enabled" boolean DEFAULT false NOT NULL,
    "bundle_enabled" boolean DEFAULT false NOT NULL,
    "linenhub_enabled" boolean DEFAULT false NOT NULL,
    "salesforce_visible" boolean DEFAULT false NOT NULL,
    "preview_active" boolean DEFAULT true NOT NULL,
    "duplicate_check_id" "uuid",
    "current_margin_percent" numeric(8,2),
    "current_margin_amount" numeric(12,2),
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "draft_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."approved_items" AS
 SELECT "id",
    "request_number",
    "request_type",
    "lifecycle_status",
    "requestor_user_id",
    "requestor_name",
    "department",
    "business_unit",
    "branch_site_id",
    "branch_site_name",
    "required_activation_date",
    "business_reason",
    "business_reason_detail",
    "new_or_replacement",
    "existing_item_id",
    "customer_reference",
    "proposed_description",
    "item_group",
    "division",
    "purchase_enabled",
    "sale_enabled",
    "bundle_enabled",
    "linenhub_enabled",
    "salesforce_visible",
    "preview_active",
    "duplicate_check_id",
    "current_margin_percent",
    "current_margin_amount",
    "validation_summary",
    "draft_payload",
    "created_by",
    "created_at",
    "updated_at"
   FROM "public"."preview_item_requests"
  WHERE ("lifecycle_status" = 'Approved'::"text");


ALTER VIEW "public"."approved_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_capitalization" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_line_id" "uuid" NOT NULL,
    "gl_code" "text",
    "asset_tag" "text",
    "capitalized_date" "date",
    "depreciation_years" integer,
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."asset_capitalization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attribute_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "value" "text" NOT NULL,
    "type" "text" NOT NULL,
    "parent_id" "uuid",
    "active_flag" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."attribute_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_connect_replica_lag" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_code" "text" NOT NULL,
    "lag_seconds" integer,
    "sampled_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bundle_connect_replica_lag" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_connect_sync_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_code" "text" NOT NULL,
    "site_name" "text" NOT NULL,
    "host" "text",
    "port" integer DEFAULT 3307 NOT NULL,
    "database_name" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "excluded" boolean DEFAULT false NOT NULL,
    "exclusion_reason" "text",
    "batch_size" integer DEFAULT 500 NOT NULL,
    "rate_limit_ms" integer DEFAULT 200 NOT NULL,
    "lag_alert_hours" integer DEFAULT 24 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bundle_connect_sync_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_connect_sync_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_code" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "triggered_by" "text" DEFAULT 'schedule'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "rows_fetched" integer,
    "rows_written" integer,
    "watermark_start" bigint,
    "watermark_end" bigint,
    "error_message" "text",
    "replica_lag_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bundle_connect_sync_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "bundle_connect_sync_jobs_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['schedule'::"text", 'manual'::"text", 'retry'::"text"])))
);


ALTER TABLE "public"."bundle_connect_sync_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_connect_sync_watermarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_code" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "last_record_number" bigint DEFAULT 0 NOT NULL,
    "last_synced_at" timestamp with time zone,
    "rows_synced" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."bundle_connect_sync_watermarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid",
    "supplier_id" "uuid",
    "supplier_sku" "text",
    "price" numeric
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."colour_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "code" "text" NOT NULL,
    "pattern_type" "text" DEFAULT 'solid'::"text" NOT NULL,
    "primary_hex" "text" DEFAULT '#CCCCCC'::"text" NOT NULL,
    "secondary_hex" "text",
    "stripe_angle" integer DEFAULT 45 NOT NULL,
    "stripe_width" integer DEFAULT 50 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "colour_options_pattern_type_check" CHECK (("pattern_type" = ANY (ARRAY['solid'::"text", 'stripe'::"text"])))
);


ALTER TABLE "public"."colour_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_request_id" "uuid",
    "date" timestamp with time zone,
    "docket_number" "text",
    "received_by" "text",
    "received_by_id" "uuid"
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "delivery_id" "uuid",
    "po_line_id" "uuid",
    "quantity" integer,
    "invoice_number" "text",
    "is_capitalised" boolean DEFAULT false,
    "capitalised_date" timestamp with time zone,
    "freight_amount" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."delivery_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."directory_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid",
    "entra_oid" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "upn" "text",
    "search_text" "text",
    "job_title" "text",
    "department" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."directory_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "site_id" "uuid",
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "invited_by" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid"
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_approval_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "instance_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "decision" "public"."approval_decision_type" NOT NULL,
    "decided_by" "uuid" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comments" "text" NOT NULL,
    "escalated_to_user" "uuid",
    "escalation_reason" "text",
    "request_status_at_decision" "public"."item_request_status" NOT NULL,
    "item_summary" "jsonb",
    CONSTRAINT "item_approval_decisions_comments_check" CHECK (("length"(TRIM(BOTH FROM "comments")) >= 10))
);


ALTER TABLE "public"."item_approval_decisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_approval_decisions" IS 'Immutable audit log of every approval action. Never update or delete. Linked to item_approval_instances; triggers instance status update on insert.';



CREATE TABLE IF NOT EXISTS "public"."item_approval_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "rule_id" "uuid",
    "rule_name" "text" NOT NULL,
    "approver_type" "text" DEFAULT 'ROLE'::"text" NOT NULL,
    "approver_role" "text",
    "approver_user_id" "uuid",
    "stage_order" integer DEFAULT 1 NOT NULL,
    "sla_hours" integer DEFAULT 72 NOT NULL,
    "sla_deadline" timestamp with time zone,
    "sla_breached" boolean DEFAULT false NOT NULL,
    "status" "public"."approval_instance_status" DEFAULT 'PENDING'::"public"."approval_instance_status" NOT NULL,
    "decision_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sla_notified_at" timestamp with time zone
);


ALTER TABLE "public"."item_approval_instances" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_approval_instances" IS 'One record per approval task per item request. Routed to a role or named user. Sequential stage_order enforced by application: stage N cannot start until stage N-1 is APPROVED.';



COMMENT ON COLUMN "public"."item_approval_instances"."sla_notified_at" IS 'Timestamp of when the SLA breach notification was sent to prevent duplicate alerts.';



CREATE TABLE IF NOT EXISTS "public"."item_approval_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_name" "text" NOT NULL,
    "description" "text",
    "condition_type" "text" NOT NULL,
    "condition_value" "text",
    "approver_type" "text" NOT NULL,
    "approver_id" "text",
    "sequential_stage_order" integer DEFAULT 1 NOT NULL,
    "sla_hours" integer DEFAULT 48 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_approval_rules_approver_type_check" CHECK (("approver_type" = ANY (ARRAY['ROLE'::"text", 'USER'::"text", 'AUTO'::"text"]))),
    CONSTRAINT "item_approval_rules_condition_type_check" CHECK (("condition_type" = ANY (ARRAY['MARGIN_BELOW'::"text", 'PURCHASE_ONLY'::"text", 'SALE_ONLY'::"text", 'CUSTOMER_SPECIFIC'::"text", 'CONTRACT'::"text", 'COG'::"text", 'URGENT'::"text", 'REPLACEMENT'::"text", 'BUNDLE_ONLY'::"text", 'LINENHUB_ONLY'::"text", 'DEFAULT'::"text"])))
);


ALTER TABLE "public"."item_approval_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_completeness_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "request_id" "uuid",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "checked_by" "uuid",
    "check_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_checks" integer DEFAULT 0 NOT NULL,
    "passed_checks" integer DEFAULT 0 NOT NULL,
    "failed_checks" integer DEFAULT 0 NOT NULL,
    "is_complete" boolean GENERATED ALWAYS AS ((("failed_checks" = 0) AND ("total_checks" > 0))) STORED,
    "failing_fields" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text"
);


ALTER TABLE "public"."item_completeness_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_duplicate_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "search_terms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "performed_by" "uuid",
    "performed_at" timestamp with time zone,
    "candidate_items" "jsonb" DEFAULT '[]'::"jsonb",
    "candidate_count" integer DEFAULT 0 NOT NULL,
    "highest_similarity" numeric(5,4) DEFAULT 0,
    "outcome" "public"."duplicate_check_outcome" DEFAULT 'PENDING'::"public"."duplicate_check_outcome" NOT NULL,
    "existing_item_id" "uuid",
    "justification" "text",
    "is_locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "idc_similar_needs_justification" CHECK ((("outcome" <> 'SIMILAR_NEW_REQUIRED'::"public"."duplicate_check_outcome") OR (("justification" IS NOT NULL) AND ("length"("justification") >= 20)))),
    CONSTRAINT "idc_use_existing_needs_item" CHECK ((("outcome" <> 'USE_EXISTING'::"public"."duplicate_check_outcome") OR ("existing_item_id" IS NOT NULL)))
);


ALTER TABLE "public"."item_duplicate_checks" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_duplicate_checks" IS 'One record per item request. Stores the structured outcome of the duplicate search. Immutable once locked (outcome set to non-PENDING value). Auto-created when an item_request transitions from DRAFT to SUBMITTED.';



CREATE TABLE IF NOT EXISTS "public"."item_field_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "is_visible" boolean DEFAULT true,
    "is_filterable" boolean DEFAULT true,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."item_field_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_publication_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "price_record_id" "uuid",
    "target_system" "public"."publication_target" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "payload_hash" "text",
    "status" "public"."publication_event_status" DEFAULT 'QUEUED'::"public"."publication_event_status" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 5 NOT NULL,
    "last_attempted_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone,
    "error_message" "text",
    "dispatched_at" timestamp with time zone,
    "acknowledged_at" timestamp with time zone,
    "external_item_id" "text",
    "external_price_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_publication_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_purchase_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "supplier_item_code" "text",
    "purchase_price_ex_gst" numeric(12,4) NOT NULL,
    "currency" character(3) DEFAULT 'AUD'::"bpchar" NOT NULL,
    "purchase_uom" "text" NOT NULL,
    "pack_conversion_factor" numeric(8,4) DEFAULT 1.0 NOT NULL,
    "moq" integer DEFAULT 1,
    "lead_time_days" integer DEFAULT 0,
    "freight_handling_cost" numeric(12,4) DEFAULT 0 NOT NULL,
    "landed_cost" numeric(12,4) GENERATED ALWAYS AS (("purchase_price_ex_gst" + "freight_handling_cost")) STORED,
    "is_preferred_supplier" boolean DEFAULT false NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "status" "public"."purchase_price_status" DEFAULT 'DRAFT'::"public"."purchase_price_status" NOT NULL,
    "superseded_by" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ipp_dates_valid" CHECK ((("effective_to" IS NULL) OR ("effective_to" > "effective_from"))),
    CONSTRAINT "item_purchase_prices_freight_handling_cost_check" CHECK (("freight_handling_cost" >= (0)::numeric)),
    CONSTRAINT "item_purchase_prices_lead_time_days_check" CHECK (("lead_time_days" >= 0)),
    CONSTRAINT "item_purchase_prices_moq_check" CHECK (("moq" > 0)),
    CONSTRAINT "item_purchase_prices_pack_conversion_factor_check" CHECK (("pack_conversion_factor" > (0)::numeric)),
    CONSTRAINT "item_purchase_prices_purchase_price_ex_gst_check" CHECK (("purchase_price_ex_gst" >= (0)::numeric))
);


ALTER TABLE "public"."item_purchase_prices" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_purchase_prices" IS 'Date-effective purchase price versions per item per supplier. Each record is immutable once ACTIVE or SUPERSEDED. Governed by Procurement team only.';



CREATE TABLE IF NOT EXISTS "public"."item_request_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "performed_by" "uuid",
    "performed_by_name" "text",
    "from_status" "text",
    "to_status" "text",
    "summary" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."item_request_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_request_audit_log" IS 'Immutable audit trail for all item request workflow events (status changes, assignments, comments, field edits). Never update or delete rows.';



CREATE SEQUENCE IF NOT EXISTS "public"."item_request_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."item_request_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_request_revisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "revision_number" integer NOT NULL,
    "status_at_revision" "public"."item_request_status" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "revision_reason" "text",
    "revised_by" "uuid",
    "revised_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."item_request_revisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_request_revisions" IS 'Immutable snapshots of item_requests state at each revision point. Auto-populated when status transitions to REVISION_REQUIRED.';



CREATE TABLE IF NOT EXISTS "public"."item_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_number" "text" NOT NULL,
    "request_type" "public"."item_request_type" NOT NULL,
    "status" "public"."item_request_status" DEFAULT 'DRAFT'::"public"."item_request_status" NOT NULL,
    "requestor_id" "uuid" NOT NULL,
    "department" "text",
    "business_unit" "text",
    "item_description" "text" NOT NULL,
    "business_reason" "text" NOT NULL,
    "required_activation_date" "date",
    "replacement_for_item_id" "uuid",
    "customer_reference" "text",
    "contract_reference" "text",
    "target_bundle" boolean DEFAULT false NOT NULL,
    "target_linenhub" boolean DEFAULT false NOT NULL,
    "target_salesforce" boolean DEFAULT false NOT NULL,
    "target_sap" boolean DEFAULT false NOT NULL,
    "resulting_item_id" "uuid",
    "revision_number" integer DEFAULT 1 NOT NULL,
    "revision_reason" "text",
    "is_urgent" boolean DEFAULT false NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "submitted_at" timestamp with time zone,
    "duplicate_review_at" timestamp with time zone,
    "data_review_at" timestamp with time zone,
    "pricing_review_at" timestamp with time zone,
    "approval_pending_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wizard_draft" "jsonb" DEFAULT '{}'::"jsonb",
    "assigned_to" "uuid",
    "assigned_at" timestamp with time zone,
    "status_changed_at" timestamp with time zone,
    "status_changed_by" "uuid",
    "revision_requested_by" "uuid",
    "spec_gsm" integer,
    "spec_uom" "text",
    "spec_upq" integer,
    "spec_material" "text",
    "spec_grade" "text",
    "spec_width_cm" numeric(8,2),
    "spec_height_cm" numeric(8,2),
    "spec_notes" "text",
    "procurement_reviewed_at" timestamp with time zone,
    "proposed_code" "text",
    "item_code" "text",
    "customer_code" "text",
    "requestor_name" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."item_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_requests" IS 'Lifecycle spine for governed item creation. Every new item starts here. Status transitions are the authoritative record of workflow position.';



COMMENT ON COLUMN "public"."item_requests"."wizard_draft" IS 'Per-step draft state keyed by step ID. Written by useItemWizardDraft hook on each step advance. Allows resuming a wizard mid-flight without data loss.';



COMMENT ON COLUMN "public"."item_requests"."assigned_to" IS 'User currently responsible for actioning this request (set per stage by the routing logic).';



COMMENT ON COLUMN "public"."item_requests"."status_changed_at" IS 'Timestamp of the most recent status transition. Updated by itemWorkflowService.transitionRequest.';



COMMENT ON COLUMN "public"."item_requests"."status_changed_by" IS 'User who performed the most recent status transition.';



COMMENT ON COLUMN "public"."item_requests"."revision_requested_by" IS 'User who triggered the REVISION_REQUIRED transition (approver or master data team member).';



CREATE TABLE IF NOT EXISTS "public"."item_sell_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "price_type" "public"."sell_price_type" DEFAULT 'STANDARD'::"public"."sell_price_type" NOT NULL,
    "customer_id" "uuid",
    "customer_group_id" "uuid",
    "contract_id" "uuid",
    "sale_uom" "text" NOT NULL,
    "sell_price_ex_gst" numeric(12,4) NOT NULL,
    "tax_code" "text" DEFAULT 'GST'::"text" NOT NULL,
    "cost_basis" numeric(12,4) DEFAULT 0 NOT NULL,
    "margin_percent" numeric(7,4) GENERATED ALWAYS AS (
CASE
    WHEN ("sell_price_ex_gst" = (0)::numeric) THEN (0)::numeric
    ELSE "round"(((("sell_price_ex_gst" - "cost_basis") / "sell_price_ex_gst") * (100)::numeric), 4)
END) STORED,
    "margin_amount" numeric(12,4) GENERATED ALWAYS AS (("sell_price_ex_gst" - "cost_basis")) STORED,
    "requires_margin_approval" boolean DEFAULT false NOT NULL,
    "publish_to_salesforce" boolean DEFAULT false NOT NULL,
    "publish_to_bundle" boolean DEFAULT false NOT NULL,
    "publish_to_linenhub" boolean DEFAULT false NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "status" "public"."sell_price_status" DEFAULT 'DRAFT'::"public"."sell_price_status" NOT NULL,
    "superseded_by" "uuid",
    "approval_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "isp_contract_needs_contract" CHECK ((("price_type" <> 'CONTRACT'::"public"."sell_price_type") OR ("contract_id" IS NOT NULL))),
    CONSTRAINT "isp_customer_specific_needs_customer" CHECK ((("price_type" <> 'CUSTOMER_SPECIFIC'::"public"."sell_price_type") OR ("customer_id" IS NOT NULL))),
    CONSTRAINT "isp_dates_valid" CHECK ((("effective_to" IS NULL) OR ("effective_to" > "effective_from"))),
    CONSTRAINT "isp_standard_no_customer" CHECK ((("price_type" <> 'STANDARD'::"public"."sell_price_type") OR (("customer_id" IS NULL) AND ("customer_group_id" IS NULL) AND ("contract_id" IS NULL)))),
    CONSTRAINT "item_sell_prices_cost_basis_check" CHECK (("cost_basis" >= (0)::numeric)),
    CONSTRAINT "item_sell_prices_sell_price_ex_gst_check" CHECK (("sell_price_ex_gst" >= (0)::numeric))
);


ALTER TABLE "public"."item_sell_prices" OWNER TO "postgres";


COMMENT ON TABLE "public"."item_sell_prices" IS 'Date-effective sell price versions per item per price type. Immutable once ACTIVE or SUPERSEDED. Governed by Sales/Finance team only. cost_basis is locked at creation time and does not update when purchase price changes.';



COMMENT ON COLUMN "public"."item_sell_prices"."cost_basis" IS 'Preferred supplier landed cost at the time this sell price was created. Intentionally locked — margin history is preserved even when purchase prices change.';



CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "unit_price" numeric,
    "uom" "text",
    "category" "text",
    "sub_category" "text",
    "stock_level" integer DEFAULT 0,
    "supplier_id" "uuid",
    "is_rfid" boolean DEFAULT false,
    "is_cog" boolean DEFAULT false,
    "specs" "jsonb",
    "default_order_multiple" integer DEFAULT 1,
    "active_flag" boolean DEFAULT true,
    "sap_item_code_raw" "text",
    "sap_item_code_norm" "text",
    "range_name" "text",
    "stock_type" "text",
    "item_weight" numeric,
    "item_pool" "text",
    "item_catalog" "text",
    "item_type" "text",
    "rfid_flag" boolean,
    "item_colour" "text",
    "item_pattern" "text",
    "item_material" "text",
    "item_size" "text",
    "measurements" "text",
    "cog_flag" boolean,
    "cog_customer" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "upq" numeric,
    "workflow_status" "text" DEFAULT 'ACTIVE'::"text",
    "current_request_id" "uuid",
    "last_published_at" timestamp with time zone,
    "publication_version" integer DEFAULT 0,
    "min_level" integer,
    "max_level" integer,
    "short_name" "text"
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."workflow_status" IS 'LEGACY = pre-governance item. ACTIVE = fully governed and published. Workflow status is driven by item_requests lifecycle; do not manually update.';



COMMENT ON COLUMN "public"."items"."current_request_id" IS 'FK to the active item_request governing this item. NULL for LEGACY items.';



CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_type" "text",
    "label" "text",
    "channels" "jsonb",
    "recipient_roles" "text"[],
    "custom_emails" "jsonb"
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."po_approvals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_request_id" "uuid",
    "approver_id" "uuid",
    "approver_name" "text",
    "action" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "comments" "text"
);


ALTER TABLE "public"."po_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."po_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_request_id" "uuid",
    "item_id" "uuid",
    "sku" "text",
    "item_name" "text",
    "quantity_ordered" integer,
    "quantity_received" integer DEFAULT 0,
    "unit_price" numeric,
    "total_price" numeric,
    "concur_po_number" "text",
    "is_force_closed" boolean DEFAULT false
);


ALTER TABLE "public"."po_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."po_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "display_id" "text",
    "request_date" timestamp with time zone,
    "requester_id" "uuid",
    "site_id" "uuid",
    "supplier_id" "uuid",
    "status" "text",
    "total_amount" numeric,
    "customer_name" "text",
    "reason_for_request" "text",
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "concur_request_number" "text"
);


ALTER TABLE "public"."po_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."po_sequences" (
    "year_month" "text" NOT NULL,
    "last_seq" integer DEFAULT 0
);


ALTER TABLE "public"."po_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_approval_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_instance_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "approver_user_id" "uuid",
    "approver_name" "text",
    "stage" integer DEFAULT 1 NOT NULL,
    "decision" "text" NOT NULL,
    "comments" "text",
    "matched_rule" "text",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_approval_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_approval_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "matched_rule" "text",
    "current_stage" integer DEFAULT 1 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."preview_item_approval_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "action_type" "text" NOT NULL,
    "performed_by" "uuid",
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "mode" "text" DEFAULT 'PREVIEW'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_duplicate_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "search_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_terms" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "match_count" integer DEFAULT 0 NOT NULL,
    "highest_match_score" numeric(5,4) DEFAULT 0 NOT NULL,
    "selected_outcome" "text" DEFAULT 'NoDuplicate'::"text" NOT NULL,
    "justification" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_duplicate_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_master_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "proposed_sku" "text" NOT NULL,
    "sku_validation" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sku_override_reason" "text",
    "confirmed_description" "text",
    "item_category" "text",
    "product_type" "text",
    "size_code" "text",
    "variety_code" "text",
    "colour_code" "text",
    "gsm_code" "text",
    "rfid_flag" boolean DEFAULT false NOT NULL,
    "cog_flag" boolean DEFAULT false NOT NULL,
    "cog_customer" "text",
    "item_weight" numeric(12,3),
    "purchase_uom" "text",
    "sale_uom" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_master_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_item_reference_overlays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_value" "text" NOT NULL,
    "code" "text" NOT NULL,
    "notes" "text",
    "active_flag" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_item_reference_overlays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_publication_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "correlation_id" "uuid" NOT NULL,
    "source_system" "text" DEFAULT 'ProcureFlow Preview'::"text" NOT NULL,
    "target_system" "text" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "external_item_id" "text",
    "external_price_id" "text",
    "published_at" timestamp with time zone,
    "acknowledged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_publication_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_purchase_price_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "supplier_name" "text",
    "supplier_item_code" "text",
    "purchase_uom" "text",
    "purchase_price_ex_gst" numeric(12,2),
    "purchase_currency" "text" DEFAULT 'AUD'::"text",
    "minimum_order_quantity" numeric(12,2),
    "lead_time_days" integer,
    "freight_handling_cost" numeric(12,2) DEFAULT 0,
    "landed_cost" numeric(12,2),
    "effective_from" "date",
    "effective_to" "date",
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_purchase_price_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preview_sell_price_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "price_type" "text" DEFAULT 'Standard'::"text" NOT NULL,
    "customer_reference" "text",
    "customer_group_reference" "text",
    "sale_uom" "text",
    "sell_price_ex_gst" numeric(12,2),
    "tax_code" "text",
    "effective_from" "date",
    "effective_to" "date",
    "margin_percent" numeric(8,2),
    "margin_amount" numeric(12,2),
    "approval_required" boolean DEFAULT false NOT NULL,
    "publish_to_salesforce" boolean DEFAULT false NOT NULL,
    "publish_to_bundle" boolean DEFAULT false NOT NULL,
    "publish_to_linenhub" boolean DEFAULT false NOT NULL,
    "validation_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."preview_sell_price_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_schedule_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "sell_price_id" "uuid" NOT NULL,
    "old_price" numeric(12,4) NOT NULL,
    "calculated_new_price" numeric(12,4) NOT NULL,
    "new_sell_price_id" "uuid",
    "old_margin_percent" numeric(7,4),
    "new_margin_percent" numeric(7,4),
    "is_flagged" boolean DEFAULT false NOT NULL,
    "flag_reason" "text",
    "executed" boolean DEFAULT false NOT NULL,
    "execution_error" "text",
    "executed_at" timestamp with time zone
);


ALTER TABLE "public"."pricing_schedule_lines" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pricing_schedule_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pricing_schedule_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_number" "text" NOT NULL,
    "schedule_name" "text" NOT NULL,
    "basis" "public"."pricing_schedule_basis" NOT NULL,
    "basis_reference" "text",
    "justification" "text",
    "uplift_method" "public"."pricing_schedule_method" NOT NULL,
    "uplift_value" numeric(8,4) NOT NULL,
    "price_type_filter" "public"."sell_price_type"[],
    "item_category_filter" "text"[],
    "item_sub_category_filter" "text"[],
    "exclude_item_ids" "uuid"[],
    "new_effective_from" "date" NOT NULL,
    "rounding_rule" "text" DEFAULT 'ROUND_TO_CENT'::"text" NOT NULL,
    "minimum_margin_floor" numeric(6,4) DEFAULT 25.0,
    "status" "public"."pricing_schedule_status" DEFAULT 'DRAFT'::"public"."pricing_schedule_status" NOT NULL,
    "preview_item_count" integer DEFAULT 0,
    "preview_prices_to_create" integer DEFAULT 0,
    "preview_flagged_count" integer DEFAULT 0,
    "preview_sample" "jsonb" DEFAULT '[]'::"jsonb",
    "executed_at" timestamp with time zone,
    "executed_by" "uuid",
    "prices_created" integer DEFAULT 0,
    "execution_errors" "jsonb" DEFAULT '[]'::"jsonb",
    "execution_report_url" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_schedules_uplift_value_check" CHECK (("uplift_value" > (0)::numeric)),
    CONSTRAINT "ps_business_needs_justification" CHECK ((("basis" <> 'BUSINESS_DECISION'::"public"."pricing_schedule_basis") OR (("justification" IS NOT NULL) AND ("length"("justification") >= 20))))
);


ALTER TABLE "public"."pricing_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_schedules" IS 'Governed batch price update operations (CPI, MWA, Business Decision). Requires approval before execution. Execution is atomic. Does NOT modify existing price records — creates new item_sell_prices versions.';



CREATE TABLE IF NOT EXISTS "public"."product_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid",
    "supplier_id" "uuid",
    "available_units" numeric,
    "available_order_qty" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_short_supply_item_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stk_key" "text" NOT NULL,
    "site_code" "text",
    "depreciation_months" integer DEFAULT 36 NOT NULL,
    "shrinkage_percent" numeric(5,2) DEFAULT 5 NOT NULL,
    "star_override" numeric(8,2),
    "item_group" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."ref_short_supply_item_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_short_supply_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stk_key" "text" NOT NULL,
    "site_code" "text",
    "purchase_price" numeric(10,2) NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."ref_short_supply_pricing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false,
    "permissions" "text"[]
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."short_supply_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sites" "text"[] NOT NULL,
    "budget" numeric(12,2) NOT NULL,
    "ss_percent" numeric(5,2) DEFAULT 100 NOT NULL,
    "data_mode" "text" DEFAULT 'manual'::"text" NOT NULL,
    "total_spend" numeric(12,2),
    "total_uplift" numeric(12,2),
    "total_units" integer,
    "plan_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    CONSTRAINT "short_supply_plans_data_mode_check" CHECK (("data_mode" = ANY (ARRAY['live'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."short_supply_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "suburb" "text",
    "address" "text",
    "state" "text",
    "zip" "text",
    "contact_person" "text"
);


ALTER TABLE "public"."sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_snapshots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid",
    "supplier_sku" "text",
    "product_name" "text",
    "available_qty" integer,
    "stock_on_hand" integer,
    "committed_qty" integer,
    "back_ordered_qty" integer,
    "total_stock_qty" integer,
    "snapshot_date" timestamp with time zone,
    "source_report_name" "text",
    "incoming_stock" "jsonb",
    "unit_price" numeric,
    "customer_stock_code_raw" "text",
    "customer_stock_code_norm" "text",
    "customer_stock_code_alt_norm" "text",
    "category" "text",
    "sub_category" "text",
    "stock_type" "text",
    "carton_qty" integer,
    "soh_value_at_sell" numeric,
    "sell_price" numeric,
    "range_name" "text"
);


ALTER TABLE "public"."stock_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_product_map" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid",
    "product_id" "uuid",
    "supplier_sku" "text",
    "supplier_customer_stock_code" "text",
    "match_priority" integer DEFAULT 100,
    "pack_conversion_factor" numeric DEFAULT 1.0,
    "mapping_status" "text",
    "mapping_method" "text",
    "confidence_score" numeric DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mapping_justification" "jsonb" DEFAULT '{}'::"jsonb",
    "manual_override" boolean DEFAULT false
);


ALTER TABLE "public"."supplier_product_map" OWNER TO "postgres";


COMMENT ON COLUMN "public"."supplier_product_map"."mapping_justification" IS 'Explanation of the auto-mapping score breakdown';



COMMENT ON COLUMN "public"."supplier_product_map"."manual_override" IS 'If TRUE, the auto-mapping engine will not touch this mapping';



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "contact_email" "text",
    "key_contact" "text",
    "phone" "text",
    "address" "text",
    "categories" "text"[]
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "action_type" "text" NOT NULL,
    "performed_by" "uuid",
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."system_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text",
    "related_request_id" "uuid",
    "related_po_id" "uuid",
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "text" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role_id" "text",
    "avatar" "text",
    "job_title" "text",
    "status" "text" DEFAULT 'PENDING_APPROVAL'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "department" "text",
    "approval_reason" "text",
    "site_ids" "text"[],
    "invitation_expires_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "preferences" "jsonb" DEFAULT '{"theme": "dark", "activeSiteIds": []}'::"jsonb",
    "auth_user_id" "uuid",
    "entra_oid" "text",
    "entra_tenant_id" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_current_item_prices" AS
 SELECT "i"."id",
    "i"."sku",
    "i"."name",
    "i"."description",
    "i"."unit_price",
    "i"."uom",
    "i"."category",
    "i"."sub_category",
    "i"."stock_level",
    "i"."supplier_id",
    "i"."is_rfid",
    "i"."is_cog",
    "i"."specs",
    "i"."default_order_multiple",
    "i"."active_flag",
    "i"."sap_item_code_raw",
    "i"."sap_item_code_norm",
    "i"."range_name",
    "i"."stock_type",
    "i"."item_weight",
    "i"."item_pool",
    "i"."item_catalog",
    "i"."item_type",
    "i"."rfid_flag",
    "i"."item_colour",
    "i"."item_pattern",
    "i"."item_material",
    "i"."item_size",
    "i"."measurements",
    "i"."cog_flag",
    "i"."cog_customer",
    "i"."created_at",
    "i"."updated_at",
    "i"."upq",
    "i"."workflow_status",
    "isp"."id" AS "sell_price_record_id",
    "isp"."sell_price_ex_gst" AS "resolved_unit_price",
    "isp"."tax_code" AS "resolved_tax_code",
    "isp"."margin_percent" AS "standard_margin_percent",
    "isp"."effective_from" AS "sell_effective_from",
    "isp"."effective_to" AS "sell_effective_to",
    "isp"."publish_to_bundle",
    "isp"."publish_to_linenhub",
    "isp"."publish_to_salesforce",
    "ipp"."id" AS "purchase_price_record_id",
    "ipp"."landed_cost" AS "current_landed_cost",
    "ipp"."supplier_id" AS "preferred_supplier_id",
    "ipp"."purchase_price_ex_gst" AS "current_purchase_price"
   FROM (("public"."items" "i"
     LEFT JOIN "public"."item_sell_prices" "isp" ON ((("isp"."item_id" = "i"."id") AND ("isp"."price_type" = 'STANDARD'::"public"."sell_price_type") AND ("isp"."status" = 'ACTIVE'::"public"."sell_price_status") AND ("isp"."effective_from" <= CURRENT_DATE) AND (("isp"."effective_to" IS NULL) OR ("isp"."effective_to" >= CURRENT_DATE)))))
     LEFT JOIN "public"."item_purchase_prices" "ipp" ON ((("ipp"."item_id" = "i"."id") AND ("ipp"."is_preferred_supplier" = true) AND ("ipp"."status" = 'ACTIVE'::"public"."purchase_price_status") AND ("ipp"."effective_from" <= CURRENT_DATE) AND (("ipp"."effective_to" IS NULL) OR ("ipp"."effective_to" >= CURRENT_DATE)))))
  WHERE ("i"."active_flag" = true);


ALTER VIEW "public"."v_current_item_prices" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_current_item_prices" IS 'One row per active item. Shows current STANDARD sell price and preferred purchase cost. Used for PO item selection — replaces raw items.unit_price reads.';



CREATE OR REPLACE VIEW "public"."v_future_price_changes" AS
 SELECT "isp"."id" AS "price_record_id",
    "isp"."item_id",
    "i"."sku",
    "i"."name" AS "item_name",
    "isp"."price_type",
    "isp"."sell_price_ex_gst" AS "future_price",
    "isp"."effective_from",
    ("isp"."effective_from" - CURRENT_DATE) AS "days_until_effective",
    "isp"."margin_percent",
    "isp"."created_by",
    "isp"."created_at"
   FROM ("public"."item_sell_prices" "isp"
     JOIN "public"."items" "i" ON (("i"."id" = "isp"."item_id")))
  WHERE ("isp"."status" = 'APPROVED_FUTURE'::"public"."sell_price_status")
  ORDER BY "isp"."effective_from", "i"."name";


ALTER VIEW "public"."v_future_price_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "step_name" "text",
    "approver_role" "text",
    "condition_type" "text",
    "condition_value" numeric,
    "order" integer,
    "is_active" boolean DEFAULT true,
    "approver_type" "text" DEFAULT 'ROLE'::"text",
    "approver_id" "text"
);


ALTER TABLE "public"."workflow_steps" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."asset_capitalization"
    ADD CONSTRAINT "asset_capitalization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attribute_options"
    ADD CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attribute_options"
    ADD CONSTRAINT "attribute_options_type_value_key" UNIQUE ("type", "value");



ALTER TABLE ONLY "public"."bundle_connect_replica_lag"
    ADD CONSTRAINT "bundle_connect_replica_lag_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_connect_sync_config"
    ADD CONSTRAINT "bundle_connect_sync_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_connect_sync_config"
    ADD CONSTRAINT "bundle_connect_sync_config_site_code_key" UNIQUE ("site_code");



ALTER TABLE ONLY "public"."bundle_connect_sync_jobs"
    ADD CONSTRAINT "bundle_connect_sync_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_connect_sync_watermarks"
    ADD CONSTRAINT "bundle_connect_sync_watermarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_connect_sync_watermarks"
    ADD CONSTRAINT "bundle_connect_sync_watermarks_site_code_table_name_key" UNIQUE ("site_code", "table_name");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colour_options"
    ADD CONSTRAINT "colour_options_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."colour_options"
    ADD CONSTRAINT "colour_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_lines"
    ADD CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."directory_users"
    ADD CONSTRAINT "directory_users_entra_oid_unique" UNIQUE ("entra_oid");



ALTER TABLE ONLY "public"."directory_users"
    ADD CONSTRAINT "directory_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."directory_users"
    ADD CONSTRAINT "directory_users_site_id_entra_oid_key" UNIQUE ("site_id", "entra_oid");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_site_id_email_accepted_at_key" UNIQUE ("site_id", "email", "accepted_at");



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "ipp_no_date_overlap" EXCLUDE USING "gist" ("item_id" WITH =, "supplier_id" WITH =, "purchase_uom" WITH =, "daterange"("effective_from", COALESCE("effective_to", '9999-12-31'::"date"), '[]'::"text") WITH &&) WHERE (("status" = ANY (ARRAY['ACTIVE'::"public"."purchase_price_status", 'APPROVED_FUTURE'::"public"."purchase_price_status"])));



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "isp_no_date_overlap" EXCLUDE USING "gist" ("item_id" WITH =, "price_type" WITH =, COALESCE("customer_id", '00000000-0000-0000-0000-000000000000'::"uuid") WITH =, COALESCE("customer_group_id", '00000000-0000-0000-0000-000000000000'::"uuid") WITH =, COALESCE("contract_id", '00000000-0000-0000-0000-000000000000'::"uuid") WITH =, "sale_uom" WITH =, "daterange"("effective_from", COALESCE("effective_to", '9999-12-31'::"date"), '[]'::"text") WITH &&) WHERE (("status" = ANY (ARRAY['ACTIVE'::"public"."sell_price_status", 'APPROVED_FUTURE'::"public"."sell_price_status"])));



ALTER TABLE ONLY "public"."item_approval_decisions"
    ADD CONSTRAINT "item_approval_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_approval_instances"
    ADD CONSTRAINT "item_approval_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_approval_rules"
    ADD CONSTRAINT "item_approval_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_completeness_checks"
    ADD CONSTRAINT "item_completeness_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_duplicate_checks"
    ADD CONSTRAINT "item_duplicate_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_duplicate_checks"
    ADD CONSTRAINT "item_duplicate_checks_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."item_field_registry"
    ADD CONSTRAINT "item_field_registry_field_key_key" UNIQUE ("field_key");



ALTER TABLE ONLY "public"."item_field_registry"
    ADD CONSTRAINT "item_field_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_publication_events"
    ADD CONSTRAINT "item_publication_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_request_audit_log"
    ADD CONSTRAINT "item_request_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_request_revisions"
    ADD CONSTRAINT "item_request_revisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_request_revisions"
    ADD CONSTRAINT "item_request_revisions_request_id_revision_number_key" UNIQUE ("request_id", "revision_number");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_request_number_key" UNIQUE ("request_number");



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "item_sell_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_sap_item_code_norm_key" UNIQUE ("sap_item_code_norm");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_approvals"
    ADD CONSTRAINT "po_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_lines"
    ADD CONSTRAINT "po_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_requests"
    ADD CONSTRAINT "po_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_sequences"
    ADD CONSTRAINT "po_sequences_pkey" PRIMARY KEY ("year_month");



ALTER TABLE ONLY "public"."preview_item_approval_decisions"
    ADD CONSTRAINT "preview_item_approval_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_approval_instances"
    ADD CONSTRAINT "preview_item_approval_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_audit_logs"
    ADD CONSTRAINT "preview_item_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_duplicate_checks"
    ADD CONSTRAINT "preview_item_duplicate_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_master_drafts"
    ADD CONSTRAINT "preview_item_master_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_master_drafts"
    ADD CONSTRAINT "preview_item_master_drafts_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."preview_item_reference_overlays"
    ADD CONSTRAINT "preview_item_reference_overla_reference_type_reference_valu_key" UNIQUE ("reference_type", "reference_value");



ALTER TABLE ONLY "public"."preview_item_reference_overlays"
    ADD CONSTRAINT "preview_item_reference_overlays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_requests"
    ADD CONSTRAINT "preview_item_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_item_requests"
    ADD CONSTRAINT "preview_item_requests_request_number_key" UNIQUE ("request_number");



ALTER TABLE ONLY "public"."preview_publication_events"
    ADD CONSTRAINT "preview_publication_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_publication_events"
    ADD CONSTRAINT "preview_publication_events_request_id_target_system_payload_key" UNIQUE ("request_id", "target_system", "payload_hash");



ALTER TABLE ONLY "public"."preview_purchase_price_drafts"
    ADD CONSTRAINT "preview_purchase_price_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_purchase_price_drafts"
    ADD CONSTRAINT "preview_purchase_price_drafts_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."preview_sell_price_drafts"
    ADD CONSTRAINT "preview_sell_price_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preview_sell_price_drafts"
    ADD CONSTRAINT "preview_sell_price_drafts_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."pricing_schedule_lines"
    ADD CONSTRAINT "pricing_schedule_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_schedules"
    ADD CONSTRAINT "pricing_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_schedules"
    ADD CONSTRAINT "pricing_schedules_schedule_number_key" UNIQUE ("schedule_number");



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_product_id_supplier_id_key" UNIQUE ("product_id", "supplier_id");



ALTER TABLE ONLY "public"."ref_short_supply_item_properties"
    ADD CONSTRAINT "ref_short_supply_item_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_short_supply_pricing"
    ADD CONSTRAINT "ref_short_supply_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."short_supply_plans"
    ADD CONSTRAINT "short_supply_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_product_map"
    ADD CONSTRAINT "supplier_product_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_product_map"
    ADD CONSTRAINT "supplier_product_map_supplier_id_product_id_supplier_sku_key" UNIQUE ("supplier_id", "product_id", "supplier_sku");



ALTER TABLE ONLY "public"."supplier_product_map"
    ADD CONSTRAINT "supplier_product_map_supplier_id_supplier_sku_key" UNIQUE ("supplier_id", "supplier_sku");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_audit_logs"
    ADD CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_capitalization"
    ADD CONSTRAINT "unique_po_line_capitalization" UNIQUE ("po_line_id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_steps"
    ADD CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_attribute_options_parent" ON "public"."attribute_options" USING "btree" ("parent_id");



CREATE INDEX "idx_attribute_options_type" ON "public"."attribute_options" USING "btree" ("type");



CREATE INDEX "idx_bc_lag_site_sampled" ON "public"."bundle_connect_replica_lag" USING "btree" ("site_code", "sampled_at" DESC);



CREATE INDEX "idx_bc_sync_jobs_site_created" ON "public"."bundle_connect_sync_jobs" USING "btree" ("site_code", "created_at" DESC);



CREATE INDEX "idx_bc_sync_jobs_status" ON "public"."bundle_connect_sync_jobs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'running'::"text"]));



CREATE INDEX "idx_directory_users_email_lower" ON "public"."directory_users" USING "btree" ("lower"("email"));



CREATE INDEX "idx_directory_users_search_text" ON "public"."directory_users" USING "btree" ("search_text");



CREATE INDEX "idx_directory_users_search_text_trgm" ON "public"."directory_users" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_directory_users_site_id" ON "public"."directory_users" USING "btree" ("site_id");



CREATE INDEX "idx_iad_decided_by" ON "public"."item_approval_decisions" USING "btree" ("decided_by");



CREATE INDEX "idx_iad_instance_id" ON "public"."item_approval_decisions" USING "btree" ("instance_id");



CREATE INDEX "idx_iad_request_id" ON "public"."item_approval_decisions" USING "btree" ("request_id");



CREATE INDEX "idx_iai_approver_role" ON "public"."item_approval_instances" USING "btree" ("approver_role");



CREATE INDEX "idx_iai_pending_sla" ON "public"."item_approval_instances" USING "btree" ("sla_deadline") WHERE ("status" = 'PENDING'::"public"."approval_instance_status");



CREATE INDEX "idx_iai_request_id" ON "public"."item_approval_instances" USING "btree" ("request_id");



CREATE INDEX "idx_iai_status" ON "public"."item_approval_instances" USING "btree" ("status");



CREATE INDEX "idx_icc_is_complete" ON "public"."item_completeness_checks" USING "btree" ("is_complete");



CREATE INDEX "idx_icc_item_id" ON "public"."item_completeness_checks" USING "btree" ("item_id");



CREATE INDEX "idx_idc_outcome" ON "public"."item_duplicate_checks" USING "btree" ("outcome");



CREATE INDEX "idx_idc_request_id" ON "public"."item_duplicate_checks" USING "btree" ("request_id");



CREATE INDEX "idx_invites_accepted_by" ON "public"."invites" USING "btree" ("accepted_by");



CREATE INDEX "idx_invites_email" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "idx_invites_token_hash" ON "public"."invites" USING "btree" ("token_hash");



CREATE INDEX "idx_ipe_correlation_id" ON "public"."item_publication_events" USING "btree" ("correlation_id");



CREATE INDEX "idx_ipe_item_id" ON "public"."item_publication_events" USING "btree" ("item_id");



CREATE INDEX "idx_ipe_queued" ON "public"."item_publication_events" USING "btree" ("next_retry_at") WHERE ("status" = ANY (ARRAY['QUEUED'::"public"."publication_event_status", 'RETRYING'::"public"."publication_event_status"]));



CREATE INDEX "idx_ipe_status" ON "public"."item_publication_events" USING "btree" ("status");



CREATE INDEX "idx_ipp_effective_from" ON "public"."item_purchase_prices" USING "btree" ("effective_from");



CREATE INDEX "idx_ipp_item_id" ON "public"."item_purchase_prices" USING "btree" ("item_id");



CREATE INDEX "idx_ipp_item_supplier_active" ON "public"."item_purchase_prices" USING "btree" ("item_id", "supplier_id") WHERE ("status" = 'ACTIVE'::"public"."purchase_price_status");



CREATE INDEX "idx_ipp_status" ON "public"."item_purchase_prices" USING "btree" ("status");



CREATE INDEX "idx_ipp_supplier_id" ON "public"."item_purchase_prices" USING "btree" ("supplier_id");



CREATE INDEX "idx_ir_created_at" ON "public"."item_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ir_is_urgent" ON "public"."item_requests" USING "btree" ("is_urgent") WHERE ("is_urgent" = true);



CREATE INDEX "idx_ir_request_type" ON "public"."item_requests" USING "btree" ("request_type");



CREATE INDEX "idx_ir_requestor_id" ON "public"."item_requests" USING "btree" ("requestor_id");



CREATE INDEX "idx_ir_resulting_item" ON "public"."item_requests" USING "btree" ("resulting_item_id");



CREATE INDEX "idx_ir_status" ON "public"."item_requests" USING "btree" ("status");



CREATE INDEX "idx_ir_status_procurement" ON "public"."item_requests" USING "btree" ("status") WHERE ("status" = 'PROCUREMENT_REVIEW'::"public"."item_request_status");



CREATE INDEX "idx_irr_request_id" ON "public"."item_request_revisions" USING "btree" ("request_id");



CREATE INDEX "idx_isp_customer_id" ON "public"."item_sell_prices" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_isp_effective_from" ON "public"."item_sell_prices" USING "btree" ("effective_from");



CREATE INDEX "idx_isp_item_active" ON "public"."item_sell_prices" USING "btree" ("item_id", "price_type", "effective_from") WHERE ("status" = 'ACTIVE'::"public"."sell_price_status");



CREATE INDEX "idx_isp_item_id" ON "public"."item_sell_prices" USING "btree" ("item_id");



CREATE INDEX "idx_isp_price_type" ON "public"."item_sell_prices" USING "btree" ("price_type");



CREATE INDEX "idx_isp_status" ON "public"."item_sell_prices" USING "btree" ("status");



CREATE INDEX "idx_item_request_audit_log_created_at" ON "public"."item_request_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_item_request_audit_log_request_id" ON "public"."item_request_audit_log" USING "btree" ("request_id");



CREATE INDEX "idx_items_category" ON "public"."items" USING "btree" ("category");



CREATE INDEX "idx_items_range" ON "public"."items" USING "btree" ("range_name");



CREATE INDEX "idx_items_short_name" ON "public"."items" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("short_name", ''::"text")));



CREATE INDEX "idx_items_stock_type" ON "public"."items" USING "btree" ("stock_type");



CREATE INDEX "idx_items_sub_category" ON "public"."items" USING "btree" ("sub_category");



CREATE INDEX "idx_preview_item_duplicate_checks_request" ON "public"."preview_item_duplicate_checks" USING "btree" ("request_id");



CREATE INDEX "idx_preview_item_requests_created_at" ON "public"."preview_item_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_preview_item_requests_status" ON "public"."preview_item_requests" USING "btree" ("lifecycle_status");



CREATE INDEX "idx_preview_publication_events_request" ON "public"."preview_publication_events" USING "btree" ("request_id");



CREATE INDEX "idx_ps_effective_from" ON "public"."pricing_schedules" USING "btree" ("new_effective_from");



CREATE INDEX "idx_ps_status" ON "public"."pricing_schedules" USING "btree" ("status");



CREATE INDEX "idx_psl_item_id" ON "public"."pricing_schedule_lines" USING "btree" ("item_id");



CREATE INDEX "idx_psl_schedule_id" ON "public"."pricing_schedule_lines" USING "btree" ("schedule_id");



CREATE INDEX "idx_stock_snapshots_alt_norm" ON "public"."stock_snapshots" USING "btree" ("customer_stock_code_alt_norm");



CREATE INDEX "idx_stock_snapshots_norm" ON "public"."stock_snapshots" USING "btree" ("customer_stock_code_norm");



CREATE INDEX "idx_system_audit_logs_action_type" ON "public"."system_audit_logs" USING "btree" ("action_type");



CREATE INDEX "idx_system_audit_logs_created_at" ON "public"."system_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_notifications_is_read" ON "public"."user_notifications" USING "btree" ("is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_user_notifications_user_id" ON "public"."user_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_users_auth_user_id" ON "public"."users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_users_entra_oid" ON "public"."users" USING "btree" ("entra_oid");



CREATE INDEX "ref_ss_pricing_stk_key_idx" ON "public"."ref_short_supply_pricing" USING "btree" ("stk_key");



CREATE INDEX "ref_ss_props_stk_key_idx" ON "public"."ref_short_supply_item_properties" USING "btree" ("stk_key");



CREATE UNIQUE INDEX "ref_ss_props_stk_site_idx" ON "public"."ref_short_supply_item_properties" USING "btree" ("stk_key", COALESCE("site_code", ''::"text"));



CREATE INDEX "short_supply_plans_created_at_idx" ON "public"."short_supply_plans" USING "btree" ("created_at" DESC);



CREATE INDEX "short_supply_plans_created_by_idx" ON "public"."short_supply_plans" USING "btree" ("created_by");



CREATE UNIQUE INDEX "users_email_case_insensitive_idx" ON "public"."users" USING "btree" ("lower"("email"));



CREATE OR REPLACE TRIGGER "colour_options_updated_at" BEFORE UPDATE ON "public"."colour_options" FOR EACH ROW EXECUTE FUNCTION "public"."colour_options_set_updated_at"();



CREATE OR REPLACE TRIGGER "lowercase_email_trigger" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."lowercase_email_trigger_fn"();



CREATE OR REPLACE TRIGGER "set_po_display_id" BEFORE INSERT ON "public"."po_requests" FOR EACH ROW EXECUTE FUNCTION "public"."generate_po_display_id"();



CREATE OR REPLACE TRIGGER "set_timestamp_items" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trg_audit_deliveries" AFTER INSERT OR DELETE OR UPDATE ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_delivery_lines" AFTER INSERT OR DELETE OR UPDATE ON "public"."delivery_lines" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_approvals" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_lines" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_lines" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_requests" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_iad_no_delete" BEFORE DELETE ON "public"."item_approval_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_iad_immutability"();



CREATE OR REPLACE TRIGGER "trg_iad_no_update" BEFORE UPDATE ON "public"."item_approval_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_iad_immutability"();



CREATE OR REPLACE TRIGGER "trg_iad_update_instance" AFTER INSERT ON "public"."item_approval_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."update_instance_on_decision"();



CREATE OR REPLACE TRIGGER "trg_iai_sla_breach" BEFORE UPDATE ON "public"."item_approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."mark_sla_breached"();



CREATE OR REPLACE TRIGGER "trg_iai_sla_deadline" BEFORE INSERT ON "public"."item_approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."set_approval_sla_deadline"();



CREATE OR REPLACE TRIGGER "trg_iai_updated_at" BEFORE UPDATE ON "public"."item_approval_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_iai_updated_at"();



CREATE OR REPLACE TRIGGER "trg_idc_auto_lock" BEFORE UPDATE OF "outcome" ON "public"."item_duplicate_checks" FOR EACH ROW EXECUTE FUNCTION "public"."auto_lock_idc_on_outcome"();



CREATE OR REPLACE TRIGGER "trg_idc_immutability" BEFORE UPDATE ON "public"."item_duplicate_checks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_idc_immutability"();



CREATE OR REPLACE TRIGGER "trg_ipe_updated_at" BEFORE UPDATE ON "public"."item_publication_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_ipe_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ipp_immutability" BEFORE UPDATE ON "public"."item_purchase_prices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ipp_immutability"();



CREATE OR REPLACE TRIGGER "trg_ipp_updated_at" BEFORE UPDATE ON "public"."item_purchase_prices" FOR EACH ROW EXECUTE FUNCTION "public"."update_ipp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ir_create_dup_check" AFTER UPDATE OF "status" ON "public"."item_requests" FOR EACH ROW EXECUTE FUNCTION "public"."create_pending_duplicate_check"();



CREATE OR REPLACE TRIGGER "trg_ir_request_number" BEFORE INSERT ON "public"."item_requests" FOR EACH ROW WHEN ((("new"."request_number" IS NULL) OR ("new"."request_number" = ''::"text"))) EXECUTE FUNCTION "public"."generate_item_request_number"();



CREATE OR REPLACE TRIGGER "trg_ir_snapshot_revision" BEFORE UPDATE OF "status" ON "public"."item_requests" FOR EACH ROW EXECUTE FUNCTION "public"."snapshot_item_request_revision"();



CREATE OR REPLACE TRIGGER "trg_ir_stage_timestamps" BEFORE UPDATE OF "status" ON "public"."item_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_ir_stage_timestamps"();



CREATE OR REPLACE TRIGGER "trg_ir_urgency" BEFORE INSERT OR UPDATE OF "required_activation_date" ON "public"."item_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_ir_urgency"();



CREATE OR REPLACE TRIGGER "trg_isp_immutability" BEFORE UPDATE ON "public"."item_sell_prices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_isp_immutability"();



CREATE OR REPLACE TRIGGER "trg_isp_margin_flag" BEFORE INSERT OR UPDATE OF "sell_price_ex_gst", "cost_basis" ON "public"."item_sell_prices" FOR EACH ROW EXECUTE FUNCTION "public"."set_isp_margin_approval_flag"();



CREATE OR REPLACE TRIGGER "trg_isp_sync_unit_price" AFTER INSERT OR UPDATE OF "status" ON "public"."item_sell_prices" FOR EACH ROW EXECUTE FUNCTION "public"."sync_item_unit_price_from_sell"();



CREATE OR REPLACE TRIGGER "trg_isp_updated_at" BEFORE UPDATE ON "public"."item_sell_prices" FOR EACH ROW EXECUTE FUNCTION "public"."update_isp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ps_immutability" BEFORE UPDATE ON "public"."pricing_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_ps_immutability"();



CREATE OR REPLACE TRIGGER "trg_ps_schedule_number" BEFORE INSERT ON "public"."pricing_schedules" FOR EACH ROW WHEN ((("new"."schedule_number" IS NULL) OR ("new"."schedule_number" = ''::"text"))) EXECUTE FUNCTION "public"."generate_pricing_schedule_number"();



CREATE OR REPLACE TRIGGER "trg_ps_updated_at" BEFORE UPDATE ON "public"."pricing_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_ps_updated_at"();



ALTER TABLE ONLY "public"."asset_capitalization"
    ADD CONSTRAINT "asset_capitalization_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attribute_options"
    ADD CONSTRAINT "attribute_options_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."attribute_options"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_po_request_id_fkey" FOREIGN KEY ("po_request_id") REFERENCES "public"."po_requests"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."delivery_lines"
    ADD CONSTRAINT "delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_lines"
    ADD CONSTRAINT "delivery_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id");



ALTER TABLE ONLY "public"."directory_users"
    ADD CONSTRAINT "directory_users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."item_approval_instances"
    ADD CONSTRAINT "fk_iai_decision" FOREIGN KEY ("decision_id") REFERENCES "public"."item_approval_decisions"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."item_approval_decisions"
    ADD CONSTRAINT "item_approval_decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_approval_decisions"
    ADD CONSTRAINT "item_approval_decisions_escalated_to_user_fkey" FOREIGN KEY ("escalated_to_user") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_approval_decisions"
    ADD CONSTRAINT "item_approval_decisions_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."item_approval_instances"("id");



ALTER TABLE ONLY "public"."item_approval_decisions"
    ADD CONSTRAINT "item_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id");



ALTER TABLE ONLY "public"."item_approval_instances"
    ADD CONSTRAINT "item_approval_instances_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_approval_instances"
    ADD CONSTRAINT "item_approval_instances_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_approval_instances"
    ADD CONSTRAINT "item_approval_instances_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."item_approval_rules"("id");



ALTER TABLE ONLY "public"."item_completeness_checks"
    ADD CONSTRAINT "item_completeness_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_completeness_checks"
    ADD CONSTRAINT "item_completeness_checks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."item_completeness_checks"
    ADD CONSTRAINT "item_completeness_checks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id");



ALTER TABLE ONLY "public"."item_duplicate_checks"
    ADD CONSTRAINT "item_duplicate_checks_existing_item_id_fkey" FOREIGN KEY ("existing_item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."item_duplicate_checks"
    ADD CONSTRAINT "item_duplicate_checks_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_duplicate_checks"
    ADD CONSTRAINT "item_duplicate_checks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_publication_events"
    ADD CONSTRAINT "item_publication_events_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."item_purchase_prices"("id");



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."item_purchase_prices"
    ADD CONSTRAINT "item_purchase_prices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_request_audit_log"
    ADD CONSTRAINT "item_request_audit_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."item_request_audit_log"
    ADD CONSTRAINT "item_request_audit_log_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_request_revisions"
    ADD CONSTRAINT "item_request_revisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."item_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_request_revisions"
    ADD CONSTRAINT "item_request_revisions_revised_by_fkey" FOREIGN KEY ("revised_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_replacement_for_item_id_fkey" FOREIGN KEY ("replacement_for_item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_requestor_id_fkey" FOREIGN KEY ("requestor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_resulting_item_id_fkey" FOREIGN KEY ("resulting_item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_revision_requested_by_fkey" FOREIGN KEY ("revision_requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."item_requests"
    ADD CONSTRAINT "item_requests_status_changed_by_fkey" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "item_sell_prices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "item_sell_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "item_sell_prices_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."item_sell_prices"("id");



ALTER TABLE ONLY "public"."item_sell_prices"
    ADD CONSTRAINT "item_sell_prices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_current_request_id_fkey" FOREIGN KEY ("current_request_id") REFERENCES "public"."item_requests"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."po_approvals"
    ADD CONSTRAINT "po_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."po_approvals"
    ADD CONSTRAINT "po_approvals_po_request_id_fkey" FOREIGN KEY ("po_request_id") REFERENCES "public"."po_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."po_lines"
    ADD CONSTRAINT "po_lines_po_request_id_fkey" FOREIGN KEY ("po_request_id") REFERENCES "public"."po_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."po_requests"
    ADD CONSTRAINT "po_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."po_requests"
    ADD CONSTRAINT "po_requests_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."po_requests"
    ADD CONSTRAINT "po_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."preview_item_approval_decisions"
    ADD CONSTRAINT "preview_item_approval_decisions_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "public"."preview_item_approval_instances"("id");



ALTER TABLE ONLY "public"."preview_item_approval_decisions"
    ADD CONSTRAINT "preview_item_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_item_approval_instances"
    ADD CONSTRAINT "preview_item_approval_instances_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_item_duplicate_checks"
    ADD CONSTRAINT "preview_item_duplicate_checks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_item_master_drafts"
    ADD CONSTRAINT "preview_item_master_drafts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_publication_events"
    ADD CONSTRAINT "preview_publication_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_purchase_price_drafts"
    ADD CONSTRAINT "preview_purchase_price_drafts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."preview_sell_price_drafts"
    ADD CONSTRAINT "preview_sell_price_drafts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."preview_item_requests"("id");



ALTER TABLE ONLY "public"."pricing_schedule_lines"
    ADD CONSTRAINT "pricing_schedule_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id");



ALTER TABLE ONLY "public"."pricing_schedule_lines"
    ADD CONSTRAINT "pricing_schedule_lines_new_sell_price_id_fkey" FOREIGN KEY ("new_sell_price_id") REFERENCES "public"."item_sell_prices"("id");



ALTER TABLE ONLY "public"."pricing_schedule_lines"
    ADD CONSTRAINT "pricing_schedule_lines_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."pricing_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_schedule_lines"
    ADD CONSTRAINT "pricing_schedule_lines_sell_price_id_fkey" FOREIGN KEY ("sell_price_id") REFERENCES "public"."item_sell_prices"("id");



ALTER TABLE ONLY "public"."pricing_schedules"
    ADD CONSTRAINT "pricing_schedules_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pricing_schedules"
    ADD CONSTRAINT "pricing_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pricing_schedules"
    ADD CONSTRAINT "pricing_schedules_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."ref_short_supply_item_properties"
    ADD CONSTRAINT "ref_short_supply_item_properties_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ref_short_supply_pricing"
    ADD CONSTRAINT "ref_short_supply_pricing_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."short_supply_plans"
    ADD CONSTRAINT "short_supply_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_product_map"
    ADD CONSTRAINT "supplier_product_map_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."system_audit_logs"
    ADD CONSTRAINT "system_audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."workflow_steps"
    ADD CONSTRAINT "workflow_steps_approver_role_fkey" FOREIGN KEY ("approver_role") REFERENCES "public"."roles"("id");



CREATE POLICY "Admin and Receivers mutate deliveries" ON "public"."deliveries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
     JOIN "public"."po_requests" "pqr" ON (("deliveries"."po_request_id" = "pqr"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("r"."id" = 'ADMIN'::"text") OR (('receive_goods'::"text" = ANY ("r"."permissions")) AND (("pqr"."site_id")::"text" = ANY ("u"."site_ids")))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
     JOIN "public"."po_requests" "pqr" ON (("deliveries"."po_request_id" = "pqr"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("r"."id" = 'ADMIN'::"text") OR (('receive_goods'::"text" = ANY ("r"."permissions")) AND (("pqr"."site_id")::"text" = ANY ("u"."site_ids"))))))));



CREATE POLICY "Admin and Receivers mutate delivery_lines" ON "public"."delivery_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
     JOIN "public"."deliveries" "d" ON (("delivery_lines"."delivery_id" = "d"."id")))
     JOIN "public"."po_requests" "pqr" ON (("d"."po_request_id" = "pqr"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("r"."id" = 'ADMIN'::"text") OR (('receive_goods'::"text" = ANY ("r"."permissions")) AND (("pqr"."site_id")::"text" = ANY ("u"."site_ids")))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
     JOIN "public"."deliveries" "d" ON (("delivery_lines"."delivery_id" = "d"."id")))
     JOIN "public"."po_requests" "pqr" ON (("d"."po_request_id" = "pqr"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND (("r"."id" = 'ADMIN'::"text") OR (('receive_goods'::"text" = ANY ("r"."permissions")) AND (("pqr"."site_id")::"text" = ANY ("u"."site_ids"))))))));



CREATE POLICY "Admins and requesters can delete requests" ON "public"."po_requests" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("r"."id" = 'ADMIN'::"text")))) OR ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."id" = "po_requests"."requester_id")))) AND ("status" = 'PENDING_APPROVAL'::"text"))));



CREATE POLICY "Admins can create invites" ON "public"."invites" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id" = "auth"."uid"()) OR ("users"."auth_user_id" = "auth"."uid"())) AND ("users"."role_id" = ANY (ARRAY['ADMIN'::"text", 'SITE_ADMIN'::"text"]))))));



CREATE POLICY "Admins can view and edit all users" ON "public"."users" USING ("public"."is_admin"());



CREATE POLICY "Admins can view invites" ON "public"."invites" FOR SELECT USING ((("invited_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id" = "auth"."uid"()) OR ("users"."auth_user_id" = "auth"."uid"())) AND ("users"."role_id" = 'ADMIN'::"text"))))));



CREATE POLICY "Allow admins to manage app_config" ON "public"."app_config" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to manage item_field_registry" ON "public"."item_field_registry" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow all public access" ON "public"."attribute_options" USING (true);



CREATE POLICY "Allow all public access" ON "public"."catalog_items" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."deliveries" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."delivery_lines" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."items" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."notification_settings" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."po_approvals" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."po_lines" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."product_availability" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."roles" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."sites" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."stock_snapshots" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."supplier_product_map" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."suppliers" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all public access" ON "public"."workflow_steps" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anon read app_config" ON "public"."app_config" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anon read item_field_registry" ON "public"."item_field_registry" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow authenticated users to insert po_sequences" ON "public"."po_sequences" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to read app_config" ON "public"."app_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read item_field_registry" ON "public"."item_field_registry" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read po_sequences" ON "public"."po_sequences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to update po_sequences" ON "public"."po_sequences" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow insert access to authenticated users" ON "public"."system_audit_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read access to authenticated users" ON "public"."system_audit_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert audit log entries" ON "public"."item_request_audit_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert requests" ON "public"."po_requests" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read audit log" ON "public"."item_request_audit_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view requests" ON "public"."po_requests" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."asset_capitalization" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable write access for authenticated users" ON "public"."asset_capitalization" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Preview users can manage preview_item_approval_decisions" ON "public"."preview_item_approval_decisions" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_approval_instances" ON "public"."preview_item_approval_instances" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_audit_logs" ON "public"."preview_item_audit_logs" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_duplicate_checks" ON "public"."preview_item_duplicate_checks" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_master_drafts" ON "public"."preview_item_master_drafts" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_reference_overlays" ON "public"."preview_item_reference_overlays" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_item_requests" ON "public"."preview_item_requests" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_publication_events" ON "public"."preview_publication_events" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_purchase_price_drafts" ON "public"."preview_purchase_price_drafts" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can manage preview_sell_price_drafts" ON "public"."preview_sell_price_drafts" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text"))) WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_approval_decisions" ON "public"."preview_item_approval_decisions" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_approval_instances" ON "public"."preview_item_approval_instances" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_audit_logs" ON "public"."preview_item_audit_logs" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_duplicate_checks" ON "public"."preview_item_duplicate_checks" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_master_drafts" ON "public"."preview_item_master_drafts" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_reference_overlays" ON "public"."preview_item_reference_overlays" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_item_requests" ON "public"."preview_item_requests" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_publication_events" ON "public"."preview_publication_events" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_purchase_price_drafts" ON "public"."preview_purchase_price_drafts" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Preview users can read preview_sell_price_drafts" ON "public"."preview_sell_price_drafts" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



CREATE POLICY "Requesters can manage lines for their own POs" ON "public"."po_lines" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."po_requests"
  WHERE (("po_requests"."id" = "po_lines"."po_request_id") AND (("auth"."uid"() IN ( SELECT "users"."auth_user_id"
           FROM "public"."users"
          WHERE ("users"."id" = "po_requests"."requester_id"))) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."auth_user_id" = "auth"."uid"()) AND ("users"."role_id" = 'ADMIN'::"text"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."po_requests"
  WHERE (("po_requests"."id" = "po_lines"."po_request_id") AND (("auth"."uid"() IN ( SELECT "users"."auth_user_id"
           FROM "public"."users"
          WHERE ("users"."id" = "po_requests"."requester_id"))) OR (EXISTS ( SELECT 1
           FROM "public"."users"
          WHERE (("users"."auth_user_id" = "auth"."uid"()) AND ("users"."role_id" = 'ADMIN'::"text")))))))));



CREATE POLICY "Users can manage their own profile" ON "public"."users" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can search directory for their sites" ON "public"."directory_users" FOR SELECT USING (((("site_id")::"text" IN ( SELECT "unnest"("users"."site_ids") AS "unnest"
   FROM "public"."users"
  WHERE (("users"."auth_user_id" = "auth"."uid"()) OR ("users"."id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id" = "auth"."uid"()) OR ("users"."auth_user_id" = "auth"."uid"())) AND ("users"."role_id" = 'ADMIN'::"text"))))));



CREATE POLICY "Users can see their own notifications" ON "public"."user_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."user_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("auth_user_id" = "auth"."uid"()) OR ("email" = ("auth"."jwt"() ->> 'email'::"text"))));



CREATE POLICY "Users with permission can update requests" ON "public"."po_requests" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("r"."id" = 'ADMIN'::"text")))) OR ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("u"."id" = "po_requests"."requester_id")))) AND ("status" = ANY (ARRAY['PENDING_APPROVAL'::"text", 'APPROVED_PENDING_CONCUR_REQUEST'::"text", 'APPROVED_PENDING_CONCUR'::"text", 'ACTIVE'::"text", 'RECEIVED'::"text", 'VARIANCE_PENDING'::"text"]))) OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ('receive_goods'::"text" = ANY ("r"."permissions")) AND (("po_requests"."site_id")::"text" = ANY ("u"."site_ids")))))));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_capitalization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attribute_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bc_sync_admin_write" ON "public"."bundle_connect_sync_config" TO "authenticated" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text") OR "public"."has_permission"('manage_settings'::"text")));



CREATE POLICY "bc_sync_config_read" ON "public"."bundle_connect_sync_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bc_sync_jobs_read" ON "public"."bundle_connect_sync_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bc_sync_jobs_write" ON "public"."bundle_connect_sync_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "bc_sync_lag_read" ON "public"."bundle_connect_replica_lag" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bc_sync_lag_write" ON "public"."bundle_connect_replica_lag" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "bc_sync_wmk_read" ON "public"."bundle_connect_sync_watermarks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bundle_connect_replica_lag" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_connect_sync_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_connect_sync_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_connect_sync_watermarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."colour_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "colour_options_anon_read" ON "public"."colour_options" FOR SELECT TO "anon" USING (true);



CREATE POLICY "colour_options_read" ON "public"."colour_options" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "colour_options_write" ON "public"."colour_options" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."directory_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "iad_insert_approver" ON "public"."item_approval_decisions" FOR INSERT WITH CHECK ((("decided_by" = "auth"."uid"()) AND ("public"."is_admin"() OR "public"."has_permission"('approve_item_requests'::"text"))));



CREATE POLICY "iad_select_permitted" ON "public"."item_approval_decisions" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('approve_item_requests'::"text") OR "public"."has_permission"('view_all_requests'::"text")));



CREATE POLICY "iai_insert_system" ON "public"."item_approval_instances" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('approve_item_requests'::"text")));



CREATE POLICY "iai_select_approver" ON "public"."item_approval_instances" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('approve_item_requests'::"text") OR "public"."has_permission"('manage_item_definition'::"text") OR "public"."has_permission"('view_all_requests'::"text")));



CREATE POLICY "iai_update_approver" ON "public"."item_approval_instances" FOR UPDATE USING (("public"."is_admin"() OR "public"."has_permission"('approve_item_requests'::"text")));



CREATE POLICY "icc_insert_master_data" ON "public"."item_completeness_checks" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text")));



CREATE POLICY "icc_select_permitted" ON "public"."item_completeness_checks" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text") OR "public"."has_permission"('publish_items'::"text")));



CREATE POLICY "idc_insert_system" ON "public"."item_duplicate_checks" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text")));



CREATE POLICY "idc_select_permitted" ON "public"."item_duplicate_checks" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text") OR "public"."has_permission"('approve_item_requests'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."item_requests" "ir"
  WHERE (("ir"."id" = "item_duplicate_checks"."request_id") AND ("ir"."requestor_id" = "auth"."uid"()))))));



CREATE POLICY "idc_update_master_data" ON "public"."item_duplicate_checks" FOR UPDATE USING ((("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text")) AND ("is_locked" = false)));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ipe_insert_system" ON "public"."item_publication_events" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('publish_items'::"text")));



CREATE POLICY "ipe_select_admin_master_data" ON "public"."item_publication_events" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('publish_items'::"text") OR "public"."has_permission"('manage_item_definition'::"text")));



CREATE POLICY "ipe_update_system" ON "public"."item_publication_events" FOR UPDATE USING (("public"."is_admin"() OR "public"."has_permission"('publish_items'::"text")));



CREATE POLICY "ipp_insert_procurement" ON "public"."item_purchase_prices" FOR INSERT WITH CHECK (("public"."has_permission"('manage_purchase_pricing'::"text") OR "public"."is_admin"()));



CREATE POLICY "ipp_no_delete" ON "public"."item_purchase_prices" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "ipp_select_procurement_admin" ON "public"."item_purchase_prices" FOR SELECT USING (("public"."has_permission"('view_purchase_pricing'::"text") OR "public"."is_admin"()));



CREATE POLICY "ipp_update_procurement" ON "public"."item_purchase_prices" FOR UPDATE USING ((("public"."has_permission"('manage_purchase_pricing'::"text") OR "public"."is_admin"()) AND ("status" = ANY (ARRAY['DRAFT'::"public"."purchase_price_status", 'PENDING_APPROVAL'::"public"."purchase_price_status"]))));



CREATE POLICY "ir_delete_policy" ON "public"."item_requests" FOR DELETE USING (("public"."is_admin"() OR (("auth"."uid"() = "requestor_id") AND (("status")::"text" <> ALL (ARRAY['APPROVED'::"text", 'PUBLISHING'::"text", 'PARTIALLY_PUBLISHED'::"text", 'FULLY_PUBLISHED'::"text", 'ACTIVE'::"text"])))));



CREATE POLICY "ir_insert_any" ON "public"."item_requests" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "ir_select_own" ON "public"."item_requests" FOR SELECT USING ((("requestor_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."has_permission"('view_all_requests'::"text")));



CREATE POLICY "ir_update_requestor_draft" ON "public"."item_requests" FOR UPDATE USING (((("requestor_id" = "auth"."uid"()) AND ("status" = 'DRAFT'::"public"."item_request_status")) OR "public"."has_permission"('manage_item_definition'::"text") OR "public"."has_permission"('manage_purchase_pricing'::"text") OR "public"."has_permission"('manage_sell_pricing'::"text") OR "public"."has_permission"('approve_item_requests'::"text") OR "public"."is_admin"()));



CREATE POLICY "irr_insert_system" ON "public"."item_request_revisions" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_item_definition'::"text") OR "public"."has_permission"('approve_item_requests'::"text")));



CREATE POLICY "irr_select_permitted" ON "public"."item_request_revisions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."item_requests" "ir"
  WHERE (("ir"."id" = "item_request_revisions"."request_id") AND (("ir"."requestor_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."has_permission"('view_all_requests'::"text"))))));



CREATE POLICY "isp_insert_sales" ON "public"."item_sell_prices" FOR INSERT WITH CHECK (("public"."has_permission"('manage_sell_pricing'::"text") OR "public"."is_admin"()));



CREATE POLICY "isp_no_delete" ON "public"."item_sell_prices" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "isp_select_sales_admin" ON "public"."item_sell_prices" FOR SELECT USING (("public"."has_permission"('view_sell_pricing'::"text") OR "public"."is_admin"()));



CREATE POLICY "isp_update_sales" ON "public"."item_sell_prices" FOR UPDATE USING ((("public"."has_permission"('manage_sell_pricing'::"text") OR "public"."is_admin"()) AND ("status" = ANY (ARRAY['DRAFT'::"public"."sell_price_status", 'PENDING_APPROVAL'::"public"."sell_price_status"]))));



ALTER TABLE "public"."item_approval_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_approval_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_approval_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "item_approval_rules_read" ON "public"."item_approval_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "item_approval_rules_write" ON "public"."item_approval_rules" TO "authenticated" USING (("public"."is_admin"() OR "public"."has_permission"('manage_development'::"text")));



ALTER TABLE "public"."item_completeness_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_duplicate_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_field_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_publication_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_purchase_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_request_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_request_revisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_sell_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_sequences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preview_approval_instances_insert" ON "public"."preview_item_approval_instances" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('approve_item_requests'::"text") OR "public"."has_permission"('manage_development'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."preview_item_approval_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_approval_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_duplicate_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_master_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_reference_overlays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_item_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_publication_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."preview_purchase_price_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preview_requests_select" ON "public"."preview_item_requests" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."has_permission"('approve_item_requests'::"text") OR "public"."has_permission"('manage_development'::"text") OR "public"."is_admin"()));



ALTER TABLE "public"."preview_sell_price_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_schedule_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_availability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ps_insert_finance" ON "public"."pricing_schedules" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")));



CREATE POLICY "ps_select_finance" ON "public"."pricing_schedules" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")));



CREATE POLICY "ps_update_finance" ON "public"."pricing_schedules" FOR UPDATE USING ((("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")) AND ("status" = ANY (ARRAY['DRAFT'::"public"."pricing_schedule_status", 'PENDING_APPROVAL'::"public"."pricing_schedule_status", 'APPROVED'::"public"."pricing_schedule_status", 'SCHEDULED'::"public"."pricing_schedule_status"]))));



CREATE POLICY "psl_insert_finance" ON "public"."pricing_schedule_lines" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")));



CREATE POLICY "psl_select_finance" ON "public"."pricing_schedule_lines" FOR SELECT USING (("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")));



CREATE POLICY "psl_update_finance" ON "public"."pricing_schedule_lines" FOR UPDATE USING (("public"."is_admin"() OR "public"."has_permission"('manage_pricing_schedules'::"text")));



CREATE POLICY "qa_anon_all_item_approval_decisions" ON "public"."item_approval_decisions" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_item_approval_instances" ON "public"."item_approval_instances" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_item_completeness_checks" ON "public"."item_completeness_checks" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_item_publication_events" ON "public"."item_publication_events" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_item_purchase_prices" ON "public"."item_purchase_prices" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_item_sell_prices" ON "public"."item_sell_prices" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_preview_purchase_drafts" ON "public"."preview_purchase_price_drafts" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_all_preview_sell_drafts" ON "public"."preview_sell_price_drafts" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_audit_log" ON "public"."item_request_audit_log" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_duplicate_checks" ON "public"."item_duplicate_checks" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_item_approval_decisions" ON "public"."item_approval_decisions" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_item_approval_instances" ON "public"."item_approval_instances" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "qa_anon_item_requests" ON "public"."item_requests" TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."ref_short_supply_item_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ref_short_supply_pricing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ref_ss_pricing_select" ON "public"."ref_short_supply_pricing" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ref_ss_pricing_write" ON "public"."ref_short_supply_pricing" TO "authenticated" USING ("public"."has_smart_buying_access"()) WITH CHECK ("public"."has_smart_buying_access"());



CREATE POLICY "ref_ss_props_select" ON "public"."ref_short_supply_item_properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ref_ss_props_write" ON "public"."ref_short_supply_item_properties" TO "authenticated" USING ("public"."has_smart_buying_access"()) WITH CHECK ("public"."has_smart_buying_access"());



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sb_plans_insert" ON "public"."short_supply_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_smart_buying_access"());



CREATE POLICY "sb_plans_select" ON "public"."short_supply_plans" FOR SELECT TO "authenticated" USING ("public"."has_smart_buying_access"());



ALTER TABLE "public"."short_supply_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_product_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_steps" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_delivery_line_qty"("p_line_id" "uuid", "p_new_qty" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_changed_fields"("old_row" "jsonb", "new_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."audit_changed_fields"("old_row" "jsonb", "new_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_changed_fields"("old_row" "jsonb", "new_row" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_lock_idc_on_outcome"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_lock_idc_on_outcome"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_lock_idc_on_outcome"() TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_item_completeness"("p_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_item_completeness"("p_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_item_completeness"("p_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."colour_options_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."colour_options_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."colour_options_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_pending_duplicate_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_pending_duplicate_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pending_duplicate_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_po_atomic"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb", "p_approval" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_po_atomic"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb", "p_approval" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_po_atomic"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb", "p_approval" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_item_request_and_cascade"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_item_request_and_cascade"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_item_request_and_cascade"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_po_and_cascade"("p_po_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_po_and_cascade"("p_po_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_po_and_cascade"("p_po_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_iad_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_iad_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_iad_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_idc_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_idc_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_idc_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_ipp_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_ipp_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_ipp_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_isp_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_isp_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_isp_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_ps_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_ps_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_ps_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."evaluate_item_approval_rules"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_pricing_schedule"("p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_item_request_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_item_request_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_item_request_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_pricing_schedule_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_pricing_schedule_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_pricing_schedule_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_smart_buying_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."has_smart_buying_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_smart_buying_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_item_request_draft"("p_requestor_id" "uuid", "p_request_type" "text", "p_item_description" "text", "p_business_reason" "text", "p_target_sap" boolean, "p_target_bundle" boolean, "p_target_linenhub" boolean, "p_target_salesforce" boolean, "p_department" "text", "p_customer_reference" "text", "p_contract_reference" "text", "p_replacement_for_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_item_request_draft"("p_requestor_id" "uuid", "p_request_type" "text", "p_item_description" "text", "p_business_reason" "text", "p_target_sap" boolean, "p_target_bundle" boolean, "p_target_linenhub" boolean, "p_target_salesforce" boolean, "p_department" "text", "p_customer_reference" "text", "p_contract_reference" "text", "p_replacement_for_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_item_request_draft"("p_requestor_id" "uuid", "p_request_type" "text", "p_item_description" "text", "p_business_reason" "text", "p_target_sap" boolean, "p_target_bundle" boolean, "p_target_linenhub" boolean, "p_target_salesforce" boolean, "p_department" "text", "p_customer_reference" "text", "p_contract_reference" "text", "p_replacement_for_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_concur_po_number"("p_po_id" "uuid", "p_concur_po_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_concur_po_number"("p_po_id" "uuid", "p_concur_po_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_concur_po_number"("p_po_id" "uuid", "p_concur_po_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_concur_request_number"("p_po_id" "uuid", "p_concur_request_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_concur_request_number"("p_po_id" "uuid", "p_concur_request_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_concur_request_number"("p_po_id" "uuid", "p_concur_request_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_sla_breached"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_sla_breached"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_sla_breached"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid", "p_as_of_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid", "p_as_of_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_item_price"("p_item_id" "uuid", "p_customer_id" "uuid", "p_as_of_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_purchase_cost"("p_item_id" "uuid", "p_supplier_id" "uuid", "p_as_of_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_purchase_cost"("p_item_id" "uuid", "p_supplier_id" "uuid", "p_as_of_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_purchase_cost"("p_item_id" "uuid", "p_supplier_id" "uuid", "p_as_of_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_approval_sla_deadline"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_approval_sla_deadline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_approval_sla_deadline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ir_stage_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ir_stage_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ir_stage_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ir_urgency"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ir_urgency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ir_urgency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_isp_margin_approval_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_isp_margin_approval_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_isp_margin_approval_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_item_request_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_item_request_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_item_request_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_item_unit_price_from_sell"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_item_unit_price_from_sell"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_item_unit_price_from_sell"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."transition_item_request"("p_request_id" "uuid", "p_to_status" "text", "p_actor_id" "uuid", "p_notes" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."transition_item_request"("p_request_id" "uuid", "p_to_status" "text", "p_actor_id" "uuid", "p_notes" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_item_request"("p_request_id" "uuid", "p_to_status" "text", "p_actor_id" "uuid", "p_notes" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_iai_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_iai_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_iai_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_instance_on_decision"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_instance_on_decision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_instance_on_decision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ipe_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ipe_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ipe_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ipp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ipp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ipp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_isp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_isp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_isp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ps_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ps_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ps_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_requests" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_requests" TO "service_role";



GRANT ALL ON TABLE "public"."approved_items" TO "anon";
GRANT ALL ON TABLE "public"."approved_items" TO "authenticated";
GRANT ALL ON TABLE "public"."approved_items" TO "service_role";



GRANT ALL ON TABLE "public"."asset_capitalization" TO "anon";
GRANT ALL ON TABLE "public"."asset_capitalization" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_capitalization" TO "service_role";



GRANT ALL ON TABLE "public"."attribute_options" TO "anon";
GRANT ALL ON TABLE "public"."attribute_options" TO "authenticated";
GRANT ALL ON TABLE "public"."attribute_options" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_connect_replica_lag" TO "anon";
GRANT ALL ON TABLE "public"."bundle_connect_replica_lag" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_connect_replica_lag" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_connect_sync_config" TO "anon";
GRANT ALL ON TABLE "public"."bundle_connect_sync_config" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_connect_sync_config" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_connect_sync_jobs" TO "anon";
GRANT ALL ON TABLE "public"."bundle_connect_sync_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_connect_sync_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_connect_sync_watermarks" TO "anon";
GRANT ALL ON TABLE "public"."bundle_connect_sync_watermarks" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_connect_sync_watermarks" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."colour_options" TO "anon";
GRANT ALL ON TABLE "public"."colour_options" TO "authenticated";
GRANT ALL ON TABLE "public"."colour_options" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_lines" TO "anon";
GRANT ALL ON TABLE "public"."delivery_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_lines" TO "service_role";



GRANT ALL ON TABLE "public"."directory_users" TO "anon";
GRANT ALL ON TABLE "public"."directory_users" TO "authenticated";
GRANT ALL ON TABLE "public"."directory_users" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."item_approval_decisions" TO "anon";
GRANT ALL ON TABLE "public"."item_approval_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."item_approval_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."item_approval_instances" TO "anon";
GRANT ALL ON TABLE "public"."item_approval_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."item_approval_instances" TO "service_role";



GRANT ALL ON TABLE "public"."item_approval_rules" TO "anon";
GRANT ALL ON TABLE "public"."item_approval_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."item_approval_rules" TO "service_role";



GRANT ALL ON TABLE "public"."item_completeness_checks" TO "anon";
GRANT ALL ON TABLE "public"."item_completeness_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."item_completeness_checks" TO "service_role";



GRANT ALL ON TABLE "public"."item_duplicate_checks" TO "anon";
GRANT ALL ON TABLE "public"."item_duplicate_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."item_duplicate_checks" TO "service_role";



GRANT ALL ON TABLE "public"."item_field_registry" TO "anon";
GRANT ALL ON TABLE "public"."item_field_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."item_field_registry" TO "service_role";



GRANT ALL ON TABLE "public"."item_publication_events" TO "anon";
GRANT ALL ON TABLE "public"."item_publication_events" TO "authenticated";
GRANT ALL ON TABLE "public"."item_publication_events" TO "service_role";



GRANT ALL ON TABLE "public"."item_purchase_prices" TO "anon";
GRANT ALL ON TABLE "public"."item_purchase_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."item_purchase_prices" TO "service_role";



GRANT ALL ON TABLE "public"."item_request_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."item_request_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."item_request_audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."item_request_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."item_request_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."item_request_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."item_request_revisions" TO "anon";
GRANT ALL ON TABLE "public"."item_request_revisions" TO "authenticated";
GRANT ALL ON TABLE "public"."item_request_revisions" TO "service_role";



GRANT ALL ON TABLE "public"."item_requests" TO "anon";
GRANT ALL ON TABLE "public"."item_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."item_requests" TO "service_role";



GRANT ALL ON TABLE "public"."item_sell_prices" TO "anon";
GRANT ALL ON TABLE "public"."item_sell_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."item_sell_prices" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."po_approvals" TO "anon";
GRANT ALL ON TABLE "public"."po_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."po_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."po_lines" TO "anon";
GRANT ALL ON TABLE "public"."po_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."po_lines" TO "service_role";



GRANT ALL ON TABLE "public"."po_requests" TO "anon";
GRANT ALL ON TABLE "public"."po_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."po_requests" TO "service_role";



GRANT ALL ON TABLE "public"."po_sequences" TO "anon";
GRANT ALL ON TABLE "public"."po_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."po_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_approval_decisions" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_approval_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_approval_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_approval_instances" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_approval_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_approval_instances" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_duplicate_checks" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_duplicate_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_duplicate_checks" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_master_drafts" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_master_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_master_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."preview_item_reference_overlays" TO "anon";
GRANT ALL ON TABLE "public"."preview_item_reference_overlays" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_item_reference_overlays" TO "service_role";



GRANT ALL ON TABLE "public"."preview_publication_events" TO "anon";
GRANT ALL ON TABLE "public"."preview_publication_events" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_publication_events" TO "service_role";



GRANT ALL ON TABLE "public"."preview_purchase_price_drafts" TO "anon";
GRANT ALL ON TABLE "public"."preview_purchase_price_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_purchase_price_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."preview_sell_price_drafts" TO "anon";
GRANT ALL ON TABLE "public"."preview_sell_price_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."preview_sell_price_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_schedule_lines" TO "anon";
GRANT ALL ON TABLE "public"."pricing_schedule_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_schedule_lines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pricing_schedule_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pricing_schedule_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pricing_schedule_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_schedules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."product_availability" TO "anon";
GRANT ALL ON TABLE "public"."product_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."product_availability" TO "service_role";



GRANT ALL ON TABLE "public"."ref_short_supply_item_properties" TO "anon";
GRANT ALL ON TABLE "public"."ref_short_supply_item_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_short_supply_item_properties" TO "service_role";



GRANT ALL ON TABLE "public"."ref_short_supply_pricing" TO "anon";
GRANT ALL ON TABLE "public"."ref_short_supply_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."ref_short_supply_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."short_supply_plans" TO "anon";
GRANT ALL ON TABLE "public"."short_supply_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."short_supply_plans" TO "service_role";



GRANT ALL ON TABLE "public"."sites" TO "anon";
GRANT ALL ON TABLE "public"."sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sites" TO "service_role";



GRANT ALL ON TABLE "public"."stock_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."stock_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_product_map" TO "anon";
GRANT ALL ON TABLE "public"."supplier_product_map" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_product_map" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."system_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."v_current_item_prices" TO "anon";
GRANT ALL ON TABLE "public"."v_current_item_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."v_current_item_prices" TO "service_role";



GRANT ALL ON TABLE "public"."v_future_price_changes" TO "anon";
GRANT ALL ON TABLE "public"."v_future_price_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_future_price_changes" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_steps" TO "anon";
GRANT ALL ON TABLE "public"."workflow_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_steps" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































