'use client';

import { useState } from 'react';
import { Lock, Unlock, Loader2, ArrowLeft, Users, User } from 'lucide-react';
import { lockAllAudits } from '@/lib/actions/assignment-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PeriodActionsProps {
    periodId: string;
}

export function PeriodActions({ periodId }: PeriodActionsProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const router = useRouter();

    const handleLock = async (type: 'group_practice' | 'midterm', locked: boolean) => {
        const typeLabel = type === 'group_practice' ? 'Latihan Kelompok' : 'Tugas Individu';
        const actionLabel = locked ? 'MENGUNCI' : 'MEMBUKA KUNCI';

        if (!confirm(`Apakah Anda yakin ingin ${actionLabel} semua audit ${typeLabel}?`)) return;

        const loadingKey = `${type}-${locked ? 'lock' : 'unlock'}`;
        setLoading(loadingKey);

        try {
            await lockAllAudits(periodId, locked, type);
            toast.success(`Berhasil ${locked ? 'mengunci' : 'membuka kunci'} ${typeLabel}`);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('Gagal memperbarui status audit');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <Link
                href="/admin/periods"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Kembali
            </Link>

            <div className="flex flex-wrap gap-6">
                {/* Group Practice Controls */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5" />
                        Latihan Kelompok
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleLock('group_practice', false)}
                            disabled={loading !== null}
                            className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors disabled:opacity-50"
                            title="Buka Semua Latihan Kelompok"
                        >
                            {loading === 'group_practice-unlock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => handleLock('group_practice', true)}
                            disabled={loading !== null}
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors disabled:opacity-50"
                            title="Kunci Semua Latihan Kelompok"
                        >
                            {loading === 'group_practice-lock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

                {/* Individual Assignment Controls */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <User className="w-3.5 h-3.5" />
                        Tugas Individu
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleLock('midterm', false)}
                            disabled={loading !== null}
                            className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors disabled:opacity-50"
                            title="Buka Semua Tugas Individu"
                        >
                            {loading === 'midterm-unlock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => handleLock('midterm', true)}
                            disabled={loading !== null}
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors disabled:opacity-50"
                            title="Kunci Semua Tugas Individu"
                        >
                            {loading === 'midterm-lock' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
