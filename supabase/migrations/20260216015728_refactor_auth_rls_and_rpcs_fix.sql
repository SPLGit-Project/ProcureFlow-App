-- Migration #2 (Fixed): RLS Policies and RPCs with Type Casting

-- 1. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_users ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies

-- DIRECTORY_USERS
-- Only users with access to the site can query that site's directory
CREATE POLICY "Users can search directory for their sites" ON public.directory_users
FOR SELECT
USING (
  site_id::text IN (
    SELECT unnest(site_ids) FROM public.users 
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
  )
  OR
  EXISTS (
     SELECT 1 FROM public.users 
     WHERE (id = auth.uid() OR auth_user_id = auth.uid()) 
     AND role_id = 'ADMIN'
  )
);

-- INVITES
-- Admins can create invites
CREATE POLICY "Admins can create invites" ON public.invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE (id = auth.uid() OR auth_user_id = auth.uid()) 
    AND role_id IN ('ADMIN', 'SITE_ADMIN')
  )
);

-- Admins can view invites they created or for their sites
CREATE POLICY "Admins can view invites" ON public.invites
FOR SELECT
USING (
  invited_by = auth.uid() 
  OR 
  (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE (id = auth.uid() OR auth_user_id = auth.uid()) 
      AND role_id = 'ADMIN'
    )
  )
);

-- USERS (Updates to existing permissions)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT
USING (
  id = auth.uid() 
  OR 
  auth_user_id = auth.uid()
  OR 
  email = (auth.jwt() ->> 'email')
);

-- 3. RPC: Search Directory
CREATE OR REPLACE FUNCTION public.search_directory(
  p_site_id UUID, 
  p_query TEXT, 
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  email TEXT,
  job_title TEXT,
  department TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission: User must have access to p_site_id or be ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND (p_site_id::text = ANY(site_ids) OR role_id = 'ADMIN')
  ) THEN
    RETURN; -- Return empty if no access
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.display_name,
    d.email,
    d.job_title,
    d.department
  FROM public.directory_users d
  WHERE d.site_id = p_site_id
  AND (
    d.search_text ILIKE '%' || p_query || '%'
    OR
    d.email ILIKE p_query || '%'
  )
  ORDER BY 
    CASE WHEN d.email ILIKE p_query || '%' THEN 0 ELSE 1 END,
    d.display_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 4. RPC: Accept Invite
CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_token_hash TEXT;
BEGIN
  v_token_hash := p_token; 

  SELECT * INTO v_invite 
  FROM public.invites 
  WHERE token_hash = v_token_hash 
  AND accepted_at IS NULL 
  AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Link user by email
  SELECT * INTO v_user FROM public.users WHERE normalize_email(email) = normalize_email(v_invite.email);

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

  RETURN jsonb_build_object('success', true, 'user_id', v_user.id);
END;
$$ LANGUAGE plpgsql;;
