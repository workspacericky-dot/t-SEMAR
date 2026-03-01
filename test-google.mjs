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
    const { data: users } = await supabase.from('profiles').select('*');

    log.totalUsers = users?.length || 0;

    const googleUsers = users?.filter(u => u.avatar_url && u.avatar_url.includes('googleusercontent')) || [];
    log.googleUsersCount = googleUsers.length;

    const ketua = users?.find(u => u.role === 'ketua kelompok' && u.avatar_url && u.avatar_url.includes('googleusercontent'));

    if (ketua) {
        log.ketua = { id: ketua.id, name: ketua.full_name, role: ketua.role };
        const { data: groups } = await supabase.from('groups').select('*').contains('members', [ketua.id]);
        log.groupsCount = groups?.length || 0;
        if (groups && groups.length > 0) {
            log.groups = groups.map(g => g.name);
        }
    } else {
        log.ketua = null;
        log.message = 'No google-based ketua kelompok found.';
        const anyKetua = users?.find(u => u.role === 'ketua kelompok');
        log.anyKetua = anyKetua ? { name: anyKetua.full_name, id: anyKetua.id, avatar: anyKetua.avatar_url } : null;
    }

    fs.writeFileSync('output-google.json', JSON.stringify(log, null, 2));
}

run().catch(console.error);
