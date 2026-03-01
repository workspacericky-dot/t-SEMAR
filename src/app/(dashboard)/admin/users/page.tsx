'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { getUsers, deleteUser, resetUserPassword } from '@/lib/actions/user-actions';
import { toast } from 'sonner';
import { Loader2, Trash2, Shield, User, Users, AlertCircle, ArrowLeft, Key, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface UserData {
    id: string;
    email?: string;
    full_name: string;
    role: string;
    training_group?: number;
    avatar_url?: string;
    created_at: string;
}

export default function ManageUsersPage() {
    const router = useRouter();
    const profile = useAuthStore((s) => s.profile);
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Password Reset State
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [resetTargetUser, setResetTargetUser] = useState<{ id: string, name: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        // Protect Route
        if (profile && profile.role !== 'superadmin') {
            router.replace('/dashboard');
        }
    }, [profile, router]);

    const fetchUsers = async () => {
        setLoading(true);
        const res = await getUsers();
        if (res.error) {
            toast.error(res.error);
        } else if (res.users) {
            setUsers(res.users);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (profile?.role === 'superadmin') {
            fetchUsers();
        }
    }, [profile]);

    const handleDelete = async (userId: string, userName: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY delete ${userName}? This cannot be undone.`)) {
            return;
        }

        setDeletingId(userId);
        const res = await deleteUser(userId);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('User deleted successfully');
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
        setDeletingId(null);
    };

    const handleOpenResetModal = (userId: string, userName: string) => {
        setResetTargetUser({ id: userId, name: userName });
        setNewPassword('');
        setResetModalOpen(true);
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTargetUser) return;

        setIsResetting(true);
        const res = await resetUserPassword(resetTargetUser.id, newPassword);

        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success(`Password for ${resetTargetUser.name} has been forcefully updated!`);
            setResetModalOpen(false);
        }
        setIsResetting(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Manage Users</h1>
                    <p className="text-slate-500 mt-1">View and manage all registered users.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Total Users: {users.length}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Group</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {user.avatar_url ? (
                                                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0">
                                                    <Image
                                                        src={user.avatar_url}
                                                        alt={user.full_name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200 shrink-0">
                                                    {user.full_name?.[0]?.toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-semibold text-slate-900">{user.full_name}</div>
                                                <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${user.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'auditor' ? 'bg-blue-100 text-blue-700' :
                                                'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            {user.role === 'superadmin' && <Shield className="w-3 h-3" />}
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.training_group ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                                {user.training_group}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {user.id === profile?.id ? (
                                            <span className="text-xs text-slate-400 italic">Current User</span>
                                        ) : user.role === 'superadmin' ? (
                                            <span className="text-xs text-slate-400 italic" title="Cannot modify superadmins">Protected</span>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenResetModal(user.id, user.full_name)}
                                                    className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                                    title="Force Reset Password"
                                                >
                                                    <Key className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id, user.full_name)}
                                                    disabled={deletingId === user.id}
                                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
                                                    title="Delete User"
                                                >
                                                    {deletingId === user.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-slate-50/50">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border-2 border-slate-200 animate-pulse">
                            <AlertCircle className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="font-semibold text-slate-700">Tidak ada pengguna ditemukan</p>
                        <p className="text-sm mt-1">Sistem saat ini tidak memiliki pengguna yang terdaftar.</p>
                    </div>
                )}
            </div>

            {/* Password Reset Modal */}
            {resetModalOpen && resetTargetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setResetModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 text-amber-600 mb-6">
                            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                                <Key className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 leading-tight">Force Reset Password</h3>
                                <p className="text-sm font-medium text-slate-500">for {resetTargetUser.name}</p>
                            </div>
                        </div>

                        <form onSubmit={handleResetSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                                <input
                                    type="text"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password (min. 6 chars)"
                                    className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:bg-white"
                                    required
                                    minLength={6}
                                />
                                <p className="text-xs text-amber-600/80 mt-2">
                                    <strong>Warning:</strong> The user will immediately be able to log in with this new credential. Make sure to communicate this password to them securely.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isResetting || newPassword.length < 6}
                                className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                            >
                                {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save New Password'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
