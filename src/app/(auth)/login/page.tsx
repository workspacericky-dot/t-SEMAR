'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError('');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('Google login error:', err);
            setError(err.message || 'Failed to sign in with Google');
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push('/dashboard');
                router.refresh();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: 'auditee',
                        },
                    },
                });
                if (error) throw error;
                setSuccess('Registrasi berhasil! Silakan cek email untuk verifikasi.');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white font-sans text-slate-900">
            {/* Left Side - Abstract Visual */}
            <div className="hidden lg:flex lg:w-1/2 relative p-4 bg-gradient-to-br from-slate-100 to-white overflow-hidden">
                <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden bg-black shadow-2xl ring-1 ring-black/5">
                    {/* Abstract gradient background */}
                    <div className="absolute inset-0 z-0">
                        {/* Video Background (FFmpeg re-encoded H.264) */}
                        <div className="absolute inset-0 z-0 bg-slate-950">
                            <video
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            >
                                <source src="/web-ready-logo-gas.mp4" type="video/mp4" />
                            </video>

                            {/* Gradient Overlay for text readability */}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 opacity-80" />
                        </div>
                    </div>

                    {/* Top Text */}
                    <div className="absolute top-10 left-10 z-10 flex items-center gap-4">
                        <span className="text-white/90 text-sm font-medium tracking-[0.2em]">SEMAR for training</span>
                        <div className="h-[1px] w-12 bg-white/50" />
                    </div>

                    {/* Bottom Content */}
                    <div className="absolute bottom-12 left-12 z-10 max-w-lg">
                        <h2 className="font-serif text-6xl text-white leading-[1.1] mb-6">
                            Hone<br />
                            Your Skill<br />
                            as An Auditor
                        </h2>
                        <p className="text-white/70 text-sm font-light leading-relaxed max-w-xs">
                            Excellence is the baseline for the collective; being the 'Best of the Best' is the mission for the individual.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12 relative">
                {/* Logo centered above everything */}
                <div className="flex flex-col items-center justify-center gap-3 mb-12">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={64}
                        height={64}
                        className="quality-100"
                        style={{ width: 'auto', height: 'auto' }}
                    />
                    <span className="font-semibold text-2xl tracking-tight text-slate-900">t-SEMAR</span>
                </div>

                <div className="w-full max-w-[420px] space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h1 className="font-serif text-4xl lg:text-[3rem] text-slate-950 mb-3">
                            {isLogin ? 'Selamat Datang' : 'Get Started'}
                        </h1>
                        <p className="text-slate-500 text-base">
                            {isLogin
                                ? 'Enter your email and password to access your account'
                                : 'Create your account to start your journey'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
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
                                    required={!isLogin}
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 ml-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-700 ml-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 focus:bg-white transition-all duration-200 pr-12"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember & Forgot */}
                        {isLogin && (
                            <div className="flex items-center justify-between text-xs">
                                <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-black focus:ring-black/10" />
                                    Remember me
                                </label>
                                <button type="button" className="font-medium text-slate-900 hover:underline">
                                    Forgot Password
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-medium">
                                {success}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 space-y-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl bg-black text-white font-semibold text-sm shadow-xl shadow-black/10 hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                    isLogin ? 'Sign In' : 'Sign Up'
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" aria-hidden="true" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                {loading ? 'Redirecting...' : 'Sign In with Google'}
                            </button>
                        </div>

                        {/* Toggle Auth Mode */}
                        <div className="text-center pt-6">
                            <p className="text-sm text-slate-500">
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    type="button"
                                    onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                                    className="font-semibold text-slate-900 hover:underline"
                                >
                                    {isLogin ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                        </div>

                    </form>
                </div>
            </div >
        </div >
    );
}
