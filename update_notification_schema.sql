
-- Update notification_settings table to support granular rules
ALTER TABLE notification_settings 
  DROP COLUMN IF EXISTS channels, 
  DROP COLUMN IF EXISTS recipient_roles, 
  DROP COLUMN IF EXISTS custom_emails;

ALTER TABLE notification_settings 
  ADD COLUMN IF NOT EXISTS recipients jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Optional: Rename table to notification_rules if desired, but sticking to settings for now implies less churn
-- ALTER TABLE notification_settings RENAME TO notification_rules;
