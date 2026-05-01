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
    requiredPermissions: [
      'patients.read',
      'patients.create',
      'queue.read',
      'queue.create',
      'appointments.read',
    ],
  },
  {
    code: 'nursing',
    name: 'Nursing',
    requiredPermissions: [
      'vitals.read',
      'vitals.create',
      'nursing.read',
      'triage.read',
      'encounters.create',
    ],
  },
  {
    code: 'doctors',
    name: 'Doctors',
    requiredPermissions: [
      'encounters.read',
      'encounters.create',
      'diagnoses.create',
      'prescriptions.create',
      'orders.create',
    ],
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
    requiredPermissions: [
      'pharmacy.read',
      'pharmacy.create',
      'prescriptions.read',
      'prescriptions.update',
    ],
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
    requiredPermissions: [
      'hr.read',
      'employees.read',
      'leave.read',
      'payroll.read',
      'attendance.read',
    ],
  },
  {
    code: 'assets',
    name: 'Assets',
    requiredPermissions: ['assets.read', 'assets.create'],
  },
  {
    code: 'pos',
    name: 'Point of Sale',
    requiredPermissions: [
      'pos.shift',
      'pos.read',
      'pharmacy.read',
      'pos.return.create',
      'pos.return.read',
      'pos.sale.void',
      'pos.sale.hold',
      'pos.discount.line',
      'pos.discount.cart_above_threshold',
      'pos.barcode.scan',
      'pos.receipt.reprint',
      'pos.quickkey.manage',
      'pos.customer.read',
      // Phase C: Hospital Bridge
      'pos.patient.link',
      'pos.prescription.dispense',
      'pos.interaction.override',
      // Phase D: Resilience & Payments
      'pos.payment.mobile_money',
      'pos.offline.use',
      'pos.offline.sync.review',
    ],
  },
  {
    code: 'dental_charting',
    name: 'Dental',
    requiredPermissions: ['dental.view', 'dental.create', 'encounters.create'],
  },
  {
    code: 'optical_exams',
    name: 'Optical',
    requiredPermissions: ['optical.view', 'optical.manage', 'encounters.create'],
  },
  {
    code: 'theatre',
    name: 'Theatre',
    requiredPermissions: ['theatre.read', 'theatre.create', 'surgery.read'],
  },
  {
    code: 'maternity',
    name: 'Maternity',
    requiredPermissions: ['maternity.read', 'maternity.create'],
  },
  {
    code: 'finance',
    name: 'Finance',
    requiredPermissions: ['finance.read', 'finance.create', 'journals.read', 'budgets.read'],
  },
  {
    code: 'procurement',
    name: 'Procurement',
    requiredPermissions: [
      'procurement.read',
      'procurement.create',
      'procurement.approve',
      'suppliers.read',
    ],
  },
  {
    code: 'integrations',
    name: 'Integrations',
    requiredPermissions: ['settings.read', 'settings.update'],
  },
  {
    code: 'admin',
    name: 'Admin',
    requiredPermissions: [
      'roles.read',
      'users.read',
      'settings.read',
      'facilities.update',
      'admin.read',
    ],
  },
];

/**
 * Maps facility preset module names (from facility-presets.constants.ts) to
 * sidebar moduleCode values (from DashboardLayout.tsx / MODULE_REGISTRY).
 * Preset names like 'patients', 'encounters', 'lab' get mapped to sidebar codes
 * like 'registration', 'doctors', 'diagnostics'. Codes that map to themselves
 * (e.g. 'pharmacy', 'billing', 'hr') are not listed here.
 */
const PRESET_TO_SIDEBAR_MAP: Record<string, string | string[]> = {
  patients: 'registration',
  encounters: 'doctors',
  vitals: 'nursing',
  lab: 'diagnostics',
  radiology: 'diagnostics',
  inventory: 'stores',
  appointments: 'registration',
  chronic: 'chronic-care',
  // Dental sub-modules map to the dental sidebar section
  dental_procedures: 'dental_charting',
  dental_imaging: 'dental_charting',
  dental_lab: 'dental_charting',
  orthodontics: 'dental_charting',
  periodontics: 'dental_charting',
  // Optical sub-modules map to the optical sidebar section
  optical_rx: 'optical_exams',
  optical_inventory: 'optical_exams',
  contact_lenses: 'optical_exams',
  optical_lab: 'optical_exams',
  visual_field: 'optical_exams',
  // Pharmacy sub-features
  controlled_substances: 'pharmacy',
  drug_interactions: 'pharmacy',
  suppliers: 'stores',
  wholesale: 'pos',
};

/**
 * Normalize preset enabledModules list into sidebar module codes.
 * E.g. ['patients', 'encounters', 'lab', 'pharmacy'] →
 *      ['registration', 'doctors', 'diagnostics', 'pharmacy']
 */
export function presetModulesToSidebarCodes(presetModules: string[]): string[] {
  const codes = new Set<string>();
  for (const mod of presetModules) {
    const mapped = PRESET_TO_SIDEBAR_MAP[mod];
    if (mapped) {
      if (Array.isArray(mapped)) {
        mapped.forEach((m) => codes.add(m));
      } else {
        codes.add(mapped);
      }
    } else {
      // Module code maps to itself (e.g. 'pharmacy', 'billing', 'hr', 'dental_charting')
      codes.add(mod);
    }
  }
  return [...codes];
}

/**
 * Given a set of user permission codes, return the module codes they can access.
 * A user can access a module if they have ANY of its requiredPermissions.
 * If tenantEnabledModules is provided (preset-format names), results are intersected
 * with the tenant's allowed modules so that e.g. a pharmacy tenant's Super Admin
 * doesn't see IPD/Surgery.
 */
export function getAccessibleModules(
  userPermissions: string[],
  isSuperAdmin: boolean,
  tenantEnabledModules?: string[] | null,
): string[] {
  // Modules always visible regardless of facility preset
  const alwaysAllowed = ['admin', 'registration'];

  let modules: string[];
  if (isSuperAdmin) {
    modules = MODULE_REGISTRY.map((m) => m.code);
  } else {
    modules = MODULE_REGISTRY.filter((mod) =>
      mod.requiredPermissions.some((p) => userPermissions.includes(p)),
    ).map((mod) => mod.code);
  }

  // Filter by tenant's enabled modules if available
  if (tenantEnabledModules && tenantEnabledModules.length > 0) {
    const allowedCodes = presetModulesToSidebarCodes(tenantEnabledModules);
    modules = modules.filter((m) => alwaysAllowed.includes(m) || allowedCodes.includes(m));
  }

  return modules;
}
