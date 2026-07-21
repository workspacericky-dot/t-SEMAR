'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { AuditItemStatus } from '@/types/database';

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

/**
 * Distributes a Master Exam Template to all students (role: auditor).
 *
 * Two selection modes:
 * - Manual (`selectedItemIds` provided): every student gets the exact same
 *   hand-picked set of criteria, in full — no randomization.
 * - Automatic (default): clones `questionCount` random items from the pool
 *   filtered by `selectedCategories`, a different random subset per student.
 */
export async function distributeExam(
    masterAuditId: string,
    examType: 'midterm' | 'final',
    timeLimitMinutes: number = 60,
    scheduledStartTime?: string,
    targetStudentIds?: string[],
    questionCount: number = 20,
    selectedCategories?: string[],
    examExpiresAt?: string,
    examTerms?: string[],
    selectedItemIds?: string[]
) {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch master audit
        const { data: masterAudit, error: masterError } = await supabase
            .from('audits')
            .select('*')
            .eq('id', masterAuditId)
            .single();

        if (masterError || !masterAudit) {
            return { error: 'Master Audit not found.' };
        }

        // 2. Fetch all items belonging to master audit
        const { data: masterItems, error: itemsError } = await supabase
            .from('audit_items')
            .select('*')
            .eq('audit_id', masterAuditId);

        if (itemsError || !masterItems || masterItems.length === 0) {
            return { error: 'Master Audit has no items to distribute.' };
        }

        // 3. Fetch all students (role: auditor) or specific students
        let query = supabase
            .from('profiles')
            .select('id, full_name')
            .in('role', ['auditor', 'participant']);

        // If target students are specified, filter by them
        if (targetStudentIds && targetStudentIds.length > 0) {
            query = query.in('id', targetStudentIds);
        }

        const { data: students, error: studentsError } = await query;

        if (studentsError || !students || students.length === 0) {
            return { error: 'No students found to distribute to.' };
        }

        const allNewItems: any[] = [];
        let distributedCount = 0;

        const isManualSelection = !!selectedItemIds && selectedItemIds.length > 0;

        // 3.5 Determine the item pool: hand-picked criteria (manual mode) or
        // everything under the selected categories (automatic/random mode).
        const itemPool = isManualSelection
            ? masterItems.filter(item => selectedItemIds!.includes(item.id))
            : selectedCategories && selectedCategories.length > 0
                ? masterItems.filter(item => selectedCategories.includes(item.category))
                : masterItems;

        if (itemPool.length === 0) {
            return { error: isManualSelection ? 'Tidak ada kriteria terpilih yang ditemukan.' : 'Tidak ada soal pada komponen yang dipilih.' };
        }

        if (!isManualSelection && itemPool.length < questionCount) {
            return { error: `Soal tidak cukup: tersedia ${itemPool.length} dari komponen terpilih, diminta ${questionCount}.` };
        }

        // 4. Distribute to each student
        for (const student of students) {
            // Manual mode: every student gets the exact same hand-picked items.
            // Automatic mode: shuffle and pick questionCount items unique per student.
            const selectedItems = isManualSelection
                ? itemPool
                : [...itemPool].sort(() => 0.5 - Math.random()).slice(0, questionCount);

            // Create new Audit row for this student
            const { data: newAudit, error: insertAuditError } = await supabase
                .from('audits')
                .insert({
                    title: `${examType === 'midterm' ? 'UTS' : 'UAS'} - ${student.full_name}`,
                    description: `Individual Exam based on: ${masterAudit.title}`,
                    year: masterAudit.year,
                    type: examType,
                    individual_auditor_id: student.id,
                    time_limit_minutes: timeLimitMinutes,
                    scheduled_start_time: scheduledStartTime,
                    status: 'SUBMITTED', // Ready for auditor to evaluate
                    period_id: masterAudit.period_id,
                    auditee_id: masterAudit.auditee_id,
                    exam_expires_at: examExpiresAt || null,
                    exam_terms: examTerms && examTerms.length > 0 ? examTerms : null,
                })
                .select('id')
                .single();

            if (insertAuditError || !newAudit) {
                console.error('Failed to create audit for student:', student.id, insertAuditError);
                continue; // skip on error
            }

            // Prepare the 20 items to insert
            for (const item of selectedItems) {
                // Remove the original ID so Supabase generates a new one
                const { id, created_at, updated_at, ...itemWithoutIds } = item;
                allNewItems.push({
                    ...itemWithoutIds,
                    audit_id: newAudit.id,
                });
            }
            distributedCount++;
        }

        // 5. Bulk insert all new items
        if (allNewItems.length > 0) {
            // Supabase can handle large bulk inserts, but just in case, let's chunk them if > 1000
            const chunkSize = 500;
            for (let i = 0; i < allNewItems.length; i += chunkSize) {
                const chunk = allNewItems.slice(i, i + chunkSize);
                const { error: bulkInsertError } = await supabase
                    .from('audit_items')
                    .insert(chunk);

                if (bulkInsertError) {
                    console.error('Failed to insert items chunk:', bulkInsertError);
                    // Continuing even if one chunk fails, to distribute as much as possible
                }
            }
        }

        revalidatePath('/admin/exams');
        revalidatePath('/dashboard');
        return { success: true, count: distributedCount };
    } catch (error: any) {
        console.error('[distributeExam] ERROR:', error);
        return { error: error.message || 'Internal server error while distributing exam.' };
    }
}

/**
 * Starts an exam for a student, recording the exact start time.
 */
export async function startExam(auditId: string) {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({ exam_start_time: new Date().toISOString() })
            .eq('id', auditId)
            // ensure it hasn't been started yet
            .is('exam_start_time', null);

        if (error) {
            return { error: 'Failed to start the exam.' };
        }

        revalidatePath(`/audits/${auditId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[startExam] ERROR:', error);
        return { error: error.message || 'Internal server error while starting exam.' };
    }
}

/**
 * Toggles the manual lock status of an exam.
 */
export async function toggleExamManualLock(auditId: string, isLocked: boolean) {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({ is_manually_locked: isLocked })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal mengubah status akses ujian.' };
        }

        revalidatePath(`/audits/${auditId}`);
        revalidatePath(`/audits`);
        return { success: true };
    } catch (error: any) {
        console.error('[toggleExamManualLock] ERROR:', error);
        return { error: error.message || 'Internal server error while changing exam access.' };
    }
}

/**
 * Submits the exam early for the student, locking it immediately.
 */
export async function submitExamEarly(auditId: string) {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({ is_manually_locked: true })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal mengumpulkan ujian.' };
        }

        revalidatePath(`/audits/${auditId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[submitExamEarly] ERROR:', error);
        return { error: error.message || 'Internal server error while submitting exam.' };
    }
}

/**
 * Saves teacher score and/or assessor note for a single exam item.
 */
export async function saveExamFeedback(itemId: string, data: { teacher_score?: number; catatan_asesor?: string }) {
    try {
        const supabase = getSupabaseAdmin();

        const { data: updated, error } = await supabase
            .from('audit_items')
            .update(data)
            .eq('id', itemId)
            .select('*')
            .single();

        if (error || !updated) {
            return { error: 'Gagal menyimpan.' };
        }

        return updated;
    } catch (error: any) {
        console.error('[saveExamFeedback] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Bulk saves teacher scores and/or assessor notes for multiple items.
 */
export async function bulkSaveExamFeedback(items: { itemId: string; teacher_score?: number; catatan_asesor?: string }[]) {
    try {
        const supabase = getSupabaseAdmin();

        const results: any[] = [];
        for (const { itemId, ...data } of items) {
            const { data: updated, error } = await supabase
                .from('audit_items')
                .update(data)
                .eq('id', itemId)
                .select('*')
                .single();

            if (error) {
                console.error(`[bulkSaveExamFeedback] Failed for item ${itemId}:`, error);
                continue;
            }
            results.push(updated);
        }

        return { success: true, updatedItems: results };
    } catch (error: any) {
        console.error('[bulkSaveExamFeedback] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Saves the teacher's calculated score for a specific item.
 */
export async function saveTeacherScore(itemId: string, score: number) {
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('audit_items')
            .update({ teacher_score: score })
            .eq('id', itemId)
            .select('*')
            .single();

        if (error || !data) {
            return { error: 'Gagal menyimpan nilai.' };
        }

        return data; // Return updated AuditItem
    } catch (error: any) {
        console.error('[saveTeacherScore] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Bulk saves teacher scores for multiple items at once.
 */
export async function bulkSaveTeacherScores(scores: { itemId: string; score: number }[]) {
    try {
        const supabase = getSupabaseAdmin();

        const results: any[] = [];
        for (const { itemId, score } of scores) {
            const { data, error } = await supabase
                .from('audit_items')
                .update({ teacher_score: score })
                .eq('id', itemId)
                .select('*')
                .single();

            if (error) {
                console.error(`[bulkSaveTeacherScores] Failed for item ${itemId}:`, error);
                continue;
            }
            results.push(data);
        }

        return { success: true, updatedItems: results };
    } catch (error: any) {
        console.error('[bulkSaveTeacherScores] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Updates the exam expiry deadline (exam_expires_at) for a single student's
 * exam, independent of every other student's deadline. Meant for force
 * majeure cases (e.g. one student had a valid reason to miss the group
 * deadline) without having to redistribute or touch anyone else's exam.
 * Pass `null` to clear the deadline entirely (exam never expires by date).
 */
export async function updateExamDeadline(auditId: string, newExpiresAt: string | null) {
    try {
        const supabase = getSupabaseAdmin();

        // Stamp deadline_changed_at (and clear any prior deadline_seen_at) so the
        // student's UI can show a notice badge until they've seen the new deadline.
        const { error } = await supabase
            .from('audits')
            .update({
                exam_expires_at: newExpiresAt,
                deadline_changed_at: new Date().toISOString(),
                deadline_seen_at: null,
            })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal mengubah batas waktu ujian.' };
        }

        revalidatePath(`/audits/${auditId}`);
        revalidatePath('/admin/exams');
        revalidatePath('/audits');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        console.error('[updateExamDeadline] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Marks the deadline-change notice as seen by the student, so the animated
 * notice badge on their dashboard/audit list stops showing for this exam.
 */
export async function markDeadlineNoticeSeen(auditId: string) {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({ deadline_seen_at: new Date().toISOString() })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal menandai notifikasi sebagai dibaca.' };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[markDeadlineNoticeSeen] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Updates the exam duration (time_limit_minutes) for a single student's exam,
 * independent of every other student's. Typically used alongside a deadline
 * extension (force majeure) to also shorten/lengthen how long they get once
 * they open the exam.
 */
export async function updateExamDuration(auditId: string, newTimeLimitMinutes: number) {
    try {
        if (!Number.isFinite(newTimeLimitMinutes) || newTimeLimitMinutes < 1) {
            return { error: 'Durasi tidak valid.' };
        }

        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({
                time_limit_minutes: newTimeLimitMinutes,
                deadline_changed_at: new Date().toISOString(),
                deadline_seen_at: null,
            })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal mengubah durasi ujian.' };
        }

        revalidatePath(`/audits/${auditId}`);
        revalidatePath('/admin/exams');
        revalidatePath('/audits');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        console.error('[updateExamDuration] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Resets a single student's exam attempt back to its just-distributed state:
 * clears their evaluator answers and any teacher grading on every item, and
 * unlocks/un-starts the exam itself -- as if they had never opened it. Deadline
 * and duration are left untouched (adjust those separately if needed).
 */
export async function resetExamAttempt(auditId: string) {
    try {
        const supabase = getSupabaseAdmin();

        // Freshly-distributed exam items sit at SUBMITTED (that's the status
        // distributeExam clones from the master, and the one criteria-row.tsx's
        // canEdit check requires for role "auditor" to be able to fill anything in
        // -- DRAFTING is the auditee-drafting state from the non-exam workflow and
        // would leave the item permanently read-only for the student).
        const { error: itemsError } = await supabase
            .from('audit_items')
            .update({
                jawaban_evaluator: null,
                nilai_evaluator: null,
                catatan: null,
                rekomendasi: null,
                teacher_score: 0,
                catatan_asesor: null,
                status: 'SUBMITTED' as AuditItemStatus,
            })
            .eq('audit_id', auditId);

        if (itemsError) {
            return { error: 'Gagal mereset jawaban ujian.' };
        }

        const { error: auditError } = await supabase
            .from('audits')
            .update({
                exam_start_time: null,
                is_manually_locked: false,
                score_released: false,
                status: 'SUBMITTED',
                deadline_changed_at: new Date().toISOString(),
                deadline_seen_at: null,
            })
            .eq('id', auditId);

        if (auditError) {
            return { error: 'Gagal mereset status ujian.' };
        }

        revalidatePath(`/audits/${auditId}`);
        revalidatePath('/admin/exams');
        revalidatePath('/audits');
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        console.error('[resetExamAttempt] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}

/**
 * Toggles score_released on an audit to reveal/hide teacher scores for students.
 */
export async function toggleScoreRelease(auditId: string, released: boolean) {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
            .from('audits')
            .update({ score_released: released })
            .eq('id', auditId);

        if (error) {
            return { error: 'Gagal mengubah status rilis nilai.' };
        }

        revalidatePath(`/audits/${auditId}`);
        revalidatePath('/admin/exams');
        return { success: true };
    } catch (error: any) {
        console.error('[toggleScoreRelease] ERROR:', error);
        return { error: error.message || 'Internal server error.' };
    }
}
