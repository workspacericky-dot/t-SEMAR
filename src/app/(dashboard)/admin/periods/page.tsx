import Link from 'next/link';
import { getPeriods } from '@/lib/actions/period-actions';
import { Eye, Calendar, ArrowLeft } from 'lucide-react';
import { CreatePeriodButton } from '@/components/admin/periods/create-period-button';
import { DeletePeriodButton } from '@/components/admin/periods/delete-period-button';

export const metadata = {
    title: 'Manajemen Periode Audit | eSEMAR',
};

export const dynamic = 'force-dynamic';

export default async function AuditPeriodsPage() {
    const periods = await getPeriods();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Kembali ke Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Periode Audit
                    </h1>
                    <p className="text-slate-500">
                        Kelola tahun ajaran dan periode audit (Semester Ganjil/Genap).
                    </p>
                </div>
                <CreatePeriodButton />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Nama Periode</th>
                                <th className="px-6 py-4">Tahun</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Dibuat Pada</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {periods.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Calendar className="w-8 h-8 text-slate-300" />
                                            <p>Belum ada periode audit yang dibuat.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                periods.map((period) => (
                                    <tr key={period.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {period.name}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {period.year}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${period.is_active
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                {period.is_active ? 'Aktif' : 'Tidak Aktif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {new Date(period.created_at).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/admin/periods/${period.id}`}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Detail & Grup
                                                </Link>

                                                <DeletePeriodButton periodId={period.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
