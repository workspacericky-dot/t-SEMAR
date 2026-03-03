import { createClient } from '@supabase/supabase-js';

// Setup Supabase admin client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanGroups() {
    console.log('Fetching all auth users...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
    }

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

        const validMembers = g.members.filter((id: string) => validIds.has(id));

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
