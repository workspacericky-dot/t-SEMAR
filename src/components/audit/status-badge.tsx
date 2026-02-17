'use client';

import { AuditItemStatus } from '@/types/database';
import { STATUS_CONFIG } from '@/lib/constants';

interface StatusBadgeProps {
    status: AuditItemStatus;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status];

    return (
        <span
            className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${config.bgColor} ${config.color} ${size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
                }`}
            title={config.description}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'DRAFTING'
                    ? 'bg-slate-400'
                    : status === 'SUBMITTED'
                        ? 'bg-indigo-500'
                        : status === 'PUBLISHED_TO_AUDITEE'
                            ? 'bg-amber-500'
                            : status === 'DISPUTED'
                                ? 'bg-red-500 animate-pulse'
                                : 'bg-emerald-500'
                    }`}
            />
            {config.label}
        </span>
    );
}
