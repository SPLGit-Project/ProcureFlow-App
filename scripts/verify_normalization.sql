-- 1. Check for missing norms in Items
SELECT id, sku, sap_item_code_norm 
FROM items 
WHERE sap_item_code_norm IS NULL;

-- 2. Check for missing norms in Snapshots
SELECT id, customer_stock_code, customer_stock_code_norm 
FROM stock_snapshots 
WHERE customer_stock_code IS NOT NULL AND customer_stock_code != '' AND customer_stock_code_norm IS NULL;

-- 3. Check for duplicates in Master Item Norms (Should be enforced by UNIQUE Index, but good to check)
SELECT sap_item_code_norm, COUNT(*) 
FROM items 
WHERE sap_item_code_norm IS NOT NULL 
GROUP BY sap_item_code_norm 
HAVING COUNT(*) > 1;

-- 4. Sample Match Logic Test
SELECT 
    s.supplier_sku, 
    s.customer_stock_code, 
    s.customer_stock_code_norm,
    i.sku AS matched_item_sku,
    i.sap_item_code_norm AS matched_item_norm
FROM stock_snapshots s
JOIN items i ON s.customer_stock_code_norm = i.sap_item_code_norm
LIMIT 20;

-- 5. Alternate Match Logic Test
SELECT 
    s.supplier_sku, 
    s.customer_stock_code, 
    s.customer_stock_code_alt_norm,
    i.sku AS matched_item_sku,
    i.sap_item_code_norm AS matched_item_norm
FROM stock_snapshots s
JOIN items i ON s.customer_stock_code_alt_norm = i.sap_item_code_norm
LIMIT 20;
