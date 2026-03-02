'use client';

import { useState } from 'react';
import { AuditItem, UserRole, isFinalStatus } from '@/types/database';
import { useThemeStore } from '@/store/theme-store';
import { StatusBadge } from './status-badge';
import { Save, Send, Loader2, MessageSquare, Check, X, FileText, ChevronDown, ExternalLink } from 'lucide-react';

interface CriteriaRowProps {
    item: AuditItem;
    role: UserRole;
    editingFields: Record<string, Partial<AuditItem>>;
    updateField: (itemId: string, field: string, value: string | number) => void;
    onSaveDraft: (itemId: string) => void;
    onPublish: (itemId: string) => void;
    onAgree: (itemId: string) => void;
    onDisagree: (itemId: string, response: string) => void;
    onAcceptDispute: (itemId: string) => void;
    onRejectDispute: (itemId: string, rebuttal?: string) => void;
    onSubmitActionPlan: (itemId: string, plan: string) => void;
    savingRows: Set<string>;
    onToggleExpand: (itemId: string) => void;
    isExpanded: boolean;
    isEditable?: boolean;
    scoreReleased?: boolean;
}

const SCORE_MAP: Record<string, number> = {
    'AA': 100, 'A': 90, 'BB': 80, 'B': 70, 'CC': 60, 'C': 50, 'D': 30, 'E': 0,
};

const OPTIONS = ['AA', 'A', 'BB', 'B', 'CC', 'C', 'D', 'E'];

export function CriteriaRow({
    item, role, editingFields, updateField,
    onSaveDraft, onPublish, onAgree, onDisagree,
    onAcceptDispute, onRejectDispute, onSubmitActionPlan,
    savingRows, onToggleExpand, isExpanded, isEditable = true, scoreReleased,
}: CriteriaRowProps) {
    const isDark = useThemeStore((s) => s.isDark);
    // Local state for response panels
    const [responseText, setResponseText] = useState('');
    const [rebuttalText, setRebuttalText] = useState('');
    const [actionPlanText, setActionPlanText] = useState(item.auditee_action_plan || '');

    const isSaving = savingRows.has(item.id);
    const isAuditee = role === 'auditee' || role === 'superadmin';
    const isWaitingForPublish = role === 'auditee' && (item.status === 'SUBMITTED' || item.status === 'DRAFTING');
    const canEditAuditee = isEditable && isAuditee && item.status === 'DRAFTING';
    const canEdit = isEditable && role === 'auditor' && (
        item.status === 'SUBMITTED' ||
        item.status === 'DISPUTED' ||
        item.status === 'PUBLISHED_TO_AUDITEE' ||
        item.status === 'FINAL_ALTERED'
    );

    // Auditor can edit recommendation in Final phases (Phase 5)
    const canEditRecom = (isEditable && role === 'auditor' && isFinalStatus(item.status)) || canEdit;

    const showRekomendasi =
        role === 'auditor' ||
        role === 'superadmin' ||
        (role as string) === 'admin' ||
        isFinalStatus(item.status);

    const showBobot = role === 'superadmin';
    const isAdminOrSuperadmin = role === 'superadmin' || (role as string) === 'admin';
    const showTeacherScore = isAdminOrSuperadmin || !!scoreReleased;
    const canEditTeacherScore = isAdminOrSuperadmin; // Only admin can edit, students are read-only
    const hasModified = editingFields[item.id] && Object.keys(editingFields[item.id]).length > 0;

    const getFieldValue = (field: keyof AuditItem): string => {
        const edited = editingFields[item.id];
        if (edited && field in edited) return String(edited[field as keyof typeof edited] ?? '');
        return String(item[field] ?? '');
    };

    // Determine when to show the expand toggle
    const showExpandButton =
        (role === 'auditee' && item.status === 'PUBLISHED_TO_AUDITEE') ||
        (role === 'auditor' && item.status === 'DISPUTED') ||
        (isFinalStatus(item.status)); // All roles can view history / action plan

    return (
        <>
            {/* Main Row */}
            <tr className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                {/* No */}
                <td className="px-3 py-3 w-12 text-center text-slate-500 text-xs">
                    {item.sort_order + 1}
                </td>

                {/* Criteria */}
                <td className="px-3 py-3 min-w-[250px]">
                    <span className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {item.criteria}
                    </span>
                </td>

                {/* Bobot (Superadmin only) */}
                {showBobot && (
                    <td className="px-3 py-3 w-16 text-center">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                            {item.bobot}
                        </span>
                    </td>
                )}

                {/* Jwb Auditee */}
                <td className={`px-3 py-3 w-28 text-center ${isDark ? 'bg-slate-800/40' : 'bg-teal-50/30'}`}>
                    {canEditAuditee ? (
                        <select
                            value={getFieldValue('jawaban_auditee')}
                            onChange={(e) => {
                                const val = e.target.value;
                                updateField(item.id, 'jawaban_auditee', val);
                                updateField(item.id, 'nilai_auditee', SCORE_MAP[val] || 0);
                            }}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-teal-200 dark:border-teal-500/30 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
                        >
                            <option value="">-</option>
                            {OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {item.jawaban_auditee || '-'}
                        </span>
                    )}
                </td>

                {/* Deskripsi Auditee */}
                <td className={`px-3 py-3 min-w-[200px] ${isDark ? 'bg-slate-800/40' : 'bg-teal-50/30'}`}>
                    {canEditAuditee ? (
                        <>
                            <textarea
                                value={getFieldValue('deskripsi_auditee') || ''}
                                onChange={(e) => updateField(item.id, 'deskripsi_auditee', e.target.value)}
                                placeholder="Deskripsi / Penjelasan..."
                                rows={4}
                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-teal-200 dark:border-teal-500/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-y"
                            />
                            <input
                                type="text"
                                value={getFieldValue('evidence_link') || ''}
                                onChange={(e) => updateField(item.id, 'evidence_link', e.target.value)}
                                placeholder="Link Bukti Dukung (Google Drive, dll)..."
                                className="w-full mt-2 px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-teal-200 dark:border-teal-500/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                            />
                        </>
                    ) : (
                        <div>
                            <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap block">
                                {item.deskripsi_auditee || '-'}
                            </span>
                            {item.evidence_link && (
                                <a
                                    href={item.evidence_link.startsWith('http') ? item.evidence_link : `https://${item.evidence_link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Lihat Bukti Dukung
                                </a>
                            )}
                        </div>
                    )}
                </td>

                {/* Jwb Evaluator */}
                <td className={`px-3 py-3 w-28 text-center ${isDark ? 'bg-slate-800/40' : 'bg-blue-50/30'}`}>
                    {canEdit ? (
                        <select
                            value={getFieldValue('jawaban_evaluator')}
                            onChange={(e) => {
                                const val = e.target.value;
                                updateField(item.id, 'jawaban_evaluator', val);
                                updateField(item.id, 'nilai_evaluator', SCORE_MAP[val] || 0);
                            }}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-500/30 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                        >
                            <option value="">-</option>
                            {OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                            {isWaitingForPublish
                                ? <span className="text-xs text-slate-400 italic">Menunggu Publikasi Evaluator</span>
                                : (item.jawaban_evaluator || '-')}
                        </span>
                    )}
                </td>

                {/* Nilai */}
                <td className={`px-3 py-3 w-24 text-center ${isDark ? 'bg-slate-800/40' : 'bg-blue-50/30'}`}>
                    {canEdit ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {getFieldValue('nilai_evaluator') || 0}
                        </span>
                    ) : (
                        <div className="text-center font-medium">
                            {isWaitingForPublish ? (
                                <span className="text-xs text-slate-400 italic">Menunggu</span>
                            ) : (
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                    {Number(item.nilai_evaluator) || 0}
                                </span>
                            )}
                        </div>
                    )}
                </td>

                {/* Catatan */}
                <td className={`px-3 py-3 min-w-[150px] ${isDark ? 'bg-slate-800/40' : 'bg-blue-50/30'}`}>
                    {canEdit ? (
                        <textarea
                            value={getFieldValue('catatan')}
                            onChange={(e) => updateField(item.id, 'catatan', e.target.value)}
                            rows={4}
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                        />
                    ) : (
                        <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                            {item.catatan || '-'}
                        </span>
                    )}
                </td>

                {/* Rekomendasi - Executable Phase 5 */}
                <td className={`px-3 py-3 min-w-[150px] ${isDark ? 'bg-slate-800/40' : 'bg-blue-50/30'}`}>
                    {canEditRecom ? (
                        <div className="relative">
                            <textarea
                                value={getFieldValue('rekomendasi')}
                                onChange={(e) => updateField(item.id, 'rekomendasi', e.target.value)}
                                rows={4}
                                placeholder="Isi rekomendasi..."
                                className="w-full px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-200 border border-blue-200 dark:border-blue-500/30 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                            />
                            {/* Visual cue for Auditor in Final phase */}
                            {role === 'auditor' && isFinalStatus(item.status) && (
                                <span className="absolute -top-2 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                </span>
                            )}
                        </div>
                    ) : showRekomendasi ? (
                        <span className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                            {item.rekomendasi || '-'}
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400 italic">Tersembunyi</span>
                    )}
                </td>

                {/* Score (Teacher) - Admin/Superadmin editable, Students read-only when released */}
                {showTeacherScore && (
                    <td className={`px-3 py-3 w-24 text-center ${isDark ? 'bg-purple-900/10' : 'bg-purple-50'}`}>
                        {canEditTeacherScore ? (
                            <div className="flex items-center justify-center relative group/input">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={getFieldValue('teacher_score') || 0}
                                    onChange={(e) => updateField(item.id, 'teacher_score', Number(e.target.value))}
                                    className="w-16 px-2 py-1.5 bg-white dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all shadow-sm"
                                />
                                {hasModified && getFieldValue('teacher_score') !== String(item.teacher_score ?? 0) && (
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-sm border border-white dark:border-slate-800"></span>
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="font-bold text-purple-700 dark:text-purple-300 text-sm">
                                {item.teacher_score ?? '-'}
                            </span>
                        )}
                    </td>
                )}

                {/* Status */}
                <td className="px-3 py-3 w-28 text-center">
                    <StatusBadge status={item.status} />
                </td>

                {/* Aksi */}
                {(role === 'auditor' || isAuditee || canEditTeacherScore) && (
                    <td className="px-3 py-3 w-28 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                            {/* Admin/Teacher Saves Score */}
                            {canEditTeacherScore && hasModified && getFieldValue('teacher_score') !== String(item.teacher_score ?? 0) && (
                                <button
                                    onClick={() => onSaveDraft(item.id)}
                                    disabled={isSaving}
                                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-sm border border-emerald-100 dark:border-emerald-900/50"
                                    title="Simpan Nilai Ujian"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                            )}

                            {/* Phase 1: Auditee drafting */}
                            {isAuditee && canEditAuditee && (
                                <>
                                    {hasModified && (
                                        <button
                                            onClick={() => onSaveDraft(item.id)}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                            title="Simpan Penilaian"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onPublish(item.id)}
                                        disabled={isSaving}
                                        className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                        title="Kirim ke Evaluator"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}

                            {/* Auditor Actions (Edit/Publish) */}
                            {role === 'auditor' && (canEdit || canEditRecom) && (
                                <>
                                    {hasModified && (
                                        <button
                                            onClick={() => onSaveDraft(item.id)}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                            title="Simpan Perubahan"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        </button>
                                    )}

                                    {/* Publish button only available in SUBMITTED state (Phase 2->3 transition) */}
                                    {item.status === 'SUBMITTED' && (
                                        <button
                                            onClick={() => onPublish(item.id)}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 transition-colors"
                                            title="Publikasikan ke Auditee"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Phase 3: Auditee responds (PUBLISHED_TO_AUDITEE) */}
                            {role === 'auditee' && item.status === 'PUBLISHED_TO_AUDITEE' && (
                                <button
                                    onClick={() => onToggleExpand(item.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100'}`}
                                    title="Tanggapi Evaluasi"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Phase 4: Auditor reviews dispute (DISPUTED) */}
                            {role === 'auditor' && item.status === 'DISPUTED' && (
                                <>
                                    {hasModified && (
                                        <button
                                            onClick={() => onSaveDraft(item.id)}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                            title="Simpan Perubahan"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onToggleExpand(item.id)}
                                        className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-red-100 text-red-700' : 'bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100'}`}
                                        title="Review Tanggapan"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}

                            {/* Phase 6: Auditee action plan (FINAL states) */}
                            {role === 'auditee' && isFinalStatus(item.status) && (
                                <button
                                    onClick={() => onToggleExpand(item.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100'}`}
                                    title="Rencana Tindak Lanjut"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Expand for history (auditor/superadmin in final states) */}
                            {role !== 'auditee' && isFinalStatus(item.status) && item.auditee_response && (
                                <button
                                    onClick={() => onToggleExpand(item.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 dark:bg-slate-500/10 text-slate-500 hover:bg-slate-200'}`}
                                    title="Lihat Riwayat"
                                >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </div>
                    </td>
                )}
            </tr>

            {/* Expanded Detail Row */}
            {isExpanded && (
                <tr>
                    <td colSpan={99} className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                        <div className="max-w-3xl space-y-4">

                            {/* ============ Phase 3: Auditee responds to evaluation ============ */}
                            {role === 'auditee' && item.status === 'PUBLISHED_TO_AUDITEE' && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-500/30 p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Tanggapan terhadap Hasil Evaluasi
                                    </h4>
                                    <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                                        <p><strong>Jwb Evaluator:</strong> {item.jawaban_evaluator || '-'}</p>
                                        <p><strong>Catatan:</strong> {item.catatan || '-'}</p>
                                    </div>
                                    <textarea
                                        value={responseText}
                                        onChange={(e) => setResponseText(e.target.value)}
                                        placeholder="Komentar Anda (wajib diisi jika tidak setuju)..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-y"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onAgree(item.id)}
                                            disabled={isSaving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            Setuju
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!responseText.trim()) return;
                                                onDisagree(item.id, responseText);
                                            }}
                                            disabled={isSaving || !responseText.trim()}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                            Tidak Setuju
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ============ Phase 4: Auditor reviews dispute ============ */}
                            {role === 'auditor' && item.status === 'DISPUTED' && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-500/30 p-4 space-y-3">
                                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Tanggapan Auditee
                                    </h4>
                                    <blockquote className="text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-500/10 rounded-lg p-3 border-l-4 border-red-400 italic">
                                        &ldquo;{item.auditee_response}&rdquo;
                                    </blockquote>
                                    <p className="text-xs text-slate-500">
                                        💡 Jika menerima koreksi, edit <strong>Catatan</strong> dan <strong>Rekomendasi</strong> di kolom tabel terlebih dahulu.
                                    </p>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Catatan Bantahan (opsional, untuk menolak):</label>
                                        <textarea
                                            value={rebuttalText}
                                            onChange={(e) => setRebuttalText(e.target.value)}
                                            placeholder="Tulis bantahan jika menolak koreksi..."
                                            rows={2}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-y"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => onAcceptDispute(item.id)}
                                            disabled={isSaving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                            Terima Koreksi
                                        </button>
                                        <button
                                            onClick={() => onRejectDispute(item.id, rebuttalText || undefined)}
                                            disabled={isSaving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                            Tolak Koreksi
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ============ Phase 5-6: Auditee Action Plan ============ */}
                            {(role === 'auditee' || role === 'auditor') && isFinalStatus(item.status) && (
                                <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-[#1A1D27] border-slate-700' : 'bg-white border-emerald-200'}`}>
                                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Rekomendasi &amp; Rencana Tindak Lanjut
                                    </h4>
                                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 border-l-4 border-blue-400">
                                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Rekomendasi Evaluator:</p>
                                        <p>{item.rekomendasi || <em className="text-slate-400">Belum ada rekomendasi</em>}</p>
                                    </div>
                                    <div className="mb-2">
                                        <label className="text-xs font-medium text-slate-500 block mb-1">
                                            {role === 'auditee' ? 'Rencana Tindak Lanjut Anda:' : 'Rencana Tindak Lanjut Auditee:'}
                                        </label>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                                        <p className="text-sm text-slate-500 mb-3">
                                            {role === 'auditee'
                                                ? 'Silakan lengkapi detail rencana aksi (Target, Waktu, PIC, dll) pada halaman Monitoring Tindak Lanjut.'
                                                : 'Pantau perkembangan tindak lanjut yang dilakukan Auditee pada halaman Monitoring Tindak Lanjut.'}
                                        </p>
                                        <a
                                            href={`/audits/${item.audit_id}/action-plan`}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {role === 'auditee' ? 'Buat Rencana Aksi' : 'Lihat Matrix Tindak Lanjut'}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* ============ Response History (all roles in resolved states) ============ */}
                            {item.auditee_response && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Riwayat Tanggapan</h4>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <span className="text-xs font-medium text-teal-600 dark:text-teal-400 whitespace-nowrap">Auditee:</span>
                                            <span className="text-xs text-slate-600 dark:text-slate-300">{item.auditee_response}</span>
                                        </div>
                                        {item.auditor_rebuttal && (
                                            <div className="flex gap-2">
                                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">Evaluator:</span>
                                                <span className="text-xs text-slate-600 dark:text-slate-300">{item.auditor_rebuttal}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Show action plan to auditor/superadmin if exists */}
                            {role !== 'auditee' && isFinalStatus(item.status) && item.auditee_action_plan && (
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4">
                                    <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Rencana Tindak Lanjut Auditee</h4>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">{item.auditee_action_plan}</p>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
