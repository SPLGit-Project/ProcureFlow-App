


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






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
declare
    v_po_line_id uuid;
    v_po_request_id uuid;
    v_total_received numeric;
    v_variance_triggered boolean := false;
    v_new_status text := 'PARTIALLY_RECEIVED';
    l_line record;
    v_is_admin boolean;
begin
    -- Check if user is an ADMIN
    select exists (
        select 1 from public.users u 
        join public.roles r on u.role_id = r.id 
        where u.auth_user_id = auth.uid() and r.id = 'ADMIN'
    ) into v_is_admin;

    if not v_is_admin then
        raise exception 'Only administrators can perform this action.';
    end if;

    -- 1. Get references
    select po_line_id into v_po_line_id from public.delivery_lines where id = p_line_id;
    if v_po_line_id is null then
        raise exception 'Delivery line not found';
    end if;

    select po_request_id into v_po_request_id from public.po_lines where id = v_po_line_id;

    -- 2. Update delivery_lines
    update public.delivery_lines set quantity = p_new_qty where id = p_line_id;

    -- 3. Recalculate and update po_lines received_quantity
    select coalesce(sum(quantity), 0) into v_total_received
    from public.delivery_lines where po_line_id = v_po_line_id;

    update public.po_lines set quantity_received = v_total_received where id = v_po_line_id;

    -- 4. Re-evaluate PO Request status
    v_new_status := 'RECEIVED'; -- assume received unless proven otherwise

    for l_line in (select quantity_ordered, quantity_received, is_force_closed from public.po_lines where po_request_id = v_po_request_id) loop
        if l_line.quantity_received > l_line.quantity_ordered then
            v_variance_triggered := true;
        end if;
        if coalesce(l_line.is_force_closed, false) and l_line.quantity_received < l_line.quantity_ordered then
            v_variance_triggered := true;
        end if;

        if l_line.quantity_received < l_line.quantity_ordered and not coalesce(l_line.is_force_closed, false) then
            v_new_status := 'PARTIALLY_RECEIVED';
        end if;
    end loop;

    if v_variance_triggered then
        v_new_status := 'VARIANCE_PENDING';
    end if;

    update public.po_requests set status = v_new_status where id = v_po_request_id;
end;
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


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role_id = 'ADMIN' FROM user_roles WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "text"
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "item_id" "uuid",
    "supplier_id" "uuid",
    "supplier_sku" "text",
    "price" numeric
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "po_request_id" "uuid",
    "date" timestamp with time zone,
    "docket_number" "text",
    "received_by" "text"
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
    "upq" numeric
);


ALTER TABLE "public"."items" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."product_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid",
    "supplier_id" "uuid",
    "available_units" numeric,
    "available_order_qty" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false,
    "permissions" "text"[]
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."item_field_registry"
    ADD CONSTRAINT "item_field_registry_field_key_key" UNIQUE ("field_key");



ALTER TABLE ONLY "public"."item_field_registry"
    ADD CONSTRAINT "item_field_registry_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_product_id_supplier_id_key" UNIQUE ("product_id", "supplier_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_directory_users_email_lower" ON "public"."directory_users" USING "btree" ("lower"("email"));



CREATE INDEX "idx_directory_users_search_text" ON "public"."directory_users" USING "btree" ("search_text");



CREATE INDEX "idx_directory_users_search_text_trgm" ON "public"."directory_users" USING "gin" ("search_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_directory_users_site_id" ON "public"."directory_users" USING "btree" ("site_id");



CREATE INDEX "idx_invites_accepted_by" ON "public"."invites" USING "btree" ("accepted_by");



CREATE INDEX "idx_invites_email" ON "public"."invites" USING "btree" ("email");



CREATE INDEX "idx_invites_token_hash" ON "public"."invites" USING "btree" ("token_hash");



CREATE INDEX "idx_items_category" ON "public"."items" USING "btree" ("category");



CREATE INDEX "idx_items_range" ON "public"."items" USING "btree" ("range_name");



CREATE INDEX "idx_items_stock_type" ON "public"."items" USING "btree" ("stock_type");



CREATE INDEX "idx_items_sub_category" ON "public"."items" USING "btree" ("sub_category");



CREATE INDEX "idx_stock_snapshots_alt_norm" ON "public"."stock_snapshots" USING "btree" ("customer_stock_code_alt_norm");



CREATE INDEX "idx_stock_snapshots_norm" ON "public"."stock_snapshots" USING "btree" ("customer_stock_code_norm");



CREATE INDEX "idx_system_audit_logs_action_type" ON "public"."system_audit_logs" USING "btree" ("action_type");



CREATE INDEX "idx_system_audit_logs_created_at" ON "public"."system_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_users_auth_user_id" ON "public"."users" USING "btree" ("auth_user_id");



CREATE INDEX "idx_users_entra_oid" ON "public"."users" USING "btree" ("entra_oid");



CREATE UNIQUE INDEX "users_email_case_insensitive_idx" ON "public"."users" USING "btree" ("lower"("email"));



CREATE OR REPLACE TRIGGER "lowercase_email_trigger" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."lowercase_email_trigger_fn"();



CREATE OR REPLACE TRIGGER "set_po_display_id" BEFORE INSERT ON "public"."po_requests" FOR EACH ROW EXECUTE FUNCTION "public"."generate_po_display_id"();



CREATE OR REPLACE TRIGGER "set_timestamp_items" BEFORE UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trg_audit_deliveries" AFTER INSERT OR DELETE OR UPDATE ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_delivery_lines" AFTER INSERT OR DELETE OR UPDATE ON "public"."delivery_lines" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_approvals" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_lines" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_lines" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



CREATE OR REPLACE TRIGGER "trg_audit_po_requests" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_requests" FOR EACH ROW EXECUTE FUNCTION "public"."capture_system_audit"();



ALTER TABLE ONLY "public"."asset_capitalization"
    ADD CONSTRAINT "asset_capitalization_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attribute_options"
    ADD CONSTRAINT "attribute_options_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."attribute_options"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_po_request_id_fkey" FOREIGN KEY ("po_request_id") REFERENCES "public"."po_requests"("id");



ALTER TABLE ONLY "public"."delivery_lines"
    ADD CONSTRAINT "delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_lines"
    ADD CONSTRAINT "delivery_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id");



ALTER TABLE ONLY "public"."directory_users"
    ADD CONSTRAINT "directory_users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");



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



ALTER TABLE ONLY "public"."product_availability"
    ADD CONSTRAINT "product_availability_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."stock_snapshots"
    ADD CONSTRAINT "stock_snapshots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_product_map"
    ADD CONSTRAINT "supplier_product_map_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."system_audit_logs"
    ADD CONSTRAINT "system_audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."workflow_steps"
    ADD CONSTRAINT "workflow_steps_approver_role_fkey" FOREIGN KEY ("approver_role") REFERENCES "public"."roles"("id");



CREATE POLICY "Admins and requesters can delete requests" ON "public"."po_requests" FOR DELETE USING (((("auth"."uid"() IN ( SELECT "users"."auth_user_id"
   FROM "public"."users"
  WHERE ("users"."id" = "po_requests"."requester_id"))) AND ("status" = 'PENDING_APPROVAL'::"text")) OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("r"."id" = 'ADMIN'::"text"))))));



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



CREATE POLICY "Authenticated users can insert requests" ON "public"."po_requests" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view requests" ON "public"."po_requests" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."asset_capitalization" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable write access for authenticated users" ON "public"."asset_capitalization" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Requesters can update pending requests" ON "public"."po_requests" FOR UPDATE USING (((("auth"."uid"() IN ( SELECT "users"."auth_user_id"
   FROM "public"."users"
  WHERE ("users"."id" = "po_requests"."requester_id"))) AND ("status" = 'PENDING_APPROVAL'::"text")) OR (EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."auth_user_id" = "auth"."uid"()) AND ("r"."id" = 'ADMIN'::"text"))))));



CREATE POLICY "Users can manage their own profile" ON "public"."users" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can search directory for their sites" ON "public"."directory_users" FOR SELECT USING (((("site_id")::"text" IN ( SELECT "unnest"("users"."site_ids") AS "unnest"
   FROM "public"."users"
  WHERE (("users"."auth_user_id" = "auth"."uid"()) OR ("users"."id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE ((("users"."id" = "auth"."uid"()) OR ("users"."auth_user_id" = "auth"."uid"())) AND ("users"."role_id" = 'ADMIN'::"text"))))));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("auth_user_id" = "auth"."uid"()) OR ("email" = ("auth"."jwt"() ->> 'email'::"text"))));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asset_capitalization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attribute_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."directory_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_field_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_product_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workflow_steps" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






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



GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_system_audit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_po_display_id"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_user_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lowercase_email_trigger_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_system_audit_logs"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_directory"("p_site_id" "uuid", "p_query" "text", "p_limit" integer) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pending_po_request"("p_request_id" "uuid", "p_header" "jsonb", "p_lines" "jsonb") TO "service_role";



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



GRANT ALL ON TABLE "public"."asset_capitalization" TO "anon";
GRANT ALL ON TABLE "public"."asset_capitalization" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_capitalization" TO "service_role";



GRANT ALL ON TABLE "public"."attribute_options" TO "anon";
GRANT ALL ON TABLE "public"."attribute_options" TO "authenticated";
GRANT ALL ON TABLE "public"."attribute_options" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_items" TO "anon";
GRANT ALL ON TABLE "public"."catalog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";



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



GRANT ALL ON TABLE "public"."item_field_registry" TO "anon";
GRANT ALL ON TABLE "public"."item_field_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."item_field_registry" TO "service_role";



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



GRANT ALL ON TABLE "public"."product_availability" TO "anon";
GRANT ALL ON TABLE "public"."product_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."product_availability" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



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



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



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































