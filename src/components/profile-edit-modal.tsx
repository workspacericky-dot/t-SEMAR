'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { AvatarUpload } from '@/components/avatar-upload';

interface ProfileEditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
    const { profile, setProfile } = useAuthStore();
    const supabase = createClient();

    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
    const [saving, setSaving] = useState(false);

    if (!isOpen || !profile) return null;

    const handleSave = async () => {
        try {
            setSaving(true);

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', profile.id);

            if (error) throw error;

            // Update local store
            setProfile({
                ...profile,
                full_name: fullName,
                avatar_url: avatarUrl,
            });

            toast.success('Profile updated successfully');
            onClose();
        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Avatar */}
                    <div className="flex justify-center">
                        <AvatarUpload
                            uid={profile.id}
                            url={avatarUrl}
                            onUpload={(url) => setAvatarUrl(url)}
                            size={100}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#252830] border-transparent rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-[#252830] transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Institution
                                </label>
                                <div className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#252830]/50 border-transparent rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                    {profile.satker_name || 'Mahkamah Agung RI'}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Group
                                </label>
                                <div className="w-full px-4 py-2.5 bg-slate-100 dark:bg-[#252830]/50 border-transparent rounded-lg text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                    {profile.training_group ? `Group ${profile.training_group}` : '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-[#252830] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
