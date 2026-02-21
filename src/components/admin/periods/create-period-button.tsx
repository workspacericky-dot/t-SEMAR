'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreatePeriodModal } from './create-period-modal';

export function CreatePeriodButton() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all"
            >
                <Plus className="w-4 h-4" />
                Periode Baru
            </button>

            <CreatePeriodModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
