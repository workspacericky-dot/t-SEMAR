'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, FileSymlink } from 'lucide-react';
import { toast } from 'sonner';
import { createMasterTemplate } from '@/lib/actions/assignment-actions';

interface CreateMasterTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    periodId: string;
}

export function CreateMasterTemplateModal({ isOpen, onClose, periodId }: CreateMasterTemplateModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [title, setTitle] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Nama Master Template tidak boleh kosong');
            return;
        }

        setSubmitting(true);

        try {
            const description = 'Master Template (Ujian)';

            await createMasterTemplate(periodId, title, description);

            toast.success(`Master Template "${title}" berhasil dibuat`);
            onClose();
            setTitle(''); // reset
        } catch (error: any) {
            console.error(error);
            toast.error('Gagal membuat master template');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <FileSymlink className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">Buat Master Template</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-5">
                        <div className="p-4 bg-emerald-50/50 rounded-lg text-sm text-emerald-700 border border-emerald-100">
                            <p>
                                Master Template ini akan digunakan untuk distribusi ujian (UTS/UAS).
                                Template ini <strong>tidak</strong> langsung ditugaskan ke mahasiswa mana pun, melainkan sebagai sumber soal (worksheet) yang bisa diubah oleh Superadmin.
                            </p>
                        </div>

                        {/* Title Input */}
                        <div className="space-y-2">
                            <label htmlFor="title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Nama Template <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Contoh: Template UAS 2026, Template Ujian Akhir, dll."
                                className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 pt-4 flex justify-end gap-3 border-t border-slate-100 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !title.trim()}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Buat Template</span>
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
