-- Migration #3: Fix RPC Security and Normalization

-- 1. Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Update accept_invite RPC
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
$$ LANGUAGE plpgsql;;
