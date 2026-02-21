'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, User, Camera, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';

export default function OnboardingPage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [profileExists, setProfileExists] = useState(false);

    // Form Stats
    const [step, setStep] = useState(1);
    const totalSteps = 3;

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
                    setProfileExists(true);
                    setFullName(profile.full_name || user.user_metadata.full_name || '');
                    setAvatarUrl(profile.avatar_url || user.user_metadata.avatar_url || '');

                    if (profile.training_group && profile.role !== 'superadmin') {
                        router.replace('/dashboard');
                        return;
                    }
                } else {
                    setFullName(user.user_metadata.full_name || '');
                    setAvatarUrl(user.user_metadata.avatar_url || '');
                }

            } catch (error) {
                console.error('Error checking user:', error);
            } finally {
                setLoading(false);
            }
        };

        checkUser();
    }, []);

    const handleNext = () => {
        if (step === 1 && !fullName.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (step < totalSteps) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleSubmit = async () => {
        if (!userId) return;
        if (!trainingGroup) {
            toast.error('Please select your training group');
            return;
        }

        try {
            setSubmitting(true);
            let error;

            if (profileExists) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        avatar_url: avatarUrl,
                        training_group: trainingGroup,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        full_name: fullName,
                        avatar_url: avatarUrl,
                        training_group: trainingGroup,
                        role: 'auditor',
                        updated_at: new Date().toISOString(),
                    });
                error = insertError;
            }

            if (error) throw error;

            toast.success('All set! Welcome to eSEMAR.');
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

    // Progress percentage
    const progress = ((step - 1) / (totalSteps - 1)) * 100;

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FDFBF7] font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-50" />

            {/* Main Card Container */}
            <div className="w-full max-w-4xl px-6 relative z-10">

                {/* Header / Brand */}
                <div className="flex justify-between items-center mb-12">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className={`flex items-center gap-2 text-sm font-medium transition-all ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        PREVIOUS
                    </button>

                    <div className="flex items-center gap-3">
                        <Image
                            src="/logo-semar-legacy.png"
                            alt="t-SEMAR Logo"
                            width={42}
                            height={42}
                            className="object-contain"
                        />
                        <span className="font-semibold text-xl tracking-tight text-slate-900">t-SEMAR</span>
                    </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full max-w-2xl mx-auto mb-16 relative">
                    <div className="flex justify-between text-xs font-bold text-slate-300 uppercase tracking-widest mb-4">
                        <span className={step >= 1 ? 'text-blue-600 transition-colors duration-500' : ''}>Identity</span>
                        <span className={step >= 2 ? 'text-blue-600 transition-colors duration-500' : ''}>Avatar</span>
                        <span className={step >= 3 ? 'text-blue-600 transition-colors duration-500' : ''}>Group</span>
                    </div>

                    <div className="h-[2px] w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-700 ease-in-out"
                            style={{ width: `${((step) / totalSteps) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[400px] flex flex-col items-center justify-center max-w-2xl mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* STEP 1: NAME */}
                    {step === 1 && (
                        <div className="w-full space-y-8">
                            <div className="space-y-4">
                                <span className="text-xs font-bold text-yellow-500 tracking-wider uppercase">Question 1 / 3</span>
                                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                                    What is your full name?
                                </h1>
                                <p className="text-slate-500 text-lg font-light">
                                    We'll use this for your certificates and profile.
                                </p>
                            </div>

                            <div className="max-w-md mx-auto relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <User className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                    placeholder="Type your name here..."
                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-lg outline-none focus:border-blue-500 focus:shadow-xl focus:shadow-blue-500/10 transition-all placeholder:text-slate-300 text-slate-800 font-medium text-center"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: AVATAR */}
                    {step === 2 && (
                        <div className="w-full space-y-8">
                            <div className="space-y-4">
                                <span className="text-xs font-bold text-yellow-500 tracking-wider uppercase">Question 2 / 3</span>
                                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                                    Pick a profile picture
                                </h1>
                                <p className="text-slate-500 text-lg font-light">
                                    Optional, but helps your team recognize you.
                                </p>
                            </div>

                            <div className="flex justify-center py-6">
                                <div className="p-2 bg-white rounded-full shadow-2xl shadow-blue-900/5 border-4 border-white">
                                    <AvatarUpload
                                        uid={userId!}
                                        url={avatarUrl}
                                        onUpload={(url) => setAvatarUrl(url)}
                                        size={180}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: GROUP */}
                    {step === 3 && (
                        <div className="w-full space-y-8">
                            <div className="space-y-4">
                                <span className="text-xs font-bold text-yellow-500 tracking-wider uppercase">Question 3 / 3</span>
                                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                                    Select your training group
                                </h1>
                                <p className="text-slate-500 text-lg font-light">
                                    This determines your assignment schedule.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto w-full">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((group) => (
                                    <button
                                        key={group}
                                        onClick={() => setTrainingGroup(group)}
                                        className={`relative group/item flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${trainingGroup === group
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'
                                            }`}
                                    >
                                        <div className={`mb-2 p-2 rounded-full ${trainingGroup === group ? 'bg-white/20' : 'bg-slate-100 group-hover/item:bg-white'
                                            }`}>
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold">Group {group}</span>
                                        {trainingGroup === group && (
                                            <div className="absolute top-2 right-2">
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-12">
                        {step < totalSteps ? (
                            <button
                                onClick={handleNext}
                                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 group"
                            >
                                Next Question
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !trainingGroup}
                                className="px-8 py-3.5 bg-slate-900 hover:bg-black text-white rounded-full font-semibold shadow-xl shadow-slate-900/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        Complete Setup
                                        <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* Footer decoration */}
            <div className="absolute bottom-6 text-center w-full text-slate-300 text-xs font-medium tracking-widest uppercase">
                eSEMAR Training Platform &copy; 2026
            </div>
        </div>
    );
}
