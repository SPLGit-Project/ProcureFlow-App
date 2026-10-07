ALTER TABLE item_approval_instances ADD COLUMN IF NOT EXISTS sla_notified_at TIMESTAMPTZ;
COMMENT ON COLUMN item_approval_instances.sla_notified_at IS 'Timestamp of when the SLA breach notification was sent to prevent duplicate alerts.';;
