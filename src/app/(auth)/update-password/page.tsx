'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hashError, setHashError] = useState<string | null>(null);

    // Verify session exists or check for hash errors
    useEffect(() => {
        // Parse Hash parameters since Supabase Password Recovery uses implicit flows
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorDescription = hashParams.get('error_description');
        if (errorDescription) {
            setHashError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
            toast.error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
            return;
        }

        const checkSession = async () => {
            const supabase = createClient();
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                toast.error('Sesi tidak valid atau telah berakhir. Silakan minta link reset baru.');
                router.replace('/forgot-password');
            }
        };
        checkSession();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Password tidak cocok');
            return;
        }

        if (password.length < 6) {
            toast.error('Password minimal 6 karakter');
            return;
        }

        setLoading(true);

        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            toast.error(error.message || 'Gagal mengubah password');
        } else {
            toast.success('Password berhasil diubah!');
            // Redirect to dashboard since they are now securely authenticated
            router.push('/dashboard');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10" />
            <div className="absolute top-20 -left-20 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10" />

            <div className="sm:mx-auto sm:w-full sm:max-w-[480px]">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-blue-500/10 flex items-center justify-center p-2.5 border border-slate-100/50">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={64}
                            height={64}
                            className="w-full h-full object-contain"
                            priority
                        />
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl px-8 py-10 shadow-2xl shadow-slate-200/50 sm:rounded-[2rem] border border-white">
                    <div className="mb-8 text-center space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            Create New Password
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Please enter your new password below to secure your account.
                        </p>
                    </div>

                    {hashError && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex flex-col items-center text-center gap-2">
                            <span>{hashError}</span>
                            <button
                                onClick={() => router.replace('/forgot-password')}
                                className="mt-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                            >
                                Request New Link
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 ml-1">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200"
                                    required
                                    minLength={6}
                                />
                                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 ml-1">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200"
                                    required
                                    minLength={6}
                                />
                                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 space-y-4">
                            <button
                                type="submit"
                                disabled={loading || !password || !confirmPassword || !!hashError}
                                className="w-full py-3.5 rounded-xl bg-black text-white font-semibold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
