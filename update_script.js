const fs = require('fs');
const file = 'src/lib/actions/user-actions.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `        // 2. Delete Auth User (this is the big one)
        const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
        if (error) throw error;`;

const replacement = `        // 2. Clear user from any Groups 'members' array
        const { data: groupsWithUser } = await getSupabaseAdmin()
            .from('groups')
            .select('id, members, lead_student_id');
            
        if (groupsWithUser) {
            for (const group of groupsWithUser) {
                if (group.members && group.members.includes(userId)) {
                    const newMembers = group.members.filter((id) => id !== userId);
                    const updateData: any = { members: newMembers };
                    if (group.lead_student_id === userId) {
                        updateData.lead_student_id = null;
                    }
                    await getSupabaseAdmin()
                        .from('groups')
                        .update(updateData)
                        .eq('id', group.id);
                }
            }
        }

        // 3. Delete Auth User (this is the big one)
        const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
        if (error) throw error;`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Migration successful");
} else {
    console.log("Target string not found in file");
}
