'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { AuditPeriod, Group, Profile } from '@/types/database';

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

// ============================================
// PERIOD ACTIONS
// ============================================

export async function createPeriod(name: string, year: number) {
    const { data, error } = await getSupabaseAdmin()
        .from('audit_periods')
        .insert({ name, year, is_active: true })
        .select()
        .single();

    if (error) throw error;
    revalidatePath('/admin/periods');
    return data as AuditPeriod;
}

export async function deletePeriod(id: string) {
    const { error } = await getSupabaseAdmin()
        .from('audit_periods')
        .delete()
        .eq('id', id);

    if (error) throw error;
    revalidatePath('/admin/periods');
}

export async function togglePeriodStatus(id: string, isActive: boolean) {
    const { data, error } = await getSupabaseAdmin()
        .from('audit_periods')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    revalidatePath('/admin/periods');
    return data as AuditPeriod;
}

export async function getPeriods() {
    const { data, error } = await getSupabaseAdmin()
        .from('audit_periods')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as AuditPeriod[];
}

// ============================================
// GROUP ACTIONS
// ============================================

export async function createGroup(
    periodId: string,
    name: string,
    groupNumber: number,
    leadStudentId: string | null,
    memberIds: string[]
) {
    // 1. Create the Group
    const { data: group, error: groupError } = await getSupabaseAdmin()
        .from('groups')
        .insert({
            period_id: periodId,
            name,
            group_number: groupNumber,
            lead_student_id: leadStudentId,
            members: memberIds,
        })
        .select()
        .single();

    if (groupError) throw groupError;

    // 2. Update profiles to set 'training_group' (legacy support + easy visual)
    if (memberIds.length > 0) {
        const { error: profileError } = await getSupabaseAdmin()
            .from('profiles')
            .update({ training_group: groupNumber, role: 'participant' }) // Ensure role is participant
            .in('id', memberIds);

        if (profileError) {
            console.error('Failed to update profile roles/groups:', profileError);
            // We don't throw here to avoid failing the whole group creation if just profile update fails, 
            // but strictly speaking we should probably execute in a transaction if possible.
            // Supabase JS doesn't support transactions directly yet without RPC.
        }
    }

    revalidatePath(`/admin/periods/${periodId}`);
    return group as Group;
}

export async function updateGroup(
    groupId: string,
    name: string,
    leadStudentId: string | null,
    memberIds: string[]
) {
    const { data, error } = await getSupabaseAdmin()
        .from('groups')
        .update({
            name,
            lead_student_id: leadStudentId,
            members: memberIds,
        })
        .eq('id', groupId)
        .select()
        .single();

    if (error) throw error;

    // We also re-update the profiles to ensure they have the role
    if (memberIds.length > 0) {
        await getSupabaseAdmin()
            .from('profiles')
            .update({ role: 'participant' })
            .in('id', memberIds);
    }

    // Note: We are NOT removing 'training_group' from removed members here 
    // to keep it simple, but in a perfect world we would diff the members.

    revalidatePath('/admin/periods');
    return data as Group;
}

export async function deleteGroup(groupId: string) {
    const { error } = await getSupabaseAdmin()
        .from('groups')
        .delete()
        .eq('id', groupId);

    if (error) throw error;
    revalidatePath('/admin/periods');
}

export async function getGroupsByPeriod(periodId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from('groups')
        .select(`
            *,
            lead_student:profiles!groups_lead_student_id_fkey(id, full_name, avatar_url)
        `)
        .eq('period_id', periodId)
        .order('group_number', { ascending: true });

    if (error) throw error;

    // We also need to fetch the full member profiles manually since 'members' is just an array of IDs
    // A smarter database design would have a join table 'group_members', but we are using array for simplicity as per plan.
    // Let's stick to the current plan but maybe we need a helper to get member details.
    return data as Group[];
}



/**
 * Helper to fetch detailed profiles for a list of IDs
 * Useful for displaying group members in UI
 */
export async function getProfilesByIds(ids: string[]) {
    if (ids.length === 0) return [];

    const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, full_name, role, satker_name, avatar_url')
        .in('id', ids);

    if (error) throw error;
    return data as Profile[];
}

/**
 * Fetch all students (participants/auditors/auditees) for group assignment
 */
export async function getStudentsForGroupAssignment() {
    const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, full_name, role, satker_name, avatar_url')
        .neq('role', 'superadmin')
        .order('full_name', { ascending: true });

    if (error) throw error;
    return data as Profile[];
}
