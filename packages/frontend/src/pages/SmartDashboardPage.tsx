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
    return <Navigate to="/doctor" replace />;
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

  // Receptionists land on their counter: the POS-style OPD token page
  if (roles.includes('Receptionist') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/opd/token" replace />;
  }

  // Cashiers land on their counter: the POS-style payment worklist
  if (roles.includes('Cashier') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/cashier" replace />;
  }

  // Nurses land on the triage queue (queue → tap patient → vitals)
  if (roles.includes('Nurse') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/nursing/triage" replace />;
  }

  // Store Keepers should go to Stores
  if (roles.includes('Store Keeper') && !roles.includes('Super Admin') && !roles.includes('Administrator')) {
    return <Navigate to="/stores/main" replace />;
  }

  // Default: Hospital Dashboard (for Super Admin, Administrator, or users with multiple roles)
  return <DashboardPage />;
}
