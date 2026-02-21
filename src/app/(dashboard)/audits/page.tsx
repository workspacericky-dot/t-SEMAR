'use client';

import { useAuthStore } from '@/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Audit } from '@/types/database';
import Link from 'next/link';
import { deleteAudit } from '@/lib/actions/audit-server-actions';
import {
    ClipboardCheck,
    Plus,
    Search,
    Calendar,
    Users,
    ArrowLeft,
    ArrowRight,
    Loader2,
    Settings,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AuditsPage() {
    const profile = useAuthStore((s) => s.profile);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchAudits();
    }, [profile]);

    const fetchAudits = async () => {
        if (!profile) return;

        try {
            // Use server action to get all audits (including group ones)
            const { getUserAudits } = await import('@/lib/actions/audit-server-actions');
            const data = await getUserAudits(profile.id);
            setAudits(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Gagal memuat data audit');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus audit "${title}"? Data yang dihapus tidak dapat dikembalikan.`)) {
            return;
        }

        setDeletingId(id);
        try {
            await deleteAudit(id);
            toast.success('Audit berhasil dihapus');
            setAudits(audits.filter((a) => a.id !== id));
        } catch (error) {
            toast.error('Gagal menghapus audit');
            console.error(error);
        } finally {
            setDeletingId(null);
        }
    };

    const filtered = audits.filter(
        (a) =>
            a.title.toLowerCase().includes(search.toLowerCase()) ||
            String(a.year).includes(search)
    );

    return (
        <div className="space-y-8">
            {/* Back to Dashboard */}
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-500 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
            </Link>

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        {profile?.role === 'superadmin'
                            ? 'Manajemen Audit'
                            : 'Daftar Tugas & Audit'}
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        {filtered.length} audit ditemukan
                    </p>
                </div>
                {profile?.role === 'superadmin' && (
                    <Link
                        href="/admin/periods"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Kelola Periode Audit
                    </Link>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Cari audit berdasarkan judul atau tahun..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                />
            </div>

            {/* Loading / Empty States */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <ClipboardCheck className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="font-medium text-lg">Belum ada audit</p>
                    <p className="text-sm mt-1">Audit yang ditugaskan akan muncul di sini.</p>
                </div>
            ) : (
                <div className="space-y-10">

                    {/* 1. Group Practice Section */}
                    {filtered.some(a => a.type === 'group_practice') && (
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-500" />
                                Latihan Kelompok (Group Practice)
                            </h2>
                            <div className="grid gap-4">
                                {filtered.filter(a => a.type === 'group_practice').map((audit) => (
                                    <AuditCard
                                        key={audit.id}
                                        audit={audit}
                                        profile={profile}
                                        isDeleting={deletingId === audit.id}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Individual Assignment Section */}
                    {filtered.some(a => a.type !== 'group_practice') && (
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-pink-500" />
                                Tugas Individu (Exam)
                            </h2>
                            <div className="grid gap-4">
                                {filtered.filter(a => a.type !== 'group_practice').map((audit) => (
                                    <AuditCard
                                        key={audit.id}
                                        audit={audit}
                                        profile={profile}
                                        isDeleting={deletingId === audit.id}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

function AuditCard({ audit, profile, isDeleting, onDelete }: any) {
    const auditor = audit.auditor;
    const auditee = audit.auditee;

    // Logic to visually distinguish group roles
    const isGroupPractice = audit.type === 'group_practice';
    const effectiveRole = audit.effectiveRole;

    return (
        <div className={`group relative bg-white dark:bg-slate-900 border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 ${isGroupPractice && effectiveRole
            ? effectiveRole === 'auditor'
                ? 'border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400'
                : 'border-amber-200 dark:border-amber-900/50 hover:border-amber-400'
            : 'border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800'
            }`}>
            {/* Role Badge for Groups */}
            {isGroupPractice && effectiveRole && (
                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl rounded-tr-xl text-[10px] font-bold uppercase tracking-wider ${effectiveRole === 'auditor'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-amber-100 text-amber-700'
                    }`}>
                    {effectiveRole === 'auditor' ? 'Sebagai Auditor' : 'Sebagai Auditee'}
                </div>
            )}

            <Link
                href={`/audits/${audit.id}`}
                className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                aria-label={`Lihat audit ${audit.title}`}
            />

            <div className="relative z-10 flex items-start justify-between pointer-events-none pt-2">
                <div className="flex-1 min-w-0 pointer-events-auto">
                    <h3 className="font-semibold text-slate-800 dark:text-white text-lg group-hover:text-blue-500 transition-colors">
                        {audit.title}
                    </h3>
                    {audit.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {audit.description}
                        </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Tahun {audit.year}
                        </span>

                        {!isGroupPractice && auditor && (
                            <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> {auditor.full_name}
                            </span>
                        )}

                        {!isGroupPractice && auditee?.satker_name && (
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-medium">
                                {auditee.satker_name}
                            </span>
                        )}

                        {isGroupPractice && (
                            <span className="text-xs text-slate-400">
                                {audit.auditor_group?.name} vs {audit.auditee_group?.name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 mt-1 shrink-0 pointer-events-auto">
                    {profile?.role === 'superadmin' ? (
                        <div className="flex gap-1">
                            {/* Admin Actions */}
                            <button
                                onClick={() => onDelete(audit.id, audit.title)}
                                disabled={isDeleting}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors z-20 relative disabled:opacity-50"
                                title="Hapus Audit"
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                        </div>
                    ) : (
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    )}
                </div>
            </div>
        </div>
    );
}
