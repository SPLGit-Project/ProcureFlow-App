import re

# Defined dictionaries for multi-word extraction
POOLS = {'Administrative', 'COG', 'General Pool', 'Rental', 'Logistics'}
CATALOGS = {'Accommodation', 'Health Care', 'Linen Hub', 'Mining', 'Food & Beverages', 'Theater', 'Transport'}
TYPES = {
    'Charges & Fees', 'Bath Linen', 'Bed Linen', 'Hospital Wear', 'Mats', 'Table Linen', 'Work Wear', 
    'Cleaning', 'Kitchen Linen', 'Kitchen Wear', 'Surgeon Items', 'Theater', 'Packs', 'Delivery', 
    'Apparel', 'Ex-Items', 'Bathroom', 'Feeding', 'Inserts & Liners', 'Trolleys & Tubs'
}
MULTI_WORD_CATEGORIES = {
    'Curtains & Drapes', 'Doonas & Quilts', 'Inserts & Liners', 'Linen Bags', 'Trolleys & Tubs',
    'Clothing-Top', 'Clothing-Bottom', 'Uniform-Top', 'Hand Wear', 'Scrubs-Top', 'Scrubs-Bottom',
    'Baby Blanket', 'Baby Cot', 'Theatre Packs'
}

def parse_line(line):
    line = line.strip()
    if not line: return None
    
    parts = line.split()
    current_tokens = parts
    
    # 1. POOL
    pool = None
    # Check 2 words first
    if len(current_tokens) >= 2 and f"{current_tokens[0]} {current_tokens[1]}" in POOLS:
        pool = f"{current_tokens[0]} {current_tokens[1]}"
        current_tokens = current_tokens[2:]
    elif current_tokens[0] in POOLS:
        pool = current_tokens[0]
        current_tokens = current_tokens[1:]
    else:
        # Fallback or error? Assuming first word is pool if not matched
        pool = current_tokens[0]
        current_tokens = current_tokens[1:]

    if not current_tokens: return {'pool': pool}

    # 2. CATALOG
    catalog = None
    if len(current_tokens) >= 3 and f"{current_tokens[0]} {current_tokens[1]} {current_tokens[2]}" in CATALOGS:
         catalog = f"{current_tokens[0]} {current_tokens[1]} {current_tokens[2]}"
         current_tokens = current_tokens[3:]
    elif len(current_tokens) >= 2 and f"{current_tokens[0]} {current_tokens[1]}" in CATALOGS:
        catalog = f"{current_tokens[0]} {current_tokens[1]}"
        current_tokens = current_tokens[2:]
    else:
        catalog = current_tokens[0]
        current_tokens = current_tokens[1:]
        
    if not current_tokens: return {'pool': pool, 'catalog': catalog}

    # 3. TYPE
    type_ = None
    # Greedy match for Type
    matched_type = False
    for i in range(3, 0, -1): # Try up to 3 words
        if len(current_tokens) >= i:
            candidate = " ".join(current_tokens[:i])
            if candidate in TYPES:
                type_ = candidate
                current_tokens = current_tokens[i:]
                matched_type = True
                break
    
    if not matched_type:
        # Fallback: assume 1 word if not found? Or maybe user provided new types
        type_ = current_tokens[0]
        current_tokens = current_tokens[1:]

    if not current_tokens: return {'pool': pool, 'catalog': catalog, 'type': type_}

    # 4. CATEGORY
    category = None
    matched_cat = False
    for i in range(3, 0, -1):
        if len(current_tokens) >= i:
            candidate = " ".join(current_tokens[:i])
            if candidate in MULTI_WORD_CATEGORIES:
                category = candidate
                current_tokens = current_tokens[i:]
                matched_cat = True
                break
    
    if not matched_cat:
        category = current_tokens[0]
        current_tokens = current_tokens[1:]

    if not current_tokens: return {'pool': pool, 'catalog': catalog, 'type': type_, 'category': category}

    # 5. SUB CATEGORY
    sub_category = " ".join(current_tokens)
    
    return {'pool': pool, 'catalog': catalog, 'type': type_, 'category': category, 'sub_category': sub_category}


def generate_sql(items):
    sql = ["DO $$", 
           "DECLARE", 
           "  v_pool_id uuid;", 
           "  v_catalog_id uuid;", 
           "  v_type_id uuid;", 
           "  v_cat_id uuid;", 
           "  v_sub_id uuid;",
           "BEGIN"]

    # Deduplicate entries to process
    processed_pools = set()
    processed_catalogs = set()
    processed_types = set()
    processed_cats = set()
    processed_subs = set()

    for item in items:
        p, c, t, cat, sub = item.get('pool'), item.get('catalog'), item.get('type'), item.get('category'), item.get('sub_category')
        
        # --- POOL ---
        if p and p not in processed_pools:
            sql.append(f"  -- POOL: {p}")
            sql.append(f"  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = '{p}';")
            sql.append(f"  IF v_pool_id IS NULL THEN")
            sql.append(f"    INSERT INTO attribute_options (type, value) VALUES ('POOL', '{p}') RETURNING id INTO v_pool_id;")
            sql.append(f"  END IF;")
            processed_pools.add(p)
        else:
             # Need to fetch id again if we switched context but already processed? 
             # Simpler: Just fetch ID every time if context changed? 
             # Optimization: Only fetch if needed. But for script simplicity, fetching is safer to ensure variable describes current raw.
             pass

    # This declarative block structure is hard to manage for a long list in a single DO block if we rely on variables persisting accurately across many differing parents.
    # Better approach: Function calls or distinct blocks. 
    # Or reset variables.
    
    # Let's restructure to be robust. 
    # We will iterate and generate concise blocks.
    
    return sql

def generate_chunk(items, chunk_index):
    lines = []
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append("  v_pool_id uuid;")
    lines.append("  v_catalog_id uuid;")
    lines.append("  v_type_id uuid;")
    lines.append("  v_cat_id uuid;")
    lines.append("  v_child_id uuid;")
    lines.append("BEGIN")

    current_pool = None
    current_catalog = None
    current_type = None
    current_cat = None

    for item in items:
        p = item.get('pool')
        c = item.get('catalog')
        t = item.get('type')
        cat = item.get('category')
        sub = item.get('sub_category')

        # POOL
        # Always re-fetch pool if it's the start of a chunk or changed
        if p and (p != current_pool or current_pool is None):
            lines.append(f"  -- POOL: {p}")
            lines.append(f"  SELECT id INTO v_pool_id FROM attribute_options WHERE type = 'POOL' AND value = '{p}';")
            lines.append(f"  IF v_pool_id IS NULL THEN INSERT INTO attribute_options (type, value) VALUES ('POOL', '{p}') RETURNING id INTO v_pool_id; END IF;")
            current_pool = p
            # Logic to carry over context if we are deep in hierarchy? 
            # If we just fetched pool, we don't have catalog yet.
            # But the next lines will check catalog.
        
        # CATALOG
        if c and (c != current_catalog or current_catalog is None):
            lines.append(f"  -- CATALOG: {c}")
            lines.append(f"  SELECT id INTO v_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND value = '{c}';")
            lines.append(f"  IF v_catalog_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATALOG', '{c}', ARRAY[v_pool_id]) RETURNING id INTO v_catalog_id;")
            lines.append(f"  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_pool_id] WHERE id = v_catalog_id; END IF;")
            current_catalog = c

        # TYPE
        if t and (t != current_type or current_type is None):
            lines.append(f"  -- TYPE: {t}")
            lines.append(f"  SELECT id INTO v_type_id FROM attribute_options WHERE type = 'TYPE' AND value = '{t}';")
            lines.append(f"  IF v_type_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('TYPE', '{t}', ARRAY[v_catalog_id]) RETURNING id INTO v_type_id;")
            lines.append(f"  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_catalog_id] WHERE id = v_type_id; END IF;")
            current_type = t

        # CATEGORY
        if cat and (cat != current_cat or current_cat is None):
            lines.append(f"  -- CATEGORY: {cat}")
            lines.append(f"  SELECT id INTO v_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND value = '{cat}';")
            lines.append(f"  IF v_cat_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('CATEGORY', '{cat}', ARRAY[v_type_id]) RETURNING id INTO v_cat_id;")
            lines.append(f"  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_type_id] WHERE id = v_cat_id; END IF;")
            current_cat = cat

        # SUB_CATEGORY
        if sub:
            lines.append(f"  -- SUB: {sub}")
            lines.append(f"  SELECT id INTO v_child_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND value = '{sub}';")
            lines.append(f"  IF v_child_id IS NULL THEN INSERT INTO attribute_options (type, value, parent_ids) VALUES ('SUB_CATEGORY', '{sub}', ARRAY[v_cat_id]);")
            lines.append(f"  ELSE UPDATE attribute_options SET parent_ids = ARRAY[v_cat_id] WHERE id = v_child_id; END IF;")

    lines.append("END $$;")
    return lines

if __name__ == "__main__":
    with open("c:/Github/ProcureFlow-App/raw_hierarchy_data.txt", "r") as f:
        lines = f.readlines()
    
    parsed_items = [parse_line(line) for line in lines if line.strip()]
    
    CHUNK_SIZE = 50
    for i in range(0, len(parsed_items), CHUNK_SIZE):
        chunk = parsed_items[i:i + CHUNK_SIZE]
        sql_lines = generate_chunk(chunk, i // CHUNK_SIZE)
        filename = f"c:/Github/ProcureFlow-App/seed_part_{i // CHUNK_SIZE}.sql"
        with open(filename, "w") as f:
            f.write("\n".join(sql_lines))
        print(f"Generated {filename}")

