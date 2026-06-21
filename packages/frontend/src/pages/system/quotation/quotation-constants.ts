// Shared constants for the unified quotation builder.

export interface ModuleDef { id: string; label: string }
export interface ModuleGroup { group: string; modules: ModuleDef[] }

export const MODULE_CATALOG: ModuleGroup[] = [
  {
    group: 'Core Clinical',
    modules: [
      { id: 'patients', label: 'Registration / Patients' },
      { id: 'appointments', label: 'Appointments' },
      { id: 'encounters', label: 'Encounters / Doctors' },
      { id: 'vitals', label: 'Vitals / Nursing' },
      { id: 'emergency', label: 'Emergency / Triage' },
    ],
  },
  {
    group: 'Diagnostics',
    modules: [
      { id: 'lab', label: 'Laboratory' },
      { id: 'radiology', label: 'Radiology / Imaging' },
    ],
  },
  {
    group: 'Pharmacy & Inventory',
    modules: [
      { id: 'pharmacy', label: 'Pharmacy / Dispensing' },
      { id: 'controlled_substances', label: 'Controlled Substances' },
      { id: 'drug_interactions', label: 'Drug Interactions' },
      { id: 'inventory', label: 'Inventory / Stores' },
      { id: 'suppliers', label: 'Suppliers' },
      { id: 'wholesale', label: 'Wholesale / POS' },
    ],
  },
  {
    group: 'Inpatient',
    modules: [
      { id: 'ipd', label: 'IPD / Wards' },
      { id: 'theatre', label: 'Theatre / Surgery' },
      { id: 'maternity', label: 'Maternity' },
    ],
  },
  {
    group: 'Specialty',
    modules: [
      { id: 'dental_charting', label: 'Dental Charting' },
      { id: 'dental_procedures', label: 'Dental Procedures' },
      { id: 'orthodontics', label: 'Orthodontics' },
      { id: 'periodontics', label: 'Periodontics' },
      { id: 'optical_exams', label: 'Optical Exams' },
      { id: 'optical_rx', label: 'Optical Rx' },
      { id: 'contact_lenses', label: 'Contact Lenses' },
    ],
  },
  {
    group: 'Finance & Admin',
    modules: [
      { id: 'billing', label: 'Billing & Invoicing' },
      { id: 'insurance', label: 'Insurance' },
      { id: 'finance', label: 'Finance / Accounting' },
      { id: 'reports', label: 'Reports & Analytics' },
      { id: 'hr', label: 'Human Resources' },
    ],
  },
  {
    group: 'Uganda Integrations (Add-ons)',
    modules: [
      { id: 'mobile_money', label: 'MTN/Airtel Mobile Money API' },
      { id: 'ura_efris', label: 'URA EFRIS Compliance Connector' },
      { id: 'dhis2_connector', label: 'DHIS2 MoH Reporting Connector' },
      { id: 'nira_validation', label: 'NIRA National ID Validator' },
    ],
  },
  {
    group: 'Recommended Hardware',
    modules: [
      { id: 'secugen_scanner', label: 'SecuGen Hamster Pro 20 Fingerprint Reader' },
      { id: 'thermal_printer', label: '80mm Thermal Receipt Printer' },
      { id: 'barcode_scanner', label: 'USB Handheld Barcode Scanner' },
      { id: 'label_printer', label: 'Barcode Label Printer (Xprinter)' },
    ],
  },
];

export const HARDWARE_IDS = new Set([
  'secugen_scanner', 'thermal_printer', 'barcode_scanner', 'label_printer',
]);

export const ADDON_IDS = new Set([
  'mobile_money', 'ura_efris', 'dhis2_connector', 'nira_validation',
]);

export const DEFAULT_PRICES: Record<string, number> = {
  patients: 500000,
  appointments: 150000,
  encounters: 200000,
  vitals: 150000,
  emergency: 300000,
  lab: 250000,
  radiology: 350000,
  pharmacy: 250000,
  controlled_substances: 120000,
  drug_interactions: 100000,
  inventory: 180000,
  suppliers: 120000,
  wholesale: 220000,
  ipd: 320000,
  theatre: 280000,
  maternity: 260000,
  dental_charting: 180000,
  dental_procedures: 200000,
  orthodontics: 220000,
  periodontics: 200000,
  optical_exams: 150000,
  optical_rx: 130000,
  contact_lenses: 100000,
  billing: 210000,
  insurance: 190000,
  finance: 220000,
  reports: 160000,
  hr: 140000,
  mobile_money: 500000,
  ura_efris: 1000000,
  dhis2_connector: 800000,
  nira_validation: 300000,
  secugen_scanner: 450000,
  thermal_printer: 350000,
  barcode_scanner: 150000,
  label_printer: 450000,
};

export const MODULE_DETAILS: Record<string, { title: string; desc: string; capabilities: string[]; impact: string }> = {
  patients: {
    title: 'Patient Registration & Lifecycle Management',
    desc: 'Provides a unified digital identity for every patient receiving care.',
    capabilities: [
      'Digital patient photography & demographic capture',
      'Unique Medical Record Number (MRN) auto-generation',
      'Next-of-kin, allergy alerts, and primary insurance schemes linking',
    ],
    impact: 'Eliminates duplicate medical records, speeds up patient lookups by 70%, and ensures clinical history remains securely attached to a single identity.',
  },
  appointments: {
    title: 'Outpatient Scheduling & Appointments',
    desc: 'Optimizes doctor scheduling and manages patient flow.',
    capabilities: [
      'Interactive calendar views by clinic, doctor, or specialty department',
      'Double-booking prevention and resource allocation controls',
      'Automated SMS/Email appointment alerts and reminders',
    ],
    impact: 'Reduces patient no-shows by up to 45%, manages patient queues, and improves clinic resource utilization.',
  },
  encounters: {
    title: 'Clinical Encounters & Electronic Medical Records (EMR)',
    desc: 'Secures and digitizes clinician consultations and patient histories.',
    capabilities: [
      'Structured SOAP notes templates for doctors and specialists',
      'Integrated vitals panel, past visit history, and active diagnoses review',
      'Coded clinical input mapping directly to ICD-10 templates',
    ],
    impact: 'Saves clinicians 20-30% documentation time, ensures legible EMR records, and improves diagnosis accuracy using ICD-10 templates.',
  },
  vitals: {
    title: 'Vitals & Nursing Assessment',
    desc: 'Automates patient pre-consultation vitals logging.',
    capabilities: [
      'Rapid logging of BP, pulse, temp, respiratory rate, SpO2, and BMI',
      'Dynamic visual vitals trend charts over past visits',
      'Automatic alerts for abnormal vitals (triage flags)',
    ],
    impact: 'Enables nursing staff to quickly filter high-risk patients and ensures doctors see real-time vital trends immediately upon opening files.',
  },
  emergency: {
    title: 'Emergency & Triage Routing',
    desc: 'Manages critical care queues and acute patient flow.',
    capabilities: [
      'Emergency severity indexing (color-coded triage priority levels)',
      'Immediate bypass routing to doctor EMR for urgent cases',
      'Bed reservation in the emergency ward',
    ],
    impact: 'Accelerates emergency response times, prioritizes high-severity cases, and secures vital signs logs for trauma victims.',
  },
  lab: {
    title: 'Laboratory Information Management (LIS)',
    desc: 'Automates sample lifecycle and digital test reporting.',
    capabilities: [
      'Electronic test ordering with barcoded sample labeling',
      'Results entry template with age/gender-specific normal ranges',
      'Multi-level results approval and automatic panic-value flags',
    ],
    impact: 'Reduces test turnaround times, eliminates transcription errors, and prevents unapproved results from leaking to patients.',
  },
  radiology: {
    title: 'Radiology Information System (RIS)',
    desc: 'Manages medical imaging orders and diagnostic interpretations.',
    capabilities: [
      'Electronic ordering for X-Ray, Ultrasound, CT, and MRI scans',
      'Radiologist reporting dashboard with template macros',
      'DICOM links for PACS storage (imaging server integration)',
    ],
    impact: 'Eliminates paper request slips, attaches imaging scans directly to EMR histories, and tracks radiologist throughput.',
  },
  pharmacy: {
    title: 'Pharmacy Dispensing & e-Prescriptions',
    desc: 'Digitizes prescription fulfillment and pharmacy store levels.',
    capabilities: [
      'Electronic prescriptions routing with real-time formulary availability',
      'Controlled substances/narcotics inventory logging',
      'Printed dosage label instructions sheet',
    ],
    impact: 'Prevents dispensing errors, automatically deducts stock at dispensing points, and seals revenue leakages at the pharmacy window.',
  },
  controlled_substances: {
    title: 'Controlled Substances Log',
    desc: 'Tracks narcotics and regulated medications closely.',
    capabilities: [
      'Strict double-authorization logs for dispensing regulated drugs',
      'Automated Ministry of Health narcotics reporting formats',
      'Real-time physical vault inventory audits',
    ],
    impact: 'Ensures strict legal compliance and alerts management of any unauthorized access to narcotics.',
  },
  drug_interactions: {
    title: 'Drug Interaction & Safety Database',
    desc: 'Provides clinical safety checks during prescription writing.',
    capabilities: [
      'Real-time alerts for drug-drug and drug-allergy interactions',
      'Contraindication warnings based on patient age and pregnancy status',
      'Integrated pediatric dose calculators',
    ],
    impact: 'Significantly reduces prescription-related medical malpractice risks and enhances patient safety.',
  },
  inventory: {
    title: 'Inventory, Stores & Procurement',
    desc: 'Controls central store levels, stock replenishment, and suppliers.',
    capabilities: [
      'First-Expiry-First-Out (FEFO) store replenishment workflows',
      'Inter-store stock transfers with approval/fulfillment steps',
      'Auto-triggered low stock alerts and supplier purchase order generation',
    ],
    impact: 'Reduces stock expiries by up to 80%, prevents critical stockouts, and establishes purchasing audit trails.',
  },
  suppliers: {
    title: 'Supplier Relationship Management',
    desc: 'Manages wholesale suppliers and inventory procurement cycles.',
    capabilities: [
      'Supplier catalogs, price histories, and performance tracking',
      'Digital Request for Quotation (RFQ) generation',
      'Accounts payable balance tracking for stock orders',
    ],
    impact: 'Saves procurement costs by comparing vendor prices and improves supply chain reliability.',
  },
  wholesale: {
    title: 'Wholesale Point of Sale (POS)',
    desc: 'Manages cash-and-carry wholesale transactions.',
    capabilities: [
      'Rapid barcoded checkout and invoice generation',
      'Bulk sales price catalogs and volume discounts support',
      'Cash drawers and end-of-shift cash verification',
    ],
    impact: 'Accelerates bulk retail checkout times and secures retail cash flows.',
  },
  ipd: {
    title: 'Inpatient Ward Admission & Bed Management',
    desc: 'Tracks bed occupancy, nurse charts, and ward activities.',
    capabilities: [
      'Interactive physical bed map (occupied, vacant, cleaning)',
      'Departmental admission, transfer, and discharge templates',
      'Integrated nursing notes, drug charts, and food orders',
    ],
    impact: 'Improves ward occupancy rates, structures nursing handovers, and tracks ward-specific charges.',
  },
  theatre: {
    title: 'Theatre Scheduling & Surgery logs',
    desc: 'Manages major/minor surgeries and operation theatre queues.',
    capabilities: [
      'Theatre calendar booking and surgical team assignments',
      'Anaesthesia records and detailed post-op summaries',
      'Consumables tracking per surgery',
    ],
    impact: 'Optimizes surgical room utilization and captures full surgical cost elements.',
  },
  maternity: {
    title: 'Maternity & Partograph Tracking',
    desc: 'Tracks prenatal, delivery, and postnatal mother/child care.',
    capabilities: [
      'Antenatal profiles and digital partograph charting',
      'Delivery logs, birth notification reports, and immunization logs',
      'High-risk mother indicators',
    ],
    impact: 'Supports clinical guidelines for safe deliveries and ensures accurate birth records.',
  },
  dental_charting: {
    title: 'Dental Patient Charting',
    desc: 'Provides visual odontogram layouts for dentists.',
    capabilities: [
      'Interactive 32-tooth odontogram diagram',
      'Visual logging of decay, fillings, crowns, and extractions',
      'Patient dental history timelines',
    ],
    impact: 'Speeds up dental assessments and visually presents treatment plans to clients.',
  },
  dental_procedures: {
    title: 'Dental Procedures Ledger',
    desc: 'Tracks specific root canals, scaling, and orthodontic procedures.',
    capabilities: [
      'Structured templates for specialist dental treatments',
      'Materials and equipment costing templates',
      'Integrated treatment scheduling',
    ],
    impact: 'Ensures accurate charging of dental operations and records materials utilized.',
  },
  billing: {
    title: 'Billing, Invoicing & Cashier Desk',
    desc: 'Automates patient charges aggregation and payment receipts.',
    capabilities: [
      'Auto-aggregation of EMR consults, tests, ward charges, and drug costs',
      'Flexible payment routes (cash, mobile money, cards, insurance)',
      'Secure cashier shift handovers with cash reconciliation',
    ],
    impact: 'Eliminates revenue leakages, speeds up checkout times, and provides auditable cashier collections.',
  },
  insurance: {
    title: 'Insurance Scheme Controls & Claims (ERP)',
    desc: 'Controls corporate client contracts and streamlines medical claims.',
    capabilities: [
      'Pre-authorization limit tracking at service points',
      'Automated medical claim forms (EDI / XML exports)',
      'Accounts receivable reconciliation for insurance payments',
    ],
    impact: 'Reduces claim rejection rates, simplifies billing administration, and accelerates insurance collections.',
  },
  finance: {
    title: 'Financial Accounting & Petty Cash',
    desc: 'Integrates general ledger accounts with clinical operations.',
    capabilities: [
      'Double-entry General Ledger tracking',
      'Petty cash vouchers, expense logging, and banking reconciliations',
      'Balance Sheet, Trial Balance, and Profit & Loss generation',
    ],
    impact: 'Maintains institutional fiscal audit readiness and eliminates accounting copy-paste errors.',
  },
  reports: {
    title: 'Reports & Analytics Hub',
    desc: 'Delivers executive insights and disease statistics.',
    capabilities: [
      'Visual disease demographic trends mapping (top-10 diseases)',
      'Revenue collections comparison dashboard',
      'Operational efficiency KPIs (average wait time per ward)',
    ],
    impact: 'Allows directors to make data-driven decisions and monitor operational health in real-time.',
  },
  hr: {
    title: 'Human Resources & Payroll',
    desc: 'Manages clinical and administrative staff lifecycle.',
    capabilities: [
      'Staff profiles, credentials, licenses, and contracts database',
      'Duty roster planning and shift attendance logs',
      'Salary generation and statutory deductions (PAYE, NSSF)',
    ],
    impact: 'Tracks clinician credentials for certification compliance and automates monthly salary disbursements.',
  },
  mobile_money: {
    title: 'MTN & Airtel Mobile Money API Connector',
    desc: 'Integrates direct mobile payments with patient cash counters.',
    capabilities: [
      'Patient payment triggers directly to their phone (push USSD)',
      'Instant callback payment status confirmation on cashier screen',
      'Direct mobile money collection accounts reconciliation',
    ],
    impact: 'Offers secure, contactless payment avenues for patients, speeding up checkout queues.',
  },
  ura_efris: {
    title: 'URA EFRIS Compliance Connector',
    desc: 'Links billing desk directly with Uganda Revenue Authority EFRIS.',
    capabilities: [
      'Real-time fiscal invoice generation upon payment validation',
      'Automatic offline caching of invoices and automatic sync upon reconnect',
      'Direct receipt validation QR codes generation',
    ],
    impact: 'Ensures complete tax compliance for commercial medical facilities, avoiding heavy URA penalties.',
  },
  dhis2_connector: {
    title: 'DHIS2 Ministry of Health Reporting Connector',
    desc: 'Automates weekly and monthly Ministry of Health reports.',
    capabilities: [
      'One-click compilation of weekly HMIS 105 maternal/child reports',
      'One-click monthly HMIS 108 disease statistics compilation',
      'Direct DHIS2 portal data file exports',
    ],
    impact: 'Reduces EMR data compilation workload from days to seconds, avoiding data-entry typos.',
  },
  nira_validation: {
    title: 'NIRA National ID Validator',
    desc: 'Verifies patient identity against the national database.',
    capabilities: [
      'Real-time national ID validation (NIN verification)',
      'Biographic verification to prevent fraud and identity theft',
      'Automatic patient registration info loading using NIN card scans',
    ],
    impact: 'Eliminates registration details typos and ensures absolute patient demographic authenticity.',
  },
};

export const ALL_MODULE_OPTIONS = MODULE_CATALOG.flatMap((g) => g.modules);

export const PRESET_PACKAGES = {
  clinic: ['patients', 'appointments', 'encounters', 'vitals', 'billing'],
  hospital: [
    'patients', 'appointments', 'encounters', 'vitals', 'billing',
    'lab', 'pharmacy', 'inventory', 'ipd', 'finance', 'reports',
  ],
  enterprise: Object.keys(DEFAULT_PRICES).filter(
    (id) => !HARDWARE_IDS.has(id) && !ADDON_IDS.has(id),
  ),
} as const;

export function formatMoney(value: number, currency = 'UGX') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}
