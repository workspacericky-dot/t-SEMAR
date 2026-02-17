'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Audit, Profile } from '@/types/database';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    Save,
    Loader2,
    Settings,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EditAuditPage() {
    const profile = useAuthStore((s) => s.profile);
    const params = useParams();
    const id = params.id as string;

    const [auditors, setAuditors] = useState<Profile[]>([]);
    const [auditees, setAuditees] = useState<Profile[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [auditorId, setAuditorId] = useState('');
    const [auditeeId, setAuditeeId] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    // Check auth
    useEffect(() => {
        if (profile && profile.role !== 'superadmin') {
            router.push('/dashboard');
        }
    }, [profile, router]);

    // Fetch data
    useEffect(() => {
        const loadData = async () => {
            // 1. Fetch profiles
            const { data: profiles } = await supabase.from('profiles').select('*');
            if (profiles) {
                setAuditors(profiles.filter((p) => p.role === 'auditor' || p.role === 'superadmin'));
                setAuditees(profiles.filter((p) => p.role === 'auditee'));
            }

            // 2. Fetch Audit
            const { data: audit, error } = await supabase
                .from('audits')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !audit) {
                toast.error('Audit tidak ditemukan');
                router.push('/dashboard');
                return;
            }

            setTitle(audit.title);
            setDescription(audit.description || '');
            setYear(audit.year);
            setAuditorId(audit.auditor_id);
            setAuditeeId(audit.auditee_id);
            setLoading(false);
        };

        if (profile) loadData();
    }, [profile, id, router, supabase]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !auditorId || !auditeeId) {
            toast.error('Mohon lengkapi semua field yang diperlukan');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('audits')
                .update({
                    title,
                    description,
                    year,
                    auditor_id: auditorId,
                    auditee_id: auditeeId,
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('Informasi audit berhasil diperbarui');
            router.push('/dashboard');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal memperbarui audit');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-500 transition-colors mb-3"
                >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                </Link>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Settings className="w-6 h-6 text-blue-500" />
                    Edit Audit
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Perbarui informasi audit dan penugasan.
                </p>
            </div>

            <form
                onSubmit={handleUpdate}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm"
            >
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Judul Audit <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Deskripsi
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all resize-y"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Tahun <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Evaluator <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={auditorId}
                            onChange={(e) => setAuditorId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                            required
                        >
                            <option value="">Pilih Evaluator</option>
                            {auditors.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.full_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Auditee <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={auditeeId}
                            onChange={(e) => setAuditeeId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                            required
                        >
                            <option value="">Pilih Auditee</option>
                            {auditees.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.full_name} {a.satker_name ? `(${a.satker_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-700 dark:text-yellow-400">
                    <p className="font-medium">⚠️ Perhatian</p>
                    <p>Mengubah Evaluator atau Auditee tidak akan menghapus data penilaian yang sudah ada, namun akses pengguna ke audit ini akan berubah sesuai penugasan baru.</p>
                </div>

                <div className="flex gap-3 pt-2">
                    <Link
                        href="/dashboard"
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-center transition-all"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    );
}
