'use client';

import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { Audit, AuditItem } from '@/types/database';
import { getDashboardData } from '@/lib/actions/audit-server-actions';
import Link from 'next/link';
import {
    ClipboardCheck,
    Clock,
    CheckCircle2,
    Calendar,
    ArrowRight,
    Users,
    Lock,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

interface DashboardStats {
    totalAudits: number;
    pendingItems: number;
    completedItems: number;
    disputedItems: number;
}

// Color palette for the radar chart – soft pastels
const COMPONENT_COLORS = [
    { stroke: '#818CF8', fill: '#818CF8', name: 'Indigo' },   // Perencanaan
    { stroke: '#F472B6', fill: '#F472B6', name: 'Pink' },     // Pengukuran
    { stroke: '#34D399', fill: '#34D399', name: 'Emerald' },  // Pelaporan
    { stroke: '#FBBF24', fill: '#FBBF24', name: 'Amber' },   // Evaluasi Internal
];

export default function DashboardPage() {
    const profile = useAuthStore((s) => s.profile);
    const isDark = useThemeStore((s) => s.isDark);
    const [audits, setAudits] = useState<any[]>([]); // TODO: fix type
    const [allAuditItems, setAllAuditItems] = useState<AuditItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Which audit is toggled ON for filtering (null = show all)
    const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            if (!profile) return;

            try {
                // Use imported server action
                const { audits: userAudits, items } = await getDashboardData(profile.id);

                setAudits(userAudits);
                setAllAuditItems((items || []) as AuditItem[]);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile]);

    // ── Derived data (recomputed when selectedAuditId changes) ──
    const filteredItems = useMemo(() => {
        if (!selectedAuditId) return allAuditItems;
        return allAuditItems.filter(i => i.audit_id === selectedAuditId);
    }, [allAuditItems, selectedAuditId]);

    const stats: DashboardStats = useMemo(() => {
        const pending = filteredItems.filter(
            (i) => i.status === 'DRAFTING' || i.status === 'PUBLISHED_TO_AUDITEE'
        ).length;
        const completed = filteredItems.filter((i) =>
            ['FINAL_AGREED', 'FINAL_ALTERED', 'FINAL_ORIGINAL'].includes(i.status)
        ).length;
        const disputed = filteredItems.filter((i) => i.status === 'DISPUTED').length;

        return {
            totalAudits: selectedAuditId ? 1 : audits.length,
            pendingItems: pending,
            completedItems: completed,
            disputedItems: disputed,
        };
    }, [filteredItems, audits, selectedAuditId]);

    const componentProgress = useMemo(() => {
        const categoryMap = new Map<string, { bobot: number; items: AuditItem[] }>();
        for (const item of filteredItems) {
            if (!categoryMap.has(item.category)) {
                categoryMap.set(item.category, { bobot: item.category_bobot || 0, items: [] });
            }
            categoryMap.get(item.category)!.items.push(item);
        }

        const progressData = [];
        for (const [category, { bobot: categoryBobot, items: catItems }] of categoryMap) {
            // Group by subcategory to calculate weighted score
            const subcatMap = new Map<string, AuditItem[]>();
            for (const item of catItems) {
                if (!subcatMap.has(item.subcategory)) subcatMap.set(item.subcategory, []);
                subcatMap.get(item.subcategory)!.push(item);
            }

            let catScore = 0;
            for (const [, subItems] of subcatMap) {
                // Score per subcategory: sum(nilai × bobot) / 100 → normalized 0-100
                const subScoreRaw = subItems.reduce((sum, item) => {
                    const nilai = item.nilai_evaluator || item.nilai_auditee || 0;
                    return sum + (nilai * (item.bobot || 0));
                }, 0);
                const subScore = subScoreRaw / 100;
                const subWeight = subItems[0].subcategory_bobot || 0;
                catScore += (subScore * subWeight) / 100;
            }

            // catScore is now 0–categoryBobot range; normalize to 0–100 for chart
            const normalizedScore = categoryBobot > 0 ? (catScore / categoryBobot) * 100 : 0;

            let shortName = category.replace(/^\d+\.\s*/, '');
            if (shortName.length > 18) shortName = shortName.split(' ').slice(0, 2).join(' ');
            progressData.push({
                subject: shortName,
                fullSubject: category.replace(/^\d+\.\s*/, ''),
                score: Math.round(normalizedScore),
                progress: Math.round((catItems.reduce((sum, i) => sum + (i.tl_progress || 0), 0)) / (catItems.length || 1)),
                fullMark: 100,
            });
        }

        const order = ['Perencanaan', 'Pengukuran', 'Pelaporan', 'Evaluasi'];
        progressData.sort((a, b) => {
            const aIdx = order.findIndex(o => a.subject.includes(o));
            const bIdx = order.findIndex(o => b.subject.includes(o));
            return aIdx - bIdx;
        });

        return progressData;
    }, [filteredItems]);

    const totalItems = stats.pendingItems + stats.completedItems + stats.disputedItems || 1;
    const completionRate = Math.round((stats.completedItems / totalItems) * 100);
    const pendingRate = Math.round((stats.pendingItems / totalItems) * 100);

    // Find the first audit with pending items to link the "Prioritized Tasks" card
    const firstPendingAudit = useMemo(() => {
        return audits.find(a =>
            allAuditItems.some(i => i.audit_id === a.id && (i.status === 'DRAFTING' || i.status === 'PUBLISHED_TO_AUDITEE'))
        );
    }, [audits, allAuditItems]);

    // ── Toggle handler ──
    const handleToggle = (auditId: string) => {
        setSelectedAuditId(prev => prev === auditId ? null : auditId);
    };

    // ── Render ──
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => <div key={i} className={`h-64 rounded-3xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Welcome Header ── */}
            <div>
                <h1 className={`text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Welcome, {profile?.full_name?.split(' ')[0]}
                </h1>
                <p className={`text-lg mt-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Here's today's AKIP evaluation overview for you.
                </p>
            </div>

            <div className="grid grid-cols-12 gap-8">
                {/* ══════════════ LEFT COLUMN ══════════════ */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* ── Profile & Info Cards Row ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Card 1: Profile Card */}
                        <div className={`rounded-[2rem] p-6 shadow-sm border flex flex-col items-center text-center relative overflow-hidden ${isDark ? 'bg-[#1A1D27] border-slate-800' : 'bg-white border-slate-100'
                            }`}>
                            {/* Avatar – linked to the "A" initial */}
                            <div className="relative mb-4 mt-2">
                                <div className={`w-24 h-24 rounded-full p-1 border-2 border-dashed ${isDark ? 'border-blue-400/40' : 'border-blue-200'}`}>
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-blue-500/20">
                                        {profile?.full_name?.[0]?.toUpperCase() || 'A'}
                                    </div>
                                </div>
                                <div className="absolute bottom-0 right-1 w-7 h-7 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white shadow-sm">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                            </div>

                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{profile?.full_name}</h3>
                            <p className={`text-[11px] font-medium mb-6 uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{profile?.role}</p>

                            <div className={`flex items-center gap-6 w-full justify-center border-t pt-6 ${isDark ? 'border-slate-700/50' : 'border-slate-50'}`}>
                                <div>
                                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.totalAudits}</p>
                                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Audits</p>
                                </div>
                                <div>
                                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.completedItems}</p>
                                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Done</p>
                                </div>
                                <div title="Disputed items – unresolved disagreements between auditor and auditee">
                                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.disputedItems}</p>
                                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Disputes</p>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Prioritized Tasks → Link to pending items */}
                        <Link
                            href={firstPendingAudit ? `/audits/${firstPendingAudit.id}` : '/audits'}
                            className="relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-pink-500/10"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#FF9A9E] to-[#FECFEF] z-0" />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay" />

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <p className="font-medium text-black/50 mb-1 text-sm">Pending Items</p>
                                    <h3 className="text-2xl font-bold text-slate-900 leading-tight">Prioritized<br />Tasks</h3>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 text-slate-900">
                                    <Clock className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="relative z-10 mt-8">
                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-5xl font-bold text-slate-900">{pendingRate}%</span>
                                    <span className="text-slate-800/70 font-medium mb-1.5">Pending</span>
                                </div>
                                <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-900 rounded-full transition-all duration-700" style={{ width: `${pendingRate}%` }} />
                                </div>
                            </div>
                        </Link>

                        {/* Card 3: Additional Tasks → Infographic only (no interaction) */}
                        <div className="relative overflow-hidden rounded-[2rem] p-8 flex flex-col justify-between shadow-lg shadow-purple-500/10">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#a18cd1] to-[#fbc2eb] z-0" />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay" />

                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <p className="font-medium text-white/70 mb-1 text-sm">Completed Items</p>
                                    <h3 className="text-2xl font-bold text-white leading-tight">Additional<br />Tasks</h3>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 text-white">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="relative z-10 mt-8">
                                <div className="flex items-end gap-2 mb-2">
                                    <span className="text-5xl font-bold text-white">{completionRate}%</span>
                                    <span className="text-white/70 font-medium mb-1.5">Completed</span>
                                </div>
                                <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Spider Web (Radar) Chart ── */}
                    <div className={`rounded-[2rem] p-8 border shadow-sm relative overflow-hidden ${isDark ? 'bg-[#1A1D27] border-slate-800' : 'bg-white border-slate-100'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Auditee&apos;s Strength Overview</h3>
                                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Weighted score per evaluation component
                                    {selectedAuditId && <span className="text-blue-400 ml-1">(filtered)</span>}
                                </p>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                                }`}>
                                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Current Period</span>
                            </div>
                        </div>

                        {componentProgress.length > 0 ? (
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={componentProgress}>
                                        <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
                                        <PolarAngleAxis
                                            dataKey="subject"
                                            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 600 }}
                                        />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip isDark={isDark} />} />
                                        <Radar
                                            name="Score"
                                            dataKey="score"
                                            stroke="#818CF8"
                                            fill="#818CF8"
                                            fillOpacity={isDark ? 0.3 : 0.2}
                                            strokeWidth={2}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className={`h-[320px] flex items-center justify-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                <p className="text-sm font-medium">No evaluation data available yet.</p>
                            </div>
                        )}

                        {/* Color-coded Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-6 mt-2">
                            {componentProgress.map((item, index) => (
                                <div key={item.subject} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPONENT_COLORS[index % COMPONENT_COLORS.length].fill }} />
                                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {item.subject}
                                    </span>
                                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {item.score}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ══════════════ RIGHT COLUMN ══════════════ */}
                <div className="col-span-12 xl:col-span-4 space-y-8">


                    {/* ── My Tasks & Group Practice ── */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Assignments</h3>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Toggle to filter dashboard
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">

                            {/* Individual Assignments */}
                            <div>
                                <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Individual Tasks
                                </h4>
                                <div className="space-y-3">
                                    {audits.filter(a => a.type !== 'group_practice').length === 0 ? (
                                        <div className={`text-center py-8 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 ${isDark ? 'text-slate-500 bg-slate-800/10 border-slate-700/50' : 'text-slate-400 bg-white/30 border-slate-200'}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            </div>
                                            <p className="text-sm font-medium">Beban Kerja Individu Kosong</p>
                                            <p className="text-[10px] opacity-70">Belum ada tugas yang ditugaskan kepada Anda secara personal.</p>
                                        </div>
                                    ) : (
                                        audits.filter(a => a.type !== 'group_practice').map(audit => {
                                            const isActive = selectedAuditId === audit.id;
                                            const isExam = audit.type === 'midterm' || audit.type === 'final';
                                            let isLocked = audit.status === 'locked';
                                            if (!isLocked && isExam && audit.time_limit_minutes && audit.exam_start_time) {
                                                const limitSeconds = audit.time_limit_minutes * 60;
                                                const startedAt = new Date(audit.exam_start_time).getTime();
                                                const now = new Date().getTime();
                                                const elapsed = Math.floor((now - startedAt) / 1000);
                                                if (limitSeconds - elapsed <= 0) {
                                                    isLocked = true;
                                                }
                                            }

                                            return (
                                                <div
                                                    key={audit.id}
                                                    className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isActive
                                                        ? isDark
                                                            ? 'bg-pink-500/10 border-pink-500/30 shadow-lg shadow-pink-500/5'
                                                            : 'bg-pink-50 border-pink-200 shadow-lg shadow-pink-100/50'
                                                        : isDark
                                                            ? 'bg-[#1A1D27] border-slate-800 hover:border-slate-700'
                                                            : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                                        }`}
                                                >
                                                    <button
                                                        onClick={() => { handleToggle(audit.id); }}
                                                        className="shrink-0"
                                                    >
                                                        {isActive ? (
                                                            <ToggleRight className="w-6 h-6 text-pink-500" />
                                                        ) : (
                                                            <ToggleLeft className={`w-6 h-6 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                                        )}
                                                    </button>

                                                    <Link href={`/audits/${audit.id}`} className="flex-1 min-w-0 flex items-center justify-between">
                                                        <div>
                                                            <h4 className={`font-bold text-sm leading-tight line-clamp-1 transition-colors ${isActive
                                                                ? 'text-pink-600'
                                                                : isDark ? 'text-white group-hover:text-pink-400' : 'text-slate-800 group-hover:text-pink-600'
                                                                }`}>
                                                                {audit.title}
                                                            </h4>
                                                            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {audit.type === 'midterm' ? 'Midterm Exam' : 'Individual'}{isLocked && ' (Selesai)'}
                                                            </p>
                                                        </div>
                                                        {isLocked && <Lock className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />}
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Group Practice */}
                            <div>
                                <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Group Practice
                                </h4>
                                <div className="space-y-3">
                                    {audits.filter(a => a.type === 'group_practice').length === 0 ? (
                                        <div className={`text-center py-8 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 ${isDark ? 'text-slate-500 bg-slate-800/10 border-slate-700/50' : 'text-slate-400 bg-white/30 border-slate-200'}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <Users className="w-5 h-5 opacity-50" />
                                            </div>
                                            <p className="text-sm font-medium">Simulasi Tim Kosong</p>
                                            <p className="text-[10px] opacity-70">Kelompok Anda belum mendapatkan tugas simulasi.</p>
                                        </div>
                                    ) : (
                                        audits.filter(a => a.type === 'group_practice').map(audit => {
                                            const isActive = selectedAuditId === audit.id;
                                            // Determine role for display based on effectiveRole
                                            const roleLabel = audit.effectiveRole === 'auditor' ? 'Auditor Team' : 'Auditee Team';

                                            return (
                                                <div
                                                    key={audit.id}
                                                    className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isActive
                                                        ? isDark
                                                            ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/5'
                                                            : 'bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-100/50'
                                                        : isDark
                                                            ? 'bg-[#1A1D27] border-slate-800 hover:border-slate-700'
                                                            : 'bg-white border-transparent hover:border-slate-200 hover:shadow-md'
                                                        }`}
                                                >
                                                    <button
                                                        onClick={() => handleToggle(audit.id)}
                                                        className="shrink-0"
                                                    >
                                                        {isActive ? (
                                                            <ToggleRight className="w-6 h-6 text-indigo-500" />
                                                        ) : (
                                                            <ToggleLeft className={`w-6 h-6 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                                        )}
                                                    </button>

                                                    <Link href={`/audits/${audit.id}`} className="flex-1 min-w-0">
                                                        <h4 className={`font-bold text-sm leading-tight line-clamp-1 transition-colors ${isActive
                                                            ? 'text-indigo-600'
                                                            : isDark ? 'text-white group-hover:text-indigo-400' : 'text-slate-800 group-hover:text-indigo-600'
                                                            }`}>
                                                            {audit.title}
                                                        </h4>
                                                        <div className="flex items-center justify-between mt-0.5">
                                                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                Practice
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${audit.effectiveRole === 'auditor'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                                }`}>
                                                                {roleLabel}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <Link
                                href="/audits"
                                className={`flex items-center gap-2 text-sm font-semibold transition-colors mt-2 w-full justify-center ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                                    }`}
                            >
                                See all tasks
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* ── Component Status (formerly "Developed areas") ── */}
                    <div>
                        <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Component Status</h3>
                        <p className={`text-sm mb-6 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            Track your AKIP evaluation progress here
                        </p>

                        <div className="space-y-5">
                            {componentProgress.length > 0 ? (
                                componentProgress.map((item, index) => (
                                    <div key={item.subject} className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-sm font-bold transition-colors w-[65%] truncate ${isDark ? 'text-slate-300 group-hover:text-blue-400' : 'text-slate-700 group-hover:text-blue-600'
                                                }`} title={item.fullSubject}>
                                                {item.subject}
                                            </span>
                                            <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.progress}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{
                                                        width: `${item.progress}%`,
                                                        backgroundColor: COMPONENT_COLORS[index % COMPONENT_COLORS.length].fill
                                                    }}
                                                />
                                            </div>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${item.progress >= 80
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-500'
                                                : isDark ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-300'
                                                }`}>
                                                <ArrowRight className="w-2.5 h-2.5 rotate-[-45deg]" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    No progress data available yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Custom Tooltip for Radar Chart ──
function ChartTooltip({ active, payload, label, isDark }: any) {
    if (active && payload && payload.length) {
        return (
            <div className={`p-3 border rounded-xl shadow-xl backdrop-blur-sm ${isDark ? 'bg-[#1A1D27]/95 border-slate-700' : 'bg-white border-slate-100'
                }`}>
                <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {payload[0].value}%
                </p>
            </div>
        );
    }
    return null;
}
