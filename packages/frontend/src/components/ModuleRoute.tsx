import { useAuthStore } from '../store/auth';
import type { ReactNode } from 'react';

interface ModuleRouteProps {
  children: ReactNode;
  module: string;
}

/**
 * Route guard that checks if the current tenant has a specific module enabled.
 * Works alongside ProtectedRoute (permissions) — this enforces module-level access.
 */
export default function ModuleRoute({ children, module }: ModuleRouteProps) {
  const { hasModuleAccess, user } = useAuthStore();

  if (!user) return null;

  // 'admin' and 'registration' are always accessible
  if (module === 'admin' || module === 'registration') {
    return <>{children}</>;
  }

  if (hasModuleAccess(module)) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Module Not Available
        </h2>
        <p className="text-gray-600 mb-4">
          The <span className="font-medium capitalize">{module.replace(/-/g, ' ')}</span> module 
          is not enabled for your organization's current plan.
        </p>
        <p className="text-sm text-gray-500">
          Contact your system administrator to enable this module.
        </p>
      </div>
    </div>
  );
}
