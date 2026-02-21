'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Users, CheckCircle2, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { createGroup, getStudentsForGroupAssignment, updateGroup } from '@/lib/actions/period-actions';
import { Profile, Group } from '@/types/database';

interface GroupFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    periodId: string;
    // For creation:
    existingGroupsCount?: number;
    // For editing:
    initialData?: Group;
}

export function GroupFormModal({ isOpen, onClose, periodId, existingGroupsCount = 0, initialData }: GroupFormModalProps) {
    const isEditing = !!initialData;
    const [submitting, setSubmitting] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [groupNumber, setGroupNumber] = useState(1);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [leadStudentId, setLeadStudentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Data State
    const [users, setUsers] = useState<Profile[]>([]);

    // Fetch users when modal opens
    useEffect(() => {
        if (isOpen) {
            setLoadingUsers(true);
            getStudentsForGroupAssignment()
                .then(data => setUsers(data))
                .catch(err => toast.error('Gagal memuat daftar mahasiswa'))
                .finally(() => setLoadingUsers(false));

            setSearchQuery('');

            if (isEditing && initialData) {
                // Pre-fill for editing
                setName(initialData.name);
                setGroupNumber(initialData.group_number);
                setSelectedMemberIds(initialData.members || []);
                setLeadStudentId(initialData.lead_student_id);
            } else {
                // Reset for creation
                setName(`Kelompok ${existingGroupsCount + 1}`);
                setGroupNumber(existingGroupsCount + 1);
                setSelectedMemberIds([]);
                setLeadStudentId(null);
            }
        }
    }, [isOpen, existingGroupsCount, isEditing, initialData]);

    // Filter users based on search
    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const lower = searchQuery.toLowerCase();
        return users.filter(u => u.full_name.toLowerCase().includes(lower));
    }, [users, searchQuery]);

    const toggleMember = (userId: string) => {
        setSelectedMemberIds(prev => {
            const isSelected = prev.includes(userId);
            if (isSelected) {
                // If removing, also remove from lead if they were lead
                if (leadStudentId === userId) setLeadStudentId(null);
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (selectedMemberIds.length === 0) {
                toast.error('Pilih minimal satu anggota kelompok');
                return;
            }

            if (isEditing && initialData) {
                await updateGroup(
                    initialData.id,
                    name,
                    leadStudentId,
                    selectedMemberIds
                );
                toast.success('Kelompok berhasil diperbarui');
            } else {
                await createGroup(
                    periodId,
                    name,
                    groupNumber,
                    leadStudentId,
                    selectedMemberIds
                );
                toast.success('Kelompok berhasil dibuat');
            }

            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Gagal menyimpan kelompok');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Users className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            {isEditing ? 'Edit Kelompok' : 'Buat Kelompok Baru'}
                        </h2>
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
                    <div className="p-6 space-y-6 overflow-y-auto">

                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Nama Kelompok
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Nomor Kelompok
                                </label>
                                <input
                                    type="number"
                                    required
                                    readOnly={isEditing} // Group number shouldn't change ideally to avoid conflict logic here, or just let it be.
                                    // User requirement didn't specify, but safer to keep it consistent or allow edit if needed.
                                    // Let's allow edit if it's just a number label, but logic uses it for ordering.
                                    value={groupNumber}
                                    onChange={(e) => setGroupNumber(parseInt(e.target.value))}
                                    className={`w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        </div>

                        {/* Member Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Pilih Anggota ({selectedMemberIds.length})
                                </label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Cari mahasiswa..."
                                        className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border-none rounded-md w-48 focus:ring-1 focus:ring-blue-500"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-lg h-60 overflow-y-auto bg-slate-50 p-2 space-y-1">
                                {loadingUsers ? (
                                    <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Memuat mahasiswa...</span>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-slate-400">
                                        Tidak ada mahasiswa ditemukan
                                    </div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <label
                                            key={user.id}
                                            className={`flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer transition-colors ${selectedMemberIds.includes(user.id) ? 'bg-blue-50 hover:bg-blue-50 ring-1 ring-blue-200' : ''
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedMemberIds.includes(user.id)}
                                                onChange={() => toggleMember(user.id)}
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
                                                    <span className="text-[10px] text-slate-500">{user.satker_name || 'Satker tidak ada'}</span>
                                                </div>
                                            </div>
                                            {leadStudentId === user.id && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                                    Ketua
                                                </span>
                                            )}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Lead Selection */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Ketua Kelompok (Dari anggota terpilih)
                            </label>
                            <select
                                className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer disabled:opacity-50"
                                value={leadStudentId || ''}
                                onChange={(e) => setLeadStudentId(e.target.value || null)}
                                disabled={selectedMemberIds.length === 0}
                            >
                                <option value="">-- Pilih Ketua --</option>
                                {users.filter(u => selectedMemberIds.includes(u.id)).map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.full_name}
                                    </option>
                                ))}
                            </select>
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
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>{isEditing ? 'Simpan Perubahan' : 'Buat Kelompok'}</span>
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
