'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background elements (matching login page) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10" />
            <div className="absolute top-20 -left-20 w-72 h-72 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10" />

            <div className="sm:mx-auto sm:w-full sm:max-w-[480px]">
                {/* Logo */}
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
                            Reset Password
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">
                            Enter your email to receive a password reset link.
                        </p>
                    </div>

                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-slate-900">Link Sent Successfully!</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    We've sent a password reset link to <strong className="text-slate-800">{email}</strong>.
                                    Please check your inbox and click the link to update your password.
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 py-4"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 ml-1">
                                    Registered Email
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email address"
                                        className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200"
                                        required
                                    />
                                    <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                                    {error}
                                </div>
                            )}

                            <div className="pt-2 space-y-4">
                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="w-full py-3.5 rounded-xl bg-black text-white font-semibold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </button>
                            </div>

                            <div className="text-center pt-2">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
