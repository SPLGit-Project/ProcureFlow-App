const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// 1. Load Environment Variables (Robust Parser)
function loadEnv(filePath) {
    if (fs.existsSync(filePath)) {
        console.log(`Loading env from ${path.basename(filePath)}`);
        const content = fs.readFileSync(filePath, 'utf8');
        // Handle standard newlines
        const lines = content.split(/\r?\n/);
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            // Split on first =
            const idx = trimmed.indexOf('=');
            if (idx === -1) return;

            const key = trimmed.substring(0, idx).trim();
            let value = trimmed.substring(idx + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            if (!process.env[key]) {
                process.env[key] = value;
                // console.log(`Loaded ${key}`); // Debug
            }
        });
    } else {
        // console.log(`Skipped ${path.basename(filePath)} (not found)`);
    }
}

// Try loading various env files
const projectRoot = path.resolve(__dirname, '..');
loadEnv(path.join(projectRoot, '.env.local'));
loadEnv(path.join(projectRoot, '.env'));
loadEnv(path.join(projectRoot, '.env.staging')); // Fallback

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY/SERVICE_ROLE_KEY');
    console.error('Available Keys:', Object.keys(process.env).filter(k => k.startsWith('VITE_')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Canonical Mapping
const MAPPING = {
    'SAP_Item_Code':    { db: 'sku',          ts: 'sku',          type: 'text' }, // or sap_item_code_raw
    'Item':             { db: 'name',         ts: 'name',         type: 'text' },
    'Item_Weight':      { db: 'item_weight',  ts: 'itemWeight',   type: 'number' },
    'Item_Pool':        { db: 'item_pool',    ts: 'itemPool',     type: 'text' },
    'Item_Catalog':     { db: 'item_catalog', ts: 'itemCatalog',  type: 'text' },
    'Item_Type':        { db: 'item_type',    ts: 'itemType',     type: 'text' },
    'Item_Category':    { db: 'category',     ts: 'category',     type: 'text' },
    'Item_Subcategory': { db: 'sub_category', ts: 'subCategory',  type: 'text' },
    'RFID':             { db: 'rfid_flag',    ts: 'rfidFlag',     type: 'boolean' },
    'Item_Colour':      { db: 'item_colour',  ts: 'itemColour',   type: 'text' },
    'item_Pattern':     { db: 'item_pattern', ts: 'itemPattern',  type: 'text' },
    'Item_Material':    { db: 'item_material',ts: 'itemMaterial', type: 'text' },
    'Item_Size':        { db: 'item_size',    ts: 'itemSize',     type: 'text' },
    'Measurements':     { db: 'measurements', ts: 'measurements', type: 'text' },
    'COG':              { db: 'cog_flag',     ts: 'cogFlag',      type: 'boolean' },
    'COG_Customer':     { db: 'cog_customer', ts: 'cogCustomer',  type: 'text' }
};

// Normalizer Helper
function normalizeItemCode(code) {
    if (!code) return { normalized: '', alternate: null };
    const str = String(code).trim().toUpperCase();
    const normalized = str.replace(/[^A-Z0-9]/g, '');
    let alternate = null;
    if (normalized.startsWith('R') && normalized.length > 1 && !isNaN(parseInt(normalized.substring(1)))) {
        alternate = normalized.substring(1);
    }
    return { normalized, alternate };
}

async function run() {
    console.log('Starting Master Item Sync...');
    // ... file reading ...
    const filePath = path.join(projectRoot, 'Resources', 'products.xlsx');
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(ws);
    console.log(`Found ${jsonData.length} rows.`);

    // 4. Transform Data
    const inputs = jsonData.map(row => {
        const item = {};
        
        Object.entries(MAPPING).forEach(([header, map]) => {
            let val = row[header];
            
            // Type Coercion
            if (map.type === 'number') val = parseFloat(val) || 0;
            if (map.type === 'boolean') {
                const s = String(val).toLowerCase();
                val = (s === 'true' || s === '1' || s === 'yes' || s === 'y');
            }
            if (val === undefined || val === null) {
                if (map.type === 'text') val = '';
            }
            item[map.db] = val;
        });
        
        if (!item.description) item.description = item.name;
        return item;
    });

    const validInputs = inputs.filter(i => i.sku && i.name);
    console.log(`Valid items to sync: ${validInputs.length}`);

    // DB Ops
    const timestamp = new Date().toISOString();
    const batchSize = 500;
    let processedCount = 0;
    
    // Registry Preparation: Use TS keys
    const registryPayload = Object.values(MAPPING).map(m => ({
        field_key: m.ts,
        label: m.ts.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        data_type: m.type,
        is_visible: true,
        is_filterable: true
    }));

    console.log('Fetching existing items...');
    const { data: existingItems, error: fetchError } = await supabase.from('items').select('id, sap_item_code_norm');
    if (fetchError) throw fetchError;
    const existingMap = new Map(existingItems.map(i => [i.sap_item_code_norm, i.id]));
    const processedNorms = new Set();
    const payloadMap = new Map();

    for (const input of validInputs) {
        const norm = normalizeItemCode(input.sku);
        if (!norm.normalized) continue;

        processedNorms.add(norm.normalized);
        const existingId = existingMap.get(norm.normalized);

        const payload = {
            ...input,
            sap_item_code_raw: input.sku,
            sap_item_code_norm: norm.normalized,
            updated_at: timestamp,
            active_flag: true
        };
        if (existingId) payload.id = existingId;
        payloadMap.set(norm.normalized, payload);
    }
    const upsertPayload = Array.from(payloadMap.values());

    console.log('Clearing old Item Field Registry...');
    const { error: clearErr } = await supabase.from('item_field_registry').delete().neq('field_key', '_KEEP_NONE_');
    if (clearErr) console.warn('Registry clear warning:', clearErr.message);

    console.log('Updating Item Field Registry...');
    const { error: regError } = await supabase.from('item_field_registry').upsert(registryPayload, { onConflict: 'field_key' });
    if (regError) console.warn('Registry update warning:', regError.message);

    console.log(`Upserting ${upsertPayload.length} items...`);
    for (let i = 0; i < upsertPayload.length; i += batchSize) {
        const batch = upsertPayload.slice(i, i + batchSize);
        // We rely on sap_item_code_norm being unique. 
        // If ID is present, it updates. If not, it inserts.
        // HOWEVER: 'items' table might require ID on insert if not auto-generated? 
        // Usually UUID is auto-gen default.
        // We match on `sap_item_code_norm`? Supabase upsert requires primary key or specified onConflict constraint.
        // Let's specify onConflict.
        
        const { error } = await supabase
            .from('items')
            .upsert(batch, { onConflict: 'sap_item_code_norm' });
            
        if (error) {
            console.error('Batch error:', error.message);
        } else {
            processedCount += batch.length;
            process.stdout.write(`.`);
        }
    }
    console.log('\n');

    // Deactivate Missing
    console.log('Deactivating missing items...');
    const missingIds = existingItems
        .filter(i => i.sap_item_code_norm && !processedNorms.has(i.sap_item_code_norm))
        .map(i => i.id);

    if (missingIds.length > 0) {
        const { error: deactError } = await supabase.from('items').update({ active_flag: false }).in('id', missingIds);
        if (deactError) console.error('Deactivation error:', deactError.message);
        else console.log(`Deactivated ${missingIds.length} items.`);
    } else {
        console.log('No items to deactivate.');
    }

    console.log('Sync Complete.');
}

run().catch(e => console.error(e));
