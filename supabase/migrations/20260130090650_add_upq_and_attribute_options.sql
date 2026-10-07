ALTER TABLE items ADD COLUMN IF NOT EXISTS upq numeric;

CREATE TABLE IF NOT EXISTS attribute_options (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    value text NOT NULL,
    type text NOT NULL,
    parent_id uuid REFERENCES attribute_options(id),
    active_flag boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attribute_options_type ON attribute_options(type);
CREATE INDEX IF NOT EXISTS idx_attribute_options_parent ON attribute_options(parent_id);;
