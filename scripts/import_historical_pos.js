
import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yasosgkznoxamysutxfc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be Service Role Key to bypass RLS if needed, or valid user key

if (!SUPABASE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
    console.error('Please run with: Set-Item -Path Env:SUPABASE_SERVICE_ROLE_KEY -Value "your_key"; node scripts/import_historical_pos.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// File Path
const filePath = path.join(process.cwd(), 'Resources', 'MKY-PO tracking July 2025_Current.xlsx');

// Mappings
// Hardcoded 'Aaron Bell' ID for requester (fetched previously)
const REQUESTER_ID = 'a6e2810c-2b85-4ee1-81cb-a6fe3cc71378'; 
// Hardcoded 'SPL Mackay' Site ID (fetched previously)
const SITE_ID = '33333333-3333-4333-8333-333333333333'; 

// Excel Serial Date to JS Date
function excelDateToJSDate(serial) {
    if (!serial) return null;
   const utc_days  = Math.floor(serial - 25569);
   const utc_value = utc_days * 86400;                                        
   const date_info = new Date(utc_value * 1000);
   return date_info;
}

async function main() {
    console.log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet); // Array of objects

    console.log(`Found ${rows.length} rows.`);

    // 1. Fetch Items for SKU mapping
    console.log('Fetching Items mapping...');
    const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, sku');
    
    if (itemsError) {
        console.error('Error fetching items:', itemsError);
        process.exit(1);
    }

    const itemMap = new Map(); // SKUC -> ID
    itemsData.forEach(i => {
        if (i.sku) itemMap.set(i.sku.trim(), i.id);
    });
    console.log(`Loaded ${itemMap.size} items.`);

    // 2. Fetch Suppliers for mapping (optional, but good for validation)
    // For now we assume items are linked to suppliers, so we just need item_id.

    // 3. Group Rows by PO Number
    const poGroups = {};
    rows.forEach(row => {
        const poNum = row['PO #'];
        if (!poNum) return; // Skip empty POs

        if (!poGroups[poNum]) {
            poGroups[poNum] = {
                poNum: poNum,
                site: row['Site'], // Just for logging
                date: excelDateToJSDate(row['Order Date']),
                status: row['Order Status'] === 'Received in Full' ? 'COMPLETED' : 'PENDING_DELIVERY', // Default mapping
                lines: []
            };
        }
        poGroups[poNum].lines.push(row);
    });

    const poNumbers = Object.keys(poGroups);
    console.log(`Identified ${poNumbers.length} unique POs.`);

    // 4. Process each PO
    for (const poNum of poNumbers) {
        const poData = poGroups[poNum];
        console.log(`Processing ${poNum}...`);

        // Calculate total amount
        const totalAmount = poData.lines.reduce((sum, line) => sum + (line['Total Order Price'] || 0), 0);

        // A. Insert PO Request
        // Check if exists first to avoid dupes?
        // Ideally we use display_id as unique key, but Supabase default doesn't enforce unique display_id unless we did.
        // Let's check first.
        const { data: existingPO } = await supabase
            .from('po_requests')
            .select('id')
            .eq('display_id', poNum)
            .maybeSingle();

        let poId;
        if (existingPO) {
            console.log(`  PO ${poNum} already exists (ID: ${existingPO.id}). Skipping header insert.`);
            poId = existingPO.id;
        } else {
            const { data: newPO, error: poError } = await supabase
                .from('po_requests')
                .insert({
                    display_id: poNum,
                    status: poData.status,
                    request_date: poData.date,
                    requester_id: REQUESTER_ID,
                    site_id: SITE_ID,
                    total_amount: totalAmount,
                    customer_name: 'Civeo', // Hardcoded from Excel sample
                    reason_for_request: 'Historical Import'
                })
                .select()
                .single();

            if (poError) {
                console.error(`  Error creating PO ${poNum}:`, poError.message);
                continue;
            }
            poId = newPO.id;
            console.log(`  Created PO ${poNum} (ID: ${poId})`);
        }

        // B. Insert Lines
        for (const line of poData.lines) {
            const sku = line['Product Code'];
            const itemId = itemMap.get(sku);

            if (!itemId) {
                console.warn(`  Warning: SKU '${sku}' not found in DB. Skipping line.`);
                continue;
            }

            // Check if line exists (composite check hard, simplistic approach: skip if PO existed? 
            // Or just try insert. Let's assume clean slate or duplicate items allowed on PO.)
            // For historical integrity, we only insert if we just created the PO OR if we are sure it's not there.
            // To be safe, if PO existed, we skip line insertion to avoid double counting.
            if (existingPO) continue; 

            const qtyOrdered = line['Order QTY'] || 0;
            const unitPrice = line['Unit Price'] || 0;
            const totalPrice = line['Total Order Price'] || 0;
            // If completed, received = ordered
            const qtyReceived = poData.status === 'COMPLETED' ? qtyOrdered : (line['QTY Received'] || 0);

            const { data: newLine, error: lineError } = await supabase
                .from('po_lines')
                .insert({
                    po_request_id: poId,
                    item_id: itemId,
                    sku: sku,
                    item_name: line['Product Description'],
                    quantity_ordered: qtyOrdered,
                    quantity_received: qtyReceived,
                    unit_price: unitPrice,
                    total_price: totalPrice
                })
                .select()
                .single();

            if (lineError) {
                console.error(`  Error creating line for SKU ${sku}:`, lineError.message);
                continue;
            }

            // C. Asset Capitalization
            // Logic: If 'Capitalized Month' has data (it is not empty/null)
            if (line['Capitalized Month']) {
                const capDate = excelDateToJSDate(line['Capitalized Month']);
                const comment = line['Capitalized Comments'];
                
                // GL Code logic? Not in Excel. We might need a default or placeholder.
                const glCode = 'UNKNOWN-HISTORICAL'; 

                const { error: capError } = await supabase
                    .from('asset_capitalization')
                    .insert({
                        po_line_id: newLine.id,
                        gl_code: glCode,
                        asset_tag: `AST-${poNum}-${sku}`, // Synthesize a tag
                        capitalized_date: capDate,
                        comments: comment
                    });
                
                if (capError) {
                    console.error(`  Error creating asset record:`, capError.message);
                } else {
                    console.log(`    + Capitalized Asset created.`);
                }
            }
        }
    }
    console.log('Done.');
}

main().catch(err => console.error(err));
