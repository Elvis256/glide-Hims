import { useAuthStore } from '../store/auth';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/auth';
import { Loader2, RefreshCcw } from 'lucide-react';

interface ModuleRouteProps {
  children: ReactNode;
  module: string;
}

/**
 * Route guard that checks if the current tenant has a specific module enabled.
 * Works alongside ProtectedRoute (permissions) — this enforces module-level access.
 */
export default function ModuleRoute({ children, module }: ModuleRouteProps) {
  const { hasModuleAccess, user, updateFromMe } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return null;

  // 'admin' and 'registration' are always accessible
  if (module === 'admin' || module === 'registration') {
    return <>{children}</>;
  }

  if (hasModuleAccess(module)) {
    return <>{children}</>;
  }

  const refresh = async () => {
    try {
      setRefreshing(true);
      const me = await authService.getMe();
      updateFromMe(me);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {module.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())} not available to you
        </h2>
        <p className="text-gray-600 mb-2">
          Either this module isn't enabled for your organization's plan, or your role doesn't have
          permission to access it.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          If your administrator just enabled it, click <strong>Refresh access</strong> below — no
          need to sign out.
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          Refresh access
        </button>
      </div>
    </div>
  );
}
