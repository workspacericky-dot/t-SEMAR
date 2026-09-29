'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { analyzeReasoning } from '@/lib/assessor/provider';
import { RUBRIC_VERSION, reasoningInput, sameReasoning, validateApproval, type AssessorRecommendation } from '@/lib/assessor/reasoning';
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

export async function generateAssessorRecommendation(auditId: string, itemId: string) {
    try {
        const { admin, audit, userId } = await assessorContext(auditId);
        assertExamFinished(audit);
        const { data: item, error } = await admin.from('audit_items').select('*').eq('audit_id', auditId).eq('id', itemId).single();
        if (error || !item) throw new Error('Kriteria ujian tidak ditemukan.');
        const { data: previous, error: storageError } = await admin.from('assessor_recommendations').select('updated_at').eq('item_id', itemId).maybeSingle();
        if (storageError) throw new Error('Penyimpanan rekomendasi belum tersedia. Terapkan migrasi database terlebih dahulu.');
        const input = reasoningInput(item);
        const { result, model } = await analyzeReasoning(input);
        const { data: latest } = await admin.from('audit_items').select('*').eq('audit_id', auditId).eq('id', itemId).single();
        if (!latest || !sameReasoning(input, reasoningInput(latest)) ||
            Number(latest.teacher_score || 0) !== Number(item.teacher_score || 0) ||
            (latest.catatan_asesor || '') !== (item.catatan_asesor || '')) throw new Error('Jawaban atau penilaian berubah selama analisis. Muat ulang lalu analisis kembali.');
        const { data: recommendation, error: saveError } = await admin.rpc('save_assessor_recommendation', {
            p_audit_id: auditId, p_item_id: itemId, p_generator: userId,
            p_expected_updated_at: previous?.updated_at || null,
            p_draft: {
                ...result, model, rubric_version: RUBRIC_VERSION, input_snapshot: input,
                feedback_snapshot: { teacher_score: Number(item.teacher_score || 0), catatan_asesor: item.catatan_asesor || '' },
            },
        });
        if (saveError?.message.includes('STALE')) throw new Error('Jawaban, penilaian, atau rekomendasi berubah selama analisis. Muat ulang sebelum mencoba kembali.');
        if (saveError || !recommendation) throw new Error('Gagal menyimpan rekomendasi. Penilaian resmi tidak berubah.');
        return { recommendation: recommendation as AssessorRecommendation };
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
            if (error.message.includes('STALE')) throw new Error('Rekomendasi, jawaban, atau penilaian manual telah berubah. Muat ulang dan analisis kembali sebelum approval.');
            throw new Error('Approval gagal. Tidak ada pasangan nilai dan catatan yang disimpan. Periksa migrasi database dan muat ulang.');
        }
        revalidatePath(`/audits/${auditId}`);
        return { updatedItems: data as AuditItem[] };
    } catch (error) { return { error: errorMessage(error) }; }
}
