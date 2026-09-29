'use client';

import { useEffect, useState } from 'react';
import { AssessorExamExport } from './assessor-exam-export';
import { Check, Download, Loader2, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditItem } from '@/types/database';
import { approveAssessorRecommendations, exportAssessorExam, importAssessorExam, getAssessorRecommendations } from '@/lib/actions/assessor-actions';
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
    const [importText, setImportText] = useState('');
    const [importInfo, setImportInfo] = useState('');
    const hasUnsaved = unsavedItems.size > 0 || busyItems.size > 0;

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
        return edits[rec.item_id] || { score: rec.score === null ? '' : String(rec.score), note: rec.assessor_note };
    }

    function canApprove(item: AuditItem) {
        const rec = recommendations[item.id];
        if (!rec || rec.status !== 'pending' || isStale(item, rec) || unsavedItems.has(item.id) || busyItems.has(item.id)) return false;
        const edit = review(rec);
        if (!edit.score.trim()) return false;
        try { validateApproval(Number(edit.score), edit.note); return true; } catch { return false; }
    }

    async function importExam() {
        setBusy('import'); setError(''); setImportInfo('');
        try {
            const result = await importAssessorExam(auditId, importText);
            if (result.error || !result.recommendations) { setError(result.error || 'Impor gagal.'); return; }
            setRecommendations(Object.fromEntries(result.recommendations.map(rec => [rec.item_id, rec])));
            setEdits({}); setImportText('');
            setImportInfo(`${result.count} hasil tervalidasi. Draft siap direview; pasangan yang sudah disahkan tetap dipertahankan.`);
            toast.success('Hasil ChatGPT diimpor sebagai draft. Nilai resmi belum berubah.');
        } catch { setError('Impor gagal. Muat ulang rekomendasi untuk memeriksa status.'); }
        finally { setBusy(''); }
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
                    <p className="text-xs text-slate-500 mt-1">Workflow manual melalui ChatGPT, tanpa koneksi API. Ekspor dan impor tersedia setelah ujian selesai; draft hanya terlihat oleh dosen.</p>
                </div>
                <button className={button} disabled={!!busy} onClick={load}><RefreshCw className="h-4 w-4" /> Muat ulang rekomendasi</button>
            </div>
            <div className="rounded-xl bg-indigo-50 p-4 space-y-3 dark:bg-indigo-950/40">
                <h3 className="font-medium text-sm">Cara menggunakan sebagai dosen</h3>
                <ol className="list-decimal pl-5 text-sm space-y-1">
                    <li>Siapkan Project ChatGPT menggunakan bahan di panduan setup di bawah.</li>
                    <li>Klik <strong>Ekspor seluruh ujian siswa</strong>, lalu <strong>Unduh paket JSON</strong> setelah paket siap. Unggah file JSON ke chat baru dalam Project, pilih mode Thinking/reasoning, lalu kirim prompt analisis.</li>
                    <li>Salin satu JSON hasil lengkap atau unduh file JSON dari ChatGPT. Tempel atau unggah di bagian impor.</li>
                    <li>Klik <strong>Impor sebagai draft</strong>, review usulan nilai dan catatan, lalu approve per kriteria atau komponen.</li>
                </ol>
                <p className="text-xs text-slate-500">Impor tidak mengubah nilai resmi atau Catatan Asesor. Keduanya disimpan bersama ketika Anda approve.</p>
                <details className="text-sm">
                    <summary className="cursor-pointer font-medium">Panduan setup Project &amp; prompt analisis</summary>
                    <div className="mt-3 space-y-2">
                        <p>Buat Project t-SEMAR Assistive Assessor. Tempel isi Instruksi Project ke pengaturan Instructions. Unggah Knowledge, Kontrak Hasil, Schema Hasil, dan Kalibrasi sebagai sumber Project.</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                ['PROJECT_INSTRUCTIONS.md', 'Instruksi Project'], ['KNOWLEDGE.md', 'Knowledge'],
                                ['OUTPUT_CONTRACT.md', 'Kontrak Hasil'], ['output.schema.json', 'Schema Hasil'],
                                ['CALIBRATION_SYNTHETIC.json', 'Contoh sintetis'], ['PROMPTS.md', 'Prompt lengkap'],
                            ].map(([file, label]) => <a key={file} className={button} href={`/assessor-chatgpt/${file}`} download><Download className="h-4 w-4" />{label}</a>)}
                        </div>
                        <a className={button} href="https://github.com/workspacericky-dot/t-SEMAR/blob/main/references/tsemar-assessor/chatgpt-workflow/CALIBRATION.json" target="_blank" rel="noopener noreferrer">Kalibrasi dosen (GitHub)</a>
                        <p>Di halaman GitHub, unduh CALIBRATION.json melalui Download raw file untuk diunggah ke Project.</p>
                        <p>Pakai prompt nomor 1 di Prompt lengkap untuk memeriksa setup. Untuk menilai setiap siswa, lampirkan ekspor dan gunakan prompt nomor 2. Jika format gagal divalidasi aplikasi, gunakan prompt nomor 4 dengan pesan kesalahannya.</p>
                    </div>
                </details>
                <AssessorExamExport auditId={auditId} createPackage={exportAssessorExam} busy={!!busy}
                    disabledReason={hasUnsaved ? 'Selesaikan penyimpanan perubahan pada tabel sebelum ekspor.' : ''}
                    onBusyChange={value => setBusy(value ? 'export' : '')} />
                <button className={button} disabled={!!busy} onClick={async () => {
                    try {
                        const response = await fetch('/assessor-chatgpt/ANALYSIS_PROMPT.txt');
                        if (!response.ok || !response.headers.get('content-type')?.includes('text/plain')) throw new Error('Prompt unavailable');
                        await navigator.clipboard.writeText(await response.text());
                        toast.success('Prompt tersalin. Tempel di ChatGPT dan lampirkan paket ekspor.');
                    } catch { setError('Prompt gagal disalin. Unduh Prompt lengkap pada panduan setup dan salin prompt nomor 2.'); }
                }}>Salin prompt analisis</button>
                <p className="text-xs">{items.length} kriteria: {Array.from(new Set(items.map(item => item.category))).map(category => `${category} (${items.filter(item => item.category === category).length})`).join(' | ')}</p>
                {hasUnsaved && <p className="text-xs text-amber-700">Selesaikan penyimpanan perubahan pada tabel sebelum ekspor atau impor.</p>}
                <p className="text-xs text-slate-500">Ekspor selalu mencakup seluruh kriteria yang ditugaskan pada ujian siswa ini, termasuk baris yang tidak terlihat karena filter. Tahun referensi dipakai untuk menafsirkan periode; sesuaikan dengan kebijakan ujian Anda.</p>
            </div>
            <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" open>
                <summary className="cursor-pointer font-medium text-sm">Impor hasil ChatGPT</summary>
                <div className="mt-3 space-y-3">
                    <label className="text-sm block">Unggah file JSON hasil lengkap
                        <input aria-label="Unggah file JSON hasil ChatGPT" type="file" accept=".json,application/json" disabled={!!busy || hasUnsaved} className="mt-1 block text-xs"
                            onChange={async event => {
                                const file = event.target.files?.[0]; event.target.value = '';
                                if (!file) return;
                                if (file.size > 4 * 1024 * 1024) { setError('Batas file hasil adalah 4 MB.'); return; }
                                setBusy('file');
                                try { setImportText(await file.text()); setError(''); }
                                catch { setError('File tidak dapat dibaca. Coba tempel JSON hasil.'); }
                                finally { setBusy(''); }
                            }} />
                    </label>
                    <label className="text-sm block">Atau tempel JSON hasil
                        <textarea aria-label="JSON hasil ChatGPT" rows={7} value={importText} disabled={!!busy} maxLength={4 * 1024 * 1024}
                            onChange={event => setImportText(event.target.value)} placeholder="Tempel satu objek JSON lengkap untuk seluruh ujian siswa ini"
                            className="mt-1 w-full rounded-lg border bg-transparent p-3 text-xs font-mono" />
                    </label>
                    <button className={button} disabled={!!busy || hasUnsaved || !importText.trim()} onClick={importExam}>
                        {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Impor sebagai draft
                    </button>
                    <p className="text-xs text-slate-500">Satu paket hanya dapat diimpor sekali. Untuk analisis ulang, ekspor paket baru dan gunakan chat baru. Hasil harus mencakup semua kriteria.</p>
                    {importInfo && <p role="status" className="text-sm text-emerald-600">{importInfo}</p>}
                </div>
            </details>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
            {categories.map(category => {
                const categoryItems = items.filter(item => item.category === category);
                const pending = categoryItems.filter(item => recommendations[item.id]?.status !== 'approved');
                const ready = pending.length > 0 && pending.every(canApprove);
                return (
                    <details key={category} className="rounded-xl border border-slate-200 dark:border-slate-700" open>
                        <summary className="cursor-pointer p-3 font-medium text-sm">{category} — {categoryItems.length - pending.length}/{categoryItems.length} disahkan</summary>
                        <div className="px-3 pb-3 space-y-3">
                            <div className="flex flex-wrap gap-2">
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
                                            {item.criteria} <span className="text-xs text-indigo-500">{stale ? 'Perlu analisis ulang' : rec?.status === 'approved' ? 'Disahkan' : rec ? (edit?.score ? `Usulan: ${edit.score}/100` : 'Perlu nilai manual') : 'Belum ada draft ChatGPT'}</span>
                                        </summary>
                                        <div className="mt-3 space-y-3">
                                            <div className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-1 whitespace-pre-wrap">
                                                <p className="text-xs text-slate-500">{item.subcategory}</p>
                                                <p><strong>Jwb Auditee:</strong> {item.jawaban_auditee || '—'} · <strong>Jwb Evaluator:</strong> {item.jawaban_evaluator || '—'}</p>
                                                <p><strong>Catatan siswa:</strong> {item.catatan || '—'}</p>
                                                <p><strong>Rekomendasi siswa:</strong> {item.rekomendasi || '—'}</p>
                                            </div>
                                            {(unsavedItems.has(item.id) || busyItems.has(item.id)) && <p className="text-xs text-amber-600">Selesaikan penyimpanan perubahan manual sebelum ekspor atau approval.</p>}
                                            {stale && <p className="text-xs text-amber-600">Jawaban atau penilaian telah berubah sejak ekspor/analisis. Ekspor paket baru dan analisis ulang sebelum approval.</p>}
                                            {rec && edit && (
                                                <>
                                                    <p className="text-xs text-slate-500">Penilaian resmi saat ini: {item.teacher_score ?? 0}/100 · {item.catatan_asesor || 'Belum ada Catatan Asesor'}</p>
                                                    <p className="text-sm whitespace-pre-wrap"><strong>Dasar penilaian:</strong> {rec.rationale}</p>
                                                    {rec.needs_manual_review && <p className="text-xs text-amber-600">ChatGPT menandai hasil ini untuk perhatian dosen.{rec.score === null ? ' Belum ada usulan nilai; isi nilai setelah menilai secara manual.' : ''}</p>}
                                                    {rec.diagnosis && Object.keys(rec.diagnosis).length > 0 && <p className="text-xs text-slate-500">Diagnosis: {Object.entries(rec.diagnosis).map(([key, value]) => `${key}: ${value}`).join(' | ')}</p>}
                                                    {!!rec.basis_refs?.length && <p className="text-xs text-slate-500">Dasar rubrik: {rec.basis_refs.join(', ')}</p>}
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
