'use client';

import { Info } from 'lucide-react';

/**
 * Animated "i" badge shown on an exam card when the admin has changed that
 * student's exam info (currently: the deadline) and they haven't seen it yet.
 */
export function DeadlineNoticeBadge() {
    return (
        <span
            className="relative inline-flex shrink-0"
            title="Info ujian diperbarui — deadline pengerjaan Anda telah diubah oleh admin"
        >
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white">
                <Info className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
        </span>
    );
}

/** True when the audit has a deadline change the student hasn't seen yet. */
export function hasUnseenDeadlineChange(audit: { deadline_changed_at?: string | null; deadline_seen_at?: string | null }) {
    return !!audit.deadline_changed_at && !audit.deadline_seen_at;
}
