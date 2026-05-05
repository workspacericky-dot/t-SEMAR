import { createBrowserClient } from '@supabase/ssr';

// Singleton: satu instance untuk seluruh sesi browser.
// Mencegah race condition pada navigator.locks ketika banyak komponen
// memanggil createClient() secara bersamaan.
let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
    if (clientInstance) return clientInstance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Build-time prerendering: env vars belum tersedia, jangan simpan ke singleton.
        return createBrowserClient(
            'https://placeholder.supabase.co',
            'placeholder-anon-key'
        );
    }

    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return clientInstance;
}
