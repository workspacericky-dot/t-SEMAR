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

async function testCreatePeriod() {
    console.log('Testing createPeriod automation...');

    const name = `Test Period ${Date.now()}`;
    const year = 2026;

    // 1. Create the period
    const { data: period, error: periodError } = await supabase
        .from('audit_periods')
        .insert({ name, year, is_active: true })
        .select()
        .single();

    if (periodError) {
        console.error('Error creating period:', periodError);
        return;
    }
    console.log(`Created Period: ${period.id}`);

    // Simulate the server action logic
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, training_group')
        .neq('role', 'superadmin')
        .not('training_group', 'is', null);

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
    }

    if (profiles && profiles.length > 0) {
        const groupedProfiles = {};
        profiles.forEach(profile => {
            const groupNum = profile.training_group;
            if (groupNum) {
                if (!groupedProfiles[groupNum]) groupedProfiles[groupNum] = [];
                groupedProfiles[groupNum].push(profile.id);
            }
        });

        const groupsToInsert = Object.entries(groupedProfiles).map(([groupNumStr, memberIds]) => {
            const groupNum = parseInt(groupNumStr, 10);
            return {
                period_id: period.id,
                name: `Kelompok ${groupNum}`,
                group_number: groupNum,
                members: memberIds,
                lead_student_id: null,
            };
        });

        if (groupsToInsert.length > 0) {
            const { data: insertedGroups, error: insertGroupsError } = await supabase
                .from('groups')
                .insert(groupsToInsert)
                .select();

            if (insertGroupsError) {
                console.error("Failed to auto-create groups:", insertGroupsError);
            } else {
                console.log(`Successfully created ${insertedGroups.length} groups automatically.`);
                console.log(insertedGroups.map(g => `${g.name} (${g.members.length} members)`).join('\n'));
            }
        }
    }
}

testCreatePeriod();
