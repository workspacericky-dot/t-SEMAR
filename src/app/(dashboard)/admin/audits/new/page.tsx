'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Profile } from '@/types/database';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Loader2,
    ClipboardCheck,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { redirect } from 'next/navigation';
import { AUDIT_CRITERIA_TEMPLATE } from '@/lib/data/criteria';

// Sample AKIP evaluation criteria template


export default function NewAuditPage() {
    const profile = useAuthStore((s) => s.profile);
    const [auditors, setAuditors] = useState<Profile[]>([]);
    const [auditees, setAuditees] = useState<Profile[]>([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [auditorId, setAuditorId] = useState('');
    const [auditeeId, setAuditeeId] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        if (profile && profile.role !== 'superadmin') {
            redirect('/dashboard');
        }
    }, [profile]);

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data } = await supabase.from('profiles').select('*');
            if (data) {
                setAuditors(data.filter((p) => p.role === 'auditor' || p.role === 'superadmin'));
                setAuditees(data.filter((p) => p.role === 'auditee'));
            }
        };
        fetchProfiles();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !auditorId || !auditeeId) {
            toast.error('Mohon lengkapi semua field yang diperlukan');
            return;
        }

        setLoading(true);
        try {
            // Create audit
            const { data: audit, error: auditError } = await supabase
                .from('audits')
                .insert({
                    title,
                    description,
                    year,
                    auditor_id: auditorId,
                    auditee_id: auditeeId,
                    created_by: profile?.id,
                })
                .select()
                .single();

            if (auditError) throw auditError;

            // Create audit items from template
            const items = AUDIT_CRITERIA_TEMPLATE.map((criteria, idx) => ({
                audit_id: audit.id,
                category: criteria.category,
                subcategory: criteria.subcategory,
                criteria: criteria.criteria,
                bobot: criteria.bobot,
                category_bobot: criteria.category_bobot,
                subcategory_bobot: criteria.subcategory_bobot,
                sort_order: criteria.sort_order,
                status: 'DRAFTING' as const,
            }));

            const { error: itemsError } = await supabase
                .from('audit_items')
                .insert(items);

            if (itemsError) throw itemsError;

            toast.success('Audit berhasil dibuat!');
            router.push(`/audits/${audit.id}`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal membuat audit');
        } finally {
            setLoading(false);
        }
    };

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
                    <ClipboardCheck className="w-6 h-6 text-blue-500" />
                    Buat Audit Baru
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Buat sesi audit baru dan tugaskan evaluator serta auditee.
                </p>
            </div>

            <form
                onSubmit={handleCreate}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
            >
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Judul Audit <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Evaluasi AKIP Tahun 2026"
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
                        placeholder="Deskripsi singkat audit..."
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

                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400">
                    <p className="font-medium mb-1">📋 Template Kriteria</p>
                    <p>
                        Audit akan dibuat dengan {AUDIT_CRITERIA_TEMPLATE.length} kriteria evaluasi AKIP standar.
                        Anda dapat memodifikasi kriteria setelah audit dibuat.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Plus className="w-5 h-5" />
                    )}
                    Buat Audit
                </button>
            </form>
        </div>
    );
}
