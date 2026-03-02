'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { distributeExam } from '@/lib/actions/exam-actions';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ClipboardList, Send, AlertCircle, Users } from 'lucide-react';
import Link from 'next/link';

export default function ManageExamsPage() {
    const router = useRouter();
    const profile = useAuthStore((s) => s.profile);
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

    useEffect(() => {
        // Protect Route
        if (profile && profile.role !== 'superadmin') {
            router.replace('/dashboard');
        }
    }, [profile, router]);

    const fetchTemplates = async () => {
        setLoading(true);
        const supabase = createClient();
        // Fetch strictly dedicated master templates for distribution
        const { data, error } = await supabase
            .from('audits')
            .select('id, title, year, status')
            .eq('type', 'master_template') // Explicitly rely on the designated type
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
            .order('full_name', { ascending: true });

        if (studentsError) {
            toast.error('Gagal mengambil daftar mahasiswa.');
        } else {
            setStudents(studentsData || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (profile?.role === 'superadmin') {
            fetchTemplates();
        }
    }, [profile]);

    const handleDistribute = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTemplate) {
            toast.error('Pilih master template terlebih dahulu');
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
                setSelectedStudentIds([]); // reset selections
            }
        });
    };

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
                    <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Distribusi Ujian</h1>
                    <p className="text-slate-500 mt-1">Gunakan Master Template untuk didistribusikan ke seluruh mahasiswa secara acak.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8">
                    <form onSubmit={handleDistribute} className="space-y-6">

                        {/* Information Callout */}
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex gap-3 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0 text-blue-600" />
                            <div>
                                <p className="font-semibold mb-1">Mekanisme Distribusi Otomatis:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Sistem akan mengambil **20 kriteria secara acak** dari Master Template yang dipilih.</li>
                                    <li>Setiap mahasiswa (auditor) mendapatkan subset kriteria yang berbeda.</li>
                                    <li>Jawaban dan Evidence dari Auditee di template akan disalin utuh.</li>
                                    <li>Ujian dilengkapi timer otomatis ({duration} menit) yang mengunci pengisian saat waktu habis.</li>
                                </ul>
                            </div>
                        </div>

                        {/* Master Template Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800">1. Pilih Master Template</label>
                            <p className="text-xs text-slate-500 mb-2">Pilih audit sumber (yg telah diisi oleh admin/auditee) sebagai basis ujian.</p>
                            <select
                                required
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="w-full h-12 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 px-4"
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
                            <label className="text-sm font-bold text-slate-800">2. Jenis Ujian</label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${examType === 'midterm' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                                    <input
                                        type="radio"
                                        name="examType"
                                        value="midterm"
                                        checked={examType === 'midterm'}
                                        onChange={() => setExamType('midterm')}
                                        className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="font-semibold text-slate-800">Ujian Tengah Semester (UTS)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${examType === 'final' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}>
                                    <input
                                        type="radio"
                                        name="examType"
                                        value="final"
                                        checked={examType === 'final'}
                                        onChange={() => setExamType('final')}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <span className="font-semibold text-slate-800">Ujian Akhir Semester (UAS)</span>
                                </label>
                            </div>
                        </div>

                        {/* Student Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-500" />
                                        3. Pemilihan Mahasiswa (Peserta Ujian)
                                    </label>
                                    <p className="text-xs text-slate-500 mt-1">Pilih siapa saja yang berhak mengikuti ujian ini.</p>
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
                                    className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200"
                                >
                                    {selectedStudentIds.length === students.length ? 'Batalkan Semua' : 'Pilih Semua'}
                                </button>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto p-4 space-y-2">
                                {students.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-4">Tidak ada mahasiswa yang ditemukan.</p>
                                ) : (
                                    students.map(student => (
                                        <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
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
                                            <span className="text-sm font-medium text-slate-700">{student.full_name}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 text-right">
                                {selectedStudentIds.length} dari {students.length} terpilih
                            </p>
                        </div>

                        {/* Timer Settings */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800">4. Batas Waktu Ujian (Menit)</label>
                            <p className="text-xs text-slate-500 mb-2">Waktu mundur dimulai otomatis ketika mahasiswa membuka ujian. Akses akan terkunci setelah waktu habis.</p>
                            <input
                                type="number"
                                required
                                min="10"
                                max="300"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                                className="w-full h-12 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 px-4"
                            />
                        </div>

                        {/* Schedule Settings */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800">5. Waktu Mulai Ujian (Opsional)</label>
                            <p className="text-xs text-slate-500 mb-2">Jika diisi, mahasiswa tidak bisa memulai ujian sebelum tanggal dan jam yang ditentukan.</p>
                            <input
                                type="datetime-local"
                                value={scheduledStartTime}
                                onChange={(e) => setScheduledStartTime(e.target.value)}
                                className="w-full h-12 rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 px-4"
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-6 border-t flex justify-end">
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
        </div>
    );
}
