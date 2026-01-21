-- Migration to add invitation_expires_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;
