'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deletePeriod } from '@/lib/actions/period-actions';

interface DeletePeriodButtonProps {
    periodId: string;
}

export function DeletePeriodButton({ periodId }: DeletePeriodButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('PERINGATAN KERAS!\n\nApakah Anda yakin ingin menghapus periode ini?\nMenghapus periode ini juga akan MENGHAPUS SEMUA GRUP DAN AUDIT yang ada di dalamnya secara permanen.\n\nTindakan ini TIDAK DAPAT DIBATALKAN. Lanjutkan?')) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deletePeriod(periodId);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success('Periode berhasil dihapus');
            }
        } catch (error) {
            console.error(error);
            toast.error('Terjadi kesalahan saat menghapus periode');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Hapus Periode"
        >
            {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Trash2 className="w-4 h-4" />
            )}
        </button>
    );
}
