'use client';

import { useAuthStore } from '@/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Audit } from '@/types/database';
import Link from 'next/link';
import { deleteAudit } from '@/lib/actions/audit-actions';
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

        let query = supabase.from('audits').select(`
    *,
    auditor:profiles!audits_auditor_id_fkey(id, full_name, role),
    auditee:profiles!audits_auditee_id_fkey(id, full_name, role, satker_name)
    `);

        if (profile.role === 'auditor') {
            query = query.eq('auditor_id', profile.id);
        } else if (profile.role === 'auditee') {
            query = query.eq('auditee_id', profile.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            toast.error('Gagal memuat data audit');
        }
        setAudits(data || []);
        setLoading(false);
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
        <div className="space-y-6">
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
                            : profile?.role === 'auditor'
                                ? 'Evaluasi Saya'
                                : 'Audit Saya'}
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        {filtered.length} audit ditemukan
                    </p>
                </div>
                {profile?.role === 'superadmin' && (
                    <Link
                        href="/admin/audits/new"
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Buat Audit Baru
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

            {/* Audit List */}
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
                <div className="grid gap-4">
                    {filtered.map((audit) => {
                        const auditor = audit.auditor as unknown as { full_name: string } | undefined;
                        const auditee = audit.auditee as unknown as {
                            full_name: string;
                            satker_name: string;
                        } | undefined;
                        const isDeleting = deletingId === audit.id;

                        return (
                            <div
                                key={audit.id}
                                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300"
                            >
                                {/* Main Link covering the card */}
                                <Link
                                    href={`/audits/${audit.id}`}
                                    className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    aria-label={`Lihat audit ${audit.title}`}
                                />

                                <div className="relative z-10 flex items-start justify-between pointer-events-none">
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
                                            {auditor && (
                                                <span className="flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5" /> {auditor.full_name}
                                                </span>
                                            )}
                                            {auditee?.satker_name && (
                                                <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-medium">
                                                    {auditee.satker_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 mt-1 shrink-0 pointer-events-auto">
                                        {profile?.role === 'superadmin' ? (
                                            <div className="flex gap-1">
                                                <Link
                                                    href={`/admin/audits/${audit.id}/edit`}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors z-20 relative"
                                                    title="Edit Audit"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(audit.id, audit.title)}
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
                    })}
                </div>
            )}
        </div>
    );
}
