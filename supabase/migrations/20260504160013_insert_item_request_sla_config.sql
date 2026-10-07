
INSERT INTO app_config (key, value, updated_at, description)
VALUES (
  'item_request_sla_hours',
  '{"SUBMITTED": 8, "DUPLICATE_REVIEW": 24, "DATA_REVIEW": 48, "PRICING_REVIEW": 24, "APPROVAL_PENDING": 48}'::jsonb,
  NOW(),
  'SLA target hours per workflow stage. Used by the approval queue and request detail to colour-code urgency: green < 50% elapsed, amber 50-100%, red overdue.'
)
ON CONFLICT (key) DO NOTHING;
;
