import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types';
import { clearAllData } from '../lib/sync';

interface AuthActions {
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasModuleAccess: (moduleCode: string) => boolean;
  setAccessibleModules: (modules: string[]) => void;
  updateFromMe: (data: { permissions?: string[]; roles?: string[]; accessibleModules?: string[]; facilityMode?: string; businessType?: string }) => void;
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

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Clear browser storage to prevent patient data leaking between users
        sessionStorage.clear();

        // Clear offline database (fire and forget — don't block logout)
        clearAllData().catch(() => {});
      },

      setLoading: (isLoading) => set({ isLoading }),

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        // System admin in tenant context: only bypass for FULL_SUPPORT tier (3)
        if (user.isSystemAdmin) {
          if (user.supportAccessTier !== undefined && user.supportAccessTier < 3) return false;
          return true;
        }
        if (!user.permissions) return false;
        const matchRole = (r: string) => user.roles?.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
        if (matchRole('Super Admin')) return true;
        return user.permissions.includes(permission);
      },

      hasAnyPermission: (permissions: string[]) => {
        const { user } = get();
        if (!user) return false;
        // System admin in tenant context: only bypass for FULL_SUPPORT tier (3)
        if (user.isSystemAdmin) {
          if (user.supportAccessTier !== undefined && user.supportAccessTier < 3) return false;
          return true;
        }
        if (!user.permissions) return false;
        const matchRole = (r: string) => user.roles?.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
        if (matchRole('Super Admin')) return true;
        return permissions.some((p) => user.permissions?.includes(p));
      },

      hasRole: (role: string) => {
        const { user } = get();
        if (!user?.roles) return false;
        return user.roles.some((r: any) => r === role || r?.role === role || r?.name === role);
      },

      hasAnyRole: (roles: string[]) => {
        const { user } = get();
        if (!user?.roles) return false;
        const matchRole = (r: string) => user.roles!.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
        if (matchRole('Super Admin')) return true;
        return roles.some((r) => matchRole(r));
      },

      hasModuleAccess: (moduleCode: string) => {
        const { user } = get();
        if (!user) return false;
        const matchRole = (r: string) => user.roles?.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
        if (matchRole('Super Admin')) return true;
        return user.accessibleModules?.includes(moduleCode) ?? false;
      },

      setAccessibleModules: (modules: string[]) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, accessibleModules: modules } });
        }
      },

      updateFromMe: (data) => {
        const { user } = get();
        if (user) {
          set({
            user: {
              ...user,
              ...(data.permissions && { permissions: data.permissions }),
              ...(data.roles && { roles: data.roles }),
              ...(data.accessibleModules && { accessibleModules: data.accessibleModules }),
              ...(data.facilityMode && { facilityMode: data.facilityMode }),
              ...(data.businessType && { businessType: data.businessType }),
            },
          });
        }
      },
    }),
    {
      name: 'glide-hims-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
