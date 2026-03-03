const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Very brittle env load just for this temp script
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        let val = parts.slice(1).join('=').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[parts[0].trim()] = val;
    }
});

const supabase = createClient(
    env['NEXT_PUBLIC_SUPABASE_URL'],
    env['SUPABASE_SERVICE_ROLE_KEY']
);

async function cleanGroups() {
    console.log('Fetching all auth users...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

    // Explicitly destructure out the users array correctly
    const validIds = new Set(usersData.users.map(u => u.id));
    console.log(`Found ${validIds.size} valid user records.`);

    console.log('Fetching all groups...');
    const { data: groups, error: groupsError } = await supabase.from('groups').select('id, members, name');

    if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        return;
    }

    let cleaned = 0;
    for (const g of groups) {
        if (!g.members) continue;

        const validMembers = g.members.filter(id => validIds.has(id));

        if (validMembers.length !== g.members.length) {
            console.log(`Group ${g.name} (${g.id}): Cleaning ${g.members.length - validMembers.length} ghost members.`);
            const { error: updateError } = await supabase.from('groups').update({ members: validMembers }).eq('id', g.id);
            if (updateError) {
                console.error(`Error updating group ${g.name}:`, updateError);
            } else {
                cleaned++;
            }
        }
    }

    console.log(`Cleanup complete. Groups affected: ${cleaned}`);
}

cleanGroups();
