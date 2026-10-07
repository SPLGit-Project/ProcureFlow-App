
INSERT INTO auth.users (
  id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'qa.admin@procureflow.dev',
  '{"provider":"email","providers":["email"]}',
  '{"name":"QA Admin"}',
  false, '',
  now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;
;
