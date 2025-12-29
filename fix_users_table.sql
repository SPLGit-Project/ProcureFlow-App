-- Fix users table columns
-- This script adds potentially missing columns required by the Admin Access Hub.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS site_ids TEXT[],
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS role_id TEXT;  -- Ensure role_id exists (it might be referencing role_definitions)
