'use client';

import { useState } from 'react';
import { Group } from '@/types/database';
import { Edit, Trash2, User, Loader2 } from 'lucide-react';
import { deleteGroup } from '@/lib/actions/period-actions';
import { toast } from 'sonner';
import { GroupFormModal } from './create-group-modal';

interface GroupCardProps {
    group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const handleDelete = async () => {
        if (!confirm('Apakah Anda yakin ingin menghapus kelompok ini?')) return;

        setIsDeleting(true);
        try {
            await deleteGroup(group.id);
            toast.success('Kelompok berhasil dihapus');
        } catch (error) {
            console.error(error);
            toast.error('Gagal menghapus kelompok');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h3 className="font-semibold text-slate-900 text-lg">
                        Kelompok {group.group_number}
                    </h3>
                    <p className="text-xs text-slate-500">{group.name}</p>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="p-4 flex-1 space-y-4">
                {/* Lead Student */}
                <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Ketua Kelompok</span>
                    {group.lead_student ? (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                                {group.lead_student.full_name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium text-slate-700 truncate">
                                {group.lead_student.full_name}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm text-slate-400 italic">Belum ditentukan</span>
                    )}
                </div>

                {/* Members Count / Preview */}
                <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                        Anggota ({group.members?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {(group.members || []).slice(0, 5).map((memberId, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border border-white shadow-sm flex items-center justify-center text-[10px] text-slate-500">
                                <User className="w-3 h-3" />
                            </div>
                        ))}
                        {(group.members?.length || 0) > 5 && (
                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-white shadow-sm flex items-center justify-center text-[10px] text-slate-500 font-medium">
                                +{(group.members?.length || 0) - 5}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <GroupFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                periodId={group.period_id}
                initialData={group}
            />
        </div>
    );
}
