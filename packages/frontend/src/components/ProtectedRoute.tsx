import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import type { ReactNode } from 'react';
import AccessDenied from './AccessDenied';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requireAll?: boolean; // If true, require all permissions/roles; if false, require any
}

export default function ProtectedRoute({ 
  children, 
  requiredPermissions = [], 
  requiredRoles = [],
  requireAll = false 
}: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, hasAnyPermission, hasRole, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    const tenantSlug = localStorage.getItem('glide_tenant_slug');
    const deploymentMode = localStorage.getItem('glide_deployment_mode');
    let loginPath: string;
    if (tenantSlug) {
      // Returning tenant user → straight back to their tenant's login page.
      loginPath = `/login/${tenantSlug}`;
    } else if (deploymentMode === 'multi-tenant' || deploymentMode === 'saas') {
      // Multi-tenant SaaS hub: anonymous traffic at "/" belongs at the system admin
      // login, not the generic tenant login form.
      loginPath = '/system/login';
    } else {
      loginPath = '/login';
    }
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Super Admin bypasses all permission checks (Administrator still requires explicit permissions)
  const matchRole = (r: string) => user?.roles?.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
  // System admin: only bypass if NOT in a limited-tier tenant context
  const isFullAccess = user?.isSystemAdmin
    ? (user.supportAccessTier === undefined || user.supportAccessTier >= 3)
    : false;
  if (matchRole('Super Admin') || isFullAccess) {
    return <>{children}</>;
  }

  // Check required roles
  if (requiredRoles.length > 0) {
    const hasRequiredRoles = requireAll 
      ? requiredRoles.every(role => hasRole(role))
      : requiredRoles.some(role => hasRole(role));
    
    if (!hasRequiredRoles) {
      return (
        <AccessDenied 
          message="You don't have the required role to access this page." 
          fullScreen 
        />
      );
    }
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? requiredPermissions.every(p => hasPermission(p))
      : hasAnyPermission(requiredPermissions);
    
    if (!hasRequiredPermissions) {
      return <AccessDenied fullScreen />;
    }
  }

  return <>{children}</>;
}
