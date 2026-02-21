'use client';

import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User, ChevronDown, Sun, Moon, UserPlus, Users } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

const roleBadge: Record<string, { label: string; color: string }> = {
    superadmin: { label: 'Super Admin', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
    auditor: { label: 'Evaluator', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    auditee: { label: 'Auditee', color: 'bg-teal-500/15 text-teal-400 border-teal-500/20' },
};

import { ProfileEditModal } from '@/components/profile-edit-modal';
import { AddUserModal } from '@/components/admin/add-user-modal';

export function Header() {
    const profile = useAuthStore((s) => s.profile);
    const { isDark, toggle: toggleDark } = useThemeStore();
    const [open, setOpen] = useState(false);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    // Close profile dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = async () => {
        setOpen(false);
        await supabase.auth.signOut();
        router.replace('/login');
    };

    return (
        <header className={`sticky top-0 z-30 h-24 backdrop-blur-md flex items-center justify-between px-8 transition-all duration-300 ${isDark ? 'bg-[#0F1117]/80' : 'bg-[#F2F4F7]/80'
            }`}>
            {/* Left: Logo / Brand */}
            <div className="w-1/3 flex flex-row items-center">
                <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <Image src="/logo-semar.png" alt="SEMAR Logo" width={40} height={40} className="object-contain" />
                    <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        t-SEMAR
                    </h1>
                </Link>
            </div>

            {/* Right: Dark Mode Toggle + Profile */}
            <div className="w-1/3 flex justify-end items-center gap-3">
                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDark}
                    className={`p-2.5 rounded-full transition-all duration-300 ${isDark
                        ? 'bg-[#1A1D27] text-yellow-400 hover:bg-[#252830]'
                        : 'bg-white text-slate-500 hover:bg-slate-50 shadow-sm'
                        }`}
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Profile Dropdown */}
                <div className="relative" ref={ref}>
                    <button
                        onClick={() => setOpen(!open)}
                        className={`flex items-center gap-3 p-1.5 pr-4 rounded-full border transition-all duration-300 group ${isDark
                            ? 'bg-[#1A1D27] border-slate-700/50 hover:bg-[#252830]'
                            : 'bg-white border-white/50 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]'
                            }`}
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <Image
                                    src={profile.avatar_url}
                                    alt="Avatar"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                profile?.full_name?.[0]?.toUpperCase() || <User className="w-5 h-5" />
                            )}
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className={`text-sm font-semibold leading-none transition-colors ${isDark ? 'text-white group-hover:text-blue-400' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                {profile?.full_name?.split(' ')[0] || 'User'}
                            </p>
                            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {roleBadge[profile?.role ?? 'auditee']?.label}
                            </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>

                    {open && (
                        <div className={`absolute right-0 mt-3 w-64 backdrop-blur-xl border rounded-2xl shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] overflow-hidden p-2 origin-top-right ${isDark
                            ? 'bg-[#1A1D27]/95 border-slate-700/50 ring-1 ring-white/5'
                            : 'bg-white/90 border-white/20 ring-1 ring-black/5'
                            }`}>
                            <div className={`px-4 py-3 border-b mb-1 ${isDark ? 'border-slate-700/50' : 'border-slate-100/50'}`}>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    {profile?.full_name}
                                </p>
                                <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {profile?.satker_name || 'Mahkamah Agung RI'}
                                </p>
                            </div>

                            <button
                                onClick={() => { setOpen(false); setIsEditProfileOpen(true); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <User className="w-4 h-4" />
                                Edit Profile
                            </button>

                            {/* Register User (Superadmin Only) */}
                            {profile?.role === 'superadmin' && (
                                <>
                                    <button
                                        onClick={() => { setOpen(false); setIsAddUserOpen(true); }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Register User
                                    </button>
                                    <Link
                                        href="/admin/users"
                                        onClick={() => setOpen(false)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <Users className="w-4 h-4" />
                                        Manage Users
                                    </Link>
                                </>
                            )}

                            {/* Role Switcher Removed as per req */}

                            <button
                                onClick={handleLogout}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 rounded-xl transition-colors ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50/80'
                                    }`}
                            >
                                <LogOut className="w-4 h-4" />
                                Keluar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ProfileEditModal isOpen={isEditProfileOpen} onClose={() => setIsEditProfileOpen(false)} />
            <AddUserModal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} />
        </header>
    );
}
