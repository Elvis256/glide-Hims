import type { ReactNode } from 'react';
import { useAuthStore } from '../store/auth';

interface PermissionGateProps {
  children: ReactNode;
  permissions?: string[];
  roles?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * PermissionGate - Conditionally renders children based on user permissions/roles
 * 
 * Usage:
 * <PermissionGate permissions={['users.read']}>
 *   <UserList />
 * </PermissionGate>
 * 
 * <PermissionGate roles={['Admin', 'Super Admin']}>
 *   <AdminPanel />
 * </PermissionGate>
 */
export default function PermissionGate({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasRole, user } = useAuthStore();

  // Super Admin bypasses all permission checks
  if (user?.roles?.includes('Super Admin')) {
    return <>{children}</>;
  }

  // Check roles
  if (roles.length > 0) {
    const hasRequiredRoles = requireAll
      ? roles.every((role) => hasRole(role))
      : roles.some((role) => hasRole(role));

    if (!hasRequiredRoles) {
      return <>{fallback}</>;
    }
  }

  // Check permissions
  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? permissions.every((p) => hasPermission(p))
      : hasAnyPermission(permissions);

    if (!hasRequiredPermissions) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Hook to check permissions in functional components
 */
export function usePermissions() {
  const { hasPermission, hasAnyPermission, hasRole, user } = useAuthStore();

  const isSuperAdmin = user?.roles?.includes('Super Admin');

  return {
    hasPermission: (permission: string) => isSuperAdmin || hasPermission(permission),
    hasAnyPermission: (permissions: string[]) => isSuperAdmin || hasAnyPermission(permissions),
    hasRole,
    isSuperAdmin,
    permissions: user?.permissions || [],
    roles: user?.roles || [],
  };
}
