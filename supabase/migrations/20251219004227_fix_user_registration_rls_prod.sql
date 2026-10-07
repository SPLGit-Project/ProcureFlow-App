-- 1. Correcting RLS for users table
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'users') THEN
        DROP POLICY "Users can view their own profile" ON users;
    END IF;
END $$;

CREATE POLICY "Users can manage their own profile" ON users
FOR ALL 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. First User Helper Function
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM users;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_count() TO anon;
;
