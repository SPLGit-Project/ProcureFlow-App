-- Migration: Fix Directory Search to include Global Users
-- This updates the search_directory function to allow searching users with NULL site_id (Global Directory)

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
  -- Check permission: User must have access to p_site_id OR be an Admin
  -- Note: We still require the user to have valid access to the application
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
    AND (p_site_id = ANY(site_ids) OR role_id = 'ADMIN')
  ) THEN
    RETURN; -- Return empty if no access to the requested site context
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.display_name,
    d.email,
    d.job_title,
    d.department
  FROM public.directory_users d
  WHERE 
    -- Match users in the specific site OR Global users (NULL site_id)
    (d.site_id = p_site_id OR d.site_id IS NULL)
  AND (
    d.search_text ILIKE '%' || p_query || '%'
    OR
    d.email ILIKE p_query || '%'
  )
  ORDER BY 
    -- Prioritize site-specific matches, then email prefix, then name
    CASE WHEN d.site_id = p_site_id THEN 0 ELSE 1 END,
    CASE WHEN d.email ILIKE p_query || '%' THEN 0 ELSE 1 END,
    d.display_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
