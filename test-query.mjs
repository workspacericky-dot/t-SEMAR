import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// Simulate getUserAudits for rickyworkspacedude (Kelompok 1 leader)
const userId = 'd8ea9db1-c294-4cb2-82ef-6c624e760982';

async function testGetUserAudits() {
    console.log('=== Step 1: Fetch groups containing the user ===');
    const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .contains('members', [userId]);

    if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        return;
    }
    console.log('Groups found:', groups);

    const groupIds = groups.map(g => g.id);
    console.log('Group IDs:', groupIds);

    console.log('\n=== Step 2: Build and execute audit query ===');

    const conditions = [`individual_auditor_id.eq.${userId}`];
    if (groupIds.length > 0) {
        const groupList = `(${groupIds.join(',')})`;
        conditions.push(`auditor_group_id.in.${groupList}`);
        conditions.push(`auditee_group_id.in.${groupList}`);
    }

    const orFilter = conditions.join(',');
    console.log('OR filter:', orFilter);

    const { data: audits, error: auditsError } = await supabase
        .from('audits')
        .select(`
            *,
            auditor_group:groups!audits_auditor_group_id_fkey(id, name),
            auditee_group:groups!audits_auditee_group_id_fkey(id, name),
            individual_auditor:profiles!audits_individual_auditor_id_fkey(id, full_name),
            period:audit_periods(name, year)
        `)
        .or(orFilter)
        .order('created_at', { ascending: false });

    if (auditsError) {
        console.error('Error fetching audits:', JSON.stringify(auditsError, null, 2));
        return;
    }

    console.log('Audits found:', JSON.stringify(audits, null, 2));
}

testGetUserAudits();
