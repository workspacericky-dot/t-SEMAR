'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditItem } from '@/types/database';
import { approveAssessorRecommendations, generateAssessorRecommendation, getAssessorRecommendations } from '@/lib/actions/assessor-actions';
import { reasoningInput, sameReasoning, validateApproval, type AssessorRecommendation } from '@/lib/assessor/reasoning';

type ReviewEdit = { score: string; note: string };
const button = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-40 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';

export function AssessorPanel({ auditId, items, onApproved, busyItems, unsavedItems }: {
    auditId: string; items: AuditItem[]; onApproved: (items: AuditItem[]) => void;
    busyItems: Set<string>; unsavedItems: Set<string>;
}) {
    const [recommendations, setRecommendations] = useState<Record<string, AssessorRecommendation>>({});
    const [edits, setEdits] = useState<Record<string, ReviewEdit>>({});
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('');

    async function load() {
        setBusy('load');
        try {
            const result = await getAssessorRecommendations(auditId);
            if (result.error) { setError(result.error); return; }
            setRecommendations(Object.fromEntries((result.recommendations || []).map(rec => [rec.item_id, rec])));
            setEdits({}); setError('');
        } catch { setError('Gagal memuat rekomendasi. Silakan coba kembali.'); }
        finally { setBusy(''); }
    }

    useEffect(() => {
        let active = true;
        getAssessorRecommendations(auditId).then(result => {
            if (!active) return;
            if (result.error) setError(result.error);
            else setRecommendations(Object.fromEntries((result.recommendations || []).map(rec => [rec.item_id, rec])));
        }).catch(() => { if (active) setError('Gagal memuat rekomendasi.'); });
        return () => { active = false; };
    }, [auditId]);

    function isStale(item: AuditItem, rec: AssessorRecommendation) {
        return !sameReasoning(reasoningInput(item), rec.input_snapshot) || (rec.status === 'pending' && (
            Number(item.teacher_score || 0) !== rec.feedback_snapshot.teacher_score ||
            (item.catatan_asesor || '') !== rec.feedback_snapshot.catatan_asesor));
    }

    function review(rec: AssessorRecommendation): ReviewEdit {
        return edits[rec.item_id] || { score: String(rec.score), note: rec.assessor_note };
    }

    function canApprove(item: AuditItem) {
        const rec = recommendations[item.id];
        if (!rec || rec.status !== 'pending' || isStale(item, rec) || unsavedItems.has(item.id) || busyItems.has(item.id)) return false;
        const edit = review(rec);
        if (!edit.score.trim()) return false;
        try { validateApproval(Number(edit.score), edit.note); return true; } catch { return false; }
    }

    async function generate(selected: AuditItem[], scope: string) {
        setBusy(scope); setError('');
        let generated = 0;
        try {
            for (const [index, item] of selected.entries()) {
                setProgress(`${index + 1}/${selected.length}: ${item.criteria}`);
                const result = await generateAssessorRecommendation(auditId, item.id);
                if (result.error || !result.recommendation) { setError(result.error || 'Analisis gagal.'); break; }
                const rec = result.recommendation;
                setRecommendations(prev => ({ ...prev, [item.id]: rec }));
                setEdits(prev => { const next = { ...prev }; delete next[item.id]; return next; });
                generated++;
            }
            if (generated) toast.success(`${generated} rekomendasi tersimpan. Nilai resmi belum berubah.`);
        } catch { setError('Analisis terhenti. Rekomendasi yang sudah selesai tetap tersimpan.'); }
        finally { setBusy(''); setProgress(''); }
    }

    async function approve(selected: AuditItem[], category?: string) {
        setBusy(category || selected[0].id); setError('');
        try {
            const result = await approveAssessorRecommendations(auditId, selected.map(item => {
                const rec = recommendations[item.id]; const edit = review(rec);
                return { item_id: item.id, expected_updated_at: rec.updated_at, score: Number(edit.score), assessor_note: edit.note };
            }), category);
            if (result.error || !result.updatedItems) { setError(result.error || 'Approval gagal.'); return; }
            const updated = result.updatedItems;
            onApproved(updated);
            setRecommendations(prev => {
                const next = { ...prev };
                updated.forEach(item => { next[item.id] = { ...next[item.id], status: 'approved', approved_at: new Date().toISOString(),
                    approved_score: item.teacher_score ?? 0, approved_note: item.catatan_asesor || '' }; });
                return next;
            });
            toast.success(`${updated.length} pasangan nilai dan Catatan Asesor disahkan.`);
        } catch { setError('Approval gagal. Muat ulang untuk memeriksa status sebelum mencoba kembali.'); }
        finally { setBusy(''); }
    }

    const categories = Array.from(new Set(items.map(item => item.category)));
    return (
        <section className="rounded-2xl border border-indigo-200 bg-white p-5 space-y-4 text-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:border-indigo-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" /> Rekomendasi Asesor</h2>
                    <p className="text-sm text-slate-500 mt-1">Tinjau reasoning siswa dan edit usulan sebelum approve nilai serta catatan sebagai pasangan.</p>
                    <p className="text-xs text-slate-500 mt-1">Analisis tersedia setelah ujian selesai. Rekomendasi hanya terlihat oleh dosen; ekspor memakai penilaian resmi.</p>
                </div>
                <button className={button} disabled={!!busy} onClick={load}><RefreshCw className="h-4 w-4" /> Muat ulang rekomendasi</button>
            </div>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Koneksi AI belum aktif. Penilaian jawaban kosong mengikuti contoh UTS (nilai 0); jawaban lainnya menunggu aktivasi analisis AI.
            </p>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
            {progress && <p role="status" className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {progress}</p>}
            {categories.map(category => {
                const categoryItems = items.filter(item => item.category === category);
                const pending = categoryItems.filter(item => recommendations[item.id]?.status !== 'approved');
                const ready = pending.length > 0 && pending.every(canApprove);
                const unreviewed = categoryItems.filter(item => !recommendations[item.id] || isStale(item, recommendations[item.id]));
                const canGenerate = unreviewed.length > 0 && unreviewed.every(item => !unsavedItems.has(item.id) && !busyItems.has(item.id));
                return (
                    <details key={category} className="rounded-xl border border-slate-200 dark:border-slate-700" open>
                        <summary className="cursor-pointer p-3 font-medium text-sm">{category} — {categoryItems.length - pending.length}/{categoryItems.length} disahkan</summary>
                        <div className="px-3 pb-3 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <button className={button} disabled={!!busy || !canGenerate || !!error} onClick={() => generate(unreviewed, category)}>
                                    <Sparkles className="h-4 w-4" /> Analisis komponen ({unreviewed.length})
                                </button>
                                <button className={button} disabled={!!busy || !ready} onClick={() => approve(pending, category)}>
                                    <Check className="h-4 w-4" /> Approve komponen ({pending.length})
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">Approval komponen mengesahkan seluruh rekomendasi yang masih menunggu. Periksa semua usulan di bawah sebelum approve.</p>
                            {categoryItems.map(item => {
                                const rec = recommendations[item.id];
                                const stale = rec && isStale(item, rec);
                                const edit = rec && review(rec);
                                return (
                                    <details key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                                        <summary className="cursor-pointer text-sm font-medium">
                                            {item.criteria} <span className="text-xs text-indigo-500">{stale ? 'Perlu analisis ulang' : rec?.status === 'approved' ? 'Disahkan' : rec ? `Usulan: ${edit?.score}/100` : 'Belum dianalisis'}</span>
                                        </summary>
                                        <div className="mt-3 space-y-3">
                                            <div className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-1 whitespace-pre-wrap">
                                                <p className="text-xs text-slate-500">{item.subcategory}</p>
                                                <p><strong>Jwb Auditee:</strong> {item.jawaban_auditee || '—'} · <strong>Jwb Evaluator:</strong> {item.jawaban_evaluator || '—'}</p>
                                                <p><strong>Catatan siswa:</strong> {item.catatan || '—'}</p>
                                                <p><strong>Rekomendasi siswa:</strong> {item.rekomendasi || '—'}</p>
                                            </div>
                                            {(unsavedItems.has(item.id) || busyItems.has(item.id)) && <p className="text-xs text-amber-600">Selesaikan penyimpanan perubahan manual sebelum analisis atau approval.</p>}
                                            {stale && <p className="text-xs text-amber-600">Jawaban atau penilaian telah berubah sejak analisis. Analisis ulang sebelum approval.</p>}
                                            {rec && edit && (
                                                <>
                                                    <p className="text-xs text-slate-500">Penilaian resmi saat ini: {item.teacher_score ?? 0}/100 · {item.catatan_asesor || 'Belum ada Catatan Asesor'}</p>
                                                    <p className="text-sm whitespace-pre-wrap"><strong>Dasar penilaian:</strong> {rec.rationale}</p>
                                                    {rec.review_flags.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-600">{rec.review_flags.map((flag, index) => <li key={index}>{flag}</li>)}</ul>}
                                                    {rec.status === 'pending' ? (
                                                        <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                                                            <label className="text-xs">Usulan nilai
                                                                <input type="number" min={0} max={100} step={1} value={edit.score} disabled={!!busy} onChange={event => setEdits(prev => ({ ...prev, [item.id]: { ...edit, score: event.target.value } }))}
                                                                    className="mt-1 w-full rounded-lg border p-2 bg-transparent" />
                                                            </label>
                                                            <label className="text-xs">Draf Catatan Asesor
                                                                <textarea rows={4} maxLength={6000} value={edit.note} disabled={!!busy} onChange={event => setEdits(prev => ({ ...prev, [item.id]: { ...edit, note: event.target.value } }))}
                                                                    className="mt-1 w-full rounded-lg border p-2 bg-transparent text-sm" />
                                                            </label>
                                                        </div>
                                                    ) : <p className="text-sm whitespace-pre-wrap"><strong>Pasangan yang disahkan:</strong> {rec.approved_score}/100 — {rec.approved_note}</p>}
                                                    <p className="text-xs text-slate-400">{rec.model} · Rubrik {rec.rubric_version} · {new Date(rec.created_at).toLocaleString('id-ID')}</p>
                                                </>
                                            )}
                                            <div className="flex gap-2">
                                                <button className={button} disabled={!!busy || unsavedItems.has(item.id) || busyItems.has(item.id)} onClick={() => generate([item], item.id)}>
                                                    {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{rec ? 'Analisis ulang' : 'Analisis kriteria'}
                                                </button>
                                                <button className={button} disabled={!!busy || !canApprove(item)} onClick={() => approve([item])}><Check className="h-4 w-4" /> Approve kriteria</button>
                                            </div>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </details>
                );
            })}
        </section>
    );
}
