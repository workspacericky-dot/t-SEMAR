'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

interface OnboardingData {
    userId: string;
    fullName: string;
    avatarUrl: string;
    trainingGroup: number;
    profileExists: boolean;
}

export async function completeOnboarding(data: OnboardingData) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { error: 'Server configuration error: Missing Service Role Key.' };
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { userId, fullName, avatarUrl, trainingGroup, profileExists } = data;

        // 1. Update or Insert Profile
        if (profileExists) {
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    training_group: trainingGroup,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: userId,
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    training_group: trainingGroup,
                    role: 'auditor', // default starting role if created here
                    updated_at: new Date().toISOString(),
                });

            if (insertError) throw insertError;
        }

        // 2. Find Active Period
        const { data: activePeriod, error: periodError } = await supabaseAdmin
            .from('audit_periods')
            .select('id')
            .eq('is_active', true)
            .single();

        if (!periodError && activePeriod) {
            // 3. Find the matching Training Group
            const { data: group, error: groupError } = await supabaseAdmin
                .from('groups')
                .select('id, members')
                .eq('period_id', activePeriod.id)
                .eq('group_number', trainingGroup)
                .single();

            if (!groupError && group) {
                // 4a. Group exists, Inject User into Group Members safely
                const currentMembers = group.members || [];
                if (!currentMembers.includes(userId)) {
                    const newMembers = [...currentMembers, userId];
                    const { error: updateGroupError } = await supabaseAdmin
                        .from('groups')
                        .update({ members: newMembers })
                        .eq('id', group.id);

                    if (updateGroupError) throw updateGroupError;
                }
            } else if (groupError || !group) {
                // 4b. Group does NOT exist in this period, let's gracefully Auto-create it!
                const { error: insertGroupError } = await supabaseAdmin
                    .from('groups')
                    .insert({
                        period_id: activePeriod.id,
                        name: `Kelompok ${trainingGroup}`,
                        group_number: trainingGroup,
                        members: [userId],
                        lead_student_id: null,
                    });

                if (insertGroupError) throw insertGroupError;
            }

            // 5. Upgrade User Role to Participant
            // (Always happens if period was active and they successfully joined/created a group)
            const { error: upgradeRoleError } = await supabaseAdmin
                .from('profiles')
                .update({ role: 'participant' })
                .eq('id', userId);

            if (upgradeRoleError) throw upgradeRoleError;
        }

        revalidatePath('/dashboard');
        return { success: true };

    } catch (error: any) {
        console.error('Complete Onboarding Error:', error);
        return { error: error.message || 'Failed to complete onboarding' };
    }
}
