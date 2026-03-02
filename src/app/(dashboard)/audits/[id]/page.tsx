'use client';

import { useEffect, useState, use } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Audit, AuditItem, ExtendedAudit, Profile } from '@/types/database';
import { AuditTable } from '@/components/audit/audit-table';
import { TaskDistribution } from '@/components/audit/task-distribution';
import { AuditExportButtons } from '@/components/audit/audit-export-buttons';
import { ArrowLeft, Calendar, Users, Loader2, FileText, Clock, AlertCircle, Lock, Save } from 'lucide-react';
import Link from 'next/link';
import { getAuditById } from '@/lib/actions/audit-server-actions';
import { startExam, submitExamEarly } from '@/lib/actions/exam-actions';
import { getProfilesByIds } from '@/lib/actions/period-actions';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

export default function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const profile = useAuthStore((s) => s.profile);
    const isDark = useThemeStore((s) => s.isDark);
    const [audit, setAudit] = useState<ExtendedAudit | null>(null);
    const [items, setItems] = useState<AuditItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLeader, setIsLeader] = useState(false);
    const [members, setMembers] = useState<Profile[]>([]);
    const [countdownPhase, setCountdownPhase] = useState<number | null>(null);
    const [portalMounted, setPortalMounted] = useState(false);

    useEffect(() => {
        setPortalMounted(true);
    }, []);

    // Exam Timer States
    const [examTimeLeft, setExamTimeLeft] = useState<number | null>(null);
    const [isExamLocked, setIsExamLocked] = useState(false);
    const [isStartingExam, setIsStartingExam] = useState(false);
    const [isSubmittingExam, setIsSubmittingExam] = useState(false);

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

                    // Extract Timer Logic
                    if (auditData.type === 'midterm' || auditData.type === 'final') {
                        if (auditData.exam_start_time) {
                            const start = new Date(auditData.exam_start_time).getTime();
                            const limit = (auditData.time_limit_minutes || 90) * 60 * 1000;
                            const end = start + limit;
                            const now = Date.now();
                            if (now >= end || auditData.is_manually_locked) {
                                setExamTimeLeft(0);
                                setIsExamLocked(true);
                            } else {
                                setExamTimeLeft(Math.floor((end - now) / 1000));
                                setIsExamLocked(false);
                            }
                        } else {
                            setExamTimeLeft(auditData.time_limit_minutes ? auditData.time_limit_minutes * 60 : 90 * 60);
                            setIsExamLocked(!!auditData.is_manually_locked);
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
    const isExam = audit?.type === 'midterm' || audit?.type === 'final';
    const needsToStart = isExam && !audit?.exam_start_time && audit?.effectiveRole === 'auditor';

    const [currentTime, setCurrentTime] = useState<number>(Date.now());

    useEffect(() => {
        if (!needsToStart) return;
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [needsToStart]);

    const scheduledStartTimeMs = audit?.scheduled_start_time ? new Date(audit.scheduled_start_time).getTime() : 0;
    const isWaitingForSchedule = scheduledStartTimeMs > currentTime;
    const isManuallyLockedWait = !!audit?.is_manually_locked;

    // Timer Interval Effects
    useEffect(() => {
        if (examTimeLeft === null || examTimeLeft <= 0 || isExamLocked || !audit?.exam_start_time) return;

        const interval = setInterval(() => {
            setExamTimeLeft((prev) => {
                if (prev === null) return null;
                if (prev <= 1) {
                    setIsExamLocked(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [examTimeLeft, isExamLocked, audit]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (needsToStart) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [needsToStart]);

    // Countdown Animation Effect
    useEffect(() => {
        if (countdownPhase === null) return;
        if (countdownPhase === 0) {
            window.location.reload();
            return;
        }

        const timer = setTimeout(() => {
            setCountdownPhase(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdownPhase]);

    const handleStartExam = async () => {
        setIsStartingExam(true);
        const res = await startExam(id);
        if (res.error) {
            console.error(res.error);
            setIsStartingExam(false);
        } else {
            // Trigger countdown instead of reload
            setCountdownPhase(3);
        }
    };

    const handleSubmitExamEarly = async () => {
        if (!confirm('Apakah Anda yakin ingin menyelesaikan ujian sekarang? Jawaban tidak dapat diubah lagi setelah ini.')) {
            return;
        }

        setIsSubmittingExam(true);
        const res = await submitExamEarly(id);

        if (res.error) {
            toast.error(res.error);
            setIsSubmittingExam(false);
        } else {
            toast.success('Ujian berhasil diselesaikan!');
            window.location.reload();
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}j ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

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
            {/* Blocking Overlay for Exam Start */}
            {needsToStart && portalMounted && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
                    {countdownPhase !== null ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={countdownPhase}
                                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.5, filter: 'blur(5px)' }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                className="text-white text-9xl md:text-[15rem] font-black drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                            >
                                {countdownPhase}
                            </motion.div>
                        </AnimatePresence>
                    ) : isManuallyLockedWait ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`max-w-md w-full rounded-[2rem] p-8 shadow-2xl text-center border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-red-900/20' : 'bg-white border-slate-100 shadow-red-500/10'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent z-0" />
                            <div className="relative z-10">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 border-4 border-white shadow-xl ${isDark ? 'bg-red-900/30' : 'bg-red-50'}`}>
                                    <Lock className="w-10 h-10" />
                                </div>
                                <h2 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ujian Terkunci</h2>
                                <p className={`text-sm mb-8 leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Akses ujian ini telah dikunci sementara oleh Admin. Hubungi pengawas untuk informasi lebih lanjut.
                                </p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full h-14 rounded-xl bg-slate-200 text-slate-700 font-bold text-lg hover:bg-slate-300 transition-all flex justify-center items-center gap-2"
                                >
                                    Muat Ulang Halaman
                                </button>
                            </div>
                        </motion.div>
                    ) : isWaitingForSchedule ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`max-w-md w-full rounded-[2rem] p-8 shadow-2xl text-center border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-900/20' : 'bg-white border-slate-100 shadow-blue-500/10'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent z-0" />
                            <div className="relative z-10">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 border-4 border-white shadow-xl ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                                    <Clock className="w-10 h-10" />
                                </div>
                                <h2 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ujian Belum Dimulai</h2>
                                <p className={`text-sm mb-4 leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Ujian ini dijadwalkan untuk dimulai pada: <br />
                                    <strong className="text-white bg-blue-600 px-2 py-1 rounded inline-block mt-2">
                                        {new Date(audit.scheduled_start_time!).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
                                    </strong>
                                </p>
                                <p className="text-sm font-bold text-blue-500 mb-8">
                                    Sisa waktu tunggu: {formatTime(Math.floor((scheduledStartTimeMs - currentTime) / 1000))}
                                </p>
                                <button
                                    disabled
                                    className="w-full h-14 rounded-xl bg-slate-200 text-slate-400 font-bold text-lg cursor-not-allowed transition-all flex justify-center items-center gap-2"
                                >
                                    Mulai Sekarang
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`max-w-md w-full rounded-[2rem] p-8 shadow-2xl text-center border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-900/20' : 'bg-white border-slate-100 shadow-blue-500/10'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent z-0" />

                            <div className="relative z-10">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 border-4 border-white shadow-xl ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                                    <Clock className="w-10 h-10" />
                                </div>
                                <h2 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ujian Siap Dimulai</h2>
                                <p className={`text-sm mb-8 leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Anda memiliki waktu <strong className="text-blue-500">{audit.time_limit_minutes || 60} menit</strong> untuk menyelesaikan ujian ini. Waktu akan terus berjalan secara otomatis meskipun jaringan terputus atau browser ditutup.
                                </p>
                                <button
                                    disabled={isStartingExam}
                                    onClick={handleStartExam}
                                    className="w-full h-14 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 hover:scale-[1.02] shadow-xl shadow-blue-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {isStartingExam ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Mulai Sekarang'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>, document.body
            )}
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

            {/* Sticky Timer Banner For Active Exams */}
            {isExam && audit?.exam_start_time && (
                <div className={`p-5 rounded-2xl flex items-center justify-between border shadow-sm transition-colors ${isExamLocked ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isExamLocked ? 'bg-red-100 text-red-600' : 'bg-blue-100/50 text-blue-600'}`}>
                            {isExamLocked ? <AlertCircle className="w-6 h-6" /> : <Clock className="w-6 h-6 animate-pulse" />}
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">{isExamLocked ? 'Waktu Ujian Habis' : 'Sisa Waktu Ujian'}</h4>
                            <p className="text-xs font-medium opacity-80 mt-0.5">{isExamLocked ? 'Anda tidak dapat lagi mengubah penilaian.' : 'Sistem otomatis mengunci apabila waktu telah habis.'}</p>
                        </div>
                    </div>
                    <div className="text-4xl font-black tabular-nums tracking-tighter drop-shadow-sm">
                        {examTimeLeft !== null ? formatTime(examTimeLeft) : '--:--'}
                    </div>
                </div>
            )}

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
                        role={profile?.role || 'auditee'}
                        effectiveRole={isExamLocked ? 'observer' : audit?.effectiveRole}
                        currentUserId={profile?.id}
                        auditType={audit?.type}
                        auditStatus={isExamLocked ? 'locked' : audit?.status}
                        auditId={id}
                        onItemsUpdate={setItems}
                        scoreReleased={!!audit?.score_released}
                    />
                )
            }

            {/* Manual Submit Button for Students */}
            {isExam && audit?.exam_start_time && !isExamLocked && audit.effectiveRole === 'auditor' && (
                <div className="pt-8 pb-12 flex justify-center">
                    <button
                        onClick={handleSubmitExamEarly}
                        disabled={isSubmittingExam}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-xl flex items-center gap-2 transition-all ${isSubmittingExam ? 'bg-slate-400 cursor-not-allowed opacity-70' : 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] shadow-emerald-600/20'}`}
                    >
                        {isSubmittingExam ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Menyimpan Nilai...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Submit Ujian
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
