/**
 * Facility Deployment Mode Presets
 *
 * Each preset defines the enabled modules and recommended configuration
 * for a specific type of healthcare facility deployment.
 */

export const FACILITY_MODES = {
  SINGLE_USER: 'single_user',
  CLINIC_OPD: 'clinic_opd',
  CLINIC_FULL: 'clinic_full',
  MULTISITE_OPD: 'multisite_opd',
  HOSPITAL: 'hospital',
} as const;

export type FacilityMode = typeof FACILITY_MODES[keyof typeof FACILITY_MODES];

export interface FacilityPreset {
  mode: FacilityMode;
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
  {
    mode: FACILITY_MODES.SINGLE_USER,
    name: 'Single-User Clinic',
    description: 'Everything done by one person on one computer. Includes all core modules with simplified workflows.',
    icon: 'monitor',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: true,
    enabledModules: [
      'patients', 'encounters', 'vitals', 'lab', 'pharmacy',
      'radiology', 'billing', 'inventory', 'insurance', 'reports',
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
    name: 'Clinic – Outpatient Only',
    description: 'A clinic with only outpatient services. No ward admissions or inpatient care.',
    icon: 'stethoscope',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: [
      'patients', 'encounters', 'vitals', 'lab', 'pharmacy',
      'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments',
    ],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier'],
    notes: [
      'OPD consultations, triage, vitals recording',
      'Lab and pharmacy services included',
      'No IPD, theatre, or maternity modules',
    ],
  },
  {
    mode: FACILITY_MODES.CLINIC_FULL,
    name: 'Clinic – Inpatient & Outpatient',
    description: 'A clinic that handles both outpatient visits and inpatient admissions.',
    icon: 'bed',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: [
      'patients', 'encounters', 'vitals', 'lab', 'pharmacy',
      'radiology', 'billing', 'inventory', 'insurance', 'reports',
      'appointments', 'ipd',
    ],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier', 'Store Keeper'],
    notes: [
      'Supports ward admissions and discharges',
      'OPD and IPD billing integration',
      'Theatre and maternity can be enabled later if needed',
    ],
  },
  {
    mode: FACILITY_MODES.MULTISITE_OPD,
    name: 'Multi-Site OPD Network',
    description: 'Multiple outpatient-only locations under one organization. Each site operates independently with centralised reporting.',
    icon: 'map-pin',
    facilityType: 'clinic',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'patients', 'encounters', 'vitals', 'lab', 'pharmacy',
      'billing', 'inventory', 'insurance', 'reports', 'appointments',
    ],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier'],
    notes: [
      'Add branch facilities after setup via Facilities > Add Branch',
      'Each branch has its own staff and patient queues',
      'Central dashboard shows aggregated statistics across all branches',
      'Patient records can be shared across sites',
    ],
  },
  {
    mode: FACILITY_MODES.HOSPITAL,
    name: 'Full Hospital',
    description: 'Complete hospital management with all modules: OPD, IPD, Emergency, Theatre, Maternity, HR, and Finance.',
    icon: 'building',
    facilityType: 'hospital',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: [
      'patients', 'encounters', 'vitals', 'lab', 'pharmacy',
      'radiology', 'billing', 'inventory', 'insurance', 'reports',
      'appointments', 'ipd', 'emergency', 'theatre', 'maternity', 'hr', 'finance',
    ],
    recommendedRoles: [
      'Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician',
      'Cashier', 'Store Keeper', 'HR Manager', 'Accountant', 'Radiologist',
    ],
    notes: [
      'All modules enabled including HR and Finance',
      'Supports multiple wards, theatres, and departments',
      'Full reporting and analytics suite',
    ],
  },
];

/**
 * Get a preset by mode code
 */
export function getPreset(mode: FacilityMode): FacilityPreset | undefined {
  return FACILITY_PRESETS.find(p => p.mode === mode);
}
