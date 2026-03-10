import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelivery() {
    // 1. Get a PO
    const { data: pos, error: poErr } = await supabase.from('po_requests').select('id').limit(1);
    if (poErr) {
        console.error("Error fetching PO", poErr);
        return;
    }
    const poId = pos[0].id;

    // 2. Get a PO line
    const { data: lines, error: lineErr } = await supabase.from('po_lines').select('id').eq('po_request_id', poId).limit(1);
    const lineId = lines && lines.length > 0 ? lines[0].id : null;

    if (!lineId) {
        console.error("No PO line found for PO", poId);
        return;
    }

    const deliveryId = crypto.randomUUID();
    const lineDeliveryId = crypto.randomUUID();

    console.log("Creating delivery...");
    
    // 3. Try to insert
    const { error: headerError } = await supabase.from('deliveries').insert({
        id: deliveryId,
        po_request_id: poId,
        date: new Date().toISOString(),
        docket_number: 'TEST-123',
        received_by: 'Test User'
    });
        
    if (headerError) {
        console.error("Header Error:", headerError);
        return;
    }

    const { error: linesError } = await supabase.from('delivery_lines').insert([{
        id: lineDeliveryId,
        delivery_id: deliveryId,
        po_line_id: lineId,
        quantity: 1,
        invoice_number: '',
        is_capitalised: false
    }]);

    if (linesError) {
        console.error("Lines Error:", linesError);
    } else {
        console.log("Success!");
    }
    
    // Clean up
    await supabase.from('delivery_lines').delete().eq('id', lineDeliveryId);
    await supabase.from('deliveries').delete().eq('id', deliveryId);
}

testDelivery();
