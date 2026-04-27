
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const recordId = 'BR05'; // Example ID from screenshot (though it's likely a UUID in DB)
    // Actually, let's try to get ANY log first to see if the table and join work.
    
    console.log('--- Testing basic select ---');
    const { data: d1, error: e1 } = await supabase
        .from('system_audit_logs')
        .select('*')
        .limit(1);
    console.log('Basic select error:', e1);
    console.log('Basic select data count:', d1?.length);

    console.log('\n--- Testing join ---');
    const { data: d2, error: e2 } = await supabase
        .from('system_audit_logs')
        .select('*, performer:users(name)')
        .limit(1);
    console.log('Join error:', e2);
    
    console.log('\n--- Testing JSON filter (eq) ---');
    const { data: d3, error: e3 } = await supabase
        .from('system_audit_logs')
        .select('*')
        .filter('summary->>recordId', 'eq', 'test-id')
        .limit(1);
    console.log('JSON filter (->>) error:', e3);

    console.log('\n--- Testing JSON filter (->) ---');
    const { data: d4, error: e4 } = await supabase
        .from('system_audit_logs')
        .select('*')
        .filter('summary->recordId', 'eq', 'test-id')
        .limit(1);
    console.log('JSON filter (->) error:', e4);
}

testQuery();
