-- Migration #1: Additive Changes for Auth & Directory Refactor

-- 1. Add new columns to public.users
-- auth_user_id: Links to supabase auth.users.id, replacing the need to mutate the PK.
-- entra_oid: Stores the Azure AD Object ID for immutable reference.
-- entra_tenant_id: Stores the Azure AD Tenant ID (future proofing).
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE,
ADD COLUMN IF NOT EXISTS entra_oid TEXT,
ADD COLUMN IF NOT EXISTS entra_tenant_id TEXT;

-- Index for fast lookup by auth_user_id (for session matching)
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON public.users(entra_oid);

-- 2. Create public.invites table
-- Stores pending invitations with hashed tokens.
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES public.sites(id),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  invited_by UUID REFERENCES public.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  -- Prevent duplicate active invites for same site/email
  UNIQUE(site_id, email, accepted_at) 
);

-- Index for token lookup (although we'll usually look up by token_hash, 
-- but we might want to clean up expired ones)
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON public.invites(token_hash);

-- 3. Create public.directory_users table
-- Local cache of Entra directory users for high-performance typeahead.
CREATE TABLE IF NOT EXISTS public.directory_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES public.sites(id), -- Tenant/Site scoping
  entra_oid TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  upn TEXT,
  search_text TEXT, -- Lowercase concatenated string for naive search
  job_title TEXT,
  department TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure one entry per user per site
  UNIQUE(site_id, entra_oid)
);

-- Indexes for Typeahead Search
-- We want fast prefix search on display_name and email
CREATE INDEX IF NOT EXISTS idx_directory_users_site_id ON public.directory_users(site_id);
CREATE INDEX IF NOT EXISTS idx_directory_users_search_text ON public.directory_users(search_text);

-- Enable pg_trgm if available for fuzzy search, otherwise btree is fine for prefix
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_directory_users_search_text_trgm ON public.directory_users USING GIN (search_text gin_trgm_ops);

-- Lowercase indexes for specific column matches if needed
CREATE INDEX IF NOT EXISTS idx_directory_users_email_lower ON public.directory_users(lower(email));

-- 4. Ensure email normalization function exists (optional utility)
CREATE OR REPLACE FUNCTION public.normalize_email(email TEXT) 
RETURNS TEXT AS $$
BEGIN
  RETURN lower(trim(email));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
