'use client';

import { useState } from 'react';
import { AuditItem, UserRole } from '@/types/database';
import { Loader2, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { updateActionPlanDetails } from '@/lib/actions/audit-actions';

interface ActionPlanRowProps {
    item: AuditItem;
    role: UserRole;
    index: number;
}

export function ActionPlanRow({ item, role, index }: ActionPlanRowProps) {
    const isAuditee = role === 'auditee';
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Local state for editable fields
    const [actionPlan, setActionPlan] = useState(item.auditee_action_plan || '');
    const [target, setTarget] = useState(item.tl_target || '');
    const [waktu, setWaktu] = useState(item.tl_waktu || '');
    const [pic, setPic] = useState(item.tl_pic || '');
    const [progress, setProgress] = useState(item.tl_progress || 0);
    const [fileLink, setFileLink] = useState(item.tl_file_link || '');

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateActionPlanDetails(item.id, {
                auditee_action_plan: actionPlan,
                tl_target: target,
                tl_waktu: waktu,
                tl_pic: pic,
                tl_progress: progress,
                tl_file_link: fileLink,
            });
            setHasChanges(false);
            toast.success('Rencana aksi berhasil disimpan');
        } catch (error) {
            toast.error('Gagal menyimpan rencana aksi');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (setter: (val: any) => void, value: any) => {
        setter(value);
        setHasChanges(true); // Flag to show save button
    };

    return (
        <tr className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
            <td className="px-3 py-3 w-10 text-center text-slate-500 text-xs">
                {index + 1}
            </td>

            {/* View Only Columns */}
            <td className="px-3 py-3 min-w-[200px] text-sm text-slate-700 dark:text-slate-300">
                {item.rekomendasi || '-'}
            </td>
            {role !== 'auditor' && (
                <td className="px-3 py-3 min-w-[200px] text-sm text-slate-600 dark:text-slate-400">
                    {item.catatan || '-'}
                </td>
            )}
            <td className="px-3 py-3 min-w-[200px] w-64">
                {isAuditee ? (
                    <textarea
                        value={actionPlan}
                        onChange={(e) => handleChange(setActionPlan, e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Rencana Aksi..."
                        rows={3}
                    />
                ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-300">{actionPlan || '-'}</span>
                )}
            </td>

            {/* Editable / Viewable Matrix Columns */}

            {role !== 'auditor' && (
                <>
                    {/* Target */}
                    <td className="px-3 py-3 w-32">
                        {isAuditee ? (
                            <input
                                value={target}
                                onChange={(e) => handleChange(setTarget, e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Contoh: 5 Laporan"
                            />
                        ) : (
                            <span className="text-sm">{target || '-'}</span>
                        )}
                    </td>

                    {/* Waktu Pelaksanaan */}
                    <td className="px-3 py-3 w-32">
                        {isAuditee ? (
                            <input
                                value={waktu}
                                onChange={(e) => handleChange(setWaktu, e.target.value)}
                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Contoh: Q3 2026"
                            />
                        ) : (
                            <span className="text-sm">{waktu || '-'}</span>
                        )}
                    </td>
                </>
            )}

            {/* PIC */}
            <td className="px-3 py-3 w-32">
                {isAuditee ? (
                    <input
                        value={pic}
                        onChange={(e) => handleChange(setPic, e.target.value)}
                        className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Nama/Jabatan"
                    />
                ) : (
                    <span className="text-sm">{pic || '-'}</span>
                )}
            </td>

            {/* Status / Progress */}
            <td className="px-3 py-3 w-40">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                    {isAuditee ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={progress}
                                onChange={(e) => handleChange(setProgress, parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    ) : (
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </div>
            </td>

            {/* Bukti Dukung */}
            <td className="px-3 py-3 w-40">
                {isAuditee ? (
                    <input
                        value={fileLink}
                        onChange={(e) => handleChange(setFileLink, e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Link Google Drive / Upload..."
                    />
                ) : (
                    fileLink ? (
                        /^https?:\/\//i.test(fileLink) ? (
                            <a href={fileLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 break-all">
                                <ExternalLink className="w-3 h-3 shrink-0" /> {fileLink}
                            </a>
                        ) : (
                            <span className="text-xs text-slate-700 dark:text-slate-300 break-all">{fileLink}</span>
                        )
                    ) : (
                        <span className="text-xs text-slate-400">-</span>
                    )
                )}
            </td>

            {/* Save Button (Auditee only) */}
            <td className="px-3 py-3 w-16 text-center">
                {isAuditee && hasChanges && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                        title="Simpan Perubahan"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                )}
            </td>
        </tr>
    );
}
