'use client';

import { useState } from 'react';
import { Users, User, Plus } from 'lucide-react';
import { Group } from '@/types/database';
import { CreateGroupPracticeModal } from './create-group-practice-modal';
import { CreateIndividualAuditModal } from './create-individual-audit-modal';

interface CreateAuditButtonsProps {
    periodId: string;
    groups: Group[];
}

export function CreateAuditButtons({ periodId, groups }: CreateAuditButtonsProps) {
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);

    return (
        <div className="flex gap-2">
            <button
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all"
            >
                <Plus className="w-4 h-4" />
                <Users className="w-4 h-4" />
                Latihan Kelompok
            </button>
            <button
                onClick={() => setIsIndividualModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all"
            >
                <Plus className="w-4 h-4" />
                <User className="w-4 h-4" />
                Tugas Individu
            </button>

            <CreateGroupPracticeModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                periodId={periodId}
                groups={groups}
            />

            <CreateIndividualAuditModal
                isOpen={isIndividualModalOpen}
                onClose={() => setIsIndividualModalOpen(false)}
                periodId={periodId}
            />
        </div>
    );
}
