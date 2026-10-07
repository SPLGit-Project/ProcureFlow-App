-- Seed the Azure SQL connection config row so the DataSyncPanel Azure Config
-- form has an existing record to update. Defaults to disconnected with the
-- correct SQL Server port (1433). Credentials are stored as Supabase Edge
-- Function secrets (AZURE_SQL_USER / AZURE_SQL_PASS), never in this table.

INSERT INTO app_config (key, value, updated_at)
VALUES (
  'azure_db_config',
  '{"connected": false, "host": "", "port": 1433, "database": ""}'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
