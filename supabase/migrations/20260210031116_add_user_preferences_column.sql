ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"theme": "dark", "activeSiteIds": []}'::jsonb;

-- Optional: Migrate existing localStorage data isn't possible from SQL easily, 
-- but we can ensure existing rows have the default.
UPDATE public.users SET preferences = '{"theme": "dark", "activeSiteIds": []}'::jsonb WHERE preferences IS NULL;;
