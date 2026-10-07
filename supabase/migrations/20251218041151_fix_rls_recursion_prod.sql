
-- Fix RLS recursion for users table
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role_id = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins can view and edit all users" ON users;
CREATE POLICY "Admins can view and edit all users" ON users FOR ALL USING (is_admin());
;
