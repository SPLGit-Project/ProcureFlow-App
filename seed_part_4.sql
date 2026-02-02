DO $$
DECLARE
  v_pool_id uuid;
  v_catalog_id uuid;
  v_type_id uuid;
  v_cat_id uuid;
  v_child_id uuid;
BEGIN
  -- POOL: General Pool
  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = 'General Pool';
  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', 'General Pool') RETURNING id INTO v_pool_id; END IF;
  -- CATALOG: Health Care
  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = 'Health Care';
  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', 'Health Care', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;
  -- TYPE: Bed Linen
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Bed Linen';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Bed Linen', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Baby Cot
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Baby Cot';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Baby Cot', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- CATEGORY: Bedspread
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Bedspread';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Bedspread', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Blanket
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Blanket';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Blanket', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bassinette
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bassinette';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bassinette', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Cellolite
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cellolite';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cellolite', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Cellular
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cellular';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cellular', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Cot
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cot';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Sperry
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Sperry';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Sperry', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Doonas & Quilts
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Doonas & Quilts';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Doonas & Quilts', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Cover
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cover';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cover', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Insert
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Insert';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Insert', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Pillow
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Pillow';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Pillow', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Case Child
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Case Child';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Case Child', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Case Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Case Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Case Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Protector
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Protector';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Protector', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bedpad
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bedpad';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bedpad', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Kylie/Comfort
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Kylie/Comfort';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Kylie/Comfort', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Mattress
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Mattress';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Mattress', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pinkie
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pinkie';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pinkie', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pinkies
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pinkies';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pinkies', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Runner
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Runner';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Runner', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bed
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bed';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bed', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Sheet
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Sheet';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Sheet', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bassinette
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bassinette';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bassinette', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Brake
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Brake';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Brake', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Cot
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Cot';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Cot', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Double
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Double';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Double', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Draw
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Draw';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Draw', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Envelope
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Envelope';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Envelope', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Fitted
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Fitted';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Fitted', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Single
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Single';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Single', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Slide
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Slide';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Slide', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Slip
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Slip';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Slip', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Split
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Split';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Split', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Top
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Top';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Top', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Cleaning
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Cleaning';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Cleaning', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Mop
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Mop';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Mop', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Head
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Head';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Head', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pad
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pad';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pad', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Screw
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Screw';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Screw', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Feeding
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Feeding';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Feeding', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Bib
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Bib';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Bib', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Adult
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Adult';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Adult', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- TYPE: Hospital Wear
  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = 'Hospital Wear';
  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', 'Hospital Wear', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;
  -- CATEGORY: Apparel
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Apparel';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Apparel', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Pyjamas
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pyjamas';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Scrub
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Scrub';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Scrub', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Apron
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Apron';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Apron', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bib
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bib';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bib', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Caress
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Caress';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Caress', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Standard
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Standard';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Standard', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Swab
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Swab';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Swab', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Baby
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Baby';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Baby', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Bib
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Bib';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Bib', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Feeder
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Feeder';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Feeder', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Gown
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Gown';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Gown', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Nappy
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Nappy';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Nappy', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Wrap
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Wrap';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Wrap', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Clothing-Baby
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Clothing-Baby';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Clothing-Baby', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Vest
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Vest';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Vest', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Clothing-Bottom
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Clothing-Bottom';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Clothing-Bottom', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Pants
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pants';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pants', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Pyjamas
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Pyjamas';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Pyjamas', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- SUB: Shorts
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Shorts';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Shorts', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
  -- CATEGORY: Clothing-Top
  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = 'Clothing-Top';
  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', 'Clothing-Top', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;
  -- SUB: Adults
  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = 'Adults';
  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', 'Adults', ARRAY[v_cat_id]);
  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;
END $$;