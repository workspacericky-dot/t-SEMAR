'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { Audit, AuditType, UserAuditRole, ExtendedAudit } from '@/types/database';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

/** 
 * Get audits for a specific user, determining their role based on group membership 
 * or individual assignment.
 */
export async function getUserAudits(userId: string) {
    // 1. Get user's profile to find which groups they are in
    const { data: groups, error: groupsError } = await supabaseAdmin
        .from('groups')
        .select('id')
        .contains('members', [userId]);

    if (groupsError) throw groupsError;

    const groupIds = groups.map(g => g.id);

    // 2. Fetch audits where:
    //    a) User is the INDIVIDUAL auditor
    //    b) User's group is the AUDITOR group
    //    c) User's group is the AUDITEE group

    let query = supabaseAdmin
        .from('audits')
        .select(`
            *,
            auditor_group:groups!audits_auditor_group_id_fkey(id, name),
            auditee_group:groups!audits_auditee_group_id_fkey(id, name),
            individual_auditor:profiles!audits_individual_auditor_id_fkey(id, full_name),
            period:audit_periods(name, year)
        `)
        .order('created_at', { ascending: false });

    // Build OR condition
    const conditions = [`individual_auditor_id.eq.${userId}`];

    if (groupIds.length > 0) {
        // Syntax for IN with OR in Supabase/PostgREST is tricky combined with other ORs
        // Easier to fetch all relevant audits and filter in application if list is small, 
        // OR use the .or() syntax with raw string.

        const groupList = `(${groupIds.map(id => `"${id}"`).join(',')})`;
        conditions.push(`auditor_group_id.in.${groupList}`);
        conditions.push(`auditee_group_id.in.${groupList}`);
    }

    // Apply OR filter
    query = query.or(conditions.join(','));

    const { data: audits, error: auditsError } = await query;
    if (auditsError) throw auditsError;

    // 3. Process audits to add 'effectiveRole'
    const processedAudits: ExtendedAudit[] = (audits || []).map((audit: any) => {
        let role: UserAuditRole = 'observer';

        if (audit.individual_auditor_id === userId) {
            role = 'auditor';
        } else if (groupIds.includes(audit.auditor_group_id)) {
            role = 'auditor';
        } else if (groupIds.includes(audit.auditee_group_id)) {
            role = 'auditee';
        }

        return {
            ...audit,
            effectiveRole: role,
        };
    });

    return processedAudits;
}

/** 
 * Fetch all dashboard data (audits + items) for a user server-side.
 * Bypasses RLS for items to avoid permission errors on the dashboard.
 */
export async function getDashboardData(userId: string) {
    // 1. Get Audits
    const audits = await getUserAudits(userId);
    const auditIds = audits.map(a => a.id);

    let items: any[] = [];

    // 2. Get Items (if any audits exist)
    if (auditIds.length > 0) {
        const { data: auditItems, error: itemsError } = await supabaseAdmin
            .from('audit_items')
            .select('*')
            .in('audit_id', auditIds);

        if (itemsError) throw itemsError;
        items = auditItems || [];
    }

    return { audits, items };
}

/**
 * Get a single audit by ID with full details (groups, period, etc.)
 * and determine the effective role for the current user.
 */
export async function getAuditById(auditId: string, userId: string) {
    // 1. Fetch audit with all relations
    const { data: audit, error } = await supabaseAdmin
        .from('audits')
        .select(`
            *,
            auditor:profiles!audits_auditor_id_fkey(id, full_name, role, avatar_url),
            auditee:profiles!audits_auditee_id_fkey(id, full_name, role, satker_name, avatar_url),
            auditor_group:groups!audits_auditor_group_id_fkey(id, name, group_number, members, lead_student_id),
            auditee_group:groups!audits_auditee_group_id_fkey(id, name, group_number, members, lead_student_id),
            individual_auditor:profiles!audits_individual_auditor_id_fkey(id, full_name, role, avatar_url),
            period:audit_periods(name, year)
        `)
        .eq('id', auditId)
        .single();

    if (error) throw error;
    if (!audit) return null;

    // 2. Determine effective role
    let effectiveRole: UserAuditRole = 'observer';

    // Fetch user profile to check for role preference (if needed)
    const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    const preferredRole = userProfile?.role;

    const isIndividualAuditor = audit.individual_auditor_id === userId;
    const isAuditorGroupMember = audit.auditor_group?.members?.includes(userId);
    const isAuditeeGroupMember = audit.auditee_group?.members?.includes(userId);

    if (isIndividualAuditor) {
        effectiveRole = 'auditor';
    } else if (isAuditorGroupMember && isAuditeeGroupMember) {
        // User is in BOTH groups. Use their global role preference.
        if (preferredRole === 'auditor') effectiveRole = 'auditor';
        else if (preferredRole === 'auditee') effectiveRole = 'auditee';
        else effectiveRole = 'auditor'; // Default fallback
    } else if (isAuditorGroupMember) {
        effectiveRole = 'auditor';
    } else if (isAuditeeGroupMember) {
        effectiveRole = 'auditee';
    } else if (audit.auditor_id === userId) { // Legacy
        effectiveRole = 'auditor';
    } else if (audit.auditee_id === userId) { // Legacy
        effectiveRole = 'auditee';
    }

    return {
        ...audit,
        effectiveRole,
    } as ExtendedAudit;
}

/** Delete an audit and its items (Superadmin only) */
export async function deleteAudit(auditId: string) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Server configuration error: Missing Service Role Key');
    }

    // 1. Delete all items first (in case Cascade isn't set)
    const { error: itemsError } = await supabaseAdmin
        .from('audit_items')
        .delete()
        .eq('audit_id', auditId);

    if (itemsError) throw itemsError;

    // 2. Delete the audit itself
    const { error: auditError } = await supabaseAdmin
        .from('audits')
        .delete()
        .eq('id', auditId);

    if (auditError) throw auditError;


    revalidatePath('/dashboard');
    revalidatePath('/audits');
}

/**
 * Get all audits for a specific period (for Superadmin view)
 */
export async function getAuditsByPeriod(periodId: string) {
    const { data: audits, error } = await supabaseAdmin
        .from('audits')
        .select(`
            *,
            auditor_group:groups!audits_auditor_group_id_fkey(id, name, group_number),
            auditee_group:groups!audits_auditee_group_id_fkey(id, name, group_number),
            individual_auditor:profiles!audits_individual_auditor_id_fkey(id, full_name, avatar_url)
        `)
        .eq('period_id', periodId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return audits as any[]; // TODO: Define proper type for this joined response if needed
}

// Helper function (internal)
async function verifyGroupLeader(itemIds: string[], userId: string) {
    // 1. Get the audit_id from one of the items
    const { data: item, error: itemError } = await supabaseAdmin
        .from('audit_items')
        .select('audit_id')
        .in('id', itemIds)
        .limit(1)
        .single();

    if (itemError || !item) throw new Error('Item not found or error fetching item');

    // 2. Get the audit to see the groups
    const { data: audit, error: auditError } = await supabaseAdmin
        .from('audits')
        .select(`
            auditor_group:groups!audits_auditor_group_id_fkey(lead_student_id),
            auditee_group:groups!audits_auditee_group_id_fkey(lead_student_id)
        `)
        .eq('id', item.audit_id)
        .single();

    if (auditError || !audit) throw new Error('Audit not found');

    // Handle array or object return for joined relations (Supabase sometimes returns array for 1:1 if not careful, but typically object with !fkey)
    // The lint error suggested it might be an array. Let's be safe.
    const auditorGroup = Array.isArray(audit.auditor_group) ? audit.auditor_group[0] : audit.auditor_group;
    const auditeeGroup = Array.isArray(audit.auditee_group) ? audit.auditee_group[0] : audit.auditee_group;

    const isAuditorLeader = auditorGroup?.lead_student_id === userId;
    const isAuditeeLeader = auditeeGroup?.lead_student_id === userId;

    if (!isAuditorLeader && !isAuditeeLeader) {
        throw new Error('Unauthorized: You are not the leader of a group assigned to this audit.');
    }

    return true;
}

import { createClient as createServerClient } from '@/lib/supabase/server';
import { AuditItem } from '@/types/database';

export async function assignItemToMember(itemId: string, memberId: string | null) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    await verifyGroupLeader([itemId], user.id);

    const { data, error } = await supabaseAdmin
        .from('audit_items')
        .update({ assigned_to: memberId })
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    revalidatePath('/audits/[id]', 'page'); // Revalidate the audit page
    return data as AuditItem;
}

export async function assignMultipleItemsToMember(itemIds: string[], memberId: string | null, effectiveRole: string) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    await verifyGroupLeader(itemIds, user.id);

    const assignCol = effectiveRole === 'auditee' ? 'auditee_assigned_to' : 'auditor_assigned_to';

    const { data, error } = await supabaseAdmin
        .from('audit_items')
        .update({ [assignCol]: memberId, assigned_to: null }) // Set legacy assigned_to to null to prefer new columns
        .in('id', itemIds)
        .select();

    if (error) throw error;
    revalidatePath('/audits/[id]', 'page'); // Revalidate the audit page
    return data as AuditItem[];
}
export async function resetOrphanedTasks(auditId: string, currentMemberIds: string[], effectiveRole: string) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Unauthorized');

    // Verify leader permission
    await verifyGroupLeaderByAuditId(auditId, user.id);

    // Update items where assigned_to is NOT in currentMemberIds
    // Note: 'not.in' with null check is tricky, safer to fetch and update or use raw query if reliable.
    // simpler approach: fetch all items for audit, filter in code, then update list.
    // BUT for bulk update, let's try a direct query if possible.
    // Supabase .not('assigned_to', 'in', ...) might verify.

    // Let's use two steps for safety and clarity:
    // 1. Find orphaned items
    const assignCol = effectiveRole === 'auditee' ? 'auditee_assigned_to' : 'auditor_assigned_to';
    const { data: items } = await supabaseAdmin
        .from('audit_items')
        .select(`id, assigned_to, ${assignCol}`)
        .eq('audit_id', auditId);

    if (!items) return [];

    const orphanedIds = items
        .filter(item => {
            const assigneeId = item[assignCol as keyof typeof item] || item.assigned_to;
            return assigneeId !== null && !currentMemberIds.includes(assigneeId as string);
        })
        .map(item => item.id);

    if (orphanedIds.length === 0) return [];

    // 2. Unassign them
    const { data, error } = await supabaseAdmin
        .from('audit_items')
        .update({ [assignCol]: null, assigned_to: null })
        .in('id', orphanedIds)
        .select();

    if (error) throw error;
    revalidatePath('/audits/[id]', 'page');
    return data as AuditItem[];
}

// Optimized helper that takes auditId directly (saves a DB roundtrip if we know the ID)
async function verifyGroupLeaderByAuditId(auditId: string, userId: string) {
    const { data: audit, error: auditError } = await supabaseAdmin
        .from('audits')
        .select(`
            auditor_group:groups!audits_auditor_group_id_fkey(lead_student_id),
            auditee_group:groups!audits_auditee_group_id_fkey(lead_student_id)
        `)
        .eq('id', auditId)
        .single();

    if (auditError || !audit) throw new Error('Audit not found');

    const auditorGroup = Array.isArray(audit.auditor_group) ? audit.auditor_group[0] : audit.auditor_group;
    const auditeeGroup = Array.isArray(audit.auditee_group) ? audit.auditee_group[0] : audit.auditee_group;

    const isAuditorLeader = auditorGroup?.lead_student_id === userId;
    const isAuditeeLeader = auditeeGroup?.lead_student_id === userId;

    if (!isAuditorLeader && !isAuditeeLeader) {
        throw new Error('Unauthorized: You are not the leader of a group assigned to this audit.');
    }
    return true;
}
