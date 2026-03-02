'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { distributeExam, toggleScoreRelease } from '@/lib/actions/exam-actions';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ClipboardList, Send, AlertCircle, Users, Eye, EyeOff, GraduationCap } from 'lucide-react';
import Link from 'next/link';

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

    // Student selection state
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    // Distributed exams state (for score release)
    const [distributedExams, setDistributedExams] = useState<any[]>([]);
    const [togglingExam, setTogglingExam] = useState<string | null>(null);

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
            .select('id, title, type, time_limit_minutes, is_manually_locked, score_released, individual_auditor_id')
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

    const handleDistribute = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTemplate) {
            toast.error('Pilih template terlebih dahulu');
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

        if (!confirm(`Apakah Anda yakin ingin mendistribusikan ujian ini ke ${selectedStudentIds.length} mahasiswa terpilih? Proses ini tidak dapat dibatalkan.`)) {
            return;
        }

        startTransition(async () => {
            const isoTime = scheduledStartTime ? new Date(scheduledStartTime).toISOString() : undefined;
            const res = await distributeExam(selectedTemplate, examType, duration, isoTime, selectedStudentIds);

            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success(`Berhasil mendistribusikan ujian ke ${res.count} pengguna!`);
                setSelectedTemplate('');
                setSelectedStudentIds([]);
                fetchData(); // Refresh distributed exams list
            }
        });
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
                                <p className="font-semibold mb-1">Mekanisme Distribusi Otomatis:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Sistem akan mengambil <strong>20 kriteria secara acak</strong> dari Master Template yang dipilih.</li>
                                    <li>Setiap mahasiswa (auditor) mendapatkan subset kriteria yang berbeda.</li>
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

                        {/* Student Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                        <Users className="w-4 h-4 text-blue-500" />
                                        3. Pemilihan Mahasiswa (Peserta Ujian)
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
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>4. Batas Waktu Ujian (Menit)</label>
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
                            <label className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>5. Waktu Mulai Ujian (Opsional)</label>
                            <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Jika diisi, mahasiswa tidak bisa memulai ujian sebelum tanggal dan jam yang ditentukan.</p>
                            <input
                                type="datetime-local"
                                value={scheduledStartTime}
                                onChange={(e) => setScheduledStartTime(e.target.value)}
                                className={`w-full h-12 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/50 px-4 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className={`pt-6 border-t flex justify-end ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <button
                                type="submit"
                                disabled={isPending || !selectedTemplate}
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
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
                                <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rilis Nilai ke Mahasiswa</h2>
                                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aktifkan toggle untuk membuka akses nilai ujian ke masing-masing ujian mahasiswa.</p>
                            </div>
                        </div>

                        {/* Midterm Section */}
                        {midtermExams.length > 0 && (
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Ujian Tengah Semester (UTS) — {midtermExams.length} ujian
                                </h3>
                                <div className="space-y-2">
                                    {midtermExams.map(exam => (
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
                                            </div>
                                            <button
                                                disabled={togglingExam === exam.id}
                                                onClick={() => handleToggleScoreRelease(exam.id, !!exam.score_released)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ml-4 ${togglingExam === exam.id ? 'bg-slate-200 text-slate-500 cursor-wait'
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
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Final Exam Section */}
                        {finalExams.length > 0 && (
                            <div>
                                <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                    Ujian Akhir Semester (UAS) — {finalExams.length} ujian
                                </h3>
                                <div className="space-y-2">
                                    {finalExams.map(exam => (
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
                                            </div>
                                            <button
                                                disabled={togglingExam === exam.id}
                                                onClick={() => handleToggleScoreRelease(exam.id, !!exam.score_released)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ml-4 ${togglingExam === exam.id ? 'bg-slate-200 text-slate-500 cursor-wait'
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
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
