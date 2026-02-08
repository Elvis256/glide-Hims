import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import DashboardPage from './DashboardPage';

/**
 * Smart dashboard that routes users to role-appropriate dashboards.
 * - HR Manager → HR Dashboard
 * - Doctor → Doctor Dashboard  
 * - Others → Hospital Dashboard
 */
export default function SmartDashboardPage() {
  const { user } = useAuthStore();
  const roles = user?.roles || [];

  // HR Manager should go to HR dashboard
  if (roles.includes('HR Manager') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/hr" replace />;
  }

  // Doctors should go to Doctor dashboard
  if (roles.includes('Doctor') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/doctor/dashboard" replace />;
  }

  // Lab Technicians should go to Lab dashboard
  if (roles.includes('Lab Technician') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/lab/queue" replace />;
  }

  // Pharmacists should go to Pharmacy dashboard
  if (roles.includes('Pharmacist') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/pharmacy/queue" replace />;
  }

  // Radiologists should go to Radiology dashboard
  if (roles.includes('Radiologist') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/radiology/queue" replace />;
  }

  // Receptionists should go to Patient Search
  if (roles.includes('Receptionist') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/patients/search" replace />;
  }

  // Cashiers should go to Billing
  if (roles.includes('Cashier') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/billing/invoices" replace />;
  }

  // Nurses should go to Nursing dashboard
  if (roles.includes('Nurse') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/nursing/vitals/record" replace />;
  }

  // Store Keepers should go to Stores
  if (roles.includes('Store Keeper') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/stores/inventory" replace />;
  }

  // Default: Hospital Dashboard (for Super Admin, Administrator, or users with multiple roles)
  return <DashboardPage />;
}
