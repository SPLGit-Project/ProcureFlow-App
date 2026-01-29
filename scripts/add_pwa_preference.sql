-- Add PWA Install Prompt Preference to Users Table
-- This migration adds a column to track user preference for the PWA install prompt
-- Users can hide the prompt, and later re-enable it via profile settings

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS pwa_install_prompt_hidden BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN users.pwa_install_prompt_hidden IS 
'User preference to hide PWA install prompt. When true, the floating install button and automatic prompts are hidden. Can be re-enabled via Settings > Profile.';

-- Index for performance (optional, but recommended if querying by this field)
CREATE INDEX IF NOT EXISTS idx_users_pwa_prompt ON users(pwa_install_prompt_hidden);
