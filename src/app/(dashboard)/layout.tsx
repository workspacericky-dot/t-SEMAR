'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { profile, setProfile, isLoading } = useAuthStore();
    const isDark = useThemeStore((s) => s.isDark);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        const fetchProfile = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    if (mounted) router.push('/login');
                    return;
                }

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (mounted) {
                    if (profileData) {
                        setProfile(profileData);
                    } else {
                        useAuthStore.setState({ isLoading: false });
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                if (mounted) useAuthStore.setState({ isLoading: false });
            }
        };

        fetchProfile();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') {
                setProfile(null);
                router.replace('/login');
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    if (isLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0F1117]' : 'bg-[#F2F4F7]'}`}>
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Memuat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen font-sans transition-colors duration-500 ${isDark
                ? 'bg-[#0F1117] text-slate-200 selection:bg-blue-900 selection:text-blue-100'
                : 'bg-[#F2F4F7] text-slate-900 selection:bg-blue-100 selection:text-blue-900'
            }`}>
            <Header />
            <main className="px-8 pb-8 max-w-[1400px] mx-auto min-h-[calc(100vh-96px)]">
                {children}
            </main>
            <Toaster position="top-right" richColors closeButton theme={isDark ? 'dark' : 'light'} />
        </div>
    );
}
