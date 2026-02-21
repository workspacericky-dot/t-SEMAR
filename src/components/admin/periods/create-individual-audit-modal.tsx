'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, User, Search, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { createIndividualExamAudit, createBulkIndividualExamAudits } from '@/lib/actions/assignment-actions';
import { getStudentsForGroupAssignment } from '@/lib/actions/period-actions';
import { Profile } from '@/types/database';

interface CreateIndividualAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    periodId: string;
}

export function CreateIndividualAuditModal({ isOpen, onClose, periodId }: CreateIndividualAuditModalProps) {
    const [submitting, setSubmitting] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [users, setUsers] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Changed to array for multiple selection
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    // Fetch users when modal opens
    useEffect(() => {
        if (isOpen) {
            setLoadingUsers(true);
            getStudentsForGroupAssignment()
                .then(data => setUsers(data))
                .catch(err => toast.error('Gagal memuat daftar mahasiswa'))
                .finally(() => setLoadingUsers(false));

            setSelectedStudentIds([]);
            setSearchQuery('');
        }
    }, [isOpen]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const lower = searchQuery.toLowerCase();
        return users.filter(u => u.full_name.toLowerCase().includes(lower));
    }, [users, searchQuery]);

    const toggleStudent = (id: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.length === filteredUsers.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(filteredUsers.map(u => u.id));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (selectedStudentIds.length === 0) {
                toast.error('Pilih minimal satu mahasiswa');
                return;
            }

            const titlePrefix = `Ujian Individu`; // Prefix will be joined with name in backend if we want, or generic. 
            // In my updated action, I handle name appending.
            const description = 'Audit Mandiri (Individual Assignment)';

            if (selectedStudentIds.length === 1) {
                const student = users.find(u => u.id === selectedStudentIds[0]);
                const title = `${titlePrefix}: ${student?.full_name}`;
                await createIndividualExamAudit(periodId, selectedStudentIds[0], title, description);
            } else {
                await createBulkIndividualExamAudits(periodId, selectedStudentIds, titlePrefix, description);
            }

            toast.success(`${selectedStudentIds.length} Audit Individu berhasil dibuat`);
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error('Gagal membuat audit');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600">
                            <User className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">Buat Tugas Individu</h2>
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
                    <div className="p-6 space-y-5 overflow-y-auto">

                        <div className="p-4 bg-pink-50/50 rounded-lg text-sm text-pink-700 border border-pink-100">
                            <p>
                                Mahasiswa akan mengerjakan audit mandiri (User vs Standard).
                                Seluruh 80 kriteria akan dinilai oleh mahasiswa ini sendiri.
                            </p>
                        </div>

                        {/* Student Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Pilih Mahasiswa ({selectedStudentIds.length})
                                </label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari..."
                                        className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border-none rounded-md w-32 focus:ring-1 focus:ring-pink-500"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="text-xs text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
                                >
                                    {selectedStudentIds.length === filteredUsers.length && filteredUsers.length > 0 ? (
                                        <>
                                            <CheckSquare className="w-3 h-3" /> Batalkan Semua
                                        </>
                                    ) : (
                                        <>
                                            <CheckSquare className="w-3 h-3" /> Pilih Semua
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-lg h-60 overflow-y-auto bg-slate-50 p-2 space-y-1">
                                {loadingUsers ? (
                                    <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Memuat...</span>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-400">
                                        Tidak ditemukan
                                    </div>
                                ) : (
                                    filteredUsers.map(user => {
                                        const isSelected = selectedStudentIds.includes(user.id);
                                        return (
                                            <label
                                                key={user.id}
                                                className={`flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-pink-50 ring-1 ring-pink-200' : ''
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-pink-600 focus:ring-pink-500 border-slate-300 rounded"
                                                    checked={isSelected}
                                                    onChange={() => toggleStudent(user.id)}
                                                />
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-bold overflow-hidden">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            user.full_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-700">{user.full_name}</span>
                                                        <span className="text-[10px] text-slate-500">{user.satker_name || '-'}</span>
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>

                    <div className="p-4 pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || selectedStudentIds.length === 0}
                            className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Buat Tugas ({selectedStudentIds.length})</span>
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
