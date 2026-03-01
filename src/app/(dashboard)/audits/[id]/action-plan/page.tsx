'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { Audit, AuditItem } from '@/types/database';
import { ActionPlanTable } from '@/components/action-plan/action-plan-table';
import { ArrowLeft, FileText, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { getAuditById } from '@/lib/actions/audit-server-actions';

export default function ActionPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const profile = useAuthStore((s) => s.profile);
    const [audit, setAudit] = useState<Audit | null>(null);
    const [items, setItems] = useState<AuditItem[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            // Fetch audit details with effective role
            const auditData = await getAuditById(id, profile!.id);

            if (auditData) setAudit(auditData);

            // Fetch items
            const { data: itemsData } = await supabase
                .from('audit_items')
                .select('*')
                .eq('audit_id', id)
                .order('sort_order', { ascending: true });

            setItems(itemsData || []);
            setLoading(false);
        };

        fetchData();
    }, [id]);

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!profile) return <div className="p-10 text-center">Silakan login terlebih dahulu</div>;
    if (!audit) return <div className="p-10 text-center">Audit tidak ditemukan</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href={`/audits/${id}`}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-500 transition-colors mb-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Kembali ke Audit
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <LayoutDashboard className="w-6 h-6 text-teal-600" />
                        Monitoring Tindak Lanjut
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Audit: {audit.title} ({audit.year})
                    </p>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Petunjuk Pengisian</p>
                    <ul className="list-disc ml-4 space-y-1 mt-1 opacity-90">
                        <li>Halaman ini menampilkan seluruh rekomendasi yang telah diberikan evaluator.</li>
                        <li>Sebagai Auditee, silakan lengkapi kolom <strong>Target</strong>, <strong>Waktu</strong>, <strong>PIC</strong>, <strong>Progress</strong>, dan <strong>Bukti Dukung</strong> pada masing-masing item.</li>
                        <li>Klik tombol Simpan (ikon disket) di sebelah kanan setelah melakukan perubahan pada baris.</li>
                    </ul>
                </div>
            </div>

            <ActionPlanTable items={items} role={(audit as any).effectiveRole || profile?.role || 'auditee'} />
        </div>
    );
}
