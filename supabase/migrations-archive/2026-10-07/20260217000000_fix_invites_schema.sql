-- Migration #8: Add missing accepted_by column to invites table
-- This column is required by the accept_invite RPC

ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES public.users(id);

-- Ensure index for performance on accepted_by
CREATE INDEX IF NOT EXISTS idx_invites_accepted_by ON public.invites(accepted_by);
