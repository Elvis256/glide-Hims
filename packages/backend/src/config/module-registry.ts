/**
 * Module Registry — single source of truth for navigation module access.
 * Each module defines which permissions grant access to it.
 * The /auth/me endpoint uses this to compute accessible modules per user.
 */

export interface ModuleDefinition {
  code: string;
  name: string;
  /** At least one of these permissions is needed to access this module */
  requiredPermissions: string[];
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    code: 'registration',
    name: 'Registration',
    requiredPermissions: ['patients.read', 'patients.create', 'queue.read', 'queue.create', 'appointments.read'],
  },
  {
    code: 'nursing',
    name: 'Nursing',
    requiredPermissions: ['vitals.read', 'vitals.create', 'nursing.read', 'triage.read', 'encounters.create'],
  },
  {
    code: 'doctors',
    name: 'Doctors',
    requiredPermissions: ['encounters.read', 'encounters.create', 'diagnoses.create', 'prescriptions.create', 'orders.create'],
  },
  {
    code: 'chronic-care',
    name: 'Chronic Care',
    requiredPermissions: ['chronic.read', 'chronic.create', 'encounters.read'],
  },
  {
    code: 'emergency',
    name: 'Emergency',
    requiredPermissions: ['emergency.read', 'emergency.create'],
  },
  {
    code: 'diagnostics',
    name: 'Diagnostics',
    requiredPermissions: ['lab.read', 'lab.create', 'radiology.read', 'radiology.create'],
  },
  {
    code: 'pharmacy',
    name: 'Pharmacy',
    requiredPermissions: ['pharmacy.read', 'pharmacy.create', 'prescriptions.read', 'prescriptions.update'],
  },
  {
    code: 'ipd',
    name: 'IPD',
    requiredPermissions: ['ipd.read', 'ipd.create', 'ipd.update'],
  },
  {
    code: 'billing',
    name: 'Billing',
    requiredPermissions: ['billing.read', 'billing.create', 'insurance.read'],
  },
  {
    code: 'stores',
    name: 'Stores',
    requiredPermissions: ['inventory.read', 'inventory.create', 'stores.read'],
  },
  {
    code: 'reports',
    name: 'Reports',
    requiredPermissions: ['reports.read', 'analytics.read'],
  },
  {
    code: 'hr',
    name: 'HR',
    requiredPermissions: ['hr.read', 'employees.read', 'leave.read', 'payroll.read', 'attendance.read'],
  },
  {
    code: 'assets',
    name: 'Assets',
    requiredPermissions: ['assets.read', 'assets.create'],
  },
  {
    code: 'integrations',
    name: 'Integrations',
    requiredPermissions: ['settings.read', 'settings.update'],
  },
  {
    code: 'admin',
    name: 'Admin',
    requiredPermissions: ['roles.read', 'users.read', 'settings.read', 'facilities.update', 'admin.read'],
  },
];

/**
 * Given a set of user permission codes, return the module codes they can access.
 * A user can access a module if they have ANY of its requiredPermissions.
 */
export function getAccessibleModules(userPermissions: string[], isSuperAdmin: boolean): string[] {
  if (isSuperAdmin) {
    return MODULE_REGISTRY.map(m => m.code);
  }
  return MODULE_REGISTRY
    .filter(mod => mod.requiredPermissions.some(p => userPermissions.includes(p)))
    .map(mod => mod.code);
}
