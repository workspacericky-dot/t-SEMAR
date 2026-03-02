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
 * It creates a new unique Audit for each student, and clones 20 random items from the master.
 */
export async function distributeExam(
    masterAuditId: string,
    examType: 'midterm' | 'final',
    timeLimitMinutes: number = 60,
    scheduledStartTime?: string,
    targetStudentIds?: string[]
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

        // 4. Distribute to each student
        for (const student of students) {
            // Shuffle and pick 20
            const shuffled = [...masterItems].sort(() => 0.5 - Math.random());
            const selectedItems = shuffled.slice(0, 20);

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
                    // Keep the original auditee ID if needed so the "satker" name shows properly
                    auditee_id: masterAudit.auditee_id,
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
