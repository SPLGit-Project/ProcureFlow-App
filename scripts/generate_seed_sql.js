import fs from 'fs';

const RAW_DATA = `Administrative	Accommodation	Charges & Fees	Surcharge	Delivery
Administrative	Accommodation	Charges & Fees	Surcharge	Late
Administrative	Accommodation	Charges & Fees	Surcharge	Packing
Administrative	Accommodation	Charges & Fees	Surcharge	Pickup
Administrative	Accommodation	Charges & Fees	Surcharge	Service
Administrative	Health Care	Charges & Fees	Surcharge	Delivery
Administrative	Health Care	Charges & Fees	Surcharge	Rental
Administrative	Health Care	Charges & Fees	Surcharge	Supply
Administrative	Linen Hub	Charges & Fees	Mat	Bath
Administrative	Linen Hub	Charges & Fees	Towel	Bath
Administrative	Linen Hub	Charges & Fees	Towel	Face Washer
Administrative	Linen Hub	Charges & Fees	Towel	Hand
Administrative	Mining	Charges & Fees	Surcharge	Delivery
Administrative	Mining	Charges & Fees	Surcharge	Handling
COG	Accommodation	Bath Linen	Cloth	Face Washer
COG	Accommodation	Bath Linen	Curtains & Drapes	Shower
COG	Accommodation	Bath Linen	Mat	Bath
COG	Accommodation	Bath Linen	Robe	Bath
COG	Accommodation	Bath Linen	Rug	Bath
COG	Accommodation	Bath Linen	Sheet	Bath
COG	Accommodation	Bath Linen	Towel	Bath
COG	Accommodation	Bath Linen	Towel	Face
COG	Accommodation	Bath Linen	Towel	Face Washer
COG	Accommodation	Bath Linen	Towel	Hand
COG	Accommodation	Bath Linen	Towel	Pool
COG	Accommodation	Bed Linen	Bedspread	Custom
COG	Accommodation	Bed Linen	Blanket	COG
COG	Accommodation	Bed Linen	Blanket	Custom
COG	Accommodation	Bed Linen	Cover	Cushion
COG	Accommodation	Bed Linen	Cover	Ironing Board
COG	Accommodation	Bed Linen	Doonas & Quilts	Cover
COG	Accommodation	Bed Linen	Doonas & Quilts	Insert
COG	Accommodation	Bed Linen	Pillow Case	Custom
COG	Accommodation	Bed Linen	Pillow Case	Standard
COG	Accommodation	Bed Linen	Protector	Doona / Quilt
COG	Accommodation	Bed Linen	Protector	Mattress
COG	Accommodation	Bed Linen	Protector	Pillow
COG	Accommodation	Bed Linen	Protector	Pillow Case
COG	Accommodation	Bed Linen	Rags	COG
COG	Accommodation	Bed Linen	Rug	Knee
COG	Accommodation	Bed Linen	Runner	Bed
COG	Accommodation	Bed Linen	Sheet	Custom
COG	Accommodation	Bed Linen	Sheet	Double
COG	Accommodation	Bed Linen	Sheet	Flat
COG	Accommodation	Bed Linen	Sheet	Single
COG	Accommodation	Bed Linen	Sheet	Standard
COG	Accommodation	Bed Linen	Sheet	Top
COG	Accommodation	Bed Linen	Topper	Mattress
COG	Accommodation	Hospital Wear	Robe	Bath
COG	Accommodation	Mats	Mats	Bath
COG	Accommodation	Table Linen	Napkin	Serviette
COG	Accommodation	Work Wear	Clothing-Top	Shirt
COG	Food & Beverages	Cleaning	Mop	Head
COG	Food & Beverages	Kitchen Linen	Cover	Chair
COG	Food & Beverages	Kitchen Wear	Apron	Custom
COG	Food & Beverages	Table Linen	Napkin	Serviette
COG	Food & Beverages	Table Linen	Table Linen	Custom
COG	Food & Beverages	Table Linen	Table Linen	Trestle
COG	Health Care	Bath Linen	Curtains & Drapes	Custom
COG	Health Care	Bath Linen	Curtains & Drapes	Fensitrated
COG	Health Care	Bath Linen	Curtains & Drapes	Shower
COG	Health Care	Bath Linen	Mat	Floor
COG	Health Care	Bath Linen	Towel	Face Washer
COG	Health Care	Bath Linen	Towel	Hand
COG	Health Care	Bed Linen	Bedspread	Custom
COG	Health Care	Bed Linen	Blanket	COG
COG	Health Care	Bed Linen	Doonas & Quilts	Cover
COG	Health Care	Bed Linen	Doonas & Quilts	Insert
COG	Health Care	Bed Linen	Pillow Case	Custom
COG	Health Care	Bed Linen	Protector	Kylie
COG	Health Care	Bed Linen	Protector	Mattress
COG	Health Care	Bed Linen	Sheet	Cot
COG	Health Care	Bed Linen	Sheet	Custom
COG	Health Care	Bed Linen	Sheet	Fitted
COG	Health Care	Bed Linen	Sheet	Slide
COG	Health Care	Bed Linen	Sheet	Standard
COG	Health Care	Bed Linen	Sling	Custom
COG	Health Care	Bed Linen	Sling	Patient
COG	Health Care	Cleaning	Duster	High
COG	Health Care	Cleaning	Duster	Microfibre
COG	Health Care	Cleaning	Mop	Head
COG	Health Care	Cleaning	Mop	String
COG	Health Care	Hospital Wear	Apparel	T-Shirt
COG	Health Care	Hospital Wear	Baby	Feeder
COG	Health Care	Hospital Wear	Baby	Gown
COG	Health Care	Hospital Wear	Baby	Wrap
COG	Health Care	Hospital Wear	Clothing-Baby	Bodysuit
COG	Health Care	Hospital Wear	Clothing-Top	Adults
COG	Health Care	Hospital Wear	Gown	Patient
COG	Health Care	Hospital Wear	Hand Wear	Gloves-Heat Resistant
COG	Health Care	Hospital Wear	Hood	Counter
COG	Health Care	Hospital Wear	Robe	Bath
COG	Health Care	Hospital Wear	Scrubs-Bottom	Pants
COG	Health Care	Hospital Wear	Scrubs-Top	Top
COG	Health Care	Hospital Wear	Sling	Loop
COG	Health Care	Kitchen Linen	Towel	Tea
COG	Health Care	Kitchen Wear	Hand Wear	Oven Mitt
COG	Linen Hub	Bed Linen	Sheet	Custom
COG	Mining	Bath Linen	Curtains & Drapes	Custom
COG	Mining	Bath Linen	Curtains & Drapes	Shower
COG	Mining	Bath Linen	Mat	Bath
COG	Mining	Bath Linen	Sheet	Bath
COG	Mining	Bath Linen	Towel	Bath
COG	Mining	Bath Linen	Towel	Face Washer
COG	Mining	Bath Linen	Towel	Gym
COG	Mining	Bath Linen	Towel	Hand
COG	Mining	Bed Linen	Blanket	COG
COG	Mining	Bed Linen	Doonas & Quilts	Comforter
COG	Mining	Bed Linen	Doonas & Quilts	Cover
COG	Mining	Bed Linen	Doonas & Quilts	Insert
COG	Mining	Bed Linen	Pillow Case	Custom
COG	Mining	Bed Linen	Protector	Mattress
COG	Mining	Bed Linen	Protector	Pillow Case
COG	Mining	Bed Linen	Sheet	Custom
COG	Mining	Bed Linen	Sheet	Fitted
COG	Mining	Bed Linen	Sheet	Flat
COG	Mining	Work Wear	Clothing-Top	Overalls
COG	Theater	Surgeon Items	Gown	Surgeon
General Pool	Accommodation	Bath Linen	Curtains & Drapes	Shower
General Pool	Accommodation	Bath Linen	Mat	Bath
General Pool	Accommodation	Bath Linen	Rug	Bath
General Pool	Accommodation	Bath Linen	Sheet	Bath
General Pool	Accommodation	Bath Linen	Towel	Bath
General Pool	Accommodation	Bath Linen	Towel	Bath Mat
General Pool	Accommodation	Bath Linen	Towel	Face Washer
General Pool	Accommodation	Bath Linen	Towel	Hand
General Pool	Accommodation	Bath Linen	Towel	Pool
General Pool	Accommodation	Bathroom	Towel	Bath
General Pool	Accommodation	Bed Linen	Blanket	Cellular
General Pool	Accommodation	Bed Linen	Cover	Couch
General Pool	Accommodation	Bed Linen	Doonas & Quilts	Cover
General Pool	Accommodation	Bed Linen	Doonas & Quilts	Insert
General Pool	Accommodation	Bed Linen	Pillow	Case
General Pool	Accommodation	Bed Linen	Pillow Case	Circle
General Pool	Accommodation	Bed Linen	Pillow Case	Euro
General Pool	Accommodation	Bed Linen	Pillow Case	Firm
General Pool	Accommodation	Bed Linen	Pillow Case	Soft
General Pool	Accommodation	Bed Linen	Pillow Case	Standard
General Pool	Accommodation	Bed Linen	Protector	Mattress
General Pool	Accommodation	Bed Linen	Protector	Pinkies/Kylie
General Pool	Accommodation	Bed Linen	Sheet	Cot
General Pool	Accommodation	Bed Linen	Sheet	Fitted
General Pool	Accommodation	Bed Linen	Sheet	Flat
General Pool	Accommodation	Bed Linen	Sheet	Slide
General Pool	Accommodation	Bed Linen	Sheet	Standard
General Pool	Accommodation	Bed Linen	Sheet	Top
General Pool	Accommodation	Charges & Fees	Surcharge	Delivery
General Pool	Accommodation	Ex-Items	Bag	Laundry
General Pool	Accommodation	Ex-Items	Rags	Bag
General Pool	Accommodation	Ex-Items	Rags	Towels
General Pool	Accommodation	Hospital Wear	Gown	Short Sleeve
General Pool	Accommodation	Hospital Wear	Robe	Bath
General Pool	Accommodation	Hospital Wear	Shirt	Uniform
General Pool	Accommodation	Kitchen Linen	Cloth	Dorset
General Pool	Accommodation	Kitchen Linen	Cloth	Glass
General Pool	Accommodation	Kitchen Linen	Cloth	Microfiber
General Pool	Accommodation	Kitchen Linen	Cloth	Polish
General Pool	Accommodation	Kitchen Linen	Mat	Dust
General Pool	Accommodation	Kitchen Linen	Napkin	Serviette
General Pool	Accommodation	Kitchen Linen	Towel	Tea
General Pool	Accommodation	Kitchen Wear	Apron	Butcher
General Pool	Accommodation	Mats	Mats	Bath
General Pool	Accommodation	Table Linen	Mat	Place
General Pool	Accommodation	Table Linen	Napkin	Cocktail
General Pool	Accommodation	Table Linen	Napkin	Serviette
General Pool	Accommodation	Theatre	Scrubs-Top	Surgeon
General Pool	Food & Beverages	Apparel	Cap	Rubber
General Pool	Food & Beverages	Bath Linen	Towel	Bath
General Pool	Food & Beverages	Bath Linen	Towel	Salon
General Pool	Food & Beverages	Cleaning	Mop	Head
General Pool	Food & Beverages	Ex-Items	Rags	Tea Towels
General Pool	Food & Beverages	Kitchen Linen	Cloth	Glass
General Pool	Food & Beverages	Kitchen Linen	Cloth	Huck
General Pool	Food & Beverages	Kitchen Linen	Cloth	Table
General Pool	Food & Beverages	Kitchen Linen	Cloth	Tray
General Pool	Food & Beverages	Kitchen Linen	Mat	Dust
General Pool	Food & Beverages	Kitchen Linen	Table Linen	Overlay
General Pool	Food & Beverages	Kitchen Linen	Table Linen	Standard
General Pool	Food & Beverages	Kitchen Linen	Towel	Tea
General Pool	Food & Beverages	Kitchen Wear	Apron	Bib
General Pool	Food & Beverages	Kitchen Wear	Apron	Butcher
General Pool	Food & Beverages	Kitchen Wear	Apron	Waist
General Pool	Food & Beverages	Table Linen	Napkin	Serviette
General Pool	Food & Beverages	Table Linen	Table Linen	Crease-Resistant
General Pool	Food & Beverages	Table Linen	Table Linen	Momie
General Pool	Food & Beverages	Table Linen	Table Linen	Standard
General Pool	Food & Beverages	Table Linen	Table Linen	Trestle
General Pool	Food & Beverages	Table Linen	Table Linen	Visa
General Pool	Food & Beverages	Work Wear	Clothing-Bottom	Pants-Freezer
General Pool	Food & Beverages	Work Wear	Clothing-Top	Jacket-Freezer
General Pool	Food & Beverages	Work Wear	Uniform-Top	Shirt
General Pool	Health Care	Bath Linen	Curtains & Drapes	Draw
General Pool	Health Care	Bath Linen	Curtains & Drapes	Screen
General Pool	Health Care	Bath Linen	Curtains & Drapes	Shower
General Pool	Health Care	Bath Linen	Mat	Bath
General Pool	Health Care	Bath Linen	Towel	Bath
General Pool	Health Care	Bath Linen	Towel	Face Washer
General Pool	Health Care	Bath Linen	Towel	Hand
General Pool	Health Care	Bath Linen	Towel	Huck
General Pool	Health Care	Bed Linen	Baby	Blanket
General Pool	Health Care	Bed Linen	Baby	Cot
General Pool	Health Care	Bed Linen	Bedspread	Standard
General Pool	Health Care	Bed Linen	Blanket	Bassinette
General Pool	Health Care	Bed Linen	Blanket	Cellolite
General Pool	Health Care	Bed Linen	Blanket	Cellular
General Pool	Health Care	Bed Linen	Blanket	Cot
General Pool	Health Care	Bed Linen	Blanket	Sperry
General Pool	Health Care	Bed Linen	Doonas & Quilts	Cover
General Pool	Health Care	Bed Linen	Doonas & Quilts	Insert
General Pool	Health Care	Bed Linen	Pillow Case	Child
General Pool	Health Care	Bed Linen	Pillow Case	Standard
General Pool	Health Care	Bed Linen	Protector	Bedpad
General Pool	Health Care	Bed Linen	Protector	Kylie/Comfort
General Pool	Health Care	Bed Linen	Protector	Mattress
General Pool	Health Care	Bed Linen	Protector	Pinkie
General Pool	Health Care	Bed Linen	Protector	Pinkies
General Pool	Health Care	Bed Linen	Runner	Bed
General Pool	Health Care	Bed Linen	Sheet	Bassinette
General Pool	Health Care	Bed Linen	Sheet	Brake
General Pool	Health Care	Bed Linen	Sheet	Cot
General Pool	Health Care	Bed Linen	Sheet	Double
General Pool	Health Care	Bed Linen	Sheet	Draw
General Pool	Health Care	Bed Linen	Sheet	Envelope
General Pool	Health Care	Bed Linen	Sheet	Fitted
General Pool	Health Care	Bed Linen	Sheet	Single
General Pool	Health Care	Bed Linen	Sheet	Slide
General Pool	Health Care	Bed Linen	Sheet	Slip
General Pool	Health Care	Bed Linen	Sheet	Split
General Pool	Health Care	Bed Linen	Sheet	Standard
General Pool	Health Care	Bed Linen	Sheet	Top
General Pool	Health Care	Cleaning	Mop	Head
General Pool	Health Care	Cleaning	Mop	Pad
General Pool	Health Care	Cleaning	Mop	Screw
General Pool	Health Care	Feeding	Bib	Adult
General Pool	Health Care	Hospital Wear	Apparel	Pyjamas
General Pool	Health Care	Hospital Wear	Apparel	Scrub
General Pool	Health Care	Hospital Wear	Apron	Bib
General Pool	Health Care	Hospital Wear	Apron	Caress
General Pool	Health Care	Hospital Wear	Apron	Standard
General Pool	Health Care	Hospital Wear	Apron	Swab
General Pool	Health Care	Hospital Wear	Baby	Bib
General Pool	Health Care	Hospital Wear	Baby	Feeder
General Pool	Health Care	Hospital Wear	Baby	Gown
General Pool	Health Care	Hospital Wear	Baby	Nappy
General Pool	Health Care	Hospital Wear	Baby	Wrap
General Pool	Health Care	Hospital Wear	Clothing-Baby	Vest
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Pants
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Pyjamas
General Pool	Health Care	Hospital Wear	Clothing-Bottom	Shorts
General Pool	Health Care	Hospital Wear	Clothing-Top	Adults
General Pool	Health Care	Hospital Wear	Clothing-Top	Jacket-Stud
General Pool	Health Care	Hospital Wear	Clothing-Top	Jumper
General Pool	Health Care	Hospital Wear	Clothing-Top	Pyjamas
General Pool	Health Care	Hospital Wear	Curtain	Recycle
General Pool	Health Care	Hospital Wear	Gown	Custom
General Pool	Health Care	Hospital Wear	Gown	Dressing
General Pool	Health Care	Hospital Wear	Gown	Patient
General Pool	Health Care	Hospital Wear	Gown	Theatre
General Pool	Health Care	Hospital Wear	Gown	Utility
General Pool	Health Care	Hospital Wear	Hand Wear	Gloves
General Pool	Health Care	Hospital Wear	Robe	Bath
General Pool	Health Care	Hospital Wear	Rug	Bunny
General Pool	Health Care	Hospital Wear	Scrubs-Bottom	Pants
General Pool	Health Care	Hospital Wear	Scrubs-Top	Top
General Pool	Health Care	Hospital Wear	Uniform-Top	Shirt
General Pool	Health Care	Kitchen Linen	Cloth	Bench
General Pool	Health Care	Kitchen Linen	Cloth	Microfiber
General Pool	Health Care	Kitchen Linen	Cloth	Table
General Pool	Health Care	Kitchen Linen	Towel	Kitchen
General Pool	Health Care	Kitchen Linen	Towel	Tea
General Pool	Health Care	Table Linen	Napkin	Serviette
General Pool	Health Care	Theatre	Clothing-Bottom	Pants
General Pool	Health Care	Theatre	Clothing-Bottom	Surgeon
General Pool	Health Care	Theatre	Curtains & Drapes	Loose
General Pool	Health Care	Theatre	Curtains & Drapes	Mini
General Pool	Health Care	Theatre	Jacket	Warm Up
General Pool	Health Care	Theatre	Pack	Major
General Pool	Health Care	Theatre	Pack	Minor
General Pool	Health Care	Theatre	Pack	Urology
General Pool	Health Care	Theatre	Packs	Surgical
General Pool	Health Care	Theatre	Pop Up	Green
General Pool	Health Care	Theatre	Scrubs-Bottom	Pants
General Pool	Health Care	Theatre	Scrubs-Top	Jacket
General Pool	Health Care	Theatre	Scrubs-Top	Surgeon
General Pool	Health Care	Theatre	Scrubs-Top	Top
General Pool	Health Care	Theatre	Scrubs-Top	Unisex
General Pool	Health Care	Theatre	Scrubs-Top	Urology
General Pool	Health Care	Theatre	Theatre	Squares
General Pool	Linen Hub	Bath Linen	Towel	Bath
General Pool	Linen Hub	Bed Linen	Pillow Case	Standard
General Pool	Linen Hub	Bed Linen	Sheet	Standard
General Pool	Linen Hub	Bed Linen	Sheet	Top
General Pool	Linen Hub	Cleaning	Mop	Head
General Pool	Linen Hub	Kitchen Linen	Napkin	Serviette
General Pool	Mining	Bath Linen	Mat	Bath
General Pool	Mining	Bath Linen	Towel	Bath
General Pool	Mining	Bed Linen	Doonas & Quilts	Cover
General Pool	Mining	Bed Linen	Doonas & Quilts	Insert
General Pool	Mining	Bed Linen	Sheet	Standard
General Pool	Theater	Packs	Theater Pack	
General Pool	Theater	Surgeon Items	Gown	Surgeon
Logistics	Transport	Delivery	Inserts & Liners	Bin Liner
Logistics	Transport	Delivery	Inserts & Liners	Sheet
Logistics	Transport	Delivery	Linen Bags	Bag
Logistics	Transport	Delivery	Linen Bags	Reject
Logistics	Transport	Delivery	Linen Bags	Safety
Logistics	Transport	Delivery	Linen Bags	Soiled
Logistics	Transport	Delivery	Linen Bags	Standard
Logistics	Transport	Delivery	Linen Bags	Zip
Logistics	Transport	Delivery	Trolleys & Tubs	Cage
Logistics	Transport	Delivery	Trolleys & Tubs	Full
Logistics	Transport	Delivery	Trolleys & Tubs	Reject
Logistics	Transport	Delivery	Trolleys & Tubs	Rental
Logistics	Transport	Delivery	Trolleys & Tubs	Soiled
Rental	Accommodation	Bed Linen	Sheet	Flat
Rental	Linen Hub	Bath Linen	Towel	Bath
Rental	Linen Hub	Bed Linen	Blanket	Cellular
Rental	Linen Hub	Bed Linen	Blanket	Fibresmart
Rental	Linen Hub	Charges & Fees	Doonas & Quilts	Cover
Rental	Linen Hub	Cleaning	Mop	Head
Rental	Linen Hub	Theatre	Scrubs-Bottom	Pants
Rental	Linen Hub	Theatre	Scrubs-Top	Jacket
Rental	Linen Hub	Theatre	Scrubs-Top	Top`;

// Node structure: { name: string, children: Map<string, Node> }

// Build Tree
const buildTree = () => {
    const root = { name: 'Root', children: new Map() };

    const lines = RAW_DATA.split('\n').filter(l => l.trim());
    lines.forEach(line => {
        const parts = line.split('\t').map(c => c.trim());
        if (parts.length < 5) return;

        let current = root;
        parts.forEach(part => {
            if (!current.children.has(part.toLowerCase())) {
                current.children.set(part.toLowerCase(), { name: part, children: new Map() });
            }
            current = current.children.get(part.toLowerCase());
        });
    });

    return root;
};

// Generate PL/pgSQL
const generateSQL = () => {
    const root = buildTree();
    const sqlStatements = [];

    sqlStatements.push('DO $$');
    sqlStatements.push('DECLARE');
    sqlStatements.push('  l_pool_id uuid;');
    sqlStatements.push('  l_catalog_id uuid;');
    sqlStatements.push('  l_type_id uuid;');
    sqlStatements.push('  l_cat_id uuid;');
    sqlStatements.push('  l_sub_id uuid;');
    sqlStatements.push('BEGIN');

    // Traverse
    // Level 1: Pool
    root.children.forEach((poolNode) => {
        const poolName = poolNode.name;
        sqlStatements.push(`  -- POOL: ${poolName}`);
        sqlStatements.push(`  SELECT id INTO l_pool_id FROM attribute_options WHERE type = 'POOL' AND lower(value) = '${poolName.toLowerCase()}';`);
        sqlStatements.push(`  IF l_pool_id IS NULL THEN`);
        sqlStatements.push(`    INSERT INTO attribute_options (type, value, label) VALUES ('POOL', '${poolName}', '${poolName}') RETURNING id INTO l_pool_id;`);
        sqlStatements.push(`  END IF;`);

        // Level 2: Catalog
        poolNode.children.forEach((catNode) => {
            const catName = catNode.name;
            sqlStatements.push(`    -- CATALOG: ${catName}`);
            // Logic: Lookup or Insert. Update parent_ids if needed.
            sqlStatements.push(`    SELECT id INTO l_catalog_id FROM attribute_options WHERE type = 'CATALOG' AND lower(value) = '${catName.toLowerCase()}';`);
            sqlStatements.push(`    IF l_catalog_id IS NULL THEN`);
            sqlStatements.push(`      INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATALOG', '${catName}', '${catName}', ARRAY[l_pool_id]) RETURNING id INTO l_catalog_id;`);
            sqlStatements.push(`    ELSE`);
            sqlStatements.push(`      -- Append parent if not present`);
            sqlStatements.push(`      UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_pool_id) WHERE id = l_catalog_id AND NOT (parent_ids @> ARRAY[l_pool_id]);`);
            sqlStatements.push(`    END IF;`);

            // Level 3: Type
            catNode.children.forEach((typeNode) => {
                const typeName = typeNode.name;
                sqlStatements.push(`      -- TYPE: ${typeName}`);
                sqlStatements.push(`      SELECT id INTO l_type_id FROM attribute_options WHERE type = 'TYPE' AND lower(value) = '${typeName.toLowerCase()}';`);
                sqlStatements.push(`      IF l_type_id IS NULL THEN`);
                sqlStatements.push(`        INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('TYPE', '${typeName}', '${typeName}', ARRAY[l_catalog_id]) RETURNING id INTO l_type_id;`);
                sqlStatements.push(`      ELSE`);
                sqlStatements.push(`        UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_catalog_id) WHERE id = l_type_id AND NOT (parent_ids @> ARRAY[l_catalog_id]);`);
                sqlStatements.push(`      END IF;`);

                // Level 4: Category
                typeNode.children.forEach((cNode) => {
                    const cName = cNode.name;
                    sqlStatements.push(`        -- CATEGORY: ${cName}`);
                    sqlStatements.push(`        SELECT id INTO l_cat_id FROM attribute_options WHERE type = 'CATEGORY' AND lower(value) = '${cName.toLowerCase()}';`);
                    sqlStatements.push(`        IF l_cat_id IS NULL THEN`);
                    sqlStatements.push(`          INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('CATEGORY', '${cName}', '${cName}', ARRAY[l_type_id]) RETURNING id INTO l_cat_id;`);
                    sqlStatements.push(`        ELSE`);
                    sqlStatements.push(`          UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_type_id) WHERE id = l_cat_id AND NOT (parent_ids @> ARRAY[l_type_id]);`);
                    sqlStatements.push(`        END IF;`);

                    // Level 5: SubCategory
                    cNode.children.forEach((subNode) => {
                        const subName = subNode.name;
                         sqlStatements.push(`          -- SUB_CATEGORY: ${subName}`);
                         sqlStatements.push(`          SELECT id INTO l_sub_id FROM attribute_options WHERE type = 'SUB_CATEGORY' AND lower(value) = '${subName.toLowerCase()}';`);
                         sqlStatements.push(`          IF l_sub_id IS NULL THEN`);
                         sqlStatements.push(`            INSERT INTO attribute_options (type, value, label, parent_ids) VALUES ('SUB_CATEGORY', '${subName}', '${subName}', ARRAY[l_cat_id]) RETURNING id INTO l_sub_id;`);
                         sqlStatements.push(`          ELSE`);
                         sqlStatements.push(`            UPDATE attribute_options SET parent_ids = array_append(parent_ids, l_cat_id) WHERE id = l_sub_id AND NOT (parent_ids @> ARRAY[l_cat_id]);`);
                         sqlStatements.push(`          END IF;`);
                    });
                });
            });
        });
    });

    sqlStatements.push('END $$;');
    
    return sqlStatements.join('\n');
};

const sql = generateSQL();
fs.writeFileSync('seed_hierarchy.sql', sql);
console.log('Generated seed_hierarchy.sql');
