import { createClient } from '@/lib/supabase/client';
import { AuditItem, AuditItemStatus } from '@/types/database';

const getSupabase = () => createClient();



// Helper to check if audit is locked
async function checkAuditLocked(itemId: string) {
    // 1. Get audit_id from item
    const { data: item, error: itemError } = await getSupabase()
        .from('audit_items')
        .select('audit_id')
        .eq('id', itemId)
        .single();

    if (itemError || !item) throw new Error('Item not found');

    // 2. Check audit status
    const { data: audit, error: auditError } = await getSupabase()
        .from('audits')
        .select('status')
        .eq('id', item.audit_id)
        .single();

    if (auditError || !audit) throw new Error('Audit not found');

    if (audit.status === 'locked') {
        throw new Error('Audit is LOCKED. No changes allowed.');
    }
}

// Helper to update status with validation
async function updateItemStatus(
    itemId: string,
    newStatus?: AuditItemStatus,
    additionalFields: Partial<AuditItem> = {}
) {
    // Check lock first
    await checkAuditLocked(itemId);

    const updates: any = { ...additionalFields };
    if (newStatus) updates.status = newStatus;

    const { data, error } = await getSupabase()
        .from('audit_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data as AuditItem;
}

// ============================================
// AUDITOR ACTIONS
// ============================================

/** Save evaluator's draft fields (jawaban, nilai, catatan, rekomendasi) */
export async function saveEvaluatorDraft(
    itemId: string,
    fields: {
        jawaban_evaluator?: string;
        nilai_evaluator?: number;
        catatan?: string;
        rekomendasi?: string;
    }
) {
    await checkAuditLocked(itemId); // Enforce lock check

    const { data, error } = await getSupabase()
        .from('audit_items')
        .update(fields)
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data as AuditItem;
}

/** DRAFTING → PUBLISHED_TO_AUDITEE */
export async function publishToAuditee(itemId: string) {
    return updateItemStatus(itemId, 'PUBLISHED_TO_AUDITEE');
}

/** Publish ALL drafting items in an audit at once */
export async function publishAllToAuditee(auditId: string) {
    const { data, error } = await getSupabase()
        .from('audit_items')
        .update({ status: 'PUBLISHED_TO_AUDITEE' as AuditItemStatus })
        .eq('audit_id', auditId)
        .eq('status', 'DRAFTING')
        .select();

    if (error) throw error;
    return data as AuditItem[];
}

/** DISPUTED → FINAL_ALTERED (accept auditee's correction, must edit catatan & rekomendasi) */
export async function acceptDispute(itemId: string, newCatatan: string, newRekomendasi: string) {
    if (!newCatatan.trim()) {
        throw new Error('Catatan harus diisi saat menerima koreksi auditee');
    }
    return updateItemStatus(itemId, 'FINAL_ALTERED', {
        catatan: newCatatan,
        rekomendasi: newRekomendasi,
    });
}

/** DISPUTED → FINAL_ORIGINAL (reject auditee's correction, optional rebuttal) */
export async function rejectDispute(itemId: string, rebuttal?: string) {
    const additionalFields: Partial<AuditItem> = {};
    if (rebuttal?.trim()) {
        additionalFields.auditor_rebuttal = rebuttal;
    }
    return updateItemStatus(itemId, 'FINAL_ORIGINAL', additionalFields);
}

// ============================================
// AUDITEE ACTIONS
// ============================================

/** Save auditee's self-assessment fields */
export async function saveAuditeeSelfAssessment(
    itemId: string,
    fields: {
        jawaban_auditee?: string;
        nilai_auditee?: number;
        deskripsi_auditee?: string;
        evidence_link?: string;
    }
) {
    await checkAuditLocked(itemId); // Enforce lock check

    // Log for debugging
    console.log('Saving auditee assessment:', itemId, fields);

    const { data, error } = await getSupabase()
        .from('audit_items')
        .update(fields)
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data as AuditItem;
}

/** DRAFTING -> SUBMITTED (Auditee submits to Auditor) */
export async function submitToAuditor(itemId: string) {
    return updateItemStatus(itemId, 'SUBMITTED');
}

/** PUBLISHED_TO_AUDITEE → FINAL_AGREED */
export async function auditeeAgree(itemId: string) {
    return updateItemStatus(itemId, 'FINAL_AGREED');
}

/** PUBLISHED_TO_AUDITEE → DISPUTED */
export async function auditeeDisagree(itemId: string, response: string) {
    if (!response.trim()) {
        throw new Error('Tanggapan harus diisi saat tidak setuju');
    }
    return updateItemStatus(itemId, 'DISPUTED', { auditee_response: response });
}

/** Submit action plan (in FINAL states) */
export async function submitActionPlan(itemId: string, plan: string) {
    if (!plan.trim()) {
        throw new Error('Rencana tindak lanjut harus diisi');
    }
    const { data, error } = await getSupabase()
        .from('audit_items')
        .update({ auditee_action_plan: plan })
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data as AuditItem;
}



/** Update detailed Action Plan (Matrix) fields */
export async function updateActionPlanDetails(
    itemId: string,
    details: {
        auditee_action_plan?: string;
        tl_target?: string;
        tl_waktu?: string;
        tl_pic?: string;
        tl_progress?: number;
        tl_file_link?: string;
    }
) {
    // Only allow updating action plan fields, not status (status update handled separately if needed)
    // Actually, updateItemStatus is a helper that also updates status.
    // Here we just want to update fields.
    const { data, error } = await getSupabase()
        .from('audit_items')
        .update(details)
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data as AuditItem;
}

// ============================================
// GROUP LEADER ACTIONS
// ============================================

// Actions moved to audit-server-actions.ts to handle permissions securely
