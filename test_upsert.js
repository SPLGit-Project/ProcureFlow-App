import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // 1. Get a PENDING_APPROVAL PO
    const { data: po, error: poErr } = await supabase
        .from('po_requests')
        .select('id, status')
        .eq('status', 'PENDING_APPROVAL')
        .limit(1)
        .single();
        
    if (poErr) {
        console.error("No pending PO found", poErr);
        return;
    }
    
    console.log("Found PO:", po.id);
    
    const { data: lines, error: linesErr } = await supabase
        .from('po_lines')
        .select('id, item_id, sku, item_name, quantity_ordered, unit_price, total_price')
        .eq('po_request_id', po.id);
        
    console.log("Existing lines:", lines.length);
    
    // Add a dummy line
    const dummyLine = {
        id: '12345678-1234-1234-1234-123456789012', // standard uuid format
        po_request_id: po.id,
        item_id: lines[0].item_id, // reuse same item just to be safe with FK
        sku: 'TEST-SKU',
        item_name: 'TEST ITEM',
        quantity_ordered: 1,
        unit_price: 10,
        total_price: 10
    };
    
    console.log("Upserting dummy line...");
    const { error: upsertErr } = await supabase
        .from('po_lines')
        .upsert([dummyLine], { onConflict: 'id' });
        
    console.log("Upsert error:", upsertErr);
    
    const { data: linesAfter } = await supabase
        .from('po_lines')
        .select('*')
        .eq('po_request_id', po.id);
        
    console.log("Lines after:", linesAfter.length);
    
    // Cleanup
    await supabase.from('po_lines').delete().eq('id', dummyLine.id);
}

test().catch(console.error);
