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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin bypasses all permission checks
  if (user?.roles?.includes('Super Admin')) {
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
