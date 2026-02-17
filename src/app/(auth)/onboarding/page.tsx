'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [trainingGroup, setTrainingGroup] = useState<number | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    router.replace('/login');
                    return;
                }

                setUserId(user.id);

                // Fetch existing profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    // Pre-fill fields
                    setFullName(profile.full_name || user.user_metadata.full_name || '');
                    setAvatarUrl(profile.avatar_url || user.user_metadata.avatar_url || '');

                    // If already has training group (and not superadmin), redirect to dashboard
                    // But we'll let them edit if they landed here manually? 
                    // No, for now assume strict onboarding flow.
                    if (profile.training_group && profile.role !== 'superadmin') {
                        router.replace('/dashboard');
                        return;
                    }
                }

            } catch (error) {
                console.error('Error checking user:', error);
            } finally {
                setLoading(false);
            }
        };

        checkUser();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId) return;
        if (!fullName.trim()) {
            toast.error('Full name is required');
            return;
        }
        if (!trainingGroup) {
            toast.error('Please select your training group');
            return;
        }

        try {
            setSubmitting(true);

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    training_group: trainingGroup,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Profile updated! Welcome to eSEMAR.');

            // Force refresh to update server components/middleware awareness
            router.refresh();
            router.push('/dashboard');

        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-white font-sans text-slate-900">
            {/* Left Side - Visual (Same as login but with different text) */}
            <div className="hidden lg:flex lg:w-1/2 relative p-4 bg-gradient-to-br from-slate-100 to-white overflow-hidden">
                <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden bg-black shadow-2xl ring-1 ring-black/5">
                    <div className="absolute inset-0 z-0 bg-slate-950">
                        {/* Reusing the login video if available, or just a dark background */}
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-slate-900 to-black opacity-90" />
                    </div>

                    <div className="absolute top-10 left-10 z-10 flex items-center gap-4">
                        <span className="text-white/90 text-sm font-medium tracking-[0.2em]">ONBOARDING</span>
                        <div className="h-[1px] w-12 bg-white/50" />
                    </div>

                    <div className="absolute bottom-12 left-12 z-10 max-w-lg">
                        <h2 className="font-serif text-5xl text-white leading-[1.1] mb-6">
                            Welcome to<br />
                            the Team
                        </h2>
                        <p className="text-white/70 text-sm font-light leading-relaxed max-w-xs">
                            Please complete your profile to get started with your training assignments.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12 relative">
                <div className="w-full max-w-[420px] space-y-10">
                    <div className="text-center space-y-2">
                        <h1 className="font-serif text-3xl text-slate-950">
                            Setup Your Profile
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Just a few details to personalize your experience
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Avatar Upload */}
                        <div className="flex justify-center">
                            <AvatarUpload
                                uid={userId!}
                                url={avatarUrl}
                                onUpload={(url) => setAvatarUrl(url)}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 ml-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 ml-1">
                                    Training Group
                                </label>
                                <div className="relative">
                                    <select
                                        value={trainingGroup || ''}
                                        onChange={(e) => setTrainingGroup(Number(e.target.value))}
                                        className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200 appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="" disabled>Select your group...</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((group) => (
                                            <option key={group} value={group}>
                                                Group {group}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 ml-1">
                                    * Ask your supervisor if you are unsure about your group number.
                                </p>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-3.5 rounded-xl bg-black text-white font-semibold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Complete Setup</span>
                                    <CheckCircle2 className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
