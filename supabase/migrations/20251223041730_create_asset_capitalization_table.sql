CREATE TABLE IF NOT EXISTS asset_capitalization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_line_id UUID REFERENCES po_lines(id) ON DELETE CASCADE NOT NULL,
    gl_code TEXT,
    asset_tag TEXT,
    capitalized_date DATE,
    depreciation_years INTEGER,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint to prevent duplicate capitalization records for the same line
ALTER TABLE asset_capitalization ADD CONSTRAINT unique_po_line_capitalization UNIQUE (po_line_id);
;
