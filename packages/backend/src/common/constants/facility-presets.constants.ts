/**
 * Facility Deployment Mode Presets
 *
 * Each preset defines the enabled modules and recommended configuration
 * for a specific type of healthcare facility deployment.
 */

export const BUSINESS_TYPES = {
  HOSPITAL: 'hospital',
  PHARMACY: 'pharmacy',
} as const;

export type BusinessType = (typeof BUSINESS_TYPES)[keyof typeof BUSINESS_TYPES];

export const FACILITY_MODES = {
  SINGLE_USER: 'single_user',
  CLINIC_OPD: 'clinic_opd',
  CLINIC_FULL: 'clinic_full',
  MULTISITE_OPD: 'multisite_opd',
  HOSPITAL: 'hospital',
  PHARMACY_RETAIL: 'pharmacy_retail',
  PHARMACY_CHAIN: 'pharmacy_chain',
  PHARMACY_WHOLESALE: 'pharmacy_wholesale',
} as const;

export type FacilityMode = (typeof FACILITY_MODES)[keyof typeof FACILITY_MODES];

export interface FacilityPreset {
  mode: FacilityMode;
  businessType: BusinessType;
  name: string;
  description: string;
  icon: string;
  enabledModules: string[];
  facilityType: string;
  supportsMultiSite: boolean;
  singleUserMode: boolean;
  recommendedRoles: string[];
  notes: string[];
}

export const FACILITY_PRESETS: FacilityPreset[] = [
  // ─── Hospital & Clinic ────────────────────────────────────────────
  {
    mode: FACILITY_MODES.SINGLE_USER,
    businessType: BUSINESS_TYPES.HOSPITAL,
    name: 'Single-User Clinic',
    description:
      'Everything done by one person on one computer. Includes all core modules with simplified workflows.',
    icon: 'monitor',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: true,
    enabledModules: [
      'patients',
      'encounters',
      'vitals',
      'lab',
      'pharmacy',
      'radiology',
      'billing',
      'inventory',
      'insurance',
      'reports',
      'chronic',
    ],
    recommendedRoles: ['Clinic Staff'],
    notes: [
      'One staff member handles registration, consultation, billing, and dispensing',
      'Streamlined single-page workflow for fast patient throughput',
      'No shift management or attendance tracking',
    ],
  },
  {
    mode: FACILITY_MODES.CLINIC_OPD,
    businessType: BUSINESS_TYPES.HOSPITAL,
    name: 'Clinic – Outpatient Only',
    description: 'A clinic with only outpatient services. No ward admissions or inpatient care.',
    icon: 'stethoscope',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'encounters',
      'vitals',
      'lab',
      'pharmacy',
      'radiology',
      'billing',
      'inventory',
      'insurance',
      'reports',
      'appointments',
    ],
    recommendedRoles: [
      'Doctor',
      'Nurse',
      'Receptionist',
      'Pharmacist',
      'Lab Technician',
      'Cashier',
    ],
    notes: [
      'OPD consultations, triage, vitals recording',
      'Lab and pharmacy services included',
      'No IPD, theatre, or maternity modules',
    ],
  },
  {
    mode: FACILITY_MODES.CLINIC_FULL,
    businessType: BUSINESS_TYPES.HOSPITAL,
    name: 'Clinic – Inpatient & Outpatient',
    description: 'A clinic that handles both outpatient visits and inpatient admissions.',
    icon: 'bed',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'encounters',
      'vitals',
      'lab',
      'pharmacy',
      'radiology',
      'billing',
      'inventory',
      'insurance',
      'reports',
      'appointments',
      'ipd',
      'chronic',
    ],
    recommendedRoles: [
      'Doctor',
      'Nurse',
      'Receptionist',
      'Pharmacist',
      'Lab Technician',
      'Cashier',
      'Store Keeper',
    ],
    notes: [
      'Supports ward admissions and discharges',
      'OPD and IPD billing integration',
      'Theatre and maternity can be enabled later if needed',
    ],
  },
  {
    mode: FACILITY_MODES.MULTISITE_OPD,
    businessType: BUSINESS_TYPES.HOSPITAL,
    name: 'Multi-Site OPD Network',
    description:
      'Multiple outpatient-only locations under one organization. Each site operates independently with centralised reporting.',
    icon: 'map-pin',
    facilityType: 'clinic',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'encounters',
      'vitals',
      'lab',
      'pharmacy',
      'billing',
      'inventory',
      'insurance',
      'reports',
      'appointments',
      'chronic',
    ],
    recommendedRoles: [
      'Doctor',
      'Nurse',
      'Receptionist',
      'Pharmacist',
      'Lab Technician',
      'Cashier',
    ],
    notes: [
      'Add branch facilities after setup via Facilities > Add Branch',
      'Each branch has its own staff and patient queues',
      'Central dashboard shows aggregated statistics across all branches',
      'Patient records can be shared across sites',
    ],
  },
  {
    mode: FACILITY_MODES.HOSPITAL,
    businessType: BUSINESS_TYPES.HOSPITAL,
    name: 'Full Hospital',
    description:
      'Complete hospital management with all modules: OPD, IPD, Emergency, Theatre, Maternity, HR, and Finance.',
    icon: 'building',
    facilityType: 'hospital',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'encounters',
      'vitals',
      'lab',
      'pharmacy',
      'radiology',
      'billing',
      'inventory',
      'insurance',
      'reports',
      'appointments',
      'ipd',
      'emergency',
      'theatre',
      'maternity',
      'hr',
      'finance',
      'chronic',
    ],
    recommendedRoles: [
      'Doctor',
      'Nurse',
      'Receptionist',
      'Pharmacist',
      'Lab Technician',
      'Cashier',
      'Store Keeper',
      'HR Manager',
      'Accountant',
      'Radiologist',
    ],
    notes: [
      'All modules enabled including HR and Finance',
      'Supports multiple wards, theatres, and departments',
      'Full reporting and analytics suite',
    ],
  },

  // ─── Pharmacy ─────────────────────────────────────────────────────
  {
    mode: FACILITY_MODES.PHARMACY_RETAIL,
    businessType: BUSINESS_TYPES.PHARMACY,
    name: 'Retail Pharmacy',
    description:
      'Single-location retail pharmacy with POS, dispensing, stock management, and controlled substance tracking.',
    icon: 'pill',
    facilityType: 'pharmacy',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'pharmacy',
      'pos',
      'billing',
      'inventory',
      'controlled_substances',
      'drug_interactions',
      'insurance',
      'reports',
      'suppliers',
    ],
    recommendedRoles: ['Pharmacist', 'Pharmacy Technician', 'Cashier', 'Store Keeper'],
    notes: [
      'Full POS with barcode scanning and receipt printing',
      'Controlled substance register with DEA compliance',
      'Drug interaction checking on every sale',
      'Supplier management and purchase orders',
    ],
  },
  {
    mode: FACILITY_MODES.PHARMACY_CHAIN,
    businessType: BUSINESS_TYPES.PHARMACY,
    name: 'Pharmacy Chain',
    description:
      'Multi-branch pharmacy network with centralised purchasing, stock transfers, and consolidated reporting.',
    icon: 'store',
    facilityType: 'pharmacy',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'patients',
      'pharmacy',
      'pos',
      'billing',
      'inventory',
      'controlled_substances',
      'drug_interactions',
      'insurance',
      'reports',
      'suppliers',
      'hr',
      'finance',
    ],
    recommendedRoles: [
      'Pharmacist',
      'Pharmacy Technician',
      'Cashier',
      'Store Keeper',
      'Branch Manager',
      'HR Manager',
      'Accountant',
    ],
    notes: [
      'Central purchasing with branch-level stock transfers',
      'Consolidated reporting across all branches',
      'HR and finance modules for company management',
      'Add branches after setup via Facilities > Add Branch',
    ],
  },
  {
    mode: FACILITY_MODES.PHARMACY_WHOLESALE,
    businessType: BUSINESS_TYPES.PHARMACY,
    name: 'Wholesale / Distribution Pharmacy',
    description:
      'Wholesale pharmaceutical distributor with B2B sales, pricing tiers, delivery tracking, and full supply chain.',
    icon: 'warehouse',
    facilityType: 'pharmacy',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'pharmacy',
      'pos',
      'billing',
      'inventory',
      'controlled_substances',
      'drug_interactions',
      'wholesale',
      'reports',
      'suppliers',
      'hr',
      'finance',
    ],
    recommendedRoles: [
      'Pharmacist',
      'Sales Representative',
      'Warehouse Manager',
      'Store Keeper',
      'Driver',
      'HR Manager',
      'Accountant',
    ],
    notes: [
      'B2B order management with customer accounts',
      'Tiered pricing for different customer categories',
      'Delivery tracking and route management',
      'Full supply chain: procurement, warehousing, distribution',
    ],
  },
];

/**
 * Get a preset by mode code
 */
export function getPreset(mode: FacilityMode): FacilityPreset | undefined {
  return FACILITY_PRESETS.find((p) => p.mode === mode);
}

/**
 * Get all presets for a given business type
 */
export function getPresetsByBusinessType(businessType: BusinessType): FacilityPreset[] {
  return FACILITY_PRESETS.filter((p) => p.businessType === businessType);
}
