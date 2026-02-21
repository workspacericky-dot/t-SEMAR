'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { GroupFormModal } from './create-group-modal';

interface CreateGroupButtonProps {
    periodId: string;
    existingGroupsCount: number;
}

export function CreateGroupButton({ periodId, existingGroupsCount }: CreateGroupButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all"
            >
                <Plus className="w-4 h-4" />
                <span>Buat Kelompok</span>
            </button>

            <GroupFormModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                periodId={periodId}
                existingGroupsCount={existingGroupsCount}
            />
        </>
    );
}
