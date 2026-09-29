'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExamPackage } from '@/lib/assessor/chatgpt-workflow';

type CreatePackage = (auditId: string, referenceYear?: number) => Promise<{ payload?: ExamPackage; error?: string }>;
const button = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-40 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800';

export function AssessorExamExport({ auditId, createPackage, busy, disabledReason, onBusyChange }: {
    auditId: string; createPackage: CreatePackage; busy: boolean; disabledReason: string;
    onBusyChange: (value: boolean) => void;
}) {
    const [year, setYear] = useState('');
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState('');
    const [ready, setReady] = useState<ExamPackage | null>(null);

    async function prepare() {
        if (busy || preparing || disabledReason) return;
        setPreparing(true); onBusyChange(true); setError(''); setReady(null);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const referenceYear = year.trim() ? Number(year) : undefined;
            if (referenceYear !== undefined && (!Number.isInteger(referenceYear) || referenceYear < 1999 || referenceYear > 2199)) {
                throw new Error('Isi tahun referensi bulat 1999-2199 atau biarkan kosong untuk tahun ujian dikurangi satu.');
            }
            const result = await Promise.race([
                createPackage(auditId, referenceYear),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Server belum merespons setelah 45 detik. Periksa koneksi lalu coba ekspor kembali.')), 45000);
                }),
            ]);
            if (result.error || !result.payload) throw new Error(result.error || 'Server tidak mengembalikan paket ekspor.');
            setReady(result.payload);
            toast.success('Paket siap. Klik Unduh paket JSON untuk menyimpan file.');
        } catch (failure) {
            const message = failure instanceof Error ? failure.message : 'Ekspor gagal. Silakan coba kembali.';
            setError(message); toast.error(message);
        } finally {
            if (timer) clearTimeout(timer);
            setPreparing(false); onBusyChange(false);
        }
    }

    return <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs">Tahun referensi (opsional)
                <input aria-label="Tahun referensi" type="number" min={1999} max={2199} step={1} value={year}
                    disabled={busy || preparing} onChange={event => setYear(event.target.value)} placeholder="Default: tahun ujian - 1"
                    className="mt-1 block w-56 rounded-lg border p-2 bg-white dark:bg-slate-900" />
            </label>
            <button type="button" className={button} disabled={busy || preparing || !!disabledReason} onClick={prepare}>
                {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {preparing ? 'Menyiapkan paket ujian...' : 'Ekspor seluruh ujian siswa'}
            </button>
        </div>
        {disabledReason && !preparing && <p className="text-xs text-amber-700">{disabledReason}</p>}
        {preparing && <p role="status" className="text-sm">Sedang mengambil seluruh jawaban dan menyimpan paket ekspor. Tunggu sampai tautan unduhan muncul.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
        {ready && <div className="rounded-lg border border-emerald-300 p-3 space-y-2">
            <p role="status" className="text-sm">Paket siap: {ready.expected_item_count} kriteria dari seluruh komponen. Tahun evaluasi {ready.evaluation_year}; tahun referensi {ready.reference_year}. Klik tombol unduh berikut.</p>
            <a className={button} href={`/api/assessor/audits/${auditId}/exports/${ready.package_id}`} download>
                <Download className="h-4 w-4" /> Unduh paket JSON
            </a>
            <p className="text-xs text-slate-500">Jika file belum tersimpan, klik Unduh paket JSON lagi. Tautan ini memakai paket yang sama; tidak membuat ekspor baru.</p>
        </div>}
    </div>;
}
