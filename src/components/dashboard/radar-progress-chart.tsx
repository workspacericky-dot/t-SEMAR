'use client';

import { AuditItem } from '@/types/database';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

interface RadarProgressChartProps {
    items: AuditItem[];
}

/**
 * Calculate weighted action plan progress per component (category).
 *
 * Formula:
 * 1. Per subcategory: weighted avg of criteria tl_progress using bobot
 * 2. Per category: weighted avg of subcategory progress using subcategory_bobot
 */
function calculateCategoryProgress(items: AuditItem[]) {
    // Group items by category
    const categoryMap = new Map<string, { bobot: number; items: AuditItem[] }>();

    for (const item of items) {
        if (!categoryMap.has(item.category)) {
            categoryMap.set(item.category, {
                bobot: item.category_bobot || 0,
                items: [],
            });
        }
        categoryMap.get(item.category)!.items.push(item);
    }

    const result: { subject: string; progress: number; fullMark: 100 }[] = [];

    for (const [category, { bobot, items: catItems }] of categoryMap) {
        // Group by subcategory
        const subcatMap = new Map<string, { bobot: number; items: AuditItem[] }>();

        for (const item of catItems) {
            if (!subcatMap.has(item.subcategory)) {
                subcatMap.set(item.subcategory, {
                    bobot: item.subcategory_bobot || 0,
                    items: [],
                });
            }
            subcatMap.get(item.subcategory)!.items.push(item);
        }

        // Calculate weighted progress per subcategory
        let totalSubcatWeight = 0;
        let weightedSubcatProgress = 0;

        for (const [, { bobot: subcatBobot, items: subcatItems }] of subcatMap) {
            let totalCriteriaWeight = 0;
            let weightedCriteriaProgress = 0;

            for (const item of subcatItems) {
                const progress = item.tl_progress || 0;
                const weight = item.bobot || 0;
                weightedCriteriaProgress += progress * weight;
                totalCriteriaWeight += weight;
            }

            const subcatProgress =
                totalCriteriaWeight > 0 ? weightedCriteriaProgress / totalCriteriaWeight : 0;

            weightedSubcatProgress += subcatProgress * subcatBobot;
            totalSubcatWeight += subcatBobot;
        }

        const categoryProgress =
            totalSubcatWeight > 0 ? weightedSubcatProgress / totalSubcatWeight : 0;

        // Shorten category name for display (remove numbering prefix)
        const shortName = category.replace(/^\d+\.\s*/, '');

        result.push({
            subject: shortName,
            progress: Math.round(categoryProgress * 100) / 100,
            fullMark: 100,
        });
    }

    // Sort by original category order
    result.sort((a, b) => {
        const order = [
            'Perencanaan Kinerja',
            'Pengukuran Kinerja',
            'Pelaporan Kinerja',
            'Evaluasi Akuntabilitas Kinerja Internal',
        ];
        return order.indexOf(a.subject) - order.indexOf(b.subject);
    });

    return result;
}

export function RadarProgressChart({ items }: RadarProgressChartProps) {
    const data = calculateCategoryProgress(items);

    // Check if there's any progress at all
    const hasProgress = data.some((d) => d.progress > 0);

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                        Progress Tindak Lanjut per Komponen
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Rata-rata tertimbang berdasarkan bobot subkomponen dan kriteria
                    </p>
                </div>
            </div>

            {!hasProgress ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <p className="text-sm">Belum ada progress tindak lanjut yang tercatat.</p>
                </div>
            ) : (
                <div className="w-full" style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                className="text-xs"
                            />
                            <PolarRadiusAxis
                                angle={90}
                                domain={[0, 100]}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickCount={6}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#f8fafc',
                                    fontSize: '13px',
                                }}
                                formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Progress'] as [string, string]}
                            />
                            <Radar
                                name="Progress Tindak Lanjut"
                                dataKey="progress"
                                stroke="#0d9488"
                                fill="#14b8a6"
                                fillOpacity={0.3}
                                strokeWidth={2}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legend / Summary */}
            <div className="grid grid-cols-2 gap-2 mt-4">
                {data.map((d) => (
                    <div
                        key={d.subject}
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate mr-2">
                            {d.subject}
                        </span>
                        <span
                            className={`text-xs font-bold ${d.progress >= 75
                                ? 'text-emerald-600'
                                : d.progress >= 50
                                    ? 'text-amber-600'
                                    : d.progress > 0
                                        ? 'text-orange-600'
                                        : 'text-slate-400'
                                }`}
                        >
                            {d.progress}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
