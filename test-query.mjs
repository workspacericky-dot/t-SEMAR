import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function run() {
    const log = {};
    const ketuaId = '9644ef7b-31d3-4a50-93bb-6e8862cf931d';

    const groupIds = ['123e4567-e89b-12d3-a456-426614174000'];

    let query = supabase
        .from('audits')
        .select('id, individual_auditor_id, auditor_group_id, auditee_group_id')
        .order('created_at', { ascending: false });

    const conditions = ['individual_auditor_id.eq.' + ketuaId];

    if (groupIds.length > 0) {
        const groupList = '(' + groupIds.join(',') + ')';
        conditions.push('auditor_group_id.in.' + groupList);
        conditions.push('auditee_group_id.in.' + groupList);
    }

    const orString = conditions.join(',');
    log.orString = orString;
    query = query.or(orString);

    const { data: audits, error: auditsError } = await query;
    log.auditsError = auditsError;
    log.auditsCount = audits ? audits.length : 0;

    fs.writeFileSync('output2.json', JSON.stringify(log, null, 2));
}

run().catch(console.error);
