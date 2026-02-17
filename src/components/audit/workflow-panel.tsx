'use client';

import { useState } from 'react';
import { AuditItem, UserRole, isFinalStatus } from '@/types/database';
import {
    Check,
    X,
    Send,
    MessageSquare,
    FileText,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
} from 'lucide-react';
import {
    auditeeAgree,
    auditeeDisagree,
    acceptDispute,
    rejectDispute,
    submitActionPlan,
} from '@/lib/actions/audit-actions';
import { toast } from 'sonner';

interface WorkflowPanelProps {
    item: AuditItem;
    role: UserRole;
    onUpdate: (updatedItem: AuditItem) => void;
}

export function WorkflowPanel({ item, role, onUpdate }: WorkflowPanelProps) {
    const [response, setResponse] = useState(item.auditee_response || '');
    const [actionPlan, setActionPlan] = useState(item.auditee_action_plan || '');
    const [editedCatatan, setEditedCatatan] = useState(item.catatan || '');
    const [editedRekomendasi, setEditedRekomendasi] = useState(item.rekomendasi || '');
    const [loading, setLoading] = useState(false);
    const [showDisagreeForm, setShowDisagreeForm] = useState(false);

    const handleAction = async (action: () => Promise<AuditItem>, successMsg: string) => {
        setLoading(true);
        try {
            const updated = await action();
            onUpdate(updated);
            toast.success(successMsg);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    // ── AUDITEE: Agree/Disagree buttons (PUBLISHED_TO_AUDITEE) ──
    if (role === 'auditee' && item.status === 'PUBLISHED_TO_AUDITEE') {
        return (
            <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                {/* Finding display */}
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Catatan Temuan Evaluator
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {item.catatan || '(Tidak ada catatan)'}
                    </p>
                </div>

                {!showDisagreeForm ? (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() =>
                                handleAction(() => auditeeAgree(item.id), 'Anda menyetujui temuan evaluator')
                            }
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Setuju
                        </button>
                        <button
                            onClick={() => setShowDisagreeForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-red-500/25 transition-all"
                        >
                            <X className="w-4 h-4" /> Tidak Setuju
                        </button>
                    </div>
                ) : (
                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm">
                            <MessageSquare className="w-4 h-4" />
                            Tanggapan Anda
                        </div>
                        <textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            placeholder="Tuliskan alasan ketidaksetujuan Anda..."
                            className="w-full min-h-[100px] px-4 py-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-y"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    handleAction(
                                        () => auditeeDisagree(item.id, response),
                                        'Tanggapan berhasil dikirim'
                                    )
                                }
                                disabled={loading || !response.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium shadow transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Kirim Tanggapan
                            </button>
                            <button
                                onClick={() => setShowDisagreeForm(false)}
                                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── AUDITOR: Dispute resolution (DISPUTED) ──
    if (role === 'auditor' && item.status === 'DISPUTED') {
        return (
            <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                {/* Auditee's response */}
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm mb-2">
                        <MessageSquare className="w-4 h-4" />
                        Tanggapan Auditee
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {item.auditee_response}
                    </p>
                </div>

                {/* Edit catatan for acceptance */}
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium text-sm">
                        <FileText className="w-4 h-4" />
                        Revisi Catatan (wajib diisi jika menerima koreksi)
                    </div>
                    <textarea
                        value={editedCatatan}
                        onChange={(e) => setEditedCatatan(e.target.value)}
                        className="w-full min-h-[80px] px-4 py-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                    />

                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium text-sm mt-4">
                        <FileText className="w-4 h-4" />
                        Revisi Rekomendasi (opsional)
                    </div>
                    <textarea
                        value={editedRekomendasi}
                        onChange={(e) => setEditedRekomendasi(e.target.value)}
                        className="w-full min-h-[80px] px-4 py-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-xl text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() =>
                            handleAction(
                                () => acceptDispute(item.id, editedCatatan, editedRekomendasi),
                                'Koreksi auditee diterima, catatan direvisi'
                            )
                        }
                        disabled={loading || !editedCatatan.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        Terima Koreksi
                    </button>
                    <button
                        onClick={() =>
                            handleAction(
                                () => rejectDispute(item.id),
                                'Koreksi auditee ditolak, catatan tetap'
                            )
                        }
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-xl text-sm font-medium shadow transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <XCircle className="w-4 h-4" />
                        )}
                        Tolak Koreksi
                    </button>
                </div>
            </div>
        );
    }

    // ── AUDITEE: Action Plan (FINAL states) ──
    if (role === 'auditee' && isFinalStatus(item.status)) {
        return (
            <div className="mt-3 space-y-3 animate-in slide-in-from-top-2 duration-300">
                {/* Recommendation reveal */}
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium text-sm mb-2">
                        <FileText className="w-4 h-4" />
                        Rekomendasi Evaluator
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {item.rekomendasi || '(Tidak ada rekomendasi)'}
                    </p>
                </div>

                {/* Locked auditee_response if it exists */}
                {item.auditee_response && (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 opacity-75">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium text-sm mb-2">
                            <MessageSquare className="w-4 h-4" />
                            Tanggapan Anda (Terkunci)
                        </div>
                        <p className="text-sm text-slate-500 whitespace-pre-wrap">
                            {item.auditee_response}
                        </p>
                    </div>
                )}

                {/* Action Plan */}
                <div className="bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium text-sm">
                        <FileText className="w-4 h-4" />
                        Rencana Tindak Lanjut <span className="text-red-500">*</span>
                    </div>
                    <textarea
                        value={actionPlan}
                        onChange={(e) => setActionPlan(e.target.value)}
                        placeholder="Tuliskan rencana tindak lanjut Anda..."
                        disabled={!!item.auditee_action_plan}
                        className="w-full min-h-[100px] px-4 py-3 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-500/30 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-y disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    {!item.auditee_action_plan && (
                        <button
                            onClick={() =>
                                handleAction(
                                    () => submitActionPlan(item.id, actionPlan),
                                    'Rencana tindak lanjut berhasil disimpan'
                                )
                            }
                            disabled={loading || !actionPlan.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Simpan Rencana Tindak Lanjut
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
