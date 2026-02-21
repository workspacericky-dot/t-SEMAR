'use client';

import { AuditItem, UserRole } from '@/types/database';
import { ActionPlanRow } from './action-plan-row';
import { useAuthStore } from '@/store/auth-store';

interface ActionPlanTableProps {
    items: AuditItem[];
    role: string;
}

export function ActionPlanTable({ items, role }: ActionPlanTableProps) {
    // Filter items that are in FINAL state and have a recommendation
    const actionableItems = items.filter(
        (item) =>
            (item.status.startsWith('FINAL')) &&
            (item.rekomendasi && item.rekomendasi.trim() !== '')
    );

    if (actionableItems.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-slate-500">Belum ada rekomendasi yang perlu ditindaklanjuti.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 w-10">No</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 min-w-[200px]">Rekomendasi</th>
                            {role !== 'auditor' && (
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 min-w-[200px]">Permasalahan (Catatan)</th>
                            )}
                            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 min-w-[200px]">Rencana Aksi</th>

                            {/* Matrix Columns */}
                            {role !== 'auditor' && (
                                <>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20 w-32">Target</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20 w-32">Waktu</th>
                                </>
                            )}
                            <th className="px-3 py-3 text-left text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20 w-32">PIC</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20 w-40">Status (%)</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/20 w-40">Bukti Dukung</th>
                            <th className="px-3 py-3 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {actionableItems.map((item, idx) => (
                            <ActionPlanRow
                                key={item.id}
                                item={item}
                                role={role}
                                index={idx}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
