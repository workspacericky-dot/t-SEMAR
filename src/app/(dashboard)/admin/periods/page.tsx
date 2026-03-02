'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { Eye, Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import { CreatePeriodButton } from '@/components/admin/periods/create-period-button';
import { DeletePeriodButton } from '@/components/admin/periods/delete-period-button';

interface Period {
    id: string;
    name: string;
    year: number;
    is_active: boolean;
    created_at: string;
}

export default function AuditPeriodsPage() {
    const isDark = useThemeStore((s) => s.isDark);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPeriods = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('audit_periods')
                .select('*')
                .order('created_at', { ascending: false });
            setPeriods(data || []);
            setLoading(false);
        };
        fetchPeriods();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard"
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors mb-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Kembali ke Dashboard
                    </Link>
                    <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Buat Audit Baru
                    </h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        Kelola tahun ajaran dan periode audit (Semester Ganjil/Genap).
                    </p>
                </div>
                <CreatePeriodButton />
            </div>

            <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`font-medium border-b ${isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                            <tr>
                                <th className="px-6 py-4">Nama Periode</th>
                                <th className="px-6 py-4">Tahun</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Dibuat Pada</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
                            {periods.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className={`px-6 py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <div className="flex flex-col items-center gap-2">
                                            <Calendar className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                            <p>Belum ada periode audit yang dibuat.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                periods.map((period) => (
                                    <tr key={period.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                                        <td className={`px-6 py-4 font-medium ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                                            {period.name}
                                        </td>
                                        <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                            {period.year}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${period.is_active
                                                ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                : isDark ? 'bg-slate-700 text-slate-400 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                {period.is_active ? 'Aktif' : 'Tidak Aktif'}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                                                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${isDark
                                                        ? 'text-slate-300 bg-slate-800 border-slate-600 hover:bg-slate-700 hover:text-white'
                                                        : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
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
