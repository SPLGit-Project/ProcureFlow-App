-- Migration #4: Add link_user_identity RPC for JIT Migration

CREATE OR REPLACE FUNCTION public.link_user_identity()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
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
$$ LANGUAGE plpgsql;
