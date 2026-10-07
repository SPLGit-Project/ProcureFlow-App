-- Phase DB1: BundleConnect → Azure Database sync infrastructure
CREATE TABLE IF NOT EXISTS bundle_connect_sync_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL UNIQUE,
    site_name       TEXT NOT NULL,
    host            TEXT,
    port            INT  NOT NULL DEFAULT 3307,
    database_name   TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    excluded        BOOLEAN NOT NULL DEFAULT false,
    exclusion_reason TEXT,
    batch_size      INT NOT NULL DEFAULT 500,
    rate_limit_ms   INT NOT NULL DEFAULT 200,
    lag_alert_hours INT NOT NULL DEFAULT 24,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bundle_connect_sync_config
    (site_code, site_name, port, enabled, excluded, exclusion_reason, batch_size, rate_limit_ms)
VALUES
    ('MEL', 'Melbourne',  3307, false, false, NULL,                                            500, 200),
    ('PER', 'Perth',      3307, false, false, NULL,                                            500, 200),
    ('CNS', 'Cairns',     3307, false, false, NULL,                                            500, 200),
    ('ADL', 'Adelaide',   3307, false, false, NULL,                                            500, 250),
    ('ALB', 'Albany',     3307, false, false, NULL,                                            500, 200),
    ('BNE', 'Brisbane',   3307, false, false, NULL,                                            500, 250),
    ('SYD', 'Sydney',     3307, false, true,  'Source replication (3306→3307) not yet restored', 500, 200)
ON CONFLICT (site_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bundle_connect_sync_watermarks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    last_record_number BIGINT NOT NULL DEFAULT 0,
    last_synced_at  TIMESTAMPTZ,
    rows_synced     BIGINT NOT NULL DEFAULT 0,
    UNIQUE (site_code, table_name)
);

INSERT INTO bundle_connect_sync_watermarks (site_code, table_name, last_record_number)
SELECT s.site_code, t.table_name, 0
FROM bundle_connect_sync_config s
CROSS JOIN (VALUES
    ('rfidtrans'), ('rfidstock'), ('stock'), ('corders'),
    ('autoreturn_log'), ('debtors'), ('rfidward'), ('invhdr'), ('invline')
) AS t(table_name)
WHERE s.site_code != 'SYD'
ON CONFLICT (site_code, table_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS bundle_connect_sync_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    triggered_by    TEXT NOT NULL DEFAULT 'schedule' CHECK (triggered_by IN ('schedule', 'manual', 'retry')),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    rows_fetched    INT,
    rows_written    INT,
    watermark_start BIGINT,
    watermark_end   BIGINT,
    error_message   TEXT,
    replica_lag_seconds INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_sync_jobs_site_created ON bundle_connect_sync_jobs (site_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bc_sync_jobs_status ON bundle_connect_sync_jobs (status) WHERE status IN ('pending', 'running');

CREATE TABLE IF NOT EXISTS bundle_connect_replica_lag (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL,
    lag_seconds     INT,
    sampled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_lag_site_sampled ON bundle_connect_replica_lag (site_code, sampled_at DESC);

ALTER TABLE bundle_connect_sync_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_sync_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_sync_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_replica_lag     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bc_sync_config_read"  ON bundle_connect_sync_config;
DROP POLICY IF EXISTS "bc_sync_wmk_read"     ON bundle_connect_sync_watermarks;
DROP POLICY IF EXISTS "bc_sync_jobs_read"    ON bundle_connect_sync_jobs;
DROP POLICY IF EXISTS "bc_sync_lag_read"     ON bundle_connect_replica_lag;
DROP POLICY IF EXISTS "bc_sync_admin_write"  ON bundle_connect_sync_config;
DROP POLICY IF EXISTS "bc_sync_jobs_write"   ON bundle_connect_sync_jobs;
DROP POLICY IF EXISTS "bc_sync_lag_write"    ON bundle_connect_replica_lag;

CREATE POLICY "bc_sync_config_read"  ON bundle_connect_sync_config     FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_wmk_read"     ON bundle_connect_sync_watermarks  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_jobs_read"    ON bundle_connect_sync_jobs        FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_lag_read"     ON bundle_connect_replica_lag      FOR SELECT TO authenticated USING (true);

CREATE POLICY "bc_sync_admin_write" ON bundle_connect_sync_config FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_permission('manage_development') OR public.has_permission('manage_settings'));

CREATE POLICY "bc_sync_jobs_write" ON bundle_connect_sync_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bc_sync_lag_write"  ON bundle_connect_replica_lag FOR INSERT TO authenticated WITH CHECK (true);;
