import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // During build-time prerendering, env vars may not be available.
        // Return a dummy client that won't crash the build.
        return createBrowserClient(
            'https://placeholder.supabase.co',
            'placeholder-anon-key'
        );
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
