'use client';

import { useState } from 'react';
import { Group } from '@/types/database';
import { Edit, Trash2, User, Loader2 } from 'lucide-react';
import { deleteGroup } from '@/lib/actions/period-actions';
import { useThemeStore } from '@/store/theme-store';
import { toast } from 'sonner';
import { GroupFormModal } from './create-group-modal';

interface GroupCardProps {
    group: Group;
}

export function GroupCard({ group }: GroupCardProps) {
    const isDark = useThemeStore((s) => s.isDark);
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
        <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${isDark ? 'bg-[#1A1D2E] border-slate-700/50' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                <div>
                    <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Kelompok {group.group_number}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{group.name}</p>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="p-4 flex-1 space-y-4">
                {/* Lead Student */}
                <div>
                    <span className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ketua Kelompok</span>
                    {group.lead_student ? (
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                {group.lead_student.full_name.charAt(0)}
                            </div>
                            <span className={`text-sm font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {group.lead_student.full_name}
                            </span>
                        </div>
                    ) : (
                        <span className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Belum ditentukan</span>
                    )}
                </div>

                {/* Members Count / Preview */}
                <div>
                    <span className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Anggota ({group.members?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {(group.members || []).slice(0, 5).map((memberId, i) => (
                            <div key={i} className={`w-6 h-6 rounded-full border shadow-sm flex items-center justify-center text-[10px] ${isDark ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-100 border-white text-slate-500'}`}>
                                <User className="w-3 h-3" />
                            </div>
                        ))}
                        {(group.members?.length || 0) > 5 && (
                            <div className={`w-6 h-6 rounded-full border shadow-sm flex items-center justify-center text-[10px] font-medium ${isDark ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-slate-100 border-white text-slate-500'}`}>
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
