'use client';

import { useState } from 'react';
import { ClipboardList, Trash2, User, Lock, Unlock, Loader2 } from 'lucide-react';
import { Audit } from '@/types/database';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { toggleAuditLock } from '@/lib/actions/assignment-actions';
import { deleteAudit } from '@/lib/actions/audit-server-actions';
import { toast } from 'sonner';

interface AuditListProps {
    audits: Audit[];
}

export function AuditList({ audits }: AuditListProps) {
    const { profile } = useAuthStore();
    const isDark = useThemeStore((s) => s.isDark);
    const isSuperAdmin = profile?.role === 'superadmin';
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleToggleLock = async (audit: Audit) => {
        if (!isSuperAdmin) return;

        const isLocked = audit.status === 'locked';
        const newLockedState = !isLocked;

        setTogglingId(audit.id);
        try {
            await toggleAuditLock(audit.id, newLockedState);
            toast.success(newLockedState ? 'Audit berhasil dikunci' : 'Audit berhasil dibuka');
        } catch (error) {
            console.error(error);
            toast.error('Gagal mengubah status kunci audit');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (auditId: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus audit ini? Data penilaian yang sudah ada akan hilang selamanya.')) return;

        setDeletingId(auditId);
        try {
            await deleteAudit(auditId);
            toast.success('Audit berhasil dihapus');
        } catch (error) {
            console.error(error);
            toast.error('Gagal menghapus audit');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className={`rounded-xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
            <table className="w-full text-sm text-left">
                <thead className={`font-medium border-b ${isDark ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                    <tr>
                        <th className="px-6 py-4">Judul Audit</th>
                        <th className="px-6 py-4">Tipe</th>
                        <th className="px-6 py-4">Peserta (Auditor vs Auditee)</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-100'}`}>
                    {audits.length === 0 ? (
                        <tr>
                            <td colSpan={5} className={`px-6 py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <div className="flex flex-col items-center gap-2">
                                    <ClipboardList className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                    <p>Belum ada penugasan audit yang dibuat.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        audits.map((audit) => {
                            const isLocked = audit.status === 'locked';

                            return (
                                <tr key={audit.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/50'}`}>
                                    <td className="px-6 py-4">
                                        <span className={`font-medium block ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{audit.title}</span>
                                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{audit.description}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {audit.type === 'group_practice' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                Latihan Kelompok
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-50 text-pink-700 border border-pink-100">
                                                Tugas Individu
                                            </span>
                                        )}
                                    </td>
                                    <td className={`px-6 py-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {audit.type === 'group_practice' ? (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="font-medium text-indigo-600">Kelompok {audit.auditor_group?.group_number}</span>
                                                <span className="text-slate-400">vs</span>
                                                <span className="font-medium text-amber-600">Kelompok {audit.auditee_group?.group_number}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px]">
                                                    {audit.individual_auditor?.avatar_url ? (
                                                        <img src={audit.individual_auditor.avatar_url} className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        <User className="w-3 h-3 text-slate-400" />
                                                    )}
                                                </div>
                                                <span className="text-sm">{audit.individual_auditor?.full_name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isLocked
                                            ? 'bg-red-50 text-red-700 border border-red-100' // Locked style
                                            : audit.status === 'active'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                            {isLocked ? 'Terkunci' : (audit.status === 'active' ? 'Aktif' : 'Selesai')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isSuperAdmin && (
                                                <button
                                                    onClick={() => handleToggleLock(audit)}
                                                    disabled={togglingId === audit.id}
                                                    title={isLocked ? "Buka Kunci" : "Kunci Audit"}
                                                    className={`p-1.5 rounded-lg transition-colors ${isLocked
                                                        ? 'text-amber-500 hover:bg-amber-50'
                                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                        }`}
                                                >
                                                    {togglingId === audit.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : isLocked ? (
                                                        <Lock className="w-4 h-4" />
                                                    ) : (
                                                        <Unlock className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleDelete(audit.id)}
                                                disabled={deletingId === audit.id}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {deletingId === audit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
