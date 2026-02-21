'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPeriod } from '@/lib/actions/period-actions';

interface CreatePeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreatePeriodModal({ isOpen, onClose }: CreatePeriodModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [name, setName] = useState(`Semester ${new Date().getMonth() < 6 ? 'Genap' : 'Ganjil'} ${new Date().getFullYear()}`);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await createPeriod(name, year);
            toast.success('Periode audit berhasil dibuat');
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Gagal membuat periode audit');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">Buat Periode Baru</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Nama Periode
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            placeholder="Contoh: Semester Ganjil 2024"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Tahun
                        </label>
                        <input
                            type="number"
                            required
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Simpan</span>
                                    <CheckCircle2 className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
