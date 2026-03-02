'use client';

import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { getGroupsByPeriod } from '@/lib/actions/period-actions';
import { getAuditsByPeriod } from '@/lib/actions/audit-server-actions';
import { Users, Loader2 } from 'lucide-react';
import { CreateGroupButton } from '@/components/admin/periods/create-group-button';
import { CreateAuditButtons } from '@/components/admin/periods/create-audit-buttons';
import { GroupCard } from '@/components/admin/periods/group-card';
import { AuditList } from '@/components/admin/periods/audit-list';
import { PeriodActions } from '@/components/admin/periods/period-actions';

interface Period {
    id: string;
    name: string;
    year: number;
    is_active: boolean;
    created_at: string;
}

export default function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const isDark = useThemeStore((s) => s.isDark);
    const [period, setPeriod] = useState<Period | null>(null);
    const [groups, setGroups] = useState<any[]>([]);
    const [audits, setAudits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient();
            // Fetch period
            const { data: periodData } = await supabase
                .from('audit_periods')
                .select('*')
                .eq('id', id)
                .single();

            setPeriod(periodData);

            // Fetch groups and audits
            const [groupsData, auditsData] = await Promise.all([
                getGroupsByPeriod(id),
                getAuditsByPeriod(id),
            ]);

            setGroups(groupsData);
            setAudits(auditsData);
            setLoading(false);
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!period) {
        return (
            <div className={`text-center py-20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Periode tidak ditemukan.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <PeriodActions periodId={id} />
                <div>
                    <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {period.name} ({period.year})
                    </h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        Manajemen Kelompok Audit
                    </p>
                </div>
            </div>

            <div className={`flex justify-between items-center p-4 rounded-xl border shadow-sm ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
                <div className="flex gap-6">
                    <div>
                        <span className={`block text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</span>
                        <span className={`inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${period.is_active
                            ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : isDark ? 'bg-slate-700 text-slate-400 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                            {period.is_active ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                    </div>
                    <div>
                        <span className={`block text-xs font-medium uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Kelompok</span>
                        <span className={`block mt-1 text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{groups.length}</span>
                    </div>
                </div>

                {/* Create Group Button */}
                <CreateGroupButton periodId={id} existingGroupsCount={groups.length} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                    <div className={`col-span-full py-12 text-center rounded-xl border border-dashed ${isDark ? 'text-slate-400 bg-slate-800/30 border-slate-600' : 'text-slate-500 bg-slate-50 border-slate-300'}`}>
                        <Users className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <h3 className={`text-lg font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Belum Ada Kelompok</h3>
                        <p>Silakan buat kelompok baru untuk periode ini.</p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <GroupCard key={group.id} group={group} />
                    ))
                )}
            </div>

            {/* ASSIGNMENTS SECTION */}
            <div className={`pt-8 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Penugasan Audit
                        </h2>
                        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                            Kelola simulasi audit (Latihan Kelompok) dan ujian (Tugas Individu).
                        </p>
                    </div>
                    <CreateAuditButtons periodId={id} groups={groups} />
                </div>

                <AuditList audits={audits} />
            </div>
        </div>
    );
}
