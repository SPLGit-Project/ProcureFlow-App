
INSERT INTO public.users (id, email, name, role_id, status, auth_user_id)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'qa.admin@procureflow.dev',
  'QA Admin',
  'ADMIN',
  'ACTIVE',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;
;
