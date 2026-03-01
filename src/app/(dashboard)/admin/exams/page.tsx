'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { distributeExam } from '@/lib/actions/exam-actions';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ClipboardList, Send, AlertCircle } from 'lucide-react';
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

    useEffect(() => {
        // Protect Route
        if (profile && profile.role !== 'superadmin') {
            router.replace('/dashboard');
        }
    }, [profile, router]);

    const fetchTemplates = async () => {
        setLoading(true);
        const supabase = createClient();
        // Fetch audits that could be templates (individual_auditor_id is null)
        const { data, error } = await supabase
            .from('audits')
            .select('id, title, year, status')
            .is('individual_auditor_id', null)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Gagal mengambil daftar template.');
        } else {
            setTemplates(data || []);
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

        if (duration < 10) {
            toast.error('Durasi terlalu singkat');
            return;
        }

        if (!confirm(`Apakah Anda yakin ingin mendistribusikan ujian ini ke semua peserta (auditor)? Proses ini tidak dapat dibatalkan.`)) {
            return;
        }

        startTransition(async () => {
            const res = await distributeExam(selectedTemplate, examType, duration);

            if (res?.error) {
                toast.error(res.error);
            } else {
                toast.success(`Berhasil mendistribusikan ujian ke ${res.count} pengguna!`);
                setSelectedTemplate('');
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

                        {/* Timer Settings */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-800">3. Batas Waktu Ujian (Menit)</label>
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
