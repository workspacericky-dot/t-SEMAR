import { AuditItemStatus } from '@/types/database';

// Status display configuration
export const STATUS_CONFIG: Record<
    AuditItemStatus,
    { label: string; color: string; bgColor: string; description: string }
> = {
    DRAFTING: {
        label: 'Draft',
        color: 'text-slate-600',
        bgColor: 'bg-slate-100',
        description: 'Menunggu evaluasi auditor',
    },
    SUBMITTED: {
        label: 'Menunggu Evaluasi',
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        description: 'Telah dikirim ke auditor, menunggu penilaian',
    },
    PUBLISHED_TO_AUDITEE: {
        label: 'Menunggu Auditee',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        description: 'Menunggu tanggapan auditee',
    },
    DISPUTED: {
        label: 'Disputed',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        description: 'Auditee tidak setuju, menunggu keputusan auditor',
    },
    FINAL_AGREED: {
        label: 'Final (Setuju)',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        description: 'Auditee menyetujui temuan',
    },
    FINAL_ALTERED: {
        label: 'Final (Direvisi)',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        description: 'Temuan telah direvisi berdasarkan tanggapan auditee',
    },
    FINAL_ORIGINAL: {
        label: 'Final (Tetap)',
        color: 'text-purple-700',
        bgColor: 'bg-purple-50',
        description: 'Temuan tetap, tanggapan auditee ditolak',
    },
};

// Valid state transitions
export const VALID_TRANSITIONS: Record<AuditItemStatus, AuditItemStatus[]> = {
    DRAFTING: ['SUBMITTED'],
    SUBMITTED: ['PUBLISHED_TO_AUDITEE'],
    PUBLISHED_TO_AUDITEE: ['FINAL_AGREED', 'DISPUTED'],
    DISPUTED: ['FINAL_ALTERED', 'FINAL_ORIGINAL'],
    FINAL_AGREED: [],
    FINAL_ALTERED: [],
    FINAL_ORIGINAL: [],
};

// Navigation items per role
export const NAV_ITEMS = {
    superadmin: [
        { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
        { label: 'Periode Audit', href: '/admin/periods', icon: 'Calendar' },
        { label: 'Audit', href: '/audits', icon: 'ClipboardCheck' },
        { label: 'Pengguna', href: '/admin/users', icon: 'Users' },
    ],
    auditor: [
        { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
        { label: 'Evaluasi Saya', href: '/audits', icon: 'ClipboardCheck' },
    ],
    auditee: [
        { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
        { label: 'Audit Saya', href: '/audits', icon: 'ClipboardCheck' },
    ],
    participant: [
        { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
        { label: 'Audit Saya', href: '/audits', icon: 'ClipboardCheck' },
    ],
};
