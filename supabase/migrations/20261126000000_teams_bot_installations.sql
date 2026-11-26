-- Migration: 20261126000000_teams_bot_installations.sql
-- Description: Store Microsoft Teams Bot Framework conversation references for proactive 1:1
--              messages from the dedicated 'ProcureFlow Approval Bot' custom Teams app.

CREATE TABLE IF NOT EXISTS public.teams_bot_installations (
  user_email TEXT PRIMARY KEY,
  aad_object_id TEXT,
  tenant_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  service_url TEXT NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_bot_installations_aad_object_id
  ON public.teams_bot_installations (aad_object_id);

ALTER TABLE public.teams_bot_installations ENABLE ROW LEVEL SECURITY;

-- Service role has full access; authenticated users cannot read/enumerate other users' bot references
DROP POLICY IF EXISTS "Service role manages teams_bot_installations" ON public.teams_bot_installations;
CREATE POLICY "Service role manages teams_bot_installations"
  ON public.teams_bot_installations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
