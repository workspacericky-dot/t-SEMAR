'use client';

import { useState } from 'react';
import { AuditItem, ExtendedAudit } from '@/types/database';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuditExportButtonsProps {
    audit: ExtendedAudit;
    items: AuditItem[];
    isDark?: boolean;
}

const getScoreValue = (item: AuditItem) => {
    if (item.jawaban_evaluator) return item.nilai_evaluator || 0;
    return item.nilai_auditee || 0;
};

const calculateFinalScore = (items: AuditItem[]) => {
    const categories = [...new Set(items.map(i => i.category))];
    let totalFinalScore = 0;

    categories.forEach(category => {
        const catItems = items.filter(i => i.category === category);
        const subcats = [...new Set(catItems.map(i => i.subcategory))];

        let categoryScore = 0;
        subcats.forEach(sub => {
            const subItems = catItems.filter(i => i.subcategory === sub);
            if (subItems.length === 0) return;

            const subScoreRaw = subItems.reduce((sum, item) => {
                const nilai = getScoreValue(item);
                const bobot = item.bobot || 0;
                return sum + (nilai * bobot);
            }, 0);

            const subScore = subScoreRaw / 100;
            const subWeight = subItems[0].subcategory_bobot || 0;

            categoryScore += (subScore * subWeight) / 100;
        });
        totalFinalScore += categoryScore;
    });

    return totalFinalScore;
};

export function AuditExportButtons({ audit, items, isDark }: AuditExportButtonsProps) {
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const finalScore = calculateFinalScore(items);

    const handleExportExcel = async () => {
        setExportingExcel(true);
        try {
            const XLSX = await import('xlsx');

            const wsData = [
                ['No', 'Kategori', 'Subkategori', 'Kriteria', 'Bobot', 'Nilai Auditee', 'Jawaban Auditee', 'Nilai Evaluator', 'Jawaban Evaluator', 'Catatan', 'Rekomendasi', 'Status']
            ];

            items.forEach((item, idx) => {
                wsData.push([
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
                ]);
            });

            // Add final score row
            wsData.push([]);
            wsData.push(['', '', '', '', '', '', '', '', 'NILAI AKHIR', finalScore.toFixed(2), '', '']);

            const ws = XLSX.utils.aoa_to_sheet(wsData);
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
            doc.text(`Nilai Akhir: ${finalScore.toFixed(2)}`, doc.internal.pageSize.width - 14, 22, { align: 'right' });

            // Satker / Auditee info
            const auditeeProfile = audit.auditee as any;
            if (auditeeProfile) {
                const auditeeName = auditeeProfile.satker_name || auditeeProfile.full_name || '';
                doc.text(`Auditee: ${auditeeName}`, 14, 28);
            }

            const tableData = items.map((item, idx) => [
                idx + 1,
                item.category,
                item.subcategory,
                item.criteria,
                item.jawaban_auditee || '-',
                item.jawaban_evaluator || '-',
                item.nilai_evaluator ?? item.nilai_auditee ?? 0,
                item.catatan || '-',
                item.rekomendasi || '-'
            ]);

            autoTable(doc, {
                startY: 35,
                head: [['No', 'Kategori', 'Subkategori', 'Kriteria', 'Jwb Auditee', 'Jwb Evaluator', 'Nilai', 'Catatan', 'Rekomendasi']],
                body: tableData,
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 10 },
                    3: { cellWidth: 50 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 20 },
                    6: { cellWidth: 15 },
                    7: { cellWidth: 40 },
                    8: { cellWidth: 40 },
                },
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
