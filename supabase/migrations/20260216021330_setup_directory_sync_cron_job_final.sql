-- 1. Ensure extensions are ready
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule the Directory Sync to run every night at 1:00 AM UTC
-- We use a placeholder for the SERVICE_ROLE_KEY which needs to be updated in the SQL Editor
-- to ensure the cron job actually has permission to hit the Edge Function.

SELECT cron.schedule(
    'nightly-directory-sync', 
    '0 1 * * *',             
    $$
    SELECT net.http_post(
        url:='https://yasosgkznoxamysutxfc.supabase.co/functions/v1/sync-directory',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
    );
    $$
);
;
