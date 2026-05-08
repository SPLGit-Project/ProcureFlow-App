-- Migration: Register cron jobs for scheduled tasks
-- Date: 2026-05-04

-- Requires pg_cron extension (available in Supabase Pro and Enterprise)
-- Note: app.settings.supabase_url and app.settings.service_role_key must be configured
-- as database GUCs for these jobs to succeed.

-- Schedule: activate-future-prices-daily
SELECT cron.schedule(
  'activate-future-prices-daily',
  '0 1 * * *',  -- Run at 1:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/activate-future-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule: check-sla-breaches-hourly
SELECT cron.schedule(
  'check-sla-breaches-hourly',
  '0 * * * *',  -- Run at top of every hour
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/notify-sla-breach',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON COLUMN cron.job.jobname IS 'Name of the scheduled task';
