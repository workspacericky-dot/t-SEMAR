'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

interface CreateUserData {
    email: string;
    password: string;
    fullName: string;
    role: 'superadmin' | 'auditor' | 'auditee';
}

export async function createUser(data: CreateUserData) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return {
                error: 'Server configuration error: Missing Service Role Key.',
            };
        }

        const { email, password, fullName, role } = data;

        // 1. Create Auth User
        const { data: user, error: createError } = await getSupabaseAdmin().auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm
            user_metadata: {
                full_name: fullName,
                role: role,
            },
        });

        if (createError) throw createError;
        if (!user.user) throw new Error('Failed to create user object');

        // 2. Create/Update Profile
        // The trigger 'on_auth_user_created' might have run already, but we need to set role & training_group explicitly
        // to be sure, and to set training_group which isn't in metadata usually.

        // Wait a bit? No, let's just Upsert.
        // We use the admin client to bypass RLS if needed, or just standard client?
        // Admin client is safer for setting roles.

        const { error: profileError } = await getSupabaseAdmin()
            .from('profiles')
            .upsert({
                id: user.user.id,
                full_name: fullName,
                role: role,
                training_group: null, // No initial group
                updated_at: new Date().toISOString(),
                // satker_name is default empty or we can add it later
            });

        if (profileError) {
            // If profile creation fails, we might want to delete the auth user to keep consistency?
            // Or just return error.
            console.error('Profile creation error:', profileError);
            return { error: 'User created but profile setup failed: ' + profileError.message };
        }

        revalidatePath('/dashboard');
        return { success: true, userId: user.user.id };

    } catch (error: any) {
        console.error('Create User Error:', error);
        return { error: error.message };
    }
}

export async function getUsers() {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { error: 'Server configuration error' };
        }

        // Fetch profiles (which mirror auth users)
        const { data: profiles, error } = await getSupabaseAdmin()
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // We might want to fetch email from Auth? 
        // Profiles don't always have emails if they sign up via OAuth and we didn't sync it.
        // But for our app we sync it.
        // Wait, 'profiles' table doesn't have email column in my schema memory?
        // Checking schema... I should probably fetch auth.users too if needed, but admin.listUsers() is better.

        const { data: { users }, error: authError } = await getSupabaseAdmin().auth.admin.listUsers();
        if (authError) throw authError;

        // Merge data
        const combined = profiles.map(p => {
            const u = users.find(user => user.id === p.id);
            return {
                ...p,
                email: u?.email
            };
        });

        return { users: combined };

    } catch (error: any) {
        console.error('Get Users Error:', error);
        return { error: error.message };
    }
}

export async function deleteUser(userId: string) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { error: 'Server configuration error' };
        }

        // 1. Delete Avatar (if any)
        // We need to know the path. usually `avatars/{userId}/...`
        // But files might be named differently.
        // Easiest is to try to list files in folder {userId} if we used folders, but we used filenames like `{uuid}-{random}.jpg`
        // We can just rely on Supabase cascading delete if we set it up, but Auth doesn't cascade to Storage usually.
        // Let's just delete the Auth User.
        // If we set up ON DELETE CASCADE in Postgres for 'profiles', that handles the DB.

        // 2. Delete Auth User (this is the big one)
        const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
        if (error) throw error;

        // 3. Delete Profile (if not cascaded)
        // const { error: dbError } = await getSupabaseAdmin().from('profiles').delete().eq('id', userId);
        // if (dbError) console.error('Error deleting profile (might be cascaded):', dbError);

        revalidatePath('/dashboard');
        revalidatePath('/admin/users');
        return { success: true };

    } catch (error: any) {
        console.error('Delete User Error:', error);
        return { error: error.message };
    }
}
