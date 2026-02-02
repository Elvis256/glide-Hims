/**
 * Role Constants
 * Use these constants instead of hardcoded strings to prevent typos
 */
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'Lab Technician',
  RECEPTIONIST: 'Receptionist',
  CASHIER: 'Cashier',
  STORE_KEEPER: 'Store Keeper',
  ACCOUNTANT: 'Accountant',
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

/**
 * Check if a role name is Super Admin
 */
export function isSuperAdmin(roles: string[] | undefined): boolean {
  return roles?.includes(SYSTEM_ROLES.SUPER_ADMIN) ?? false;
}

/**
 * Permission module names
 */
export const PERMISSION_MODULES = {
  USERS: 'users',
  ROLES: 'roles',
  PATIENTS: 'patients',
  ENCOUNTERS: 'encounters',
  PRESCRIPTIONS: 'prescriptions',
  PHARMACY: 'pharmacy',
  INVENTORY: 'inventory',
  BILLING: 'billing',
  LAB: 'lab',
  RADIOLOGY: 'radiology',
  IPD: 'ipd',
  SURGERY: 'surgery',
  EMERGENCY: 'emergency',
  MATERNITY: 'maternity',
  HR: 'hr',
  FINANCE: 'finance',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  SYNC: 'sync',
} as const;

/**
 * Permission actions
 */
export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

/**
 * Build a permission code
 * @example buildPermission('patients', 'read') => 'patients.read'
 */
export function buildPermission(
  module: string,
  action: string,
): string {
  return `${module}.${action}`;
}
