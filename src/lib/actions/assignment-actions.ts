'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { Audit, AuditItem } from '@/types/database';
import { AUDIT_CRITERIA_TEMPLATE } from '@/lib/data/criteria';

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
// AUDIT CREATION ACTIONS
// ============================================

/**
 * Create a "Group Practice" audit (pairing two groups)
 */
export async function createGroupPracticeAudit(
    periodId: string,
    auditorGroupId: string,
    auditeeGroupId: string,
    title: string,
    description: string
) {
    // 1. Get period year
    const { data: period } = await getSupabaseAdmin()
        .from('audit_periods')
        .select('year')
        .eq('id', periodId)
        .single();

    if (!period) throw new Error('Periode audit tidak ditemukan');

    // 2. Create the Audit record
    const { data: audit, error: auditError } = await getSupabaseAdmin()
        .from('audits')
        .insert({
            title,
            description,
            year: period.year,
            type: 'group_practice',
            period_id: periodId,
            auditor_group_id: auditorGroupId,
            auditee_group_id: auditeeGroupId,
            status: 'active',
        })
        .select()
        .single();

    if (auditError) throw auditError;

    // 3. Create Audit Items from Template
    const items = AUDIT_CRITERIA_TEMPLATE.map((criteria) => ({
        audit_id: audit.id,
        category: criteria.category,
        subcategory: criteria.subcategory,
        criteria: criteria.criteria,
        bobot: criteria.bobot,
        category_bobot: criteria.category_bobot,
        subcategory_bobot: criteria.subcategory_bobot,
        sort_order: criteria.sort_order,
        status: 'DRAFTING',
        assigned_to: null, // Initially unassigned
    }));

    const { error: itemsError } = await getSupabaseAdmin()
        .from('audit_items')
        .insert(items);

    if (itemsError) throw itemsError;

    revalidatePath(`/admin/periods/${periodId}`);
    return audit as Audit;
}

/**
 * Create "Individual Assignment" audits for specific students
 * (Bulk creation is possible, but this function handles one)
 */
export async function createIndividualExamAudit(
    periodId: string,
    studentId: string,
    title: string,
    description: string
) {
    const { data: period } = await getSupabaseAdmin()
        .from('audit_periods')
        .select('year')
        .eq('id', periodId)
        .single();

    if (!period) throw new Error('Periode audit tidak ditemukan');

    // 1. Create Audit
    const { data: audit, error: auditError } = await getSupabaseAdmin()
        .from('audits')
        .insert({
            title,
            description,
            year: period.year,
            type: 'midterm', // Defaulting to midterm, can be parameter
            period_id: periodId,
            individual_auditor_id: studentId,
            status: 'active',
        })
        .select()
        .single();

    if (auditError) throw auditError;

    // 2. Create Audit Items (Assigned to the student automatically)
    const items = AUDIT_CRITERIA_TEMPLATE.map((criteria) => ({
        audit_id: audit.id,
        category: criteria.category,
        subcategory: criteria.subcategory,
        criteria: criteria.criteria,
        bobot: criteria.bobot,
        category_bobot: criteria.category_bobot,
        subcategory_bobot: criteria.subcategory_bobot,
        sort_order: criteria.sort_order,
        status: 'DRAFTING',
        assigned_to: studentId, // Auto-assigned since it's individual
    }));

    const { error: itemsError } = await getSupabaseAdmin()
        .from('audit_items')
        .insert(items);

    if (itemsError) throw itemsError;

    return audit as Audit;
}

// ============================================

/**
 * Bulk Create "Individual Assignment" audits
 */
export async function createBulkIndividualExamAudits(
    periodId: string,
    studentIds: string[],
    title: string,
    description: string
) {
    if (studentIds.length === 0) return;

    const { data: period } = await getSupabaseAdmin()
        .from('audit_periods')
        .select('year')
        .eq('id', periodId)
        .single();

    if (!period) throw new Error('Periode audit tidak ditemukan');

    // 1. Prepare Audits Data
    const auditsToInsert = studentIds.map(studentId => ({
        title, // Simplified title, since we might not need student name in title if UI handles it. But let's check if we want names.
        // If we want names in title, we need to fetch them.
        description,
        year: period.year,
        type: 'midterm',
        period_id: periodId,
        individual_auditor_id: studentId,
        status: 'active',
    }));

    // Fetch profiles to append names to titles if needed
    const { data: students } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);

    const auditsWithNames = auditsToInsert.map(a => {
        const student = students?.find(s => s.id === a.individual_auditor_id);
        return {
            ...a,
            title: student ? `Ujian Individu: ${student.full_name}` : title
        };
    });

    // 2. Insert Audits
    const { data: createdAudits, error: auditError } = await getSupabaseAdmin()
        .from('audits')
        .insert(auditsWithNames)
        .select();

    if (auditError) throw auditError;
    if (!createdAudits || createdAudits.length === 0) return;

    // 3. Create Audit Items for EACH audit
    const allItems: any[] = [];

    createdAudits.forEach(audit => {
        const auditItems = AUDIT_CRITERIA_TEMPLATE.map((criteria) => ({
            audit_id: audit.id,
            category: criteria.category,
            subcategory: criteria.subcategory,
            criteria: criteria.criteria,
            bobot: criteria.bobot,
            category_bobot: criteria.category_bobot,
            subcategory_bobot: criteria.subcategory_bobot,
            sort_order: criteria.sort_order,
            status: 'DRAFTING',
            assigned_to: audit.individual_auditor_id,
        }));
        allItems.push(...auditItems);
    });

    // Insert in chunks
    const chunkSize = 1000;
    for (let i = 0; i < allItems.length; i += chunkSize) {
        const chunk = allItems.slice(i, i + chunkSize);
        const { error: itemsError } = await getSupabaseAdmin()
            .from('audit_items')
            .insert(chunk);
        if (itemsError) {
            console.error('Error inserting items chunk:', itemsError);
            // Continue? Or throw? Throwing might leave partial state.
            // But for now let's throw.
            throw itemsError;
        }
    }

    revalidatePath(`/admin/periods/${periodId}`);
    return createdAudits;
}

// ============================================
// CRITERIA ASSIGNMENT ACTIONS
// ============================================

/**
 * Assign specific criteria items to a group member
 * (Callable by Group Lead or Superadmin)
 */
export async function assignCriteriaToMember(
    auditId: string,
    itemIds: string[],
    memberId: string
) {
    const { error } = await getSupabaseAdmin()
        .from('audit_items')
        .update({ assigned_to: memberId })
        .in('id', itemIds)
        .eq('audit_id', auditId); // Safety check

    if (error) throw error;
    revalidatePath(`/audits/${auditId}`);
}

/**
 * Auto-distribute criteria among group members (Round Robin)
 */
export async function autoDistributeCriteria(
    auditId: string,
    memberIds: string[]
) {
    if (memberIds.length === 0) return;

    // 1. Get all items
    const { data: items, error: fetchError } = await getSupabaseAdmin()
        .from('audit_items')
        .select('id')
        .eq('audit_id', auditId)
        .order('sort_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!items || items.length === 0) return;

    // 2. Prepare updates
    const updates = items.map((item, index) => ({
        id: item.id,
        participant: memberIds[index % memberIds.length],
    }));

    // 3. Perform batched updates (or loop if batch update by different values isn't supported easily)
    // Supabase doesn't support "update multiple rows with different values" in one query easily without a custom function or separate queries.
    // For 80 items, 80 requests is too slow.
    // Better approach: Group items by participant and do 4-5 bulk updates.

    const itemsByMember: Record<string, string[]> = {};
    updates.forEach(({ id, participant }) => {
        if (!itemsByMember[participant]) itemsByMember[participant] = [];
        itemsByMember[participant].push(id);
    });

    const promises = Object.entries(itemsByMember).map(([memberId, itemIds]) =>
        getSupabaseAdmin()
            .from('audit_items')
            .update({ assigned_to: memberId })
            .in('id', itemIds)
    );

    await Promise.all(promises);
    revalidatePath(`/audits/${auditId}`);
}

/**
 * Toggle Audit Lock Status (Superadmin only ideally, but enforced via RLS or UI checks)
 */
export async function toggleAuditLock(auditId: string, isLocked: boolean) {
    const status = isLocked ? 'locked' : 'active';

    const { error } = await getSupabaseAdmin()
        .from('audits')
        .update({ status })
        .eq('id', auditId);

    if (error) throw error;
    revalidatePath('/admin/periods'); // Revalidate list
    revalidatePath(`/audits/${auditId}`); // Revalidate detail
}

/**
 * Lock or Unlock ALL audits in a period (Superadmin)
 * Optionally filter by type ('group_practice' or 'midterm' for individual)
 */
export async function lockAllAudits(periodId: string, isLocked: boolean, type?: 'group_practice' | 'midterm') {
    const status = isLocked ? 'locked' : 'active';

    let query = getSupabaseAdmin()
        .from('audits')
        .update({ status })
        .eq('period_id', periodId);

    if (type) {
        query = query.eq('type', type);
    }

    const { error } = await query;

    if (error) throw error;
    revalidatePath(`/admin/periods/${periodId}`);
}

/**
 * Creates a dedicated Master Template that handles generating the 80 criteria.
 * This is totally unassigned to any student or group. 
 * Kept strictly for 'Distribusi Ujian' template cloning.
 */
export async function createMasterTemplate(
    periodId: string,
    title: string,
    description: string
) {
    const supabase = getSupabaseAdmin();

    const { data: period, error: pErr } = await supabase.from('audit_periods').select('year').eq('id', periodId).single();
    if (pErr) throw pErr;

    // Create Audit entry mapping specifically to 'master_template'
    const { data: audit, error: auditError } = await supabase
        .from('audits')
        .insert({
            title,
            description,
            year: period.year,
            period_id: periodId,
            status: 'PUBLISHED_TO_AUDITEE', // Standard templates start here, allowing Admin to act as Auditee filling it
            type: 'master_template',
            auditor_group_id: null,
            auditee_group_id: null,
            individual_auditor_id: null, // Critical: this must be null
        })
        .select()
        .single();

    if (auditError) {
        console.error("AUDIT INSERT ERROR:", JSON.stringify(auditError, null, 2));
        throw auditError;
    }

    // Call postgres function to populate the 80 criteria
    // OR, we can just use the same AUDIT_CRITERIA_TEMPLATE generation logic
    const items = AUDIT_CRITERIA_TEMPLATE.map((criteria) => ({
        audit_id: audit.id,
        category: criteria.category,
        subcategory: criteria.subcategory,
        criteria: criteria.criteria,
        bobot: criteria.bobot,
        category_bobot: criteria.category_bobot,
        subcategory_bobot: criteria.subcategory_bobot,
        sort_order: criteria.sort_order,
        status: 'DRAFTING',
        assigned_to: null,
    }));

    const { error: itemsError } = await getSupabaseAdmin()
        .from('audit_items')
        .insert(items);

    if (itemsError) {
        console.error("ITEMS INSERT ERROR:", JSON.stringify(itemsError, null, 2));
        throw itemsError;
    }

    revalidatePath(`/admin/periods/${periodId}`);
    revalidatePath('/audits');

    return audit;
}

