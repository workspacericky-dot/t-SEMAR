'use client';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Camera, User } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

interface AvatarUploadProps {
    uid: string;
    url: string | null;
    onUpload: (url: string) => void;
    size?: number;
}

export function AvatarUpload({ uid, url, onUpload, size = 150 }: AvatarUploadProps) {
    const supabase = createClient();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${uid}-${Math.random()}.${fileExt}`;

            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                throw new Error('File size must be less than 2MB');
            }

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            onUpload(data.publicUrl);
            toast.success('Avatar uploaded successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Error uploading avatar');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className="relative group cursor-pointer transition-all duration-300 hover:scale-105"
                style={{ width: size, height: size }}
                onClick={() => !uploading && fileInputRef.current?.click()}
            >
                <div className={`w-full h-full rounded-full overflow-hidden border-4 border-white shadow-xl ring-1 ring-slate-200 relative bg-slate-100 flex items-center justify-center`}>
                    {url ? (
                        <Image
                            src={url}
                            alt="Avatar"
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <User className="w-1/3 h-1/3 text-slate-400" />
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <Camera className="w-8 h-8 text-white drop-shadow-md" />
                    </div>

                    {/* Loader */}
                    {uploading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 transition-all duration-300">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white shadow-lg border-2 border-white scale-90 group-hover:scale-110 transition-transform duration-300">
                    <Camera className="w-4 h-4" />
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                id="single"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={uploading}
                className="hidden"
            />
        </div>
    );
}
