-- Repair admin grants for multi-role users and make admin checks role-assignment aware.
-- A prior client bug could pass roleIds as siteIds, leaving ADMIN in users.site_ids
-- without a matching user_roles row.

DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.role_id = b.role_id;

ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_pkey;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);

INSERT INTO public.user_roles (user_id, role_id)
SELECT id, role_id
FROM public.users
WHERE role_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM public.users u
JOIN public.roles r ON r.id = ANY(COALESCE(u.site_ids, '{}'::text[]))
ON CONFLICT DO NOTHING;

UPDATE public.users u
SET site_ids = COALESCE((
  SELECT array_agg(raw_site.site_id)
  FROM unnest(COALESCE(u.site_ids, '{}'::text[])) AS raw_site(site_id)
  WHERE EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.id::text = raw_site.site_id
  )
), '{}'::text[])
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(u.site_ids, '{}'::text[])) AS raw_site(site_id)
  JOIN public.roles r ON r.id = raw_site.site_id
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT permission_id
      FROM public.users u
      JOIN LATERAL (
        SELECT ur.role_id
        FROM public.user_roles ur
        WHERE ur.user_id = u.id
        UNION
        SELECT u.role_id
        WHERE u.role_id IS NOT NULL
      ) assigned_roles ON true
      JOIN public.roles r ON r.id = assigned_roles.role_id
      CROSS JOIN LATERAL unnest(COALESCE(r.permissions, '{}'::text[])) AS permission_id
      WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
        AND u.status = 'APPROVED'
    ),
    '{}'::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE (u.auth_user_id = auth.uid() OR u.id = auth.uid())
      AND u.status = 'APPROVED'
      AND (u.role_id = 'ADMIN' OR ur.role_id = 'ADMIN')
  );
$$;

ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own user_roles" ON public.user_roles;
CREATE POLICY "Users can read own user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = user_roles.user_id
        AND (u.auth_user_id = auth.uid() OR u.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
