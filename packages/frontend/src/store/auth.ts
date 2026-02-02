import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types';

interface AuthActions {
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user?.permissions) return false;
        // Super Admin has all permissions
        if (user.roles?.includes('Super Admin')) return true;
        return user.permissions.includes(permission);
      },

      hasAnyPermission: (permissions: string[]) => {
        const { user } = get();
        if (!user?.permissions) return false;
        // Super Admin has all permissions
        if (user.roles?.includes('Super Admin')) return true;
        return permissions.some((p) => user.permissions?.includes(p));
      },

      hasRole: (role: string) => {
        const { user } = get();
        if (!user?.roles) return false;
        return user.roles.includes(role);
      },

      hasAnyRole: (roles: string[]) => {
        const { user } = get();
        if (!user?.roles) return false;
        // Super Admin has access to everything
        if (user.roles.includes('Super Admin')) return true;
        return roles.some((r) => user.roles?.includes(r));
      },
    }),
    {
      name: 'glide-hims-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
