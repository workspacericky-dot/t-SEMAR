'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, UserPlus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUser } from '@/lib/actions/user-actions';

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddUserModal({ isOpen, onClose }: AddUserModalProps) {
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        role: 'auditor' as 'superadmin' | 'auditor' | 'auditee',
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (formData.password.length < 6) {
                toast.error('Password must be at least 6 characters');
                return;
            }

            const result = await createUser({
                ...formData,
            });

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success('User created successfully!');

            // Reset form
            setFormData({
                email: '',
                password: '',
                fullName: '',
                role: 'auditor',
            });
            onClose();

        } catch (error: any) {
            toast.error('Failed to create user');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <UserPlus className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Register New User</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {/* Full Name */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Full Name
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#252830] border-transparent rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#252830] transition-all"
                            placeholder="e.g. John Doe"
                        />
                    </div>

                    {/* Email & Password */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#252830] border-transparent rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#252830] border-transparent rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* Role & Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Role
                            </label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#252830] border-transparent rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                            >
                                <option value="auditor">Auditor (Evaluator)</option>
                                <option value="auditee">Auditee</option>
                                <option value="superadmin">Super Admin</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <span>Create User</span>
                                    <CheckCircle2 className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>,
        document.body
    );
}
