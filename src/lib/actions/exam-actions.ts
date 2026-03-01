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
    timeLimitMinutes: number
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

        // 3. Fetch all students (role: auditor)
        const { data: students, error: studentsError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('role', ['auditor', 'participant']); // usually 'auditor' but safe to include 'participant'

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
