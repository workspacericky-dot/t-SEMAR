'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { distributeExam, toggleScoreRelease, updateExamDeadline } from '@/lib/actions/exam-actions';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ClipboardList, Send, AlertCircle, Users, Eye, EyeOff, GraduationCap, Plus, X, CalendarClock, Search } from 'lucide-react';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

export default function ManageExamsPage() {
    const router = useRouter();
    const profile = useAuthStore((s) => s.profile);
    const isDark = useThemeStore((s) => s.isDark);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Form state
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [examType, setExamType] = useState<'midterm' | 'final'>('midterm');
    const [duration, setDuration] = useState<number>(60);
    const [scheduledStartTime, setScheduledStartTime] = useState<string>('');
    const [examExpiresAt, setExamExpiresAt] = useState<string>('');
    const [questionCount, setQuestionCount] = useState<number>(20);
    const [templateCategories, setTemplateCategories] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

    // Manual per-criteria selection (as opposed to random-per-category)
    const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>('auto');
    const [templateItems, setTemplateItems] = useState<{ id: string; category: string; subcategory: string; criteria: string; sort_order: number }[]>([]);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

    // Terms & Conditions
    const [examTerms, setExamTerms] = useState<string[]>([]);
    const [termInput, setTermInput] = useState('');

    // Student selection state
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    // Distributed exams state (for score release)
    const [distributedExams, setDistributedExams] = useState<any[]>([]);
    const [togglingExam, setTogglingExam] = useState<string | null>(null);
    const [releaseFilter, setReleaseFilter] = useState<'midterm' | 'final'>('midterm');
    const [releaseSearch, setReleaseSearch] = useState('');

    // Per-individual deadline reset (force majeure)
    const [editingDeadlineExam, setEditingDeadlineExam] = useState<any | null>(null);
    const [deadlineInput, setDeadlineInput] = useState('');
    const [savingDeadline, setSavingDeadline] = useState(false);

    useEffect(() => {
        // Protect Route
        if (profile && profile.role !== 'superadmin' && profile.role !== 'admin') {
            router.replace('/dashboard');
        }
    }, [profile, router]);

    const fetchData = async () => {
        setLoading(true);
        const supabase = createClient();
        // Fetch strictly dedicated master templates for distribution
        const { data, error } = await supabase
            .from('audits')
            .select('id, title, year, status')
            .eq('type', 'master_template')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Gagal mengambil daftar template.');
        } else {
            setTemplates(data || []);
        }

        // Fetch students
        const { data: studentsData, error: studentsError } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('role', ['auditor', 'participant'])
            .order('full_name');

        if (!studentsError && studentsData) {
            setStudents(studentsData);
        }

        // Fetch distributed exams (midterm/final)
        const { data: examsData } = await supabase
            .from('audits')
            .select('id, title, type, time_limit_minutes, is_manually_locked, score_released, individual_auditor_id, exam_expires_at')
            .in('type', ['midterm', 'final'])
            .order('created_at', { ascending: false });

        if (examsData) {
            setDistributedExams(examsData);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!selectedTemplate) {
            setTemplateCategories([]);
            setSelectedCategories([]);
            setCategoryCounts({});
            setTemplateItems([]);
            setSelectedItemIds([]);
            return;
        }
        const fetchTemplateItems = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('audit_items')
                .select('id, category, subcategory, criteria, sort_order')
                .eq('audit_id', selectedTemplate)
                .order('sort_order');
            if (data) {
                const unique: string[] = [...new Set<string>(data.map((i: any) => String(i.category)))].sort();
                const counts: Record<string, number> = {};
                data.forEach((i: any) => { counts[i.category] = (counts[i.category] || 0) + 1; });
                setTemplateCategories(unique);
                setSelectedCategories(unique);
                setCategoryCounts(counts);
                setTemplateItems(data);
                setSelectedItemIds([]);
            }
        };
        fetchTemplateItems();
    }, [selectedTemplate]);

    // Group items by category -> subcategory for the manual criteria picker
    const groupedTemplateItems = templateItems.reduce((groups, item) => {
        (groups[item.category] ??= {});
        (groups[item.category][item.subcategory] ??= []).push(item);
        return groups;
    }, {} as Record<string, Record<string, typeof templateItems>>);

    const handleDistribute = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTemplate) {
            toast.error('Pilih template terlebih dahulu');
            return;
        }

        if (selectionMode === 'manual' && selectedItemIds.length === 0) {
            toast.error('Pilih minimal satu kriteria untuk dijadikan soal');
            return;
        }

        if (selectedStudentIds.length === 0) {
            toast.error('Pilih minimal satu mahasiswa untuk mengikuti ujian');
            return;
        }

        if (duration < 10) {
            toast.error('Durasi terlalu singkat');
            return;
        }

        const confirmCount = selectionMode === 'manual' ? selectedItemIds.length : questionCount;
        if (!confirm(`Apakah Anda yakin ingin mendistribusikan ujian ini (${confirmCount} soal) ke ${selectedStudentIds.length} mahasiswa terpilih? Proses ini tidak dapat dibatalkan.`)) {
            return;
        }

        startTransition(async () => {
            const isoTime = scheduledStartTime ? new Date(scheduledStartTime).toISOString() : undefined;
            const isoExpiry = examExpiresAt ? new Date(examExpiresAt).toISOString() : undefined;
            const res = await distributeExam(
                selectedTemplate,
                examType,
                duration,
                isoTime,
                selectedStudentIds,
                questionCount,
                selectionMode === 'auto' ? selectedCategories : undefined,
                isoExpiry,
                examTerms,
                selectionMode === 'manual' ? selectedItemIds : undefined
            );

            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success(`Berhasil mendistribusikan ujian ke ${res.count} pengguna!`);
                setSelectedTemplate('');
                setSelectedStudentIds([]);
                setSelectedItemIds([]);
                fetchData(); // Refresh distributed exams list
            }
        });
    };

    // Converts a stored UTC ISO timestamp into the value a <input type="datetime-local">
    // expects, expressed in the browser's local timezone.
    const toLocalInputValue = (isoString: string | null) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    };

    const openDeadlineDialog = (exam: any) => {
        setEditingDeadlineExam(exam);
        setDeadlineInput(toLocalInputValue(exam.exam_expires_at));
    };

    const handleSaveDeadline = async () => {
        if (!editingDeadlineExam) return;
        setSavingDeadline(true);
        const isoValue = deadlineInput ? new Date(deadlineInput).toISOString() : null;
        const res = await updateExamDeadline(editingDeadlineExam.id, isoValue);
        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success(isoValue ? 'Batas waktu ujian berhasil diperbarui.' : 'Batas waktu ujian dihapus — ujian tidak akan kedaluwarsa berdasarkan tanggal.');
            setDistributedExams(prev => prev.map(e => e.id === editingDeadlineExam.id ? { ...e, exam_expires_at: isoValue } : e));
            setEditingDeadlineExam(null);
        }
        setSavingDeadline(false);
    };

    const handleToggleScoreRelease = async (auditId: string, currentReleased: boolean) => {
        setTogglingExam(auditId);
        const newValue = !currentReleased;
        const res = await toggleScoreRelease(auditId, newValue);
        if (res?.error) {
            toast.error(res.error);
        } else {
            toast.success(newValue ? 'Nilai telah dirilis ke mahasiswa.' : 'Nilai disembunyikan dari mahasiswa.');
            setDistributedExams(prev => prev.map(e => e.id === auditId ? { ...e, score_released: newValue } : e));
        }
        setTogglingExam(null);
    };

    // Group distributed exams by type
    const midtermExams = distributedExams.filter(e => e.type === 'midterm');
    const finalExams = distributedExams.filter(e => e.type === 'final');

    const ITEMS_PER_PAGE = 10;
    const [midtermPage, setMidtermPage] = useState(1);
    const [finalPage, setFinalPage] = useState(1);

    // Reset to page 1 whenever the search text changes, since it changes result counts
    useEffect(() => {
        setMidtermPage(1);
        setFinalPage(1);
    }, [releaseSearch]);

    // Score-release list: whichever exam type is selected, narrowed by the search box
    // (matches against the exam title, which embeds the student's name: "UTS - Nama").
    const searchLower = releaseSearch.trim().toLowerCase();
    const currentTypeExams = releaseFilter === 'midterm' ? midtermExams : finalExams;
    const searchedExams = searchLower
        ? currentTypeExams.filter(e => e.title.toLowerCase().includes(searchLower))
        : currentTypeExams;

    const releasePage = releaseFilter === 'midterm' ? midtermPage : finalPage;
    const setReleasePage = releaseFilter === 'midterm' ? setMidtermPage : setFinalPage;
    const releaseTotalPages = Math.ceil(searchedExams.length / ITEMS_PER_PAGE);
    const releasePaged = searchedExams.slice((releasePage - 1) * ITEMS_PER_PAGE, releasePage * ITEMS_PER_PAGE);

    // Form step numbers, computed because "auto" mode has one more step
    // (category selection + question count) than "manual" mode does.
    const stepStudents = selectionMode === 'auto' ? 6 : 5;
    const stepTimer = stepStudents + 1;
    const stepSchedule = stepTimer + 1;
    const stepExpiry = stepSchedule + 1;
    const stepTerms = stepExpiry + 1;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/dashboard" className={`text-sm flex items-center gap-1 mb-2 transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Distribusi Ujian</h1>
                    <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Gunakan Master Template untuk didistribusikan ke seluruh mahasiswa secara acak.</p>
                </div>
            </div>

            {/* ══════════════ DISTRIBUTION FORM ══════════════ */}
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
                <div className="p-8">
                    <form onSubmit={handleDistribute} className="space-y-6">

                        {/* Information Callout */}
                        <div className={`p-4 rounded-xl flex gap-3 text-sm ${isDark ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-blue-50 text-blue-800'}`}>
                            <AlertCircle className={`w-5 h-5 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <div>
                                <p className="font-semibold mb-1">Mekanisme Distribusi:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    {selectionMode === 'auto' ? (
                                        <>
                                            <li>Sistem akan mengambil <strong>{questionCount} kriteria secara acak</strong> dari komponen yang Anda pilih.</li>
                                            <li>Setiap mahasiswa mendapatkan subset kriteria yang <strong>berbeda secara acak</strong>.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>Setiap mahasiswa akan mendapatkan <strong>{selectedItemIds.length} kriteria yang sama persis</strong> sesuai pilihan Anda.</li>
                                            <li><strong>Tidak ada pengacakan</strong> — semua peserta mengerjakan soal identik.</li>
                                        </>
                                    )}
                                    <li>Jawaban dan Evidence dari Auditee di template akan disalin utuh.</li>
                                    <li>Ujian dilengkapi timer otomatis ({duration} menit) yang mengunci pengisian saat waktu habis.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Master Template Selection */}
                        <div className="space-y-2">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>1. Pilih Master Template</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih audit sumber (yg telah diisi oleh admin/auditee) sebagai basis ujian.</p>
                            <select
                                required
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className={`w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            >
                                <option value="" disabled>-- Pilih Template --</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.title} ({t.year}) - Status: {t.status}
                                    </option>
                                ))}
                            </select>
                            {templates.length === 0 && (
                                <p className="text-red-500 text-xs mt-1">Tidak ada Audit yang tersedia. Silakan buat Audit baru terlebih dahulu.</p>
                            )}
                        </div>

                        {/* Exam Type Selection */}
                        <div className="space-y-2">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>2. Jenis Ujian</label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${examType === 'midterm'
                                    ? isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-600 bg-blue-50'
                                    : isDark ? 'border-slate-600 hover:border-blue-500/50' : 'border-slate-200 hover:border-blue-200'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="examType"
                                        value="midterm"
                                        checked={examType === 'midterm'}
                                        onChange={() => setExamType('midterm')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Ujian Tengah Semester (UTS)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${examType === 'final'
                                    ? isDark ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-600 bg-indigo-50'
                                    : isDark ? 'border-slate-600 hover:border-indigo-500/50' : 'border-slate-200 hover:border-indigo-200'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="examType"
                                        value="final"
                                        checked={examType === 'final'}
                                        onChange={() => setExamType('final')}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Ujian Akhir Semester (UAS)</span>
                                </label>
                            </div>
                        </div>

                        {/* Selection Mode */}
                        {templateItems.length > 0 && (
                            <div className="space-y-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>3. Cara Memilih Soal</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectionMode === 'auto'
                                        ? isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-600 bg-blue-50'
                                        : isDark ? 'border-slate-600 hover:border-blue-500/50' : 'border-slate-200 hover:border-blue-200'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="selectionMode"
                                            checked={selectionMode === 'auto'}
                                            onChange={() => setSelectionMode('auto')}
                                            className="w-4 h-4 mt-0.5 text-blue-600"
                                        />
                                        <div>
                                            <span className={`font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Otomatis (Acak per Komponen)</span>
                                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih komponen AKIP, sistem mengacak N soal dari situ. Tiap mahasiswa bisa dapat soal berbeda.</span>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectionMode === 'manual'
                                        ? isDark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-600 bg-blue-50'
                                        : isDark ? 'border-slate-600 hover:border-blue-500/50' : 'border-slate-200 hover:border-blue-200'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="selectionMode"
                                            checked={selectionMode === 'manual'}
                                            onChange={() => setSelectionMode('manual')}
                                            className="w-4 h-4 mt-0.5 text-blue-600"
                                        />
                                        <div>
                                            <span className={`font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Manual (Pilih Kriteria Sendiri)</span>
                                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Centang kriteria spesifik, bisa lintas kategori. Semua mahasiswa mendapat soal yang identik.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {selectionMode === 'auto' ? (
                            <>
                                {/* Category Selection */}
                                {templateCategories.length > 0 && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>4. Komponen yang Diujikan</label>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih komponen AKIP yang akan dijadikan sumber soal. Soal akan diacak dari pool komponen terpilih.</p>
                                        </div>
                                        <div className={`rounded-xl p-4 space-y-2 border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                            {templateCategories.map(cat => {
                                                const shortName = cat.replace(/^\d+\.\s*/, '');
                                                const isChecked = selectedCategories.includes(cat);
                                                return (
                                                    <label key={cat} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border border-transparent ${isDark ? 'hover:bg-slate-700 hover:border-slate-600' : 'hover:bg-white hover:border-slate-200'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                setSelectedCategories(prev =>
                                                                    isChecked ? prev.filter(c => c !== cat) : [...prev, cat]
                                                                );
                                                            }}
                                                        />
                                                        <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{shortName}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className={`text-xs font-medium text-right ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {selectedCategories.length} dari {templateCategories.length} komponen dipilih
                                        </p>
                                    </div>
                                )}

                                {/* Question Count */}
                                <div className="space-y-2">
                                    <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>5. Jumlah Soal per Mahasiswa</label>
                                    <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Jumlah kriteria yang akan diacak dari komponen terpilih untuk setiap mahasiswa.
                                        {selectedCategories.length > 0 && (
                                            <> Tersedia <strong>{selectedCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0)}</strong> soal dari komponen terpilih.</>
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            max={selectedCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0) || 80}
                                            value={questionCount}
                                            onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
                                            className={`flex-1 h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setQuestionCount(selectedCategories.reduce((sum, cat) => sum + (categoryCounts[cat] || 0), 0))}
                                            disabled={selectedCategories.length === 0}
                                            className={`h-12 px-5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                                        >
                                            Max
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Manual Criteria Picker */
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>4. Pilih Kriteria Soal</label>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Centang kriteria spesifik yang ingin dijadikan soal, bisa lintas kategori.</p>
                                    </div>
                                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 ml-4 ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                        {selectedItemIds.length} dipilih
                                    </span>
                                </div>

                                <div className={`rounded-xl max-h-96 overflow-y-auto p-4 space-y-5 border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                    {Object.entries(groupedTemplateItems).map(([category, subcats]) => (
                                        <div key={category}>
                                            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {category.replace(/^\d+\.\s*/, '')}
                                            </p>
                                            {Object.entries(subcats).map(([subcategory, subItems]) => {
                                                const subIds = subItems.map(i => i.id);
                                                const allChecked = subIds.every(id => selectedItemIds.includes(id));
                                                return (
                                                    <div key={subcategory} className={`pl-3 border-l-2 mb-3 last:mb-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{subcategory}</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedItemIds(prev =>
                                                                    allChecked ? prev.filter(id => !subIds.includes(id)) : [...new Set([...prev, ...subIds])]
                                                                )}
                                                                className={`text-[11px] font-semibold shrink-0 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                                            >
                                                                {allChecked ? 'Batalkan semua' : 'Pilih semua'}
                                                            </button>
                                                        </div>
                                                        {subItems.map(item => {
                                                            const checked = selectedItemIds.includes(item.id);
                                                            return (
                                                                <label key={item.id} className={`flex items-start gap-2 py-1 px-1 rounded cursor-pointer transition-colors ${isDark ? 'hover:bg-slate-700' : 'hover:bg-white'}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                                                                        checked={checked}
                                                                        onChange={() => setSelectedItemIds(prev =>
                                                                            checked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                                                        )}
                                                                    />
                                                                    <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.criteria}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Student Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                        <Users className="w-4 h-4 text-blue-500" />
                                        {stepStudents}. Pemilihan Mahasiswa (Peserta Ujian)
                                    </label>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih siapa saja yang berhak mengikuti ujian ini.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedStudentIds.length === students.length) {
                                            setSelectedStudentIds([]);
                                        } else {
                                            setSelectedStudentIds(students.map(s => s.id));
                                        }
                                    }}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${isDark ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30' : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200'}`}
                                >
                                    {selectedStudentIds.length === students.length ? 'Batalkan Semua' : 'Pilih Semua'}
                                </button>
                            </div>

                            <div className={`rounded-xl max-h-60 overflow-y-auto p-4 space-y-2 border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                {students.length === 0 ? (
                                    <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tidak ada mahasiswa yang ditemukan.</p>
                                ) : (
                                    students.map(student => (
                                        <label key={student.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border border-transparent ${isDark ? 'hover:bg-slate-700 hover:border-slate-600' : 'hover:bg-white hover:border-slate-200'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                checked={selectedStudentIds.includes(student.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedStudentIds(prev => [...prev, student.id]);
                                                    } else {
                                                        setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                                                    }
                                                }}
                                            />
                                            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{student.full_name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                            <p className={`text-xs font-medium text-right ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {selectedStudentIds.length} dari {students.length} terpilih
                            </p>
                        </div>

                        {/* Timer Settings */}
                        <div className="space-y-2">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{stepTimer}. Batas Waktu Ujian (Menit)</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Waktu mundur dimulai otomatis ketika mahasiswa membuka ujian. Akses akan terkunci setelah waktu habis.</p>
                            <input
                                type="number"
                                required
                                min="10"
                                max="300"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                                className={`w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                        </div>

                        {/* Schedule Settings */}
                        <div className="space-y-2">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{stepSchedule}. Waktu Mulai Ujian (Opsional)</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Jika diisi, mahasiswa tidak bisa memulai ujian sebelum tanggal dan jam yang ditentukan.</p>
                            <input
                                type="datetime-local"
                                value={scheduledStartTime}
                                onChange={(e) => setScheduledStartTime(e.target.value)}
                                className={`w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                        </div>

                        {/* Expiry */}
                        <div className="space-y-2">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{stepExpiry}. Batas Kedaluwarsa Ujian (Opsional)</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Setelah tanggal &amp; jam ini, seluruh mahasiswa tidak lagi bisa membuka atau mengerjakan ujian — terlepas dari apakah mereka sudah mulai atau belum.
                            </p>
                            <input
                                type="datetime-local"
                                value={examExpiresAt}
                                onChange={(e) => setExamExpiresAt(e.target.value)}
                                className={`w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-orange-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                            {examExpiresAt && scheduledStartTime && new Date(examExpiresAt) <= new Date(scheduledStartTime) && (
                                <p className="text-xs text-red-500 font-medium">⚠ Waktu kedaluwarsa harus setelah waktu mulai ujian.</p>
                            )}
                        </div>

                        {/* Terms and Conditions */}
                        <div className="space-y-3">
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{stepTerms}. Syarat &amp; Ketentuan Ujian (Opsional)</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Tambahkan ketentuan ujian yang harus disetujui mahasiswa sebelum memulai. Tekan <strong>Enter</strong> untuk menambahkan.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Contoh: Saya berjanji tidak akan menyontek..."
                                    value={termInput}
                                    onChange={(e) => setTermInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (termInput.trim()) {
                                                setExamTerms(prev => [...prev, termInput.trim()]);
                                                setTermInput('');
                                            }
                                        }
                                    }}
                                    className={`flex-1 h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (termInput.trim()) {
                                            setExamTerms(prev => [...prev, termInput.trim()]);
                                            setTermInput('');
                                        }
                                    }}
                                    className={`h-12 px-5 rounded-xl border font-semibold text-sm transition-colors flex items-center justify-center ${isDark ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {examTerms.length > 0 && (
                                <ul className={`mt-3 space-y-2 p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                    {examTerms.map((term, index) => (
                                        <li key={index} className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                                            <div className="flex gap-3 items-start flex-1">
                                                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                                                <p className="text-sm pt-0.5 leading-relaxed">{term}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setExamTerms(prev => prev.filter((_, i) => i !== index))}
                                                className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-slate-100 text-slate-400 hover:text-red-500'}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Submit Actions */}
                        <div className={`pt-6 border-t flex justify-end ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <button
                                type="submit"
                                disabled={isPending || !selectedTemplate || (selectionMode === 'manual' && selectedItemIds.length === 0)}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Mendistribusikan...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Distribusi ke Mahasiswa
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ══════════════ SCORE RELEASE SECTION ══════════════ */}
            {(midtermExams.length > 0 || finalExams.length > 0) && (
                <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rilis Nilai ke Mahasiswa</h2>
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aktifkan toggle untuk membuka akses nilai ujian ke masing-masing ujian mahasiswa.</p>
                                </div>
                            </div>

                            {/* UTS / UAS Filter */}
                            <div className={`inline-flex items-center gap-1 rounded-xl border p-1 shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                <button
                                    type="button"
                                    onClick={() => setReleaseFilter('midterm')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${releaseFilter === 'midterm'
                                        ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    UTS ({midtermExams.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReleaseFilter('final')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${releaseFilter === 'final'
                                        ? isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white'
                                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    UAS ({finalExams.length})
                                </button>
                            </div>
                        </div>

                        {/* Search by student name */}
                        <div className="relative">
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <input
                                type="text"
                                placeholder="Cari nama peserta..."
                                value={releaseSearch}
                                onChange={(e) => setReleaseSearch(e.target.value)}
                                className={`w-full h-11 pl-11 pr-4 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 text-sm ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                            />
                        </div>

                        <div>
                            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${releaseFilter === 'midterm' ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                                {releaseFilter === 'midterm' ? 'Ujian Tengah Semester (UTS)' : 'Ujian Akhir Semester (UAS)'} — {searchLower ? `${searchedExams.length} dari ${currentTypeExams.length}` : searchedExams.length} ujian
                            </h3>

                            {releasePaged.length === 0 ? (
                                <p className={`text-sm text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {searchLower
                                        ? `Tidak ada peserta ${releaseFilter === 'midterm' ? 'UTS' : 'UAS'} yang cocok dengan "${releaseSearch}".`
                                        : `Belum ada ujian ${releaseFilter === 'midterm' ? 'UTS' : 'UAS'} yang didistribusikan.`}
                                </p>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        {releasePaged.map(exam => (
                                            <div key={exam.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${exam.score_released
                                                ? isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
                                                : isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                                                }`}>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-semibold text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{exam.title}</h4>
                                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        Durasi: {exam.time_limit_minutes || '-'} menit
                                                        {exam.is_manually_locked && <span className="ml-2 text-red-500 font-medium">• Terkunci</span>}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        Deadline: {exam.exam_expires_at
                                                            ? new Date(exam.exam_expires_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                                                            : 'Tidak ada'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                                    <button
                                                        onClick={() => openDeadlineDialog(exam)}
                                                        className={`p-2 rounded-lg transition-colors border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                                        title="Atur ulang deadline untuk peserta ini"
                                                    >
                                                        <CalendarClock className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        disabled={togglingExam === exam.id}
                                                        onClick={() => handleToggleScoreRelease(exam.id, !!exam.score_released)}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${togglingExam === exam.id ? 'bg-slate-200 text-slate-500 cursor-wait'
                                                            : exam.score_released
                                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                                                : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                                            }`}
                                                    >
                                                        {togglingExam === exam.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : exam.score_released ? (
                                                            <><Eye className="w-4 h-4" /> Nilai Dirilis</>
                                                        ) : (
                                                            <><EyeOff className="w-4 h-4" /> Belum Dirilis</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {releaseTotalPages > 1 && (
                                        <ExamPagination page={releasePage} totalPages={releaseTotalPages} onPageChange={setReleasePage} isDark={isDark} />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════ DEADLINE RESET DIALOG ══════════════ */}
            <Dialog open={editingDeadlineExam !== null} onOpenChange={(open) => { if (!open) setEditingDeadlineExam(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800 dark:text-slate-100">
                            Atur Ulang Deadline
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 dark:text-slate-400">
                            Batas waktu ujian untuk <strong>{editingDeadlineExam?.title}</strong> saja — peserta lain tidak terpengaruh. Gunakan untuk kasus force majeure.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Deadline Baru</label>
                        <input
                            type="datetime-local"
                            value={deadlineInput}
                            onChange={(e) => setDeadlineInput(e.target.value)}
                            className="w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-200"
                        />
                        {deadlineInput && (
                            <button
                                type="button"
                                onClick={() => setDeadlineInput('')}
                                className="text-xs font-medium text-red-500 hover:text-red-600"
                            >
                                Hapus batas waktu (ujian tidak akan kedaluwarsa berdasarkan tanggal)
                            </button>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <button
                            onClick={() => setEditingDeadlineExam(null)}
                            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            disabled={savingDeadline}
                            onClick={handleSaveDeadline}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                        >
                            {savingDeadline && <Loader2 className="w-4 h-4 animate-spin" />}
                            Simpan
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ExamPagination({ page, totalPages, onPageChange, isDark }: {
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
    isDark: boolean;
}) {
    const btn = `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed`;
    const active = isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white';
    const inactive = isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const visible = pages.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

    return (
        <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button className={`${btn} ${inactive}`} disabled={page === 1} onClick={() => onPageChange(1)}>«</button>
            <button className={`${btn} ${inactive}`} disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>

            {visible.map((p, idx) => {
                const prev = visible[idx - 1];
                return (
                    <span key={p} className="flex items-center gap-1.5">
                        {prev && p - prev > 1 && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>…</span>}
                        <button className={`${btn} ${p === page ? active : inactive}`} onClick={() => onPageChange(p)}>{p}</button>
                    </span>
                );
            })}

            <button className={`${btn} ${inactive}`} disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</button>
            <button className={`${btn} ${inactive}`} disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>»</button>
        </div>
    );
}
