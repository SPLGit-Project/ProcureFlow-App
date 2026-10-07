-- Standardized is_admin helper with legacy fallback
create or replace function public.is_admin() returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
    v_is_admin boolean;
begin
    -- 1. Check contemporary user_roles table (Standard)
    select exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role_id = 'ADMIN'
    ) into v_is_admin;

    if v_is_admin then return true; end if;

    -- 2. Fallback: Check legacy users.role_id column (Brittle but Necessary for older users)
    select exists (
        select 1 from public.users
        where auth_user_id = auth.uid() and role_id = 'ADMIN'
    ) into v_is_admin;

    return coalesce(v_is_admin, false);
end;
$$;
