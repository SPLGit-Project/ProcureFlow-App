-- Migration: 20260318000002_rls_hardening.sql
-- Fix F7: Replace permissive USING(true) policies on 12 tables with
-- role-appropriate, minimum-privilege RLS policies.
--
-- Design principles:
--   • Reference data (sites, suppliers, items): all authenticated users READ, ADMIN-only WRITE
--   • Transactional data (deliveries, lines, approvals): site-scoped READ, system-write via RPC
--   • Config data (roles, workflow, notifications): all authenticated users READ, ADMIN-only WRITE
--   • Catalog / mapping data: all authenticated users READ/WRITE (operational need)
--
-- po_requests is ALREADY handled by migration 20260225000001_audit_hardening.sql.
-- This migration handles the remaining 12 tables.

-- Helper: reusable admin check expression (used as inline sub-select in policies)
-- A user is admin if users.role_id = 'ADMIN' and auth_user_id matches session

-- =============================================================================
-- 1. ROLES table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.roles;

    -- All authenticated users can read roles (needed to display permissions UI)
    if not exists (select 1 from pg_policies where tablename='roles' and policyname='Auth users read roles') then
        create policy "Auth users read roles" on public.roles
        for select using (auth.role() = 'authenticated');
    end if;

    -- Only admins can mutate roles
    if not exists (select 1 from pg_policies where tablename='roles' and policyname='Admin write roles') then
        create policy "Admin write roles" on public.roles
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 2. SITES table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.sites;

    if not exists (select 1 from pg_policies where tablename='sites' and policyname='Auth users read sites') then
        create policy "Auth users read sites" on public.sites
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='sites' and policyname='Admin write sites') then
        create policy "Admin write sites" on public.sites
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 3. SUPPLIERS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.suppliers;

    if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='Auth users read suppliers') then
        create policy "Auth users read suppliers" on public.suppliers
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='suppliers' and policyname='Admin write suppliers') then
        create policy "Admin write suppliers" on public.suppliers
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 4. ITEMS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.items;

    if not exists (select 1 from pg_policies where tablename='items' and policyname='Auth users read items') then
        create policy "Auth users read items" on public.items
        for select using (auth.role() = 'authenticated');
    end if;

    -- Admins and users with manage_items permission can write items
    if not exists (select 1 from pg_policies where tablename='items' and policyname='Admin write items') then
        create policy "Admin write items" on public.items
        for all
        using (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        )
        with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        );
    end if;
end $$;

-- =============================================================================
-- 5. CATALOG_ITEMS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.catalog_items;

    -- All authenticated users need to read catalog items (used in PO creation)
    if not exists (select 1 from pg_policies where tablename='catalog_items' and policyname='Auth users read catalog') then
        create policy "Auth users read catalog" on public.catalog_items
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='catalog_items' and policyname='Admin write catalog') then
        create policy "Admin write catalog" on public.catalog_items
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 6. STOCK_SNAPSHOTS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.stock_snapshots;

    if not exists (select 1 from pg_policies where tablename='stock_snapshots' and policyname='Auth users read snapshots') then
        create policy "Auth users read snapshots" on public.stock_snapshots
        for select using (auth.role() = 'authenticated');
    end if;

    -- Admins and users with manage_items permission can import/delete snapshots
    if not exists (select 1 from pg_policies where tablename='stock_snapshots' and policyname='Admin write snapshots') then
        create policy "Admin write snapshots" on public.stock_snapshots
        for all
        using (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        )
        with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        );
    end if;
end $$;

-- =============================================================================
-- 7. PO_LINES table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.po_lines;

    -- Users can see lines for POs from their sites
    if not exists (select 1 from pg_policies where tablename='po_lines' and policyname='Site members read po lines') then
        create policy "Site members read po lines" on public.po_lines
        for select using (
            po_request_id in (
                select id from public.po_requests
                where site_id = any(
                    select unnest(site_ids) from public.users where auth_user_id = auth.uid()
                )
            )
            or exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN')
        );
    end if;

    -- Lines are mutated exclusively through RPCs (create_po, update_pending_po_request).
    -- Direct inserts/updates/deletes from the client are blocked.
    -- Only the service_role (used by RPCs as security definer) can write lines.
    -- We add an ADMIN bypass for edge cases (direct admin tooling).
    if not exists (select 1 from pg_policies where tablename='po_lines' and policyname='Admin write po lines') then
        create policy "Admin write po lines" on public.po_lines
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 8. PO_APPROVALS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.po_approvals;

    if not exists (select 1 from pg_policies where tablename='po_approvals' and policyname='Site members read approvals') then
        create policy "Site members read approvals" on public.po_approvals
        for select using (
            po_request_id in (
                select id from public.po_requests
                where site_id = any(
                    select unnest(site_ids) from public.users where auth_user_id = auth.uid()
                )
            )
            or exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN')
        );
    end if;

    -- Any authenticated user can INSERT an approval (workflow actions)
    if not exists (select 1 from pg_policies where tablename='po_approvals' and policyname='Auth users insert approvals') then
        create policy "Auth users insert approvals" on public.po_approvals
        for insert with check (auth.role() = 'authenticated');
    end if;

    -- Only admins can UPDATE or DELETE approval records
    if not exists (select 1 from pg_policies where tablename='po_approvals' and policyname='Admin mutate approvals') then
        create policy "Admin mutate approvals" on public.po_approvals
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 9. DELIVERIES table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.deliveries;

    if not exists (select 1 from pg_policies where tablename='deliveries' and policyname='Site members read deliveries') then
        create policy "Site members read deliveries" on public.deliveries
        for select using (
            po_request_id in (
                select id from public.po_requests
                where site_id = any(
                    select unnest(site_ids) from public.users where auth_user_id = auth.uid()
                )
            )
            or exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN')
        );
    end if;

    -- Users with receive_goods permission can insert deliveries
    if not exists (select 1 from pg_policies where tablename='deliveries' and policyname='Receivers insert deliveries') then
        create policy "Receivers insert deliveries" on public.deliveries
        for insert with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'receive_goods' = any(r.permissions))
            )
        );
    end if;

    -- Admins can update/delete deliveries
    if not exists (select 1 from pg_policies where tablename='deliveries' and policyname='Admin mutate deliveries') then
        create policy "Admin mutate deliveries" on public.deliveries
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 10. DELIVERY_LINES table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.delivery_lines;

    -- Read: accessible if the parent delivery is accessible
    if not exists (select 1 from pg_policies where tablename='delivery_lines' and policyname='Site members read delivery lines') then
        create policy "Site members read delivery lines" on public.delivery_lines
        for select using (
            delivery_id in (select id from public.deliveries)
            -- Note: RLS on deliveries table above already scopes what deliveries are visible
        );
    end if;

    -- Insert/Update: users with receive_goods or finance permissions
    if not exists (select 1 from pg_policies where tablename='delivery_lines' and policyname='Receivers write delivery lines') then
        create policy "Receivers write delivery lines" on public.delivery_lines
        for all
        using (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'receive_goods' = any(r.permissions) or 'manage_finance' = any(r.permissions))
            )
        )
        with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'receive_goods' = any(r.permissions) or 'manage_finance' = any(r.permissions))
            )
        );
    end if;
end $$;

-- =============================================================================
-- 11. WORKFLOW_STEPS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.workflow_steps;

    if not exists (select 1 from pg_policies where tablename='workflow_steps' and policyname='Auth users read workflow') then
        create policy "Auth users read workflow" on public.workflow_steps
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='workflow_steps' and policyname='Admin write workflow') then
        create policy "Admin write workflow" on public.workflow_steps
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 12. NOTIFICATION_SETTINGS table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.notification_settings;

    if not exists (select 1 from pg_policies where tablename='notification_settings' and policyname='Auth users read notification settings') then
        create policy "Auth users read notification settings" on public.notification_settings
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='notification_settings' and policyname='Admin write notification settings') then
        create policy "Admin write notification settings" on public.notification_settings
        for all
        using (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'))
        with check (exists (select 1 from public.users where auth_user_id = auth.uid() and role_id = 'ADMIN'));
    end if;
end $$;

-- =============================================================================
-- 13. SUPPLIER_PRODUCT_MAP table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.supplier_product_map;

    -- Mapping data is read by all but managed by users with manage_items permission
    if not exists (select 1 from pg_policies where tablename='supplier_product_map' and policyname='Auth users read supplier map') then
        create policy "Auth users read supplier map" on public.supplier_product_map
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='supplier_product_map' and policyname='Manage items write supplier map') then
        create policy "Manage items write supplier map" on public.supplier_product_map
        for all
        using (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        )
        with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        );
    end if;
end $$;

-- =============================================================================
-- 14. PRODUCT_AVAILABILITY table
-- =============================================================================
do $$ begin
    drop policy if exists "Allow all public access" on public.product_availability;

    if not exists (select 1 from pg_policies where tablename='product_availability' and policyname='Auth users read availability') then
        create policy "Auth users read availability" on public.product_availability
        for select using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where tablename='product_availability' and policyname='Manage items write availability') then
        create policy "Manage items write availability" on public.product_availability
        for all
        using (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        )
        with check (
            exists (
                select 1 from public.users u
                join public.roles r on u.role_id = r.id
                where u.auth_user_id = auth.uid()
                and (r.id = 'ADMIN' or 'manage_items' = any(r.permissions))
            )
        );
    end if;
end $$;
