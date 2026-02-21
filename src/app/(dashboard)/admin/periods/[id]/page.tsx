import Link from 'next/link';
import { getGroupsByPeriod, getPeriods } from '@/lib/actions/period-actions';
import { getAuditsByPeriod } from '@/lib/actions/audit-server-actions';
import { ChevronLeft, Users, User, Trash2, Edit, ClipboardList } from 'lucide-react';
import { notFound } from 'next/navigation';
import { CreateGroupButton } from '@/components/admin/periods/create-group-button';
import { CreateAuditButtons } from '@/components/admin/periods/create-audit-buttons';
import { GroupCard } from '@/components/admin/periods/group-card';
import { AuditList } from '@/components/admin/periods/audit-list';
import { PeriodActions } from '@/components/admin/periods/period-actions';

export const dynamic = 'force-dynamic';

interface PeriodDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function PeriodDetailPage({ params }: PeriodDetailPageProps) {
    const { id } = await params;

    // We need period details too, but getGroupsByPeriod only returns groups.
    // Let's fetch all periods and find the one. Efficient enough for now as periods items are few.
    const allPeriods = await getPeriods();
    const period = allPeriods.find(p => p.id === id);

    if (!period) {
        notFound();
    }

    const groups = await getGroupsByPeriod(id);
    const audits = await getAuditsByPeriod(id);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <PeriodActions periodId={id} />
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {period.name} ({period.year})
                    </h1>
                    <p className="text-slate-500">
                        Manajemen Kelompok Audit
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-6">
                    <div>
                        <span className="block text-xs font-medium text-slate-500 uppercase">Status</span>
                        <span className={`inline-flex mt-1 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${period.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                            {period.is_active ? 'Aktif' : 'Tidak Aktif'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-slate-500 uppercase">Total Kelompok</span>
                        <span className="block mt-1 text-sm font-semibold text-slate-900">{groups.length}</span>
                    </div>
                </div>

                {/* Create Group Button */}
                <CreateGroupButton periodId={id} existingGroupsCount={groups.length} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <h3 className="text-lg font-medium text-slate-900">Belum Ada Kelompok</h3>
                        <p>Silakan buat kelompok baru untuk periode ini.</p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <GroupCard key={group.id} group={group} />
                    ))
                )}
            </div>

            {/* ASSIGNMENTS SECTION */}
            <div className="pt-8 border-t border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">
                            Penugasan Audit
                        </h2>
                        <p className="text-slate-500">
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
