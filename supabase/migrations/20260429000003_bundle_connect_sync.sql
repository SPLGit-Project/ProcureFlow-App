-- Phase DB1: BundleConnect → Azure Database sync infrastructure
-- Tracks per-site sync jobs, watermarks, and health metrics for the
-- high-watermark CDC approach (binlog-safe, zero table locks on replica).

-- ── Site sync configuration ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_connect_sync_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL UNIQUE,          -- MEL, PER, CNS, ADL, ALB, BNE, SYD
    site_name       TEXT NOT NULL,
    host            TEXT,                          -- stored encrypted in app_config; this row is a pointer
    port            INT  NOT NULL DEFAULT 3307,    -- always replica port
    database_name   TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    excluded        BOOLEAN NOT NULL DEFAULT false, -- SYD flagged excluded until replication restored
    exclusion_reason TEXT,
    batch_size      INT NOT NULL DEFAULT 500,
    rate_limit_ms   INT NOT NULL DEFAULT 200,       -- min milliseconds between batches
    lag_alert_hours INT NOT NULL DEFAULT 24,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default site configs (SYD excluded, all others enabled=false until Azure is confirmed ready)
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

-- ── Per-table high-watermark tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_connect_sync_watermarks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    last_record_number BIGINT NOT NULL DEFAULT 0,  -- high-watermark on record_number index
    last_synced_at  TIMESTAMPTZ,
    rows_synced     BIGINT NOT NULL DEFAULT 0,
    UNIQUE (site_code, table_name)
);

-- Seed watermarks for the tables needed by Smart Buying + Integration layer
INSERT INTO bundle_connect_sync_watermarks (site_code, table_name, last_record_number)
SELECT s.site_code, t.table_name, 0
FROM bundle_connect_sync_config s
CROSS JOIN (VALUES
    ('rfidtrans'), ('rfidstock'), ('stock'), ('corders'),
    ('autoreturn_log'), ('debtors'), ('rfidward'), ('invhdr'), ('invline')
) AS t(table_name)
WHERE s.site_code != 'SYD'
ON CONFLICT (site_code, table_name) DO NOTHING;

-- ── Sync job log ─────────────────────────────────────────────────────────────
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

-- ── Replica lag monitoring ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bundle_connect_replica_lag (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_code       TEXT NOT NULL,
    lag_seconds     INT,
    sampled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_lag_site_sampled ON bundle_connect_replica_lag (site_code, sampled_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE bundle_connect_sync_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_sync_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_sync_jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_connect_replica_lag     ENABLE ROW LEVEL SECURITY;

-- Admins and manage_development users can read + write; everyone else read-only
CREATE POLICY "bc_sync_config_read"  ON bundle_connect_sync_config     FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_wmk_read"     ON bundle_connect_sync_watermarks  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_jobs_read"    ON bundle_connect_sync_jobs        FOR SELECT TO authenticated USING (true);
CREATE POLICY "bc_sync_lag_read"     ON bundle_connect_replica_lag      FOR SELECT TO authenticated USING (true);

CREATE POLICY "bc_sync_admin_write" ON bundle_connect_sync_config FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() AND p.name IN ('manage_development', 'system_admin', 'manage_settings')
    ));

CREATE POLICY "bc_sync_jobs_write" ON bundle_connect_sync_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bc_sync_lag_write"  ON bundle_connect_replica_lag FOR INSERT TO authenticated WITH CHECK (true);
