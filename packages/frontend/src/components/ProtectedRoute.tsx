import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import type { ReactNode } from 'react';

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
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">You don't have the required role to access this page.</p>
            <button 
              onClick={() => window.history.back()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // Check required permissions
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAll 
      ? requiredPermissions.every(p => hasPermission(p))
      : hasAnyPermission(requiredPermissions);
    
    if (!hasRequiredPermissions) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
            <button 
              onClick={() => window.history.back()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
