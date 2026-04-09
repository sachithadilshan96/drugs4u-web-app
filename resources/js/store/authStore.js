import { create } from 'zustand';
import * as authApi from '../api/auth';

export const useAuthStore = create((set) => ({
    user: null,
    isAuthenticated: false,
    initializing: true,

    setUser: (user) =>
        set({
            user,
            isAuthenticated: !!user,
            initializing: false,
        }),

    bootstrap: async () => {
        set({ initializing: true });
        try {
            const { data } = await authApi.fetchUser();
            set({ user: data, isAuthenticated: true, initializing: false });
        } catch {
            set({ user: null, isAuthenticated: false, initializing: false });
        }
    },

    login: async (credentials) => {
        try {
            await authApi.fetchCsrfCookie();
        } catch {
            // Sanctum may not be installed yet; login route may still issue session + XSRF cookie.
        }
        await authApi.login(credentials);
        const { data } = await authApi.fetchUser();
        set({ user: data, isAuthenticated: true, initializing: false });
    },

    logout: async () => {
        try {
            await authApi.logout();
        } finally {
            set({ user: null, isAuthenticated: false, initializing: false });
        }
    },
}));
