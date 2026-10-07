
-- Colour options table — admin-managed palette with pattern support
CREATE TABLE IF NOT EXISTS colour_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text        NOT NULL,
  code          text        NOT NULL,
  pattern_type  text        NOT NULL DEFAULT 'solid'  CHECK (pattern_type IN ('solid', 'stripe')),
  primary_hex   text        NOT NULL DEFAULT '#CCCCCC',
  secondary_hex text,
  stripe_angle  int         NOT NULL DEFAULT 45,
  stripe_width  int         NOT NULL DEFAULT 50,
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

-- Seed from existing hardcoded palette
INSERT INTO colour_options (label, code, primary_hex, sort_order) VALUES
  ('White',    'W',  '#FFFFFF', 1),
  ('Off-White','OW', '#F5ECD7', 2),
  ('Cream',    'CR', '#FFFACD', 3),
  ('Ivory',    'IV', '#FFFFF0', 4),
  ('Natural',  'NA', '#E8DCC8', 5),
  ('Beige',    'BG', '#D4C5A9', 6),
  ('Stone',    'ST', '#B0A395', 7),
  ('Khaki',    'KH', '#C3B091', 8),
  ('Sand',     'SD', '#D2B48C', 9),
  ('Grey',     'GY', '#9E9E9E', 10),
  ('Charcoal', 'CH', '#4A4A4A', 11),
  ('Black',    'BK', '#1A1A1A', 12),
  ('Navy',     'NV', '#1B2A4A', 13),
  ('Blue',     'BL', '#2196F3', 14),
  ('Teal',     'TL', '#008B8B', 15),
  ('Aqua',     'AQ', '#00BCD4', 16),
  ('Green',    'GN', '#4CAF50', 17),
  ('Sage',     'SG', '#87A878', 18),
  ('Red',      'RD', '#F44336', 19),
  ('Burgundy', 'BU', '#800020', 20),
  ('Pink',     'PK', '#E91E96', 21),
  ('Coral',    'CO', '#FF6B6B', 22),
  ('Orange',   'OR', '#FF9800', 23),
  ('Gold',     'GD', '#FFD700', 24),
  ('Purple',   'PU', '#9C27B0', 25),
  ('Brown',    'BR', '#795548', 26)
ON CONFLICT (code) DO NOTHING;

-- RLS
ALTER TABLE colour_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colour_options_read" ON colour_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "colour_options_write" ON colour_options
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION colour_options_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER colour_options_updated_at
  BEFORE UPDATE ON colour_options
  FOR EACH ROW EXECUTE FUNCTION colour_options_set_updated_at();
;
