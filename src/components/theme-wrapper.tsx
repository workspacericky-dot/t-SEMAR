'use client';

import { useThemeStore } from '@/store/theme-store';

/**
 * A simple client-side wrapper that passes isDark boolean via CSS classes
 * to enable dark mode in server-rendered content.
 * 
 * Usage: Wrap server component content that needs dark mode awareness.
 * Uses data attribute [data-theme="dark"] so child elements can use:
 * - `group-[]/dark:` prefix or 
 * - Simply read classes from parent.
 */
export function ThemeWrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const isDark = useThemeStore((s) => s.isDark);

    return (
        <div className={`${className} ${isDark ? 'theme-dark' : 'theme-light'}`} data-theme={isDark ? 'dark' : 'light'}>
            {children}
        </div>
    );
}

export function useIsDark() {
    return useThemeStore((s) => s.isDark);
}
