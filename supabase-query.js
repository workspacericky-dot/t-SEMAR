const { createClient } = require('@supabase/supabase-js');

// Load env vars
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    // We execute sql via rpc or generic fallback if possible, 
    // but the safest way without migrations is via the REST API or Dashboard.
    // Let's attempt to see if there's any active rpc we can hijack for DDL, otherwise we'll instruct the user.
    console.log("Since Supabase REST API doesn't allow direct DDL (ALTER TABLE), you should execute this SQL in your Supabase SQL Editor:");
    console.log(`
-- Add teacher_score column to audit_items
ALTER TABLE public.audit_items ADD COLUMN IF NOT EXISTS teacher_score numeric(5,2) DEFAULT 0;
    `);
}

main().catch(console.error);
