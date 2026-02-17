-- Migration #9: Update search_directory to support global (NULL site) users
-- This fixes the issue where sync-directory users are not found because their site_id is NULL.

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
  -- Check permission: User must have access to p_site_id OR be an ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND (p_site_id = ANY(site_ids) OR role_id = 'ADMIN')
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
  WHERE (d.site_id IS NULL OR d.site_id = p_site_id) -- Support global users
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
$$ LANGUAGE plpgsql;
