import ProtectedRoute from './ProtectedRoute';
import type { ReactNode } from 'react';

/**
 * Role constants matching backend roles.constants.ts
 */
export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  HR_MANAGER: 'HR Manager',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'Lab Technician',
  RECEPTIONIST: 'Receptionist',
  CASHIER: 'Cashier',
  STORE_KEEPER: 'Store Keeper',
  RADIOLOGIST: 'Radiologist',
  ACCOUNTANT: 'Accountant',
} as const;

interface RoleRouteProps {
  children: ReactNode;
  roles: string[];
}

/**
 * Wrapper for routes that require specific roles.
 * Super Admin always has access (handled by ProtectedRoute).
 */
export function RoleRoute({ children, roles }: RoleRouteProps) {
  return (
    <ProtectedRoute requiredRoles={roles}>
      {children}
    </ProtectedRoute>
  );
}

// Convenience components for common role combinations
export function DoctorRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.DOCTOR]}>{children}</RoleRoute>;
}

export function NurseRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.NURSE]}>{children}</RoleRoute>;
}

export function ClinicalRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.DOCTOR, ROLES.NURSE]}>{children}</RoleRoute>;
}

export function PharmacistRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.PHARMACIST]}>{children}</RoleRoute>;
}

export function LabTechRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.LAB_TECHNICIAN]}>{children}</RoleRoute>;
}

export function ReceptionistRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.RECEPTIONIST]}>{children}</RoleRoute>;
}

export function CashierRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.CASHIER]}>{children}</RoleRoute>;
}

export function StoreKeeperRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.STORE_KEEPER]}>{children}</RoleRoute>;
}

export function AccountantRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.ACCOUNTANT]}>{children}</RoleRoute>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.ADMIN]}>{children}</RoleRoute>;
}

export function FinanceRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.ACCOUNTANT, ROLES.ADMIN]}>{children}</RoleRoute>;
}

export function HRRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.SUPER_ADMIN]}>{children}</RoleRoute>;
}

export function BillingRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.CASHIER, ROLES.RECEPTIONIST, ROLES.ACCOUNTANT]}>{children}</RoleRoute>;
}

export function RadiologyRoute({ children }: { children: ReactNode }) {
  return <RoleRoute roles={[ROLES.RADIOLOGIST, ROLES.DOCTOR]}>{children}</RoleRoute>;
}

export default RoleRoute;
