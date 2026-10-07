
CREATE TABLE IF NOT EXISTS item_request_audit_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID        NOT NULL REFERENCES item_requests(id) ON DELETE CASCADE,
  action_type      TEXT        NOT NULL,
  performed_by     UUID        REFERENCES users(id),
  performed_by_name TEXT,
  from_status      TEXT,
  to_status        TEXT,
  summary          TEXT,
  metadata         JSONB       DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE item_request_audit_log IS
  'Immutable audit trail for all item request workflow events (status changes, assignments, comments, field edits). Never update or delete rows.';

CREATE INDEX IF NOT EXISTS idx_item_request_audit_log_request_id
  ON item_request_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_item_request_audit_log_created_at
  ON item_request_audit_log(created_at DESC);

ALTER TABLE item_request_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit log"
  ON item_request_audit_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert audit log entries"
  ON item_request_audit_log FOR INSERT
  TO authenticated WITH CHECK (true);
;
