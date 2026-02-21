'use client';

import { useState } from 'react';
import { AuditItem, Profile } from '@/types/database';
import { assignMultipleItemsToMember } from '@/lib/actions/audit-server-actions';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Check, Loader2, Users, Search, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TaskDistributionProps {
    items: AuditItem[];
    members: Profile[]; // Members of the group
    auditId: string;
    effectiveRole: string;
    onUpdate: () => void;
}

export function TaskDistribution({ items, members, auditId, effectiveRole, onUpdate }: TaskDistributionProps) {
    const [open, setOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedMember, setSelectedMember] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    const filteredItems = items.filter(item =>
        item.criteria.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleItem = (id: string) => {
        const next = new Set(selectedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItems(next);
    };

    const toggleAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(i => i.id)));
        }
    };

    const handleAssign = async () => {
        if (selectedItems.size === 0) return;
        if (!selectedMember) return;

        setLoading(true);
        try {
            await assignMultipleItemsToMember(Array.from(selectedItems), selectedMember, effectiveRole);
            toast.success(`Berhasil menetapkan ${selectedItems.size} item`);
            setSelectedItems(new Set());
            setSelectedMember(null);
            onUpdate();
            router.refresh(); // Refresh page data
        } catch (error) {
            console.error(error);
            toast.error('Gagal menetapkan tugas');
        } finally {
            setLoading(false);
        }
    };

    // Determine correct column based on role
    const assignCol = effectiveRole === 'auditee' ? 'auditee_assigned_to' : 'auditor_assigned_to';

    // Group items by assigned status for stats
    const assignedCount = items.filter(i => (i[assignCol] || i.assigned_to)).length;
    const unassignedCount = items.length - assignedCount;

    // Calculate tasks assigned to members currently in the list
    const visibleAssignedCount = members.reduce((sum, m) => {
        return sum + items.filter(i => (i[assignCol] || i.assigned_to) === m.id).length;
    }, 0);

    const orphanedCount = assignedCount - visibleAssignedCount;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <Users className="w-4 h-4" />
                    Distribusi Tugas
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Distribusi Tugas Kelompok</DialogTitle>
                    <DialogDescription>
                        Tetapkan item audit kepada anggota kelompok untuk dikerjakan.
                    </DialogDescription>
                    <div className="flex gap-4 text-xs mt-2">
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            Sudah Dibagi: {assignedCount}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            Belum Dibagi: {unassignedCount}
                        </span>
                        {orphanedCount > 0 && (
                            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-200 text-xs flex flex-col gap-2 mt-2">
                                <div className="flex items-center gap-2 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {orphanedCount} tugas pada anggota tidak aktif
                                </div>
                                <div className="text-red-600/80 pl-3.5">
                                    Tugas ini diberikan kepada user yang sudah tidak ada di dalam kelompok ini (ID berbeda).
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!confirm('Tugas yang "orphaned" akan di-reset menjadi "Belum Dibagi". Lanjutkan?')) return;
                                        const { resetOrphanedTasks } = await import('@/lib/actions/audit-server-actions');
                                        await resetOrphanedTasks(auditId, members.map(m => m.id), effectiveRole);
                                        if (onUpdate) onUpdate();
                                        toast.success('Berhasil mereset tugas orphaned');
                                    }}
                                    className="ml-3.5 w-fit px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors font-semibold"
                                >
                                    Reset Tugas Ini
                                </button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Item List */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50/50">
                        <div className="p-4 border-b border-slate-200 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cari kriteria..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={filteredItems.length > 0 && selectedItems.size === filteredItems.length}
                                        onChange={toggleAll}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Pilih Semua ({filteredItems.length})
                                </label>
                                {selectedItems.size > 0 && (
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                        {selectedItems.size} dipilih
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {filteredItems.map(item => {
                                const assigneeId = item[assignCol] || item.assigned_to;
                                const assignee = members.find(m => m.id === assigneeId);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedItems.has(item.id)
                                            ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                            : 'bg-white border-slate-100 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="pt-0.5">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedItems.has(item.id)
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'bg-white border-slate-300 group-hover:border-slate-400'
                                                }`}>
                                                {selectedItems.has(item.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm text-slate-800 line-clamp-2 ${selectedItems.has(item.id) ? 'font-medium' : ''}`}>
                                                {item.criteria}
                                            </p>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <span className="text-xs text-slate-500 truncate">{item.category}</span>
                                                {assignee ? (
                                                    <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                        <User className="w-3 h-3" />
                                                        {assignee.full_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Belum ada PIC</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Member Selection */}
                    <div className="w-80 bg-white flex flex-col p-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-3">Pilih Penanggung Jawab</h3>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {members.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => setSelectedMember(member.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selectedMember === member.id
                                        ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500/20'
                                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {member.avatar_url ? (
                                            <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-4 h-4 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">
                                            {member.full_name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-500 truncate">
                                                {items.filter(i => (i[assignCol] || i.assigned_to) === member.id).length} tugas
                                            </span>
                                            {/* Role Badge if needed */}
                                        </div>
                                    </div>
                                    {selectedMember === member.id && (
                                        <Check className="w-4 h-4 text-indigo-600 ml-auto" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <button
                                onClick={handleAssign}
                                disabled={selectedItems.size === 0 || !selectedMember || loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-[0.98]"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Tetapkan {selectedItems.size > 0 ? `${selectedItems.size} Soal` : ''}
                            </button>
                            {selectedItems.size > 0 && !selectedMember && (
                                <p className="text-xs text-center text-slate-500 mt-2 animate-pulse">
                                    Pilih anggota untuk ditugaskan
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
