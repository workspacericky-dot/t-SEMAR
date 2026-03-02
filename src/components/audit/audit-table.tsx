'use client';

import { useState, useCallback, useMemo } from 'react';
import { AuditItem, UserRole } from '@/types/database';
import { CriteriaRow } from './criteria-row';
import { useThemeStore } from '@/store/theme-store';
import { useSearchStore } from '@/store/search-store';
import {
    saveEvaluatorDraft,
    publishToAuditee,
    publishAllToAuditee,
    saveAuditeeSelfAssessment,
    submitToAuditor,
    auditeeAgree,
    auditeeDisagree,
    acceptDispute,
    rejectDispute,
    submitActionPlan,
} from '@/lib/actions/audit-actions';
import { saveTeacherScore, bulkSaveTeacherScores } from '@/lib/actions/exam-actions';
import { SendHorizontal, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

interface AuditTableProps {
    items: AuditItem[];
    role: UserRole;
    auditId: string;
    onItemsUpdate: (items: AuditItem[]) => void;
}

const PREDICATE_RULES = [
    { min: 90, max: 100, label: 'AA', description: 'Sangat Memuaskan: Telah terwujud Good Governance. Seluruh kinerja dikelola dengan sangat memuaskan di seluruh unit kerja. Telah terbentuk pemerintah yang dinamis, adaptif, dan efisien (Reform). Pengukuran kinerja telah dilakukan sampai ke level individu.' },
    { min: 80, max: 90, label: 'A', description: 'Memuaskan: Terdapat gambaran bahwa Mahkamah Agung RI dan Badan Peradilan di bawahnya dapat memimpin perubahan dalam mewujudkan pemerintahan berorientasi hasil. Pengukuran kinerja telah dilakukan sampai ke level eselon 4/Pengawas/Subkoordinator.' },
    { min: 70, max: 80, label: 'BB', description: 'Sangat Baik: AKIP sangat baik pada 2/3 unit kerja, baik unit kerja utama maupun pendukung. Ditandai dengan mulai terwujudnya efisiensi penggunaan anggaran, memiliki sistem manajemen kinerja yang andal berbasis IT. Pengukuran kinerja telah dilakukan sampai ke level eselon 3/koordinator.' },
    { min: 60, max: 70, label: 'B', description: 'Baik: AKIP sudah baik pada 1/3 unit kerja, khususnya unit kerja utama. Masih perlu sedikit perbaikan pada unit kerja serta komitmen dalam manajemen kinerja. Pengukuran kinerja baru dilaksanakan sampai level eselon 2/unit kerja.' },
    { min: 50, max: 60, label: 'CC', description: 'Cukup (Memadai): AKIP cukup baik, namun masih perlu banyak perbaikan walaupun tidak mendasar, khususnya akuntabilitas kinerja pada unit kerja.' },
    { min: 30, max: 50, label: 'C', description: 'Kurang: Sistem dan tatanan dalam AKIP kurang dapat diandalkan. Belum terimplementasi sistem manajemen kinerja sehingga perlu banyak perbaikan mendasar di level pusat.' },
    { min: 0, max: 30, label: 'D', description: 'Sangat Kurang: Sistem dan tatanan dalam AKIP sama sekali tidak dapat diandalkan. Belum terdapat penerapan manajemen kinerja sehingga perlu perbaikan/perubahan yang sangat mendasar dalam implementasi SAKIP.' },
];

const getPredicate = (score: number) => {
    // Handle edge case for exactly 0
    if (score === 0) return PREDICATE_RULES[PREDICATE_RULES.length - 1];

    // Find the range. Logic: min < score <= max, except for the lowest range which includes 0?
    // The Excel says "> 90 - 100", "> 80 - 90".
    // So 90 falls into "A" (> 80 - 90). 90.01 falls into "AA".
    return PREDICATE_RULES.find(r => score > r.min && score <= r.max) || PREDICATE_RULES[PREDICATE_RULES.length - 1];
};

export function AuditTable({ items, role, auditId, onItemsUpdate, effectiveRole, currentUserId, auditType, auditStatus, scoreReleased }: AuditTableProps & { effectiveRole?: string, currentUserId?: string, auditType?: string, auditStatus?: string, scoreReleased?: boolean }) {
    const isDark = useThemeStore((s) => s.isDark);
    const searchQuery = useSearchStore((s) => s.query);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [editingFields, setEditingFields] = useState<Record<string, Partial<AuditItem>>>({});
    const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
    const [publishingAll, setPublishingAll] = useState(false);
    const [savingCategory, setSavingCategory] = useState<string | null>(null);

    // Determine the actual role to use for permissions
    const actualRole = effectiveRole || role;
    const isLocked = auditStatus === 'locked';

    // Whether to show the manual "Nilai Guru" elements (Admin & Superadmin only, OR student when score is released)
    const isAdminOrSuperadmin = role === 'superadmin' || role === 'admin';
    const showTeacherScoreColumn = isAdminOrSuperadmin || !!scoreReleased;

    // Group Practice Logic
    const isGroupPractice = auditType === 'group_practice';
    const [showMyItemsOnly, setShowMyItemsOnly] = useState(isGroupPractice); // Default to My Items for group practice

    // Merge items with editing fields for live updates
    const mergedItems = useMemo(() => {
        return items.map(item => {
            const updates = editingFields[item.id];
            if (updates) {
                return { ...item, ...updates };
            }
            return item;
        });
    }, [items, editingFields]);

    // Filter items by search query AND "My Items" toggle
    const filteredItems = useMemo(() => {
        let result = mergedItems;

        // 1. Filter by "My Items" if enabled
        if (showMyItemsOnly && currentUserId && isGroupPractice && role !== 'superadmin') {
            const assignCol = actualRole === 'auditee' ? 'auditee_assigned_to' : 'auditor_assigned_to';
            result = result.filter(item => item[assignCol] === currentUserId || item.assigned_to === currentUserId);
        }

        // 2. Filter by search query
        if (!searchQuery.trim()) return result;
        const q = searchQuery.toLowerCase();
        return result.filter(item =>
            item.criteria.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.subcategory.toLowerCase().includes(q) ||
            (item.jawaban_evaluator && item.jawaban_evaluator.toLowerCase().includes(q)) ||
            (item.catatan && item.catatan.toLowerCase().includes(q)) ||
            (item.rekomendasi && item.rekomendasi.toLowerCase().includes(q))
        );
    }, [mergedItems, searchQuery, showMyItemsOnly, currentUserId, isGroupPractice]);

    // Group items by Category -> Subcategory
    const groupedItems = useMemo(() => {
        const groups: Record<string, Record<string, AuditItem[]>> = {};

        filteredItems.forEach(item => {
            if (!groups[item.category]) groups[item.category] = {};
            if (!groups[item.category][item.subcategory]) groups[item.category][item.subcategory] = [];
            groups[item.category][item.subcategory].push(item);
        });

        // Sort items within subcategories by sort_order
        Object.keys(groups).forEach(cat => {
            Object.keys(groups[cat]).forEach(sub => {
                groups[cat][sub].sort((a, b) => a.sort_order - b.sort_order);
            });
        });

        return groups;
    }, [filteredItems]);

    // Calculate scores
    const getScoreValue = (item: AuditItem) => {
        // If evaluator has answered, use that. Otherwise use auditee's answer.
        if (item.jawaban_evaluator) {
            return item.nilai_evaluator || 0;
        }
        return item.nilai_auditee || 0;
    };

    // For exams (midterm/final), each criteria has equal weight = 100 / totalItems
    const isExamType = auditType === 'midterm' || auditType === 'final';
    const totalItemsCount = mergedItems.length;
    const equalWeight = totalItemsCount > 0 ? 100 / totalItemsCount : 0;

    const getCategoryScore = (category: string) => {
        const catItems = mergedItems.filter(i => i.category === category);

        if (isExamType) {
            // EXAM MODE: equal weight per criteria
            let totalScore = 0;
            let totalTeacherScore = 0;
            catItems.forEach(item => {
                const nilai = getScoreValue(item);
                const teacherNilai = item.teacher_score || 0;
                totalScore += (nilai * equalWeight) / 100;
                totalTeacherScore += (teacherNilai * equalWeight) / 100;
            });
            return { total: totalScore, teacherTotal: totalTeacherScore, maxPoints: catItems.length * equalWeight };
        }

        // REGULAR AUDIT MODE: use bobot hierarchy
        const subcats = new Set(catItems.map(i => i.subcategory));

        let totalScore = 0;
        let totalTeacherScore = 0;
        let totalMaxWeight = 0;

        subcats.forEach(sub => {
            const subItems = catItems.filter(i => i.subcategory === sub);
            if (subItems.length === 0) return;

            const bobotSum = subItems.reduce((sum, item) => sum + (item.bobot || 0), 0);

            const subScoreRaw = subItems.reduce((sum, item) => {
                const nilai = getScoreValue(item);
                const bobot = item.bobot || 0;
                return sum + (nilai * bobot);
            }, 0);

            const subTeacherScoreRaw = subItems.reduce((sum, item) => {
                const nilai = item.teacher_score || 0;
                const bobot = item.bobot || 0;
                return sum + (nilai * bobot);
            }, 0);

            const subScore = bobotSum > 0 ? subScoreRaw / bobotSum : 0;
            const subTeacherScore = bobotSum > 0 ? subTeacherScoreRaw / bobotSum : 0;

            const subWeight = subItems[0].subcategory_bobot || 0;

            totalScore += (subScore * subWeight) / 100;
            totalTeacherScore += (subTeacherScore * subWeight) / 100;
            totalMaxWeight += subWeight;
        });

        const maxPoints = catItems.length > 0 ? (catItems[0].category_bobot || 0) : 0;

        return { total: totalScore, teacherTotal: totalTeacherScore, maxPoints };
    };

    const getSubCategoryScore = (category: string, subcategory: string) => {
        const subItems = mergedItems.filter(i => i.category === category && i.subcategory === subcategory);

        if (isExamType) {
            // EXAM MODE: simple average
            const count = subItems.length;
            if (count === 0) return { subScore: 0, subTeacherScore: 0 };

            const subScore = subItems.reduce((sum, item) => sum + getScoreValue(item), 0) / count;
            const subTeacherScore = subItems.reduce((sum, item) => sum + (item.teacher_score || 0), 0) / count;
            return { subScore, subTeacherScore };
        }

        // REGULAR AUDIT MODE: bobot-weighted average
        const bobotSum = subItems.reduce((sum, item) => sum + (item.bobot || 0), 0);

        const subScoreRaw = subItems.reduce((sum, item) => {
            const nilai = getScoreValue(item);
            const bobot = item.bobot || 0;
            return sum + (nilai * bobot);
        }, 0);

        const subTeacherScoreRaw = subItems.reduce((sum, item) => {
            const nilai = item.teacher_score || 0;
            const bobot = item.bobot || 0;
            return sum + (nilai * bobot);
        }, 0);

        const subScore = bobotSum > 0 ? subScoreRaw / bobotSum : 0;
        const subTeacherScore = bobotSum > 0 ? subTeacherScoreRaw / bobotSum : 0;

        return { subScore, subTeacherScore };
    };


    const toggleRow = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const updateField = (itemId: string, field: string, value: string | number) => {
        setEditingFields((prev) => ({
            ...prev,
            [itemId]: { ...prev[itemId], [field]: value },
        }));
    };

    const handleItemUpdate = useCallback(
        (updatedItem: AuditItem) => {
            const newItems = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
            onItemsUpdate(newItems);
        },
        [items, onItemsUpdate]
    );

    const handleSaveDraft = async (itemId: string) => {
        if (isLocked) {
            toast.error('Audit terkunci. Tidak dapat melakukan perubahan.');
            return;
        }
        const fields = editingFields[itemId];
        if (!fields) return;

        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            let updated: AuditItem;
            // Handle saving teacher score if it was modified
            if (fields.teacher_score !== undefined) {
                updated = await saveTeacherScore(itemId, Number(fields.teacher_score));
            } else if (actualRole === 'auditee' || actualRole === 'superadmin') {
                // Superadmin can act as Auditee for filling templates
                updated = await saveAuditeeSelfAssessment(itemId, {
                    jawaban_auditee: fields.jawaban_auditee,
                    nilai_auditee: fields.nilai_auditee,
                    deskripsi_auditee: fields.deskripsi_auditee,
                    evidence_link: fields.evidence_link,
                });
            } else {
                updated = await saveEvaluatorDraft(itemId, fields);
            }

            handleItemUpdate(updated);
            setEditingFields((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
            toast.success(actualRole === 'auditor' ? 'Draft berhasil disimpan' : 'Penilaian berhasil disimpan');
        } catch {
            toast.error('Gagal menyimpan perubahan');
        } finally {
            setSavingRows((prev) => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
        }
    };

    const handlePublish = async (itemId: string) => {
        if (isLocked) {
            toast.error('Audit terkunci.');
            return;
        }
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            // Auto-save if there are pending changes
            const pendingChanges = editingFields[itemId];
            if (pendingChanges) {
                // Superadmin can act as Auditee
                if (actualRole === 'auditee' || actualRole === 'superadmin') {
                    await saveAuditeeSelfAssessment(itemId, {
                        jawaban_auditee: pendingChanges.jawaban_auditee,
                        nilai_auditee: pendingChanges.nilai_auditee,
                        deskripsi_auditee: pendingChanges.deskripsi_auditee,
                        evidence_link: pendingChanges.evidence_link,
                    });
                } else {
                    await saveEvaluatorDraft(itemId, pendingChanges);
                }

                // Clear local edits after successful save
                setEditingFields(prev => {
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                });
            }

            let updated;
            if (actualRole === 'auditee' || actualRole === 'superadmin') {
                updated = await submitToAuditor(itemId);
                toast.success('Berhasil dikirim ke Evaluator/Auditor');
            } else {
                updated = await publishToAuditee(itemId);
                toast.success('Berhasil dipublikasikan ke Auditee');
            }
            if (updated) handleItemUpdate(updated);
        } catch (error) {
            console.error('Publish error:', error);
            toast.error('Gagal memproses aksi');
        } finally {
            setSavingRows((prev) => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
        }
    };

    const handlePublishAll = async () => {
        if (isLocked) return;
        setPublishingAll(true);
        try {
            const updated = await publishAllToAuditee(auditId);
            const updatedMap = new Map(updated.map((u) => [u.id, u]));
            const newItems = items.map((i) => updatedMap.get(i.id) || i);
            onItemsUpdate(newItems);
            toast.success(`${updated.length} item berhasil dipublikasikan`);
        } catch {
            toast.error('Gagal mempublikasikan semua item');
        } finally {
            setPublishingAll(false);
        }
    };

    // ========== Phase 3: Auditee agree/disagree ==========
    const handleAgree = async (itemId: string) => {
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            const updated = await auditeeAgree(itemId);
            handleItemUpdate(updated);
            toast.success('Anda menyetujui hasil evaluasi');
        } catch {
            toast.error('Gagal memproses');
        } finally {
            setSavingRows((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    const handleDisagree = async (itemId: string, response: string) => {
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            const updated = await auditeeDisagree(itemId, response);
            handleItemUpdate(updated);
            toast.success('Tanggapan berhasil dikirim');
        } catch {
            toast.error('Gagal mengirim tanggapan');
        } finally {
            setSavingRows((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    // ========== Phase 4: Auditor accept/reject dispute ==========
    const handleAcceptDispute = async (itemId: string) => {
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            // Save pending evaluator changes first
            const pending = editingFields[itemId];
            if (pending) {
                await saveEvaluatorDraft(itemId, pending);
                setEditingFields((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
            }
            const item = items.find((i) => i.id === itemId);
            const currentCatatan = (pending?.catatan ?? item?.catatan) || '';
            const currentRekomendasi = (pending?.rekomendasi ?? item?.rekomendasi) || '';
            const updated = await acceptDispute(itemId, currentCatatan, currentRekomendasi);
            handleItemUpdate(updated);
            toast.success('Koreksi diterima, temuan telah direvisi');
        } catch (error) {
            console.error('Accept dispute error:', error);
            toast.error('Gagal menerima koreksi. Pastikan Catatan terisi.');
        } finally {
            setSavingRows((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    const handleRejectDispute = async (itemId: string, rebuttal?: string) => {
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            const updated = await rejectDispute(itemId, rebuttal);
            handleItemUpdate(updated);
            toast.success('Koreksi ditolak');
        } catch {
            toast.error('Gagal menolak koreksi');
        } finally {
            setSavingRows((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    // ========== Phase 6: Auditee action plan ==========
    const handleSubmitActionPlan = async (itemId: string, plan: string) => {
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            const updated = await submitActionPlan(itemId, plan);
            handleItemUpdate(updated);
            toast.success('Rencana tindak lanjut berhasil disimpan');
        } catch {
            toast.error('Gagal menyimpan rencana tindak lanjut');
        } finally {
            setSavingRows((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
        }
    };

    const hasDraftItems = items.some((i) => i.status === 'DRAFTING');

    const grandTotalDetails = useMemo(() => {
        let total = 0;
        let teacherTotal = 0;
        Object.keys(groupedItems).forEach(cat => {
            const catScores = getCategoryScore(cat);
            total += catScores.total;
            teacherTotal += catScores.teacherTotal;
        });
        return { total, teacherTotal };
    }, [groupedItems]); // safe to depend on groupedItems as it changes with mergedItems

    const grandTotal = grandTotalDetails.total;
    const grandTeacherTotal = grandTotalDetails.teacherTotal;

    const predicate = getPredicate(grandTotal);

    return (
        <div className="space-y-6">

            {/* Search filter feedback */}
            {searchQuery.trim() && (
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm ${isDark
                    ? 'bg-orange-500/10 border border-orange-900/30 text-orange-200'
                    : 'bg-blue-50 border border-blue-100 text-blue-700'
                    }`}>
                    <span>
                        🔍 Menampilkan <strong>{filteredItems.length}</strong> dari {items.length} item untuk &ldquo;{searchQuery}&rdquo;
                    </span>
                </div>
            )}

            {searchQuery.trim() && filteredItems.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border ${isDark ? 'bg-[#2A1F10] border-orange-900/30 text-orange-200/70' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <p className="text-lg font-medium mb-1">Tidak ada hasil</p>
                    <p className="text-sm">Tidak ditemukan kriteria yang cocok dengan &ldquo;{searchQuery}&rdquo;</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* My Items Toggle for Group Practice */}
                    {isGroupPractice && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowMyItemsOnly(!showMyItemsOnly)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showMyItemsOnly
                                    ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <div className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${showMyItemsOnly ? 'bg-blue-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                                    }`}>
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showMyItemsOnly ? 'translate-x-4' : 'translate-x-0'
                                        }`} />
                                </div>
                                <span className="leading-none mt-0.5">Tampilkan Item Saya Saja</span>
                            </button>
                        </div>
                    )}

                    <Accordion type="multiple" className="space-y-4">
                        {Object.entries(groupedItems).map(([category, subcats], catIdx) => {
                            const { total } = getCategoryScore(category);
                            return (
                                <AccordionItem key={category} value={category} className={`rounded-xl overflow-hidden px-0 border ${isDark ? 'bg-[#2A1F10] border-orange-900/30' : 'bg-white border-slate-200'}`}>
                                    <AccordionTrigger className={`px-6 py-4 hover:no-underline ${isDark ? 'hover:bg-orange-900/20' : 'hover:bg-slate-50'}`}>
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <span className={`font-semibold text-lg ${isDark ? 'text-orange-100' : 'text-slate-800'}`}>{category}</span>
                                            <div className="flex gap-2">
                                                <span className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-blue-50 text-blue-700'}`}>
                                                    Skor: {getCategoryScore(category).total.toFixed(2)}
                                                </span>
                                                {showTeacherScoreColumn && (
                                                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
                                                        Nilai Ujian: {getCategoryScore(category).teacherTotal.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    {/* Bulk Save Button for Teacher Scores (below header, inside accordion) */}
                                    {isAdminOrSuperadmin && (
                                        <div className={`px-6 py-2 flex justify-end border-b ${isDark ? 'border-orange-900/20' : 'border-slate-100'}`}>
                                            <button
                                                disabled={savingCategory === category}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setSavingCategory(category);
                                                    try {
                                                        // Collect all items in this category that have teacher_score set in editingFields
                                                        const catItems = mergedItems.filter(i => i.category === category);
                                                        const scoresToSave = catItems
                                                            .filter(item => {
                                                                const edited = editingFields[item.id];
                                                                return edited && edited.teacher_score !== undefined;
                                                            })
                                                            .map(item => ({
                                                                itemId: item.id,
                                                                score: Number(editingFields[item.id].teacher_score),
                                                            }));

                                                        if (scoresToSave.length === 0) {
                                                            toast.info('Tidak ada perubahan nilai ujian di kategori ini.');
                                                            return;
                                                        }

                                                        const result = await bulkSaveTeacherScores(scoresToSave);
                                                        if ('error' in result) {
                                                            toast.error(result.error as string);
                                                        } else {
                                                            // Update local items state with saved values
                                                            const updatedItems = result.updatedItems || [];
                                                            let newItems = [...items];
                                                            for (const upd of updatedItems) {
                                                                newItems = newItems.map(i => i.id === upd.id ? upd : i);
                                                            }
                                                            onItemsUpdate(newItems);
                                                            // Clear editing fields for saved items
                                                            setEditingFields(prev => {
                                                                const next = { ...prev };
                                                                for (const s of scoresToSave) {
                                                                    if (next[s.itemId]) {
                                                                        const { teacher_score, ...remaining } = next[s.itemId] as any;
                                                                        if (Object.keys(remaining).length === 0) {
                                                                            delete next[s.itemId];
                                                                        } else {
                                                                            next[s.itemId] = remaining;
                                                                        }
                                                                    }
                                                                }
                                                                return next;
                                                            });
                                                            toast.success(`Berhasil menyimpan ${scoresToSave.length} nilai ujian di ${category.split('.')[0].trim()}.`);
                                                        }
                                                    } catch (err) {
                                                        toast.error('Gagal menyimpan nilai ujian.');
                                                    } finally {
                                                        setSavingCategory(null);
                                                    }
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${savingCategory === category ? 'bg-slate-200 text-slate-500 cursor-wait'
                                                    : isDark ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-900/30'
                                                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200'}`}
                                            >
                                                {savingCategory === category ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                                                ) : (
                                                    <><Save className="w-4 h-4" /> Simpan Nilai Ujian</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    <AccordionContent className="pt-0 pb-4 px-6">
                                        <Accordion type="multiple" className="mt-2 space-y-3">
                                            {Object.entries(subcats).map(([subcategory, subItems]) => {
                                                const subScore = getSubCategoryScore(category, subcategory);
                                                return (
                                                    <AccordionItem key={subcategory} value={subcategory} className={`rounded-lg border ${isDark ? 'border-orange-900/20' : 'border-slate-100'}`}>
                                                        <AccordionTrigger className={`px-4 py-3 text-sm font-medium hover:no-underline ${isDark ? 'text-orange-200 bg-orange-900/10' : 'text-slate-700 bg-slate-50/50'}`}>
                                                            <div className="flex items-center justify-between w-full pr-4">
                                                                <span>{subcategory}</span>
                                                                <div className="flex gap-3 text-xs">
                                                                    <span className={`${isDark ? 'text-orange-300/60' : 'text-slate-500'}`}>Sub-skor: {getSubCategoryScore(category, subcategory).subScore.toFixed(2)}</span>
                                                                    {showTeacherScoreColumn && (
                                                                        <span className={`font-bold ${isDark ? 'text-purple-300/80' : 'text-purple-600'}`}>Nilai Ujian: {getSubCategoryScore(category, subcategory).subTeacherScore.toFixed(2)}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="p-0">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead className={`border-b ${isDark ? 'bg-white/5 backdrop-blur-md border-white/10' : 'bg-white/80 backdrop-blur-md border-slate-200'}`}>
                                                                        <tr>
                                                                            <th className={`px-3 py-3 text-center w-12 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No</th>
                                                                            <th className={`px-3 py-3 text-left min-w-[250px] text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Kriteria</th>
                                                                            {role === 'superadmin' && <th className={`px-3 py-3 text-center w-16 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Bobot</th>}

                                                                            {/* Auditee Section */}
                                                                            <th className={`px-3 py-3 text-center w-28 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Jwb Auditee</th>
                                                                            <th className={`px-3 py-3 text-left min-w-[200px] text-xs font-medium uppercase tracking-wider ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Deskripsi</th>

                                                                            {/* Evaluator Section */}
                                                                            <th className={`px-3 py-3 text-center w-28 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Jwb Evaluator</th>
                                                                            <th className={`px-3 py-3 text-center w-24 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Nilai</th>
                                                                            <th className={`px-3 py-3 text-left min-w-[150px] text-xs font-medium uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Catatan</th>
                                                                            <th className={`px-3 py-3 text-left min-w-[150px] text-xs font-medium uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Rekomendasi</th>

                                                                            {showTeacherScoreColumn && (
                                                                                <th className={`px-3 py-3 text-center w-24 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-purple-400 bg-purple-900/10' : 'text-purple-700 bg-purple-50'}`}>Nilai (Ujian)</th>
                                                                            )}

                                                                            <th className={`px-3 py-3 text-center w-28 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                                                                            {(actualRole === 'auditor' || actualRole === 'auditee' || isAdminOrSuperadmin) && <th className={`px-3 py-3 text-center w-24 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aksi</th>}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className={`divide-y ${isDark ? 'divide-orange-900/15' : 'divide-slate-100'}`}>
                                                                        {subItems.map(item => {
                                                                            // Determine if user can edit this item
                                                                            let canEdit = true;

                                                                            if (isGroupPractice) {
                                                                                const assignCol = actualRole === 'auditee' ? 'auditee_assigned_to' : 'auditor_assigned_to';
                                                                                const assignedUserId = item[assignCol] || item.assigned_to;
                                                                                if (assignedUserId && assignedUserId !== currentUserId) {
                                                                                    canEdit = false;
                                                                                }
                                                                                // Also check if effectiveRole matches the action needed (handled by CriteriaRow usually, checking user.role? but user.role might be 'auditee' while effective is 'auditor')
                                                                                // We need to pass effectiveRole to CriteriaRow instead of profile.role
                                                                            }

                                                                            return (
                                                                                <CriteriaRow
                                                                                    key={item.id}
                                                                                    item={item}
                                                                                    role={isAdminOrSuperadmin ? (role as any) : (actualRole as any)}
                                                                                    editingFields={editingFields}
                                                                                    updateField={updateField}
                                                                                    onSaveDraft={handleSaveDraft}
                                                                                    onPublish={handlePublish}
                                                                                    onAgree={handleAgree}
                                                                                    onDisagree={handleDisagree}
                                                                                    onAcceptDispute={handleAcceptDispute}
                                                                                    onRejectDispute={handleRejectDispute}
                                                                                    onSubmitActionPlan={handleSubmitActionPlan}
                                                                                    savingRows={savingRows}
                                                                                    onToggleExpand={toggleRow}
                                                                                    isExpanded={expandedRows.has(item.id)}
                                                                                    isEditable={canEdit}
                                                                                    scoreReleased={scoreReleased}
                                                                                />
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>

                    {/* Score Summary */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl">
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div>
                                <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Total Nilai Akhir Evaluasi</h3>
                                <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-5xl font-bold tracking-tight">{grandTotal.toFixed(2)}</span>
                                    <span className="text-slate-400">/ 100</span>
                                </div>

                                {showTeacherScoreColumn && (
                                    <div className="bg-purple-900/30 border border-purple-500/20 rounded-xl p-4 md:mt-0 mt-4 inline-block">
                                        <h3 className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-1">Total Nilai Ujian</h3>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-purple-100 tracking-tight">{grandTeacherTotal.toFixed(2)}</span>
                                            <span className="text-purple-300 font-medium text-sm">/ 100</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm border border-white/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-blue-500/20 px-3 py-1 rounded-lg text-blue-300 font-bold text-xl border border-blue-500/30">
                                        {predicate.label}
                                    </div>
                                    <h4 className="text-lg font-semibold text-white">Predikat: {predicate.description.split(':')[0]}</h4>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    {predicate.description.split(':').slice(1).join(':').trim()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

