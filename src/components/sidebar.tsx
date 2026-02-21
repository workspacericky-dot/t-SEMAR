'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { NAV_ITEMS } from '@/lib/constants';
import {
    LayoutDashboard,
    ClipboardCheck,
    Users,
    ChevronLeft,
    ChevronRight,
    Calendar,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
    LayoutDashboard,
    ClipboardCheck,
    Users,
    Calendar,
};

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const profile = useAuthStore((s) => s.profile);

    const role = profile?.role ?? 'auditee';
    const items = NAV_ITEMS[role] || NAV_ITEMS.auditee;

    return (
        <aside
            className={`fixed left-0 top-0 z-40 h-screen flex flex-col bg-[#F8F9FC] border-r border-[#E2E8F0] transition-all duration-300 ${collapsed ? 'w-[80px]' : 'w-[280px]'
                }`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-24 shrink-0">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5 border border-slate-200 shadow-sm hover:scale-105 transition-transform">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none mb-1">
                                t-SEMAR
                            </h1>
                            <p className="text-[10px] text-slate-500 font-medium leading-none">
                                SEMAR for training
                            </p>
                        </div>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                {items.map((item) => {
                    const Icon = iconMap[item.icon] || LayoutDashboard;
                    const isActive =
                        pathname === item.href ||
                        (item.href !== '/dashboard' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 ${isActive
                                ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                                }`}
                        >
                            <Icon
                                className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                                    }`}
                            />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <div className="px-4 py-6">
                <button
                    onClick={onToggle}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all text-sm"
                >
                    {collapsed ? (
                        <ChevronRight className="w-5 h-5" />
                    ) : (
                        <>
                            <ChevronLeft className="w-5 h-5" />
                            <span>Perkecil Menu</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
