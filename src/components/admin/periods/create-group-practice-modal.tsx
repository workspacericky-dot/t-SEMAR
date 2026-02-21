'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createGroupPracticeAudit } from '@/lib/actions/assignment-actions';
import { Group } from '@/types/database';

interface CreateGroupPracticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    periodId: string;
    groups: Group[];
}

export function CreateGroupPracticeModal({ isOpen, onClose, periodId, groups }: CreateGroupPracticeModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [auditorGroupId, setAuditorGroupId] = useState('');
    const [auditeeGroupId, setAuditeeGroupId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!auditorGroupId || !auditeeGroupId) {
                toast.error('Pilih kelompok Auditor dan Auditee');
                return;
            }

            if (auditorGroupId === auditeeGroupId) {
                toast.error('Kelompok Auditor dan Auditee tidak boleh sama');
                return;
            }

            await createGroupPracticeAudit(periodId, auditorGroupId, auditeeGroupId, title, description);

            toast.success('Audit Latihan Kelompok berhasil dibuat');
            onClose();
            // Reset form
            setAuditorGroupId('');
            setAuditeeGroupId('');
            setTitle('');
            setDescription('');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Gagal membuat audit');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Users className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">Buat Latihan Kelompok</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div className="p-4 bg-blue-50/50 rounded-lg text-sm text-blue-700 border border-blue-100">
                        <p>
                            Pilih dua kelompok untuk dipasangkan dalam simulasi audit.
                            Kelompok <strong>Auditor</strong> akan menilai Kelompok <strong>Auditee</strong>.
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Judul Audit
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Latihan Minggu 1"
                            className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Deskripsi (Opsional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Deskripsi singkat..."
                            className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none h-20"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Kelompok Auditor
                            </label>
                            <select
                                value={auditorGroupId}
                                onChange={(e) => setAuditorGroupId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
                                required
                            >
                                <option value="">-- Pilih --</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>
                                        Kelompok {group.group_number}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Kelompok Auditee
                            </label>
                            <select
                                value={auditeeGroupId}
                                onChange={(e) => setAuditeeGroupId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all cursor-pointer"
                                required
                            >
                                <option value="">-- Pilih --</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id} disabled={group.id === auditorGroupId}>
                                        Kelompok {group.group_number}
                                    </option>
                                ))}
                            </select>
                        </div>
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
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Buat</span>
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
