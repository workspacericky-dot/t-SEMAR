'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createExamPackage, parseChatGPTOutput, validateOutputAgainstPackage, CHATGPT_RUBRIC, CHATGPT_SCHEMA, type ExamPackage } from '@/lib/assessor/chatgpt-workflow';
import { reasoningInput, validateApproval, type AssessorRecommendation } from '@/lib/assessor/reasoning';
import type { Audit, AuditItem } from '@/types/database';

async function assessorContext(auditId: string) {
    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) throw new Error('Silakan masuk sebagai dosen/administrator.');
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile || !['admin', 'superadmin'].includes(profile.role)) throw new Error('Hanya dosen/administrator yang dapat menggunakan rekomendasi asesor.');
    const { data: audit, error } = await admin.from('audits').select('*').eq('id', auditId).single();
    if (error || !audit || !['midterm', 'final'].includes(audit.type)) throw new Error('Rekomendasi asesor hanya tersedia pada ujian UTS/UAS.');
    return { admin, audit: audit as Audit, userId: user.id };
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Operasi rekomendasi gagal. Silakan coba kembali.';
}

function assertExamFinished(audit: Audit) {
    const now = Date.now();
    const timedOut = !!audit.exam_start_time && now >= Date.parse(audit.exam_start_time) + (audit.time_limit_minutes || 90) * 60000;
    const expired = !!audit.exam_expires_at && now >= Date.parse(audit.exam_expires_at);
    if (!audit.is_manually_locked && !timedOut && !expired) throw new Error('Analisis dan approval tersedia setelah siswa mengumpulkan ujian atau waktu ujian berakhir.');
}

export async function getAssessorRecommendations(auditId: string) {
    try {
        const { admin } = await assessorContext(auditId);
        const { data, error } = await admin.from('assessor_recommendations').select('*').eq('audit_id', auditId);
        if (error) return { error: 'Penyimpanan rekomendasi belum tersedia. Terapkan migrasi assessor_recommendations pada database.' };
        return { recommendations: data as AssessorRecommendation[] };
    } catch (error) { return { error: errorMessage(error) }; }
}

export async function exportAssessorExam(auditId: string, referenceYear?: number) {
    try {
        const { admin, audit, userId } = await assessorContext(auditId);
        assertExamFinished(audit);
        const { data: items, error } = await admin.from('audit_items').select('*').eq('audit_id', auditId);
        if (error || !items?.length) throw new Error('Kriteria ujian tidak ditemukan.');
        const { data: drafts, error: draftError } = await admin.from('assessor_recommendations').select('item_id, updated_at').eq('audit_id', auditId);
        if (draftError) throw new Error('Terapkan migrasi 20260929090000_assessor_recommendations.sql terlebih dahulu.');
        const payload = createExamPackage(audit, items as AuditItem[], referenceYear ?? audit.year - 1);
        const { error: saveError } = await admin.from('assessor_export_packages').insert({
            id: payload.package_id, audit_id: auditId, exported_by: userId, payload,
            reasoning_snapshots: Object.fromEntries(items.map(item => [item.id, reasoningInput(item)])),
            feedback_snapshots: Object.fromEntries(items.map(item => [item.id, { teacher_score: Number(item.teacher_score || 0), catatan_asesor: item.catatan_asesor || '' }])),
            draft_versions: Object.fromEntries(items.map(item => [item.id, drafts?.find(draft => draft.item_id === item.id)?.updated_at || null])),
        });
        if (saveError) throw new Error('Ekspor belum dapat disimpan. Terapkan migrasi 20260929100000_assessor_chatgpt_workflow.sql pada Supabase.');
        return { payload };
    } catch (error) { return { error: errorMessage(error) }; }
}

export async function getAssessorExportDownload(auditId: string, packageId: string) {
    try {
        const { admin, audit } = await assessorContext(auditId);
        assertExamFinished(audit);
        const { data: manifest, error } = await admin.from('assessor_export_packages').select('payload').eq('id', packageId).eq('audit_id', auditId).single();
        if (error || !manifest) throw new Error('Paket ekspor tidak ditemukan. Kembali ke ujian dan buat paket ekspor baru.');
        return { payload: manifest.payload as ExamPackage };
    } catch (error) { return { error: errorMessage(error) }; }
}

export async function importAssessorExam(auditId: string, text: string) {
    try {
        const { admin, audit, userId } = await assessorContext(auditId);
        assertExamFinished(audit);
        const output = parseChatGPTOutput(text);
        if (output.audit_id !== auditId) throw new Error('Hasil ini berasal dari ujian siswa lain.');
        if (output.schema_version !== CHATGPT_SCHEMA || output.rubric_version !== CHATGPT_RUBRIC) throw new Error('Versi schema/rubrik tidak didukung. Gunakan paket terbaru.');
        const { data: manifest, error: manifestError } = await admin.from('assessor_export_packages').select('payload, imported_at').eq('id', output.package_id).eq('audit_id', auditId).single();
        if (manifestError || !manifest) throw new Error('Paket ekspor tidak ditemukan. Gunakan hasil dari file ekspor aplikasi ini; periksa juga migrasi ChatGPT.');
        if (manifest.imported_at) throw new Error('Paket ini sudah diimpor. Untuk analisis ulang, ekspor paket baru dahulu.');
        validateOutputAgainstPackage(output, manifest.payload as ExamPackage);
        const { data, error } = await admin.rpc('import_assessor_chatgpt_results', { p_audit_id: auditId, p_importer: userId, p_output: output });
        if (error?.message.includes('STALE')) throw new Error('Jawaban, penilaian, atau draft berubah sejak ekspor. Tidak ada hasil diimpor. Muat ulang, ekspor paket baru, lalu analisis kembali.');
        if (error?.message.includes('SUPERSEDED_PACKAGE')) throw new Error('Paket ini sudah digantikan oleh ekspor yang lebih baru. Gunakan paket terbaru.');
        if (error?.message.includes('PACKAGE_ALREADY_IMPORTED')) throw new Error('Paket ini sudah diimpor. Muat ulang rekomendasi.');
        if (error) throw new Error('Impor gagal. Tidak ada nilai resmi berubah. Periksa kelengkapan JSON dan migrasi 20260929100000_assessor_chatgpt_workflow.sql.');
        return { recommendations: data as AssessorRecommendation[], count: output.result_count };
    } catch (error) { return { error: errorMessage(error) }; }
}

export async function approveAssessorRecommendations(auditId: string, entries: {
    item_id: string; expected_updated_at: string; score: number; assessor_note: string;
}[], category?: string) {
    try {
        const { admin, audit, userId } = await assessorContext(auditId);
        assertExamFinished(audit);
        if (!Array.isArray(entries) || !entries.length || entries.length > 200 || new Set(entries.map(entry => entry.item_id)).size !== entries.length) {
            throw new Error('Daftar approval tidak valid.');
        }
        if (!category && entries.length !== 1) throw new Error('Approval beberapa kriteria harus dalam satu komponen.');
        entries.forEach(entry => validateApproval(entry.score, entry.assessor_note));
        const { data, error } = await admin.rpc('approve_assessor_recommendations', {
            p_audit_id: auditId, p_approver: userId, p_entries: entries, p_category: category || null,
        });
        if (error) {
            if (error.message.includes('STALE')) throw new Error('Rekomendasi, jawaban, atau penilaian manual telah berubah. Muat ulang dan ekspor paket baru sebelum approval.');
            throw new Error('Approval gagal. Tidak ada pasangan nilai dan catatan yang disimpan. Periksa migrasi database dan muat ulang.');
        }
        revalidatePath(`/audits/${auditId}`);
        return { updatedItems: data as AuditItem[] };
    } catch (error) { return { error: errorMessage(error) }; }
}
