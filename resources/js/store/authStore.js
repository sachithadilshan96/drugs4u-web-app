import { create } from 'zustand';
import * as authApi from '../api/auth';

export const useAuthStore = create((set, get) => ({
    user: null,
    isAuthenticated: false,
    /** False until the first `loadUser()` run finishes (session restore). */
    authReady: false,

    setUser: (user) =>
        set({
            user,
            isAuthenticated: !!user,
        }),

    clearUser: () =>
        set({
            user: null,
            isAuthenticated: false,
        }),

    /**
     * Restore session from GET /api/me (Sanctum cookie session).
     */
    loadUser: async () => {
        try {
            const { status, data } = await authApi.fetchUser();
            if (status === 200 && data && typeof data === 'object') {
                set({ user: data, isAuthenticated: true, authReady: true });
                return;
            }
        } catch {
            // Network / server error
        }
        set({ user: null, isAuthenticated: false, authReady: true });
    },

    logout: async () => {
        try {
            await authApi.logout();
        } finally {
            get().clearUser();
        }
    },
}));
