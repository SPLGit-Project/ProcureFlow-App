-- Add standalone unique constraint on entra_oid to support simplified upserts
ALTER TABLE public.directory_users 
ADD CONSTRAINT directory_users_entra_oid_unique UNIQUE (entra_oid);;
