'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Audit, AuditItem, ExtendedAudit, Profile } from '@/types/database';
import { AuditTable } from '@/components/audit/audit-table';
import { TaskDistribution } from '@/components/audit/task-distribution';
import { AuditExportButtons } from '@/components/audit/audit-export-buttons';
import { ArrowLeft, Calendar, Users, Loader2, FileText } from 'lucide-react';
import Link from 'next/link';
import { getAuditById } from '@/lib/actions/audit-server-actions';
import { getProfilesByIds } from '@/lib/actions/period-actions';

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const profile = useAuthStore((s) => s.profile);
    const isDark = useThemeStore((s) => s.isDark);
    const [audit, setAudit] = useState<ExtendedAudit | null>(null);
    const [items, setItems] = useState<AuditItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLeader, setIsLeader] = useState(false);
    const [members, setMembers] = useState<Profile[]>([]);
    const supabase = createClient();

    useEffect(() => {
        const fetchAudit = async () => {
            if (!profile) return;

            try {
                // Use server action to get audit with effective role
                const auditData = await getAuditById(id, profile.id);

                if (auditData) {
                    setAudit(auditData);

                    // Determine if Leader
                    let currentGroup = null;
                    if (auditData.effectiveRole === 'auditor') {
                        currentGroup = auditData.auditor_group;
                    } else if (auditData.effectiveRole === 'auditee') {
                        currentGroup = auditData.auditee_group;
                    }

                    if (currentGroup && currentGroup.lead_student_id === profile.id) {
                        setIsLeader(true);
                        // Fetch members
                        if (currentGroup.members && currentGroup.members.length > 0) {
                            const memberProfiles = await getProfilesByIds(currentGroup.members);
                            setMembers(memberProfiles);
                        }
                    }
                }

                // Fetch audit items
                const { data: itemsData } = await supabase
                    .from('audit_items')
                    .select('*')
                    .eq('audit_id', id)
                    .order('sort_order', { ascending: true });

                setItems(itemsData || []);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchAudit();
    }, [id, profile]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!audit) {
        return (
            <div className="text-center py-32">
                <p className="text-lg text-slate-500">Audit tidak ditemukan</p>
                <Link href="/dashboard" className="text-blue-500 hover:underline mt-2 inline-block">
                    Kembali ke Dashboard
                </Link>
            </div>
        );
    }

    const auditor = audit.auditor as unknown as { full_name: string } | undefined;
    const auditee = audit.auditee as unknown as {
        full_name: string;
        satker_name: string;
    } | undefined;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <Link
                        href="/dashboard"
                        className={`inline-flex items-center gap-1.5 text-sm transition-colors mb-3 ${isDark ? 'text-slate-400 hover:text-orange-400' : 'text-slate-500 hover:text-blue-500'}`}
                    >
                        <ArrowLeft className="w-4 h-4" /> Kembali
                    </Link>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {audit.title}
                    </h1>
                    {audit.description && (
                        <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{audit.description}</p>
                    )}
                    <div className={`flex flex-wrap items-center gap-4 mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> Tahun {audit.year}
                        </span>
                        {auditor && (
                            <span className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> Evaluator: {auditor.full_name}
                            </span>
                        )}
                        {auditee && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                                {auditee.satker_name || auditee.full_name}
                            </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                            Peran Anda: {audit.effectiveRole === 'auditor' ? 'Evaluator' : audit.effectiveRole === 'auditee' ? 'Auditee' : 'Observer'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* Task Distribution for Group Leaders */}
                    {isLeader && members.length > 0 && (
                        <TaskDistribution
                            items={items}
                            members={members}
                            auditId={id}
                            effectiveRole={audit.effectiveRole}
                            onUpdate={async () => {
                                const { data } = await supabase.from('audit_items').select('*').eq('audit_id', id).order('sort_order');
                                if (data) setItems(data);
                            }}
                        />
                    )}

                    <AuditExportButtons audit={audit} items={items} isDark={isDark} />

                    <Link
                        href={`/audits/${id}/action-plan`}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ${isDark ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        <FileText className="w-4 h-4" />
                        Monitoring Tindak Lanjut
                    </Link>
                </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    {
                        label: 'Total Item',
                        value: items.length,
                        color: 'text-slate-600 dark:text-slate-400',
                    },
                    {
                        label: 'Draft',
                        value: items.filter((i) => i.status === 'DRAFTING').length,
                        color: 'text-slate-500',
                    },
                    {
                        label: 'Menunggu',
                        value: items.filter(
                            (i) =>
                                i.status === 'SUBMITTED' ||
                                i.status === 'PUBLISHED_TO_AUDITEE' ||
                                i.status === 'DISPUTED'
                        ).length,
                        color: 'text-amber-600',
                    },
                    {
                        label: 'Selesai',
                        value: items.filter((i) =>
                            ['FINAL_AGREED', 'FINAL_ALTERED', 'FINAL_ORIGINAL'].includes(i.status)
                        ).length,
                        color: 'text-emerald-600',
                    },
                ].map((s) => (
                    <div
                        key={s.label}
                        className={`rounded-xl px-4 py-3 border ${isDark ? 'bg-[#2A1F10] border-orange-900/30' : 'bg-white border-slate-200'}`}
                    >
                        <p className={`text-xs ${isDark ? 'text-orange-300/70' : 'text-slate-500'}`}>{s.label}</p>
                        <p className={`text-xl font-bold ${isDark ? 'text-orange-100' : s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Audit Table */}
            {
                items.length === 0 ? (
                    <div className={`text-center py-20 rounded-2xl border ${isDark ? 'bg-[#2A1F10] border-orange-900/30 text-orange-200/70' : 'bg-white border-slate-200 text-slate-400'}`}>
                        <p>Belum ada item audit.</p>
                        <p className="text-sm mt-1">
                            Hubungi administrator untuk menambahkan kriteria evaluasi.
                        </p>
                    </div>
                ) : (
                    <AuditTable
                        items={items}
                        role={profile?.role || 'auditee'} // Fallback, but effectiveRole should take precedence in AuditTable
                        effectiveRole={audit.effectiveRole}
                        currentUserId={profile?.id}
                        auditType={audit.type}
                        auditStatus={audit.status}
                        auditId={id}
                        onItemsUpdate={setItems}
                    />
                )
            }
        </div >
    );
}
