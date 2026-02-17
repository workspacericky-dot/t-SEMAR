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
import { SendHorizontal, Loader2 } from 'lucide-react';
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

export function AuditTable({ items, role, auditId, onItemsUpdate }: AuditTableProps) {
    const isDark = useThemeStore((s) => s.isDark);
    const searchQuery = useSearchStore((s) => s.query);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [editingFields, setEditingFields] = useState<Record<string, Partial<AuditItem>>>({});
    const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
    const [publishingAll, setPublishingAll] = useState(false);

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

    // Filter items by search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return mergedItems;
        const q = searchQuery.toLowerCase();
        return mergedItems.filter(item =>
            item.criteria.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.subcategory.toLowerCase().includes(q) ||
            (item.jawaban_evaluator && item.jawaban_evaluator.toLowerCase().includes(q)) ||
            (item.catatan && item.catatan.toLowerCase().includes(q)) ||
            (item.rekomendasi && item.rekomendasi.toLowerCase().includes(q))
        );
    }, [mergedItems, searchQuery]);

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

    const getCategoryScore = (category: string) => {
        const catItems = mergedItems.filter(i => i.category === category);

        // Group by subcategory first to calculate sub-scores
        const subcats = new Set(catItems.map(i => i.subcategory));

        // Total Score = Sum(SubScore * SubWeight / 100)
        // SubScore = Sum(Nilai * Bobot / 100)

        let totalScore = 0;
        let totalMaxWeight = 0; // Should sum to category_bobot (e.g. 30)

        subcats.forEach(sub => {
            const subItems = catItems.filter(i => i.subcategory === sub);
            if (subItems.length === 0) return;

            // Calculate Sub-Score (0-100)
            // Bobot sums to 100 (approx) in a subcategory
            const subScoreRaw = subItems.reduce((sum, item) => {
                const nilai = getScoreValue(item);
                const bobot = item.bobot || 0;
                return sum + (nilai * bobot);
            }, 0);

            const subScore = subScoreRaw / 100; // Normalize to 0-100 if bobot sums to 100

            // Weight of this subcategory
            const subWeight = subItems[0].subcategory_bobot || 0;

            totalScore += (subScore * subWeight) / 100; // Contribution to total score
            totalMaxWeight += subWeight;
        });

        // Max points is simply the category weight
        const maxPoints = catItems.length > 0 ? (catItems[0].category_bobot || 0) : 0;

        return { total: totalScore, maxPoints };
    };

    const getSubCategoryScore = (category: string, subcategory: string) => {
        const subItems = mergedItems.filter(i => i.category === category && i.subcategory === subcategory);

        const subScoreRaw = subItems.reduce((sum, item) => {
            const nilai = getScoreValue(item);
            const bobot = item.bobot || 0;
            return sum + (nilai * bobot);
        }, 0);

        return subScoreRaw / 100;
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
        const fields = editingFields[itemId];
        if (!fields) return;

        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            let updated: AuditItem;
            if (role === 'auditee') {
                const { saveAuditeeSelfAssessment } = await import('@/lib/actions/audit-actions');
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
            toast.success(role === 'auditee' ? 'Penilaian berhasil disimpan' : 'Draft berhasil disimpan');
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
        setSavingRows((prev) => new Set(prev).add(itemId));
        try {
            // Auto-save if there are pending changes
            const pendingChanges = editingFields[itemId];
            if (pendingChanges) {
                if (role === 'auditee') {
                    const { saveAuditeeSelfAssessment } = await import('@/lib/actions/audit-actions');
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
            if (role === 'auditee') {
                updated = await submitToAuditor(itemId);
                toast.success('Berhasil dikirim ke Evaluator');
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

    const grandTotal = useMemo(() => {
        let total = 0;
        Object.keys(groupedItems).forEach(cat => {
            total += getCategoryScore(cat).total;
        });
        return total;
    }, [groupedItems]); // safe to depend on groupedItems as it changes with mergedItems

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

                <Accordion type="multiple" className="space-y-4">
                    {Object.entries(groupedItems).map(([category, subcats], catIdx) => {
                        const { total } = getCategoryScore(category);
                        return (
                            <AccordionItem key={category} value={category} className={`rounded-xl overflow-hidden px-0 border ${isDark ? 'bg-[#2A1F10] border-orange-900/30' : 'bg-white border-slate-200'}`}>
                                <AccordionTrigger className={`px-6 py-4 hover:no-underline ${isDark ? 'hover:bg-orange-900/20' : 'hover:bg-slate-50'}`}>
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <span className={`font-semibold text-lg ${isDark ? 'text-orange-100' : 'text-slate-800'}`}>{category}</span>
                                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-blue-50 text-blue-700'}`}>
                                            Skor: {total.toFixed(2)}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-0 pb-4 px-6">
                                    <Accordion type="multiple" className="mt-2 space-y-3">
                                        {Object.entries(subcats).map(([subcategory, subItems]) => {
                                            const subScore = getSubCategoryScore(category, subcategory);
                                            return (
                                                <AccordionItem key={subcategory} value={subcategory} className={`rounded-lg border ${isDark ? 'border-orange-900/20' : 'border-slate-100'}`}>
                                                    <AccordionTrigger className={`px-4 py-3 text-sm font-medium hover:no-underline ${isDark ? 'text-orange-200 bg-orange-900/10' : 'text-slate-700 bg-slate-50/50'}`}>
                                                        <div className="flex items-center justify-between w-full pr-4">
                                                            <span>{subcategory}</span>
                                                            <span className={`text-xs ${isDark ? 'text-orange-300/60' : 'text-slate-500'}`}>Sub-skor: {subScore.toFixed(2)}</span>
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

                                                                        <th className={`px-3 py-3 text-center w-28 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Status</th>
                                                                        {(role === 'auditor' || role === 'auditee') && <th className={`px-3 py-3 text-center w-24 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aksi</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className={`divide-y ${isDark ? 'divide-orange-900/15' : 'divide-slate-100'}`}>
                                                                    {subItems.map(item => (
                                                                        <CriteriaRow
                                                                            key={item.id}
                                                                            item={item}
                                                                            role={role}
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
                                                                        />
                                                                    ))}
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
            )}

            {/* Score Summary */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Total Nilai Akhir</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold tracking-tight">{grandTotal.toFixed(2)}</span>
                            <span className="text-slate-400">/ 100</span>
                        </div>
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
    );
}

