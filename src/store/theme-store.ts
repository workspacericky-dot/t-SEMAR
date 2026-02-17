import { create } from 'zustand';

interface ThemeState {
    isDark: boolean;
    toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
    isDark: false,
    toggle: () => set((state) => {
        const newIsDark = !state.isDark;
        if (typeof window !== 'undefined') {
            if (newIsDark) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        }
        return { isDark: newIsDark };
    }),
}));
