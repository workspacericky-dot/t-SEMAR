'use client';

import { useState } from 'react';
import { AuditItem, ExtendedAudit, UserRole } from '@/types/database';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuditExportButtonsProps {
    audit: ExtendedAudit;
    items: AuditItem[];
    isDark?: boolean;
    role?: UserRole;
    scoreReleased?: boolean;
}

const getScoreValue = (item: AuditItem) => {
    if (item.jawaban_evaluator) return item.nilai_evaluator || 0;
    return item.nilai_auditee || 0;
};

// For exams (midterm/final), every item carries equal weight and the score
// that matters is teacher_score — the same simple average AuditTable uses
// for its exam-mode "Nilai Ujian" total (see audit-table.tsx isExamType branch).
const calculateExamScore = (items: AuditItem[]) => {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item.teacher_score || 0), 0) / items.length;
};

// Regular (non-exam) audits use the bobot-weighted hierarchy of
// nilai_evaluator/nilai_auditee across category -> subcategory -> criteria.
const calculateRegularScore = (items: AuditItem[]) => {
    const categories = [...new Set(items.map(i => i.category))];
    let totalFinalScore = 0;

    categories.forEach(category => {
        const catItems = items.filter(i => i.category === category);
        const subcats = [...new Set(catItems.map(i => i.subcategory))];

        let categoryScore = 0;
        subcats.forEach(sub => {
            const subItems = catItems.filter(i => i.subcategory === sub);
            if (subItems.length === 0) return;

            const bobotSum = subItems.reduce((sum, item) => sum + (item.bobot || 0), 0);
            const subScoreRaw = subItems.reduce((sum, item) => {
                const nilai = getScoreValue(item);
                const bobot = item.bobot || 0;
                return sum + (nilai * bobot);
            }, 0);

            const subScore = bobotSum > 0 ? subScoreRaw / bobotSum : 0;
            const subWeight = subItems[0].subcategory_bobot || 0;

            categoryScore += (subScore * subWeight) / 100;
        });
        totalFinalScore += categoryScore;
    });

    return totalFinalScore;
};

export function AuditExportButtons({ audit, items, isDark, role, scoreReleased }: AuditExportButtonsProps) {
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const isExamType = audit.type === 'midterm' || audit.type === 'final';
    const isAdminOrSuperadmin = role === 'superadmin' || role === 'admin';
    const showTeacherScore = isExamType && (isAdminOrSuperadmin || !!scoreReleased);

    const finalScore = isExamType ? calculateExamScore(items) : calculateRegularScore(items);
    const finalScoreLabel = isExamType ? 'Nilai Ujian' : 'Nilai Akhir';

    const handleExportExcel = async () => {
        setExportingExcel(true);
        try {
            const XLSX = await import('xlsx');

            const header = ['No', 'Kategori', 'Subkategori', 'Kriteria', 'Bobot', 'Nilai Auditee', 'Jawaban Auditee', 'Nilai Evaluator', 'Jawaban Evaluator', 'Catatan', 'Rekomendasi', 'Status'];
            if (showTeacherScore) header.push('Nilai (Ujian)', 'Catatan Asesor');

            const wsData = [header];

            items.forEach((item, idx) => {
                const row = [
                    (idx + 1).toString(),
                    item.category || '',
                    item.subcategory || '',
                    item.criteria || '',
                    (item.bobot || 0).toString(),
                    (item.nilai_auditee || 0).toString(),
                    item.jawaban_auditee || '',
                    (item.nilai_evaluator || 0).toString(),
                    item.jawaban_evaluator || '',
                    item.catatan || '',
                    item.rekomendasi || '',
                    item.status || ''
                ];
                if (showTeacherScore) row.push((item.teacher_score || 0).toString(), item.catatan_asesor || '');
                wsData.push(row);
            });

            // Add final score row (label in the "Jawaban Evaluator" column, value in "Catatan")
            const finalRow = new Array(header.length).fill('');
            finalRow[8] = finalScoreLabel.toUpperCase();
            finalRow[9] = finalScore.toFixed(2);
            wsData.push([]);
            wsData.push(finalRow);

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            // The free "xlsx" package can't write cell styles (no wrapText support on
            // export), so column width is the only lever available to keep long text
            // like Subkategori/Kriteria from being clipped by Excel's default ~8-char
            // column width.
            ws['!cols'] = [
                { wch: 5 },   // No
                { wch: 22 },  // Kategori
                { wch: 45 },  // Subkategori
                { wch: 40 },  // Kriteria
                { wch: 8 },   // Bobot
                { wch: 12 },  // Nilai Auditee
                { wch: 30 },  // Jawaban Auditee
                { wch: 12 },  // Nilai Evaluator
                { wch: 30 },  // Jawaban Evaluator
                { wch: 30 },  // Catatan
                { wch: 30 },  // Rekomendasi
                { wch: 14 },  // Status
                ...(showTeacherScore ? [{ wch: 12 }, { wch: 30 }] : []), // Nilai (Ujian), Catatan Asesor
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Audit Items');
            XLSX.writeFile(wb, `Audit_${audit.id.substring(0, 8)}_Result.xlsx`);
            toast.success('Berhasil ekspor ke Excel');
        } catch (error) {
            console.error(error);
            toast.error('Gagal ekspor ke Excel');
        } finally {
            setExportingExcel(false);
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const doc = new jsPDF('landscape');

            // Header
            doc.setFontSize(16);
            doc.text(`Hasil Evaluasi AKIP: ${audit.title}`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Tahun: ${audit.year}`, 14, 22);
            doc.text(`${finalScoreLabel}: ${finalScore.toFixed(2)}`, doc.internal.pageSize.width - 14, 22, { align: 'right' });

            // Satker / Auditee info
            const auditeeProfile = audit.auditee as any;
            if (auditeeProfile) {
                const auditeeName = auditeeProfile.satker_name || auditeeProfile.full_name || '';
                doc.text(`Auditee: ${auditeeName}`, 14, 28);
            }

            const head = ['No', 'Kategori', 'Subkategori', 'Kriteria', 'Jwb Auditee', 'Jwb Evaluator', 'Nilai', 'Catatan', 'Rekomendasi'];
            if (showTeacherScore) head.push('Nilai (Ujian)', 'Catatan Asesor');

            const tableData = items.map((item, idx) => {
                const row = [
                    idx + 1,
                    item.category,
                    item.subcategory,
                    item.criteria,
                    item.jawaban_auditee || '-',
                    item.jawaban_evaluator || '-',
                    item.nilai_evaluator ?? item.nilai_auditee ?? 0,
                    item.catatan || '-',
                    item.rekomendasi || '-'
                ];
                if (showTeacherScore) row.push(item.teacher_score ?? 0, item.catatan_asesor || '-');
                return row;
            });

            // Every column but the last needs an explicit width — a column left unset
            // otherwise only gets whatever thin sliver remains after the fixed ones,
            // which is what forced Kategori/Subkategori into one-character-per-line
            // wrapping before. The last column is left unset on purpose so it
            // stretches to absorb any leftover page width instead of the table
            // falling short of the page edge.
            const columnStyles: Record<number, { cellWidth: number }> = {
                0: { cellWidth: 8 },   // No
                1: { cellWidth: 25 },  // Kategori
                2: { cellWidth: 38 },  // Subkategori
                3: { cellWidth: 43 },  // Kriteria
                4: { cellWidth: 16 },  // Jwb Auditee
                5: { cellWidth: 16 },  // Jwb Evaluator
                6: { cellWidth: 12 },  // Nilai
                7: { cellWidth: 29 },  // Catatan
            };
            if (showTeacherScore) {
                columnStyles[8] = { cellWidth: 29 }; // Rekomendasi
                columnStyles[9] = { cellWidth: 14 }; // Nilai (Ujian)
                // column 10, Catatan Asesor, intentionally left unset (stretches)
            }
            // else column 8, Rekomendasi, intentionally left unset (stretches)

            autoTable(doc, {
                startY: 35,
                margin: { left: 14, right: 14 },
                head: [head],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
                columnStyles,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 }
            });

            doc.save(`Audit_${audit.id.substring(0, 8)}_Result.pdf`);
            toast.success('Berhasil ekspor ke PDF');
        } catch (error) {
            console.error(error);
            toast.error('Gagal ekspor ke PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border shadow-sm ${isDark
                    ? 'bg-[#1A1D27] border-slate-700 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                    : 'bg-white border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                    }`}
                title="Export ke Excel"
            >
                {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Excel
            </button>

            <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border shadow-sm ${isDark
                    ? 'bg-[#1A1D27] border-slate-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/30'
                    : 'bg-white border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200'
                    }`}
                title="Export ke PDF"
            >
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
            </button>
        </div>
    );
}
