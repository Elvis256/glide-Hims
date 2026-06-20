import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileText, Plus, Printer, Trash2, Sparkles, Building2, User, Calendar, DollarSign, Check, AlertCircle, Briefcase, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../services/api';

const MODULE_CATALOG: Array<{ group: string; modules: Array<{ id: string; label: string }> }> = [
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

const DEFAULT_PRICES: Record<string, number> = {
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
  // Uganda Integrations
  mobile_money: 500000,
  ura_efris: 1000000,
  dhis2_connector: 800000,
  nira_validation: 300000,
  // Hardware
  secugen_scanner: 450000,
  thermal_printer: 350000,
  barcode_scanner: 150000,
  label_printer: 450000,
};

const MODULE_DETAILS: Record<string, { title: string; desc: string; capabilities: string[]; impact: string }> = {
  patients: {
    title: 'Patient Registration & Lifecycle Management',
    desc: 'Provides a unified digital identity for every patient receiving care.',
    capabilities: [
      'Digital patient photography & demographic capture',
      'Unique Medical Record Number (MRN) auto-generation',
      'Next-of-kin, allergy alerts, and primary insurance schemes linking'
    ],
    impact: 'Eliminates duplicate medical records, speeds up patient lookups by 70%, and ensures clinical history remains securely attached to a single identity.'
  },
  appointments: {
    title: 'Outpatient Scheduling & Appointments',
    desc: 'Optimizes doctor scheduling and manages patient flow.',
    capabilities: [
      'Interactive calendar views by clinic, doctor, or specialty department',
      'Double-booking prevention and resource allocation controls',
      'Automated SMS/Email appointment alerts and reminders'
    ],
    impact: 'Reduces patient no-shows by up to 45%, manages patient queues, and improves clinic resource utilization.'
  },
  encounters: {
    title: 'Clinical Encounters & Electronic Medical Records (EMR)',
    desc: 'Secures and digitizes clinician consultations and patient histories.',
    capabilities: [
      'Structured SOAP notes templates for doctors and specialists',
      'Integrated vitals panel, past visit history, and active diagnoses review',
      'Coded clinical input mapping directly to ICD-10 templates'
    ],
    impact: 'Saves clinicians 20-30% documentation time, ensures legible EMR records, and improves diagnosis accuracy using ICD-10 templates.'
  },
  vitals: {
    title: 'Vitals & Nursing Assessment',
    desc: 'Automates patient pre-consultation vitals logging.',
    capabilities: [
      'Rapid logging of BP, pulse, temp, respiratory rate, SpO2, and BMI',
      'Dynamic visual vitals trend charts over past visits',
      'Automatic alerts for abnormal vitals (triage flags)'
    ],
    impact: 'Enables nursing staff to quickly filter high-risk patients and ensures doctors see real-time vital trends immediately upon opening files.'
  },
  emergency: {
    title: 'Emergency & Triage Routing',
    desc: 'Manages critical care queues and acute patient flow.',
    capabilities: [
      'Emergency severity indexing (color-coded triage priority levels)',
      'Immediate bypass routing to doctor EMR for urgent cases',
      'Bed reservation in the emergency ward'
    ],
    impact: 'Accelerates emergency response times, prioritizes high-severity cases, and secures vital signs logs for trauma victims.'
  },
  lab: {
    title: 'Laboratory Information Management (LIS)',
    desc: 'Automates sample lifecycle and digital test reporting.',
    capabilities: [
      'Electronic test ordering with barcoded sample labeling',
      'Results entry template with age/gender-specific normal ranges',
      'Multi-level results approval and automatic panic-value flags'
    ],
    impact: 'Reduces test turnaround times, eliminates transcription errors, and prevents unapproved results from leaking to patients.'
  },
  radiology: {
    title: 'Radiology Information System (RIS)',
    desc: 'Manages medical imaging orders and diagnostic interpretations.',
    capabilities: [
      'Electronic ordering for X-Ray, Ultrasound, CT, and MRI scans',
      'Radiologist reporting dashboard with template macros',
      'DICOM links for PACS storage (imaging server integration)'
    ],
    impact: 'Eliminates paper request slips, attaches imaging scans directly to EMR histories, and tracks radiologist throughput.'
  },
  pharmacy: {
    title: 'Pharmacy Dispensing & e-Prescriptions',
    desc: 'Digitizes prescription fulfillment and pharmacy store levels.',
    capabilities: [
      'Electronic prescriptions routing with real-time formulary availability',
      'Controlled substances/narcotics inventory logging',
      'Printed dosage label instructions sheet'
    ],
    impact: 'Prevents dispensing errors, automatically deducts stock at dispensing points, and seals revenue leakages at the pharmacy window.'
  },
  controlled_substances: {
    title: 'Controlled Substances Log',
    desc: 'Tracks narcotics and regulated medications closely.',
    capabilities: [
      'Strict double-authorization logs for dispensing regulated drugs',
      'Automated Ministry of Health narcotics reporting formats',
      'Real-time physical vault inventory audits'
    ],
    impact: 'Ensures strict legal compliance and alerts management of any unauthorized access to narcotics.'
  },
  drug_interactions: {
    title: 'Drug Interaction & Safety Database',
    desc: 'Provides clinical safety checks during prescription writing.',
    capabilities: [
      'Real-time alerts for drug-drug and drug-allergy interactions',
      'Contraindication warnings based on patient age and pregnancy status',
      'Integrated pediatric dose calculators'
    ],
    impact: 'Significantly reduces prescription-related medical malpractice risks and enhances patient safety.'
  },
  inventory: {
    title: 'Inventory, Stores & Procurement',
    desc: 'Controls central store levels, stock replenishment, and suppliers.',
    capabilities: [
      'First-Expiry-First-Out (FEFO) store replenishment workflows',
      'Inter-store stock transfers with approval/fulfillment steps',
      'Auto-triggered low stock alerts and supplier purchase order generation'
    ],
    impact: 'Reduces stock expiries by up to 80%, prevents critical stockouts, and establishes purchasing audit trails.'
  },
  suppliers: {
    title: 'Supplier Relationship Management',
    desc: 'Manages wholesale suppliers and inventory procurement cycles.',
    capabilities: [
      'Supplier catalogs, price histories, and performance tracking',
      'Digital Request for Quotation (RFQ) generation',
      'Accounts payable balance tracking for stock orders'
    ],
    impact: 'Saves procurement costs by comparing vendor prices and improves supply chain reliability.'
  },
  wholesale: {
    title: 'Wholesale Point of Sale (POS)',
    desc: 'Manages cash-and-carry wholesale transactions.',
    capabilities: [
      'Rapid barcoded checkout and invoice generation',
      'Bulk sales price catalogs and volume discounts support',
      'Cash drawers and end-of-shift cash verification'
    ],
    impact: 'Accelerates bulk retail checkout times and secures retail cash flows.'
  },
  ipd: {
    title: 'Inpatient Ward Admission & Bed Management',
    desc: 'Tracks bed occupancy, nurse charts, and ward activities.',
    capabilities: [
      'Interactive physical bed map (occupied, vacant, cleaning)',
      'Departmental admission, transfer, and discharge templates',
      'Integrated nursing notes, drug charts, and food orders'
    ],
    impact: 'Improves ward occupancy rates, structures nursing handovers, and tracks ward-specific charges.'
  },
  theatre: {
    title: 'Theatre Scheduling & Surgery logs',
    desc: 'Manages major/minor surgeries and operation theatre queues.',
    capabilities: [
      'Theatre calendar booking and surgical team assignments',
      'Anaesthesia records and detailed post-op summaries',
      'Consumables tracking per surgery'
    ],
    impact: 'Optimizes surgical room utilization and captures full surgical cost elements.'
  },
  maternity: {
    title: 'Maternity & Partograph Tracking',
    desc: 'Tracks prenatal, delivery, and postnatal mother/child care.',
    capabilities: [
      'Antenatal profiles and digital partograph charting',
      'Delivery logs, birth notification reports, and immunization logs',
      'High-risk mother indicators'
    ],
    impact: 'Supports clinical guidelines for safe deliveries and ensures accurate birth records.'
  },
  dental_charting: {
    title: 'Dental Patient Charting',
    desc: 'Provides visual odontogram layouts for dentists.',
    capabilities: [
      'Interactive 32-tooth odontogram diagram',
      'Visual logging of decay, fillings, crowns, and extractions',
      'Patient dental history timelines'
    ],
    impact: 'Speeds up dental assessments and visually presents treatment plans to clients.'
  },
  dental_procedures: {
    title: 'Dental Procedures Ledger',
    desc: 'Tracks specific root canals, scaling, and orthodontic procedures.',
    capabilities: [
      'Structured templates for specialist dental treatments',
      'Materials and equipment costing templates',
      'Integrated treatment scheduling'
    ],
    impact: 'Ensures accurate charging of dental operations and records materials utilized.'
  },
  billing: {
    title: 'Billing, Invoicing & Cashier Desk',
    desc: 'Automates patient charges aggregation and payment receipts.',
    capabilities: [
      'Auto-aggregation of EMR consults, tests, ward charges, and drug costs',
      'Flexible payment routes (cash, mobile money, cards, insurance)',
      'Secure cashier shift handovers with cash reconciliation'
    ],
    impact: 'Eliminates revenue leakages, speeds up checkout times, and provides auditable cashier collections.'
  },
  insurance: {
    title: 'Insurance Scheme Controls & Claims (ERP)',
    desc: 'Controls corporate client contracts and streamlines medical claims.',
    capabilities: [
      'Pre-authorization limit tracking at service points',
      'Automated medical claim forms (EDI / XML exports)',
      'Accounts receivable reconciliation for insurance payments'
    ],
    impact: 'Reduces claim rejection rates, simplifies billing administration, and accelerates insurance collections.'
  },
  finance: {
    title: 'Financial Accounting & Petty Cash',
    desc: 'Integrates general ledger accounts with clinical operations.',
    capabilities: [
      'Double-entry General Ledger tracking',
      'Petty cash vouchers, expense logging, and banking reconciliations',
      'Balance Sheet, Trial Balance, and Profit & Loss generation'
    ],
    impact: 'Maintains institutional fiscal audit readiness and eliminates accounting copy-paste errors.'
  },
  reports: {
    title: 'Reports & Analytics Hub',
    desc: 'Delivers executive insights and disease statistics.',
    capabilities: [
      'Visual disease demographic trends mapping (top-10 diseases)',
      'Revenue collections comparison dashboard',
      'Operational efficiency KPIs (average wait time per ward)'
    ],
    impact: 'Allows directors to make data-driven decisions and monitor operational health in real-time.'
  },
  hr: {
    title: 'Human Resources & Payroll',
    desc: 'Manages clinical and administrative staff lifecycle.',
    capabilities: [
      'Staff profiles, credentials, licenses, and contracts database',
      'Duty roster planning and shift attendance logs',
      'Salary generation and statutory deductions (PAYE, NSSF)'
    ],
    impact: 'Tracks clinician credentials for certification compliance and automates monthly salary disbursements.'
  },
  mobile_money: {
    title: 'MTN & Airtel Mobile Money API Connector',
    desc: 'Integrates direct mobile payments with patient cash counters.',
    capabilities: [
      'Patient payment triggers directly to their phone (push USSD)',
      'Instant callback payment status confirmation on cashier screen',
      'Direct mobile money collection accounts reconciliation'
    ],
    impact: 'Offers secure, contactless payment avenues for patients, speeding up checkout queues.'
  },
  ura_efris: {
    title: 'URA EFRIS Compliance Connector',
    desc: 'Links billing desk directly with Uganda Revenue Authority EFRIS.',
    capabilities: [
      'Real-time fiscal invoice generation upon payment validation',
      'Automatic offline caching of invoices and automatic sync upon reconnect',
      'Direct receipt validation QR codes generation'
    ],
    impact: 'Ensures complete tax compliance for commercial medical facilities, avoiding heavy URA penalties.'
  },
  dhis2_connector: {
    title: 'DHIS2 Ministry of Health Reporting Connector',
    desc: 'Automates weekly and monthly Ministry of Health reports.',
    capabilities: [
      'One-click compilation of weekly HMIS 105 maternal/child reports',
      'One-click monthly HMIS 108 disease statistics compilation',
      'Direct DHIS2 portal data file exports'
    ],
    impact: 'Reduces EMR data compilation workload from days to seconds, avoiding data-entry typos.'
  },
  nira_validation: {
    title: 'NIRA National ID Validator',
    desc: 'Verifies patient identity against the national database.',
    capabilities: [
      'Real-time national ID validation (NIN verification)',
      'Biographic verification to prevent fraud and identity theft',
      'Automatic patient registration info loading using NIN card scans'
    ],
    impact: 'Eliminates registration details typos and ensures absolute patient demographic authenticity.'
  }
};

function formatMoney(value: number, currency = 'UGX') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function buildQuoteNumber() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const seq = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295 * 9000 + 1000);
  return `Q-${yy}${mm}-${seq}`;
}

function buildTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildExpiryIso(days = 14) {
  const next = new Date(Date.now() + days * 86400000);
  return next.toISOString().slice(0, 10);
}

interface QuoteLine {
  id: string;
  moduleId: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

function createLine() {
  return {
    id: crypto.randomUUID(),
    moduleId: '',
    description: '',
    unitPrice: 0,
    quantity: 1,
  } as QuoteLine;
}

export default function SystemQuotationGeneratorPage() {
  const [company, setCompany] = useState({
    legalName: 'Your Company Name',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
  });

  useEffect(() => {
    api.get('/saas-revenue/billing-settings').then((res) => {
      const d = res.data;
      if (d) {
        setCompany({
          legalName: d.legalName || d.companyName || 'Your Company Name',
          address: [d.addressLine1, d.addressLine2, d.city, d.country].filter(Boolean).join(', '),
          phone: d.phone || '',
          email: d.email || '',
          website: d.website || '',
          taxId: d.taxId || '',
        });
      }
    }).catch(() => { /* use defaults */ });
  }, []);

  const [catalogPrices, setCatalogPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    api.get('/saas-revenue/price-catalog').then((res) => {
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      const priceMap: Record<string, number> = {};
      items.forEach((item: any) => {
        if (item.code && item.unitPrice != null) {
          priceMap[item.code] = Number(item.unitPrice);
        }
      });
      if (Object.keys(priceMap).length > 0) {
        setCatalogPrices(priceMap);
      }
    }).catch(() => { /* use DEFAULT_PRICES fallback */ });
  }, []);

  const [hospitalName, setHospitalName] = useState('');
  const [hospitalContact, setHospitalContact] = useState('');
  const [quoteNumber, setQuoteNumber] = useState(buildQuoteNumber());
  const [issueDate, setIssueDate] = useState(buildTodayIso());
  const [validUntil, setValidUntil] = useState(buildExpiryIso());
  const [currency, setCurrency] = useState('UGX');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<QuoteLine[]>([createLine()]);
  const [includeVat, setIncludeVat] = useState(true);
  const [deductWht, setDeductWht] = useState(false);
  const [includeTraining, setIncludeTraining] = useState(false);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );

  const trainingAmount = useMemo(
    () => (includeTraining ? Math.round(subtotal * 0.15) : 0),
    [subtotal, includeTraining],
  );

  const baseSubtotal = subtotal + trainingAmount;

  const vatAmount = useMemo(
    () => (includeVat ? Math.round(baseSubtotal * 0.18) : 0),
    [baseSubtotal, includeVat],
  );

  const whtAmount = useMemo(
    () => (deductWht ? Math.round(baseSubtotal * 0.06) : 0),
    [baseSubtotal, deductWht],
  );

  const total = baseSubtotal + vatAmount - whtAmount;

  const selectedModuleIds = useMemo(() => new Set(lines.map((l) => l.moduleId).filter(Boolean)), [lines]);

  const hardwareSuggestions = useMemo(() => {
    const suggestions = [];
    if (selectedModuleIds.has('patients') && !selectedModuleIds.has('secugen_scanner')) {
      suggestions.push({
        id: 'secugen_scanner',
        label: 'SecuGen Hamster Pro 20 Fingerprint Reader',
        reason: 'Required for biometric patient registration & duplicate detection.',
        price: 450000,
      });
    }
    if ((selectedModuleIds.has('billing') || selectedModuleIds.has('pharmacy') || selectedModuleIds.has('wholesale')) && !selectedModuleIds.has('thermal_printer')) {
      suggestions.push({
        id: 'thermal_printer',
        label: '80mm Thermal Receipt Printer',
        reason: 'Required for printing payment receipts & POS sales.',
        price: 350000,
      });
    }
    if ((selectedModuleIds.has('billing') || selectedModuleIds.has('pharmacy') || selectedModuleIds.has('wholesale')) && !selectedModuleIds.has('barcode_scanner')) {
      suggestions.push({
        id: 'barcode_scanner',
        label: 'USB Handheld Barcode Scanner',
        reason: 'Recommended for rapid drug dispensing & inventory stock-taking.',
        price: 150000,
      });
    }
    if (selectedModuleIds.has('lab') && !selectedModuleIds.has('label_printer')) {
      suggestions.push({
        id: 'label_printer',
        label: 'Barcode Label Printer (Xprinter)',
        reason: 'Required for labeling laboratory tubes and blood samples.',
        price: 450000,
      });
    }
    return suggestions;
  }, [selectedModuleIds]);

  const moduleOptions = MODULE_CATALOG.flatMap((group) => group.modules);

  const updateLine = (id: string, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((current) => [...current, createLine()]);
  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));
  
  const applyModuleToLine = (lineId: string, moduleId: string) => {
    const label = moduleOptions.find((option) => option.id === moduleId)?.label || '';
    setLines((current) => current.map((line) => {
      if (line.id !== lineId) return line;
      return {
        ...line,
        moduleId,
        description: label || line.description,
        unitPrice: line.unitPrice || catalogPrices[moduleId] || DEFAULT_PRICES[moduleId] || 0,
      };
    }));
  };

  const addQuotedModule = (moduleId: string) => {
    const isHardware = ['secugen_scanner', 'thermal_printer', 'barcode_scanner', 'label_printer'].includes(moduleId);
    
    setLines((current) => {
      const filtered = (current.length === 1 && !current[0].moduleId && !current[0].description) ? [] : current;
      const existingLineIdx = filtered.findIndex((l) => l.moduleId === moduleId);
      
      if (existingLineIdx > -1) {
        if (isHardware) {
          toast.success(`Incremented quantity for ${moduleOptions.find(o => o.id === moduleId)?.label}`);
          return filtered.map((line, idx) => 
            idx === existingLineIdx ? { ...line, quantity: line.quantity + 1 } : line
          );
        }
        toast.error('This module is already added to the quotation.');
        return filtered;
      }
      
      const label = moduleOptions.find((option) => option.id === moduleId)?.label || '';
      toast.success(`Added ${label} to quotation`);
      return [
        ...filtered,
        {
          ...createLine(),
          moduleId,
          description: label,
          unitPrice: catalogPrices[moduleId] || DEFAULT_PRICES[moduleId] || 0,
          quantity: 1,
        },
      ];
    });
  };

  const applyPresetPackage = (packType: 'clinic' | 'hospital' | 'enterprise') => {
    let moduleIds: string[] = [];
    if (packType === 'clinic') {
      moduleIds = ['patients', 'appointments', 'encounters', 'vitals', 'billing'];
    } else if (packType === 'hospital') {
      moduleIds = [
        'patients', 'appointments', 'encounters', 'vitals', 'billing',
        'lab', 'pharmacy', 'inventory', 'ipd', 'finance', 'reports'
      ];
    } else if (packType === 'enterprise') {
      moduleIds = Object.keys(DEFAULT_PRICES).filter(
        id => !['mobile_money', 'ura_efris', 'dhis2_connector', 'nira_validation', 'secugen_scanner', 'thermal_printer', 'barcode_scanner', 'label_printer'].includes(id)
      );
    }

    const newLines = moduleIds.map((moduleId) => {
      const label = moduleOptions.find((option) => option.id === moduleId)?.label || '';
      return {
        ...createLine(),
        moduleId,
        description: label,
        unitPrice: catalogPrices[moduleId] || DEFAULT_PRICES[moduleId] || 0,
        quantity: 1,
      };
    });
    
    setLines(newLines);
    toast.success(`${packType.charAt(0).toUpperCase() + packType.slice(1)} package presets loaded!`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* 1. EDITOR WRAPPER (Hidden when printing) */}
      <div className="print:hidden space-y-8 max-w-7xl mx-auto pb-12">
        {/* Sleek Gradient Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-8 shadow-lg text-white">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
          
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Bid Quotation Control Center
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Glide-HIMS Proposal Builder</h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Configure hospital modules, hardware specifications, and local tax requirements for <strong>{company.legalName}</strong> commercial bids.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link to="/system/subscriptions" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all">
                <ArrowRight className="w-4 h-4 rotate-180" /> Back to subscriptions
              </Link>
              <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-950/20 hover:shadow-lg transition-all active:scale-[0.98]">
                <Printer className="w-4 h-4" /> Print / Save Proposal
              </button>
            </div>
          </div>
        </div>

        {/* Preset Packages Quick-Bar */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" /> Loaded Preset Packages
              </h3>
              <p className="text-xs text-slate-500">Fast-track bid configurations using standard hospital setup presets.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto min-w-[360px]">
              <button
                type="button"
                onClick={() => applyPresetPackage('clinic')}
                className="px-4 py-3 bg-blue-50/50 hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-xs font-bold rounded-lg transition-all text-center border border-blue-100 hover:border-blue-200 shadow-sm flex flex-col items-center justify-center gap-1"
              >
                <span>Clinic Pack</span>
                <span className="text-[10px] font-normal text-blue-500">Basic EMR (5 modules)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPresetPackage('hospital')}
                className="px-4 py-3 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-xs font-bold rounded-lg transition-all text-center border border-indigo-100 hover:border-indigo-200 shadow-sm flex flex-col items-center justify-center gap-1"
              >
                <span>Hospital Pack</span>
                <span className="text-[10px] font-normal text-indigo-500">Standard ERP (11 modules)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPresetPackage('enterprise')}
                className="px-4 py-3 bg-purple-50/50 hover:bg-purple-50 text-purple-700 hover:text-purple-800 text-xs font-bold rounded-lg transition-all text-center border border-purple-100 hover:border-purple-200 shadow-sm flex flex-col items-center justify-center gap-1"
              >
                <span>Enterprise Pack</span>
                <span className="text-[10px] font-normal text-purple-500">Full System (20+ modules)</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT: EDITING INTERFACE */}
          <div className="space-y-6">
            {/* Meta Information Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" /> Proposal Information
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Specify customer profile, reference details and timelines.</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Quote Reference Number</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input className="input pl-9 font-mono" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preferred Currency</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select className="input pl-9" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="UGX">UGX (Ugandan Shilling)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Date of Issue</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input type="date" className="input pl-9" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Validity Expiry</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input type="date" className="input pl-9" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-slate-50">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Hospital / Customer Name</label>
                  <input className="input" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} placeholder="e.g. St. Mary Hospital Lacor" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Client Contact Person</label>
                  <input className="input" value={hospitalContact} onChange={(e) => setHospitalContact(e.target.value)} placeholder="Name, phone number, or email" />
                </div>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Check className="w-5 h-5 text-indigo-600" /> Scope of Work Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Define software modules, pricing structures, and specifications.</p>
                </div>
                <button onClick={addLine} className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all">
                  <Plus className="w-4 h-4" /> Add Row
                </button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={line.id} className="relative p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4 hover:border-slate-350 transition-all">
                    {/* Floating line index */}
                    <span className="absolute -top-2 -left-2 w-6 h-6 bg-slate-200 text-slate-705 rounded-full flex items-center justify-center text-xs font-bold border border-slate-300">
                      {index + 1}
                    </span>

                    <div className="grid gap-4 md:grid-cols-[1.5fr_0.5fr_1fr_1fr] items-start pt-1">
                      {/* Selection */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select System Module</label>
                        <select
                          className="input bg-white"
                          value={line.moduleId}
                          onChange={(e) => applyModuleToLine(line.id, e.target.value)}
                        >
                          <option value="">Select standard module...</option>
                          {moduleOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Qty */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          className="input bg-white text-center"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit Price ({currency})</label>
                        <input
                          type="number"
                          min={0}
                          className="input bg-white"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </div>

                      {/* Line Total & Remove */}
                      <div className="flex items-center justify-between gap-2 self-end pb-1.5 h-10">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Line Total</p>
                          <p className="font-bold text-slate-800 text-sm">{formatMoney(line.quantity * line.unitPrice, currency)}</p>
                        </div>
                        <button onClick={() => removeLine(line.id)} className="p-2 text-rose-500 hover:text-rose-705 hover:bg-rose-55 rounded-lg transition-all" title="Delete Row">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Custom Description Textarea */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Scope / Custom Line Description</label>
                      <textarea
                        className="input bg-white min-h-[60px] text-xs"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        placeholder="Detail the modules, user licenses or implementation terms represented by this item..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Notes Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-800">Custom Bidding & Payment Terms</h2>
                <p className="text-xs text-slate-500 mt-0.5">Add details on payment terms, support SLA, or deployment schedules.</p>
              </div>
              <textarea
                className="input min-h-[120px] text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specify details like: Payments are 50% upfront, 30% after user acceptance training, 20% on go-live. Includes free first 3 months support SLA, etc."
              />
            </div>
          </div>

          {/* RIGHT: LIVE SUMMARY & MODULE SELECTION CHECKLIST */}
          <div className="space-y-6">
            {/* Live Pricing Summary Panel */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm sticky top-6">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-800">Commercial Summary</h2>
                <p className="text-xs text-slate-500 mt-0.5">Live calculation of project fees and local taxes.</p>
              </div>

              <div className="space-y-3.5 text-xs text-slate-700 border-b border-slate-100 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hospital:</span>
                  <span className="font-semibold text-slate-850 truncate max-w-[180px]">{hospitalName || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quote Reference:</span>
                  <span className="font-semibold text-slate-850 font-mono">{quoteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issue / Expiry:</span>
                  <span className="font-semibold text-slate-850">{issueDate} / {validUntil}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Software Line Items:</span>
                  <span className="font-semibold text-slate-850">{lines.length} modules</span>
                </div>
              </div>

              {/* Taxation & Fee Toggles */}
              <div className="py-4 border-b border-slate-100 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Local Taxes & Implementation Fees</span>
                
                <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTraining}
                    onChange={(e) => setIncludeTraining(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Implementation & Training Fee (+15%)</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => setIncludeVat(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Include VAT (+18%)</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deductWht}
                    onChange={(e) => setDeductWht(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Deduct Withholding Tax (-6%)</span>
                </label>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="pt-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Software Subtotal</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                
                {includeTraining && (
                  <div className="flex justify-between text-slate-600">
                    <span>Setup & Training Fee</span>
                    <span>{formatMoney(trainingAmount, currency)}</span>
                  </div>
                )}
                
                {includeTraining && (
                  <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-50 pt-1.5">
                    <span>Base Subtotal</span>
                    <span>{formatMoney(baseSubtotal, currency)}</span>
                  </div>
                )}
                
                {includeVat && (
                  <div className="flex justify-between text-slate-600">
                    <span>Value Added Tax (18%)</span>
                    <span>{formatMoney(vatAmount, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-extrabold text-slate-905 border-t border-slate-200 pt-3">
                  <span>Gross Total</span>
                  <span>{formatMoney(baseSubtotal + vatAmount, currency)}</span>
                </div>

                {deductWht && (
                  <>
                    <div className="flex justify-between text-rose-600 border-t border-dashed border-slate-200 pt-2.5">
                      <span>Less: 6% WHT Deduction</span>
                      <span>-{formatMoney(whtAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-emerald-700 border-t border-slate-200 pt-2.5">
                      <span>Net Payable Amount</span>
                      <span>{formatMoney(total, currency)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Print Action Buttons */}
              <div className="mt-6 space-y-2">
                <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-900/10 hover:shadow-lg transition-all active:scale-[0.98]">
                  <Printer className="w-4.5 h-4.5" /> Print Proposal / Save PDF
                </button>
                <button onClick={() => setQuoteNumber(buildQuoteNumber())} className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all">
                  <FileText className="w-4 h-4" /> Reset Quote Number
                </button>
              </div>
            </div>

            {/* Smart Hardware Recommendations (Dynamic) */}
            {hardwareSuggestions.length > 0 && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Recommended Hardware Options</h3>
                </div>
                <p className="text-xs text-amber-700 leading-normal">
                  Based on your software choices, we suggest adding the following compatible peripheral hardware:
                </p>
                <div className="space-y-3 mt-1">
                  {hardwareSuggestions.map((item) => (
                    <div key={item.id} className="text-xs bg-white border border-amber-200/50 rounded-lg p-3 flex items-start justify-between gap-3 shadow-sm hover:border-amber-300 transition-all">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800">{item.label}</p>
                        <p className="text-slate-500 text-[11px] leading-relaxed">{item.reason}</p>
                        <p className="font-bold text-indigo-750 text-[11px] mt-0.5">{formatMoney(item.price, currency)}</p>
                      </div>
                      <button
                        onClick={() => addQuotedModule(item.id)}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md whitespace-nowrap self-center text-[10px] shadow-sm transition-all active:scale-[0.97]"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete Module Catalog Quick-Add (Visual Grid) */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-800">Quick-Add Module Directory</h3>
                <p className="text-xs text-slate-500">Tap modules to instantly add them to the quotation lines.</p>
              </div>

              <div className="space-y-5">
                {MODULE_CATALOG.map((group) => (
                  <div key={group.group} className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block border-b border-slate-50 pb-1">{group.group}</span>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {group.modules.map((module) => {
                        const isAdded = selectedModuleIds.has(module.id);
                        const isHardware = ['secugen_scanner', 'thermal_printer', 'barcode_scanner', 'label_printer'].includes(module.id);
                        const isSoftware = !isHardware;
                        
                        return (
                          <button
                            key={module.id}
                            type="button"
                            onClick={() => addQuotedModule(module.id)}
                            className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                              isAdded && isSoftware
                                ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800 font-semibold'
                                : 'border-slate-200/80 bg-slate-50/50 text-slate-650 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              {module.label}
                              {isAdded && isSoftware && <span className="text-emerald-600 font-bold ml-1">✓</span>}
                            </span>
                            <span className="font-bold text-slate-700 shrink-0">
                              {formatMoney(catalogPrices[module.id] ?? DEFAULT_PRICES[module.id] ?? 0, currency)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRINT PROPOSAL WRAPPER (Only visible when printing) */}
      <div className="hidden print:block print-proposal text-slate-900 bg-white font-sans max-w-[210mm] mx-auto p-10 leading-relaxed text-sm">
        
        {/* PAGE 1: COVER LETTER & VALUE PROP */}
        <div className="min-h-[285mm] flex flex-col justify-between pb-8">
          <div>
            {/* Elegant Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-blue-905 pb-4 mb-6">
              <div className="flex items-center gap-3">
                {/* SVG Logo: digital gear + medical cross */}
                <svg className="w-12 h-12 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="6" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="3 3"/>
                </svg>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-blue-900 uppercase">{company.legalName}</h1>
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Healthcare Systems Division</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-600 leading-normal">
                <p className="font-bold text-slate-800">{company.legalName.toUpperCase()}</p>
                {company.address && <p>{company.address}</p>}
                {company.phone && <p>Tel: {company.phone}</p>}
                {company.email && <p>Email: {company.email}{company.website ? ` | Web: ${company.website}` : ''}</p>}
              </div>
            </div>

            {/* Proposal Title Block */}
            <div className="bg-slate-50 border-l-4 border-blue-900 p-6 rounded-r-lg mb-8">
              <span className="text-xs font-semibold tracking-wider text-blue-900 uppercase">Commercial Proposal & Bid</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">GLIDE-HIMS HOSPITAL MANAGEMENT INFORMATION SYSTEM</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-xs">
                <div>
                  <span className="text-slate-500">Prepared For:</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{hospitalName || 'Hospital Partner'}</p>
                  <p className="text-slate-655">{hospitalContact || 'Administration Department'}</p>
                </div>
                <div>
                  <span className="text-slate-550">Proposal Metadata:</span>
                  <p className="text-slate-700 mt-0.5"><span className="font-semibold">Quote Ref:</span> {quoteNumber}</p>
                  <p className="text-slate-700"><span className="font-semibold">Issue Date:</span> {new Date(issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p className="text-slate-700"><span className="font-semibold">Valid Until:</span> {new Date(validUntil).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {/* Letter Body */}
            <div className="space-y-4 text-[13px] leading-relaxed text-slate-800">
              <p className="font-semibold">Dear Management Team,</p>
              <p>
                We are pleased to submit this proposal for the deployment of <strong>Glide-HIMS (Hospital Management Information System)</strong> at your esteemed facility. 
                In Uganda's rapidly evolving healthcare ecosystem, operational efficiency, financial transparency, and precise clinical records are paramount to achieving outstanding patient outcomes and ensuring institutional sustainability.
              </p>
              <p>
                Glide-HIMS is an enterprise-grade solution built by <strong>{company.legalName}</strong> specifically to meet the clinical and administrative needs of local and regional medical facilities. 
                Our solution is offline-resilient, meaning that your doctors, pharmacies, and billing desks continue to operate seamlessly even during internet outages, synchronizing immediately when connectivity is restored.
              </p>
              <p>
                Furthermore, Glide-HIMS is fully integrated with Ugandan statutory systems:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 font-medium text-slate-705">
                <li><strong className="text-blue-900">URA EFRIS Compliance:</strong> Automatically generates e-invoices and fiscal receipt values to comply with local tax laws.</li>
                <li><strong className="text-blue-900">DHIS2 MoH Integration:</strong> Outputs weekly HMIS 105 and monthly HMIS 108 report sheets directly for submission to the Ministry of Health.</li>
                <li><strong className="text-blue-900">Patient Biometric Registry:</strong> Integrates with national ID databases or direct fingerprint validation to eliminate duplicates and secure clinical files.</li>
              </ul>
              <p>
                We look forward to partnering with your institution to transform your clinical operations and establish a secure digital record system.
              </p>
            </div>
          </div>

          {/* Letter Footer */}
          <div className="flex justify-between items-end border-t border-slate-100 pt-6">
            <div>
              <p className="text-xs text-slate-500">Prepared by:</p>
              <p className="font-semibold text-slate-800">{company.legalName}</p>
              <p className="text-xs text-slate-505 font-mono">info@itsolutionsuganda.com &middot; +256 742 020 610 / 0752052202</p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              Cover Letter
            </div>
          </div>
        </div>

        <div className="page-break" />

        {/* PAGE 2: DETAILED COMMERCIAL QUOTE */}
        <div className="min-h-[285mm] flex flex-col justify-between pb-8 pt-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
              <h3 className="text-base font-bold text-blue-900 uppercase tracking-wider">Section A: Scope of Modules & Financial Quote</h3>
              <span className="text-xs text-slate-505">Quote Reference: {quoteNumber}</span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-normal">
              Below is the comprehensive list of licensing, system modules, integrations, and hardware requested for implementation. Custom system descriptions are modified to match your requirements.
            </p>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-105 text-slate-705">
                  <th className="py-2.5 px-3 font-semibold">Module / Item & Description</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-16">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-32">Unit Price</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-36">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{line.moduleId ? moduleOptions.find(o => o.id === line.moduleId)?.label : 'Custom Service'}</p>
                      <p className="text-slate-505 mt-0.5 text-[11px] whitespace-pre-line leading-relaxed">{line.description || 'No description provided.'}</p>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-800">{line.quantity}</td>
                    <td className="py-3 px-3 text-right text-slate-805">{formatMoney(line.unitPrice, currency)}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">{formatMoney(line.quantity * line.unitPrice, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quote Calculations Panel */}
            <div className="mt-8 flex justify-end">
              <div className="w-80 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-505">Modules Subtotal:</span>
                  <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
                </div>
                {includeTraining && (
                  <div className="flex justify-between">
                    <span className="text-slate-505">Setup & Training (15%):</span>
                    <span className="font-semibold">{formatMoney(trainingAmount, currency)}</span>
                  </div>
                )}
                {includeTraining && (
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium">
                    <span className="text-slate-800">Base Subtotal:</span>
                    <span className="font-semibold text-slate-900">{formatMoney(baseSubtotal, currency)}</span>
                  </div>
                )}
                {includeVat && (
                  <div className="flex justify-between">
                    <span className="text-slate-505">VAT (18%):</span>
                    <span className="font-semibold">{formatMoney(vatAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
                  <span>Gross Proposal Total:</span>
                  <span>{formatMoney(baseSubtotal + vatAmount, currency)}</span>
                </div>
                {deductWht && (
                  <>
                    <div className="flex justify-between text-rose-700 pt-1 border-t border-dashed border-slate-300">
                      <span>Less: 6% WHT Deduction:</span>
                      <span>-{formatMoney(whtAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-emerald-800 pt-1.5 border-t border-emerald-300">
                      <span>Net Payable Amount:</span>
                      <span>{formatMoney(total, currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {notes && (
              <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h4 className="text-xs font-bold text-slate-800 mb-1">Additional Project Notes & Custom Instructions:</h4>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{notes}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-end border-t border-slate-100 pt-6">
            <div>
              <p className="text-[10px] text-slate-400">All prices are exclusive of external network provider fees unless stated otherwise.</p>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              Section A: Financial Proposal
            </div>
          </div>
        </div>

        {/* SECTION B: DETAILED MODULE CAPABILITIES & BUSINESS IMPACT */}
        {lines.filter(line => line.moduleId && MODULE_DETAILS[line.moduleId]).length > 0 && (
          <>
            <div className="page-break" />
            <div className="min-h-[285mm] flex flex-col justify-between pb-8 pt-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
                  <h3 className="text-base font-bold text-blue-900 uppercase tracking-wider">Section B: System Modules Functionality & Business Impact</h3>
                  <span className="text-xs text-slate-505">Quote Reference: {quoteNumber}</span>
                </div>

                <p className="text-xs text-slate-600 mb-6 leading-normal">
                  The following sections outline the detailed capabilities and anticipated business value for each of the selected system modules:
                </p>

                <div className="space-y-6">
                  {lines
                    .filter(line => line.moduleId && MODULE_DETAILS[line.moduleId])
                    .map((line) => {
                      const detail = MODULE_DETAILS[line.moduleId];
                      return (
                        <div key={line.id} className="border-b border-slate-100 pb-5 last:border-0 page-break-inside-avoid">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-900"></span>
                            {detail.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">{detail.desc}</p>
                          
                          <div className="mt-2.5 grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Key Features & Scope:</span>
                              <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px] mt-1">
                                {detail.capabilities.map((cap, i) => (
                                  <li key={i}>{cap}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/50 rounded-lg p-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-semibold">Anticipated Business Impact:</span>
                              <p className="text-slate-700 italic text-[11px] leading-relaxed mt-1">
                                {detail.impact}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-slate-100 pt-6">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Glide-HIMS Functional Scope Specification</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  Section B: Module Functional Scope
                </div>
              </div>
            </div>
          </>
        )}

        <div className="page-break" />

        {/* PAGE 3: PROJECT PHASING, TERMS & SIGN-OFF */}
        <div className="min-h-[285mm] flex flex-col justify-between pb-8 pt-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
              <h3 className="text-base font-bold text-blue-900 uppercase tracking-wider">Section C: Implementation Milestones & Terms</h3>
              <span className="text-xs text-slate-505">Quote Reference: {quoteNumber}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-xs text-slate-700">
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">1. Deployment Milestones</h4>
                  <ul className="space-y-2.5 list-none pl-0">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                      <div>
                        <p className="font-semibold text-slate-800">Initial Setup & Base System (50%)</p>
                        <p className="text-slate-500 mt-0.5">Database setup, server configuration, and baseline module deployment within 7 days of deposit.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                      <div>
                        <p className="font-semibold text-slate-800">Customization & User Training (30%)</p>
                        <p className="text-slate-500 mt-0.5">Departmental workflow customization, template styling, and intensive training for staff.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                      <div>
                        <p className="font-semibold text-slate-800">Go-Live & Support Handover (20%)</p>
                        <p className="text-slate-500 mt-0.5">Final data migration validation, on-site launch assistance, and official project handover.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">2. SLA & Maintenance Agreement</h4>
                  <p className="leading-relaxed text-slate-600">
                    {company.legalName} provides <strong>90 days of complimentary support</strong> post-deployment. 
                    Thereafter, a Service Level Agreement (SLA) contract will take effect at <strong>15% of the total software licensing value annually</strong>, billed quarterly. 
                    The SLA covers routine security updates, remote support, database checkups, and statutory compliance changes.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">3. Invoicing & Inbound Payments</h4>
                  <p className="leading-relaxed text-slate-650">
                    Milestone invoicing terms apply. Standard pro-forma and commercial invoices will be generated at each phase. 
                    Official bank transfer details (Stanbic Bank Uganda) and Mobile Money billing collection codes will be provided directly on the invoice documents at the time of billing. 
                    Deployments and licenses provisioning are triggered upon receipt of payments.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">4. Additional Terms</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>This quote is valid for exactly 14 calendar days from the date of issue.</li>
                    <li>Delivery timeline is 4-6 weeks from initial 50% payment clearance.</li>
                    <li>Hardware components carry a 12-month manufacturer warranty.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Dual Authorization Block */}
            <div className="mt-12">
              <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-6 text-xs uppercase tracking-wider text-center">Section C: Acceptance & Authorization</h4>
              
              <div className="grid grid-cols-2 gap-12 text-xs mt-4">
                {/* Avis Signature */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3.5 relative min-h-[140px] flex flex-col justify-between">
                  <span className="absolute top-2 right-2 text-[10px] font-bold text-blue-900 tracking-wider bg-blue-50 px-2 py-0.5 rounded">PROVIDER</span>
                  <div className="space-y-1">
                    <p className="text-slate-550">For and on behalf of:</p>
                    <p className="font-bold text-slate-800">{company.legalName}</p>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-2 mt-4 space-y-1.5">
                    <p className="text-slate-505 font-mono text-[10px]">Authorized Signature & Stamp</p>
                    <div className="h-6"></div>
                    <div className="flex justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1">
                      <span>Name: Elvis M.</span>
                      <span>Date: ________________</span>
                    </div>
                  </div>
                </div>

                {/* Client Signature */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3.5 relative min-h-[140px] flex flex-col justify-between">
                  <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-800 tracking-wider bg-emerald-50 px-2 py-0.5 rounded">CLIENT ACCEPTANCE</span>
                  <div className="space-y-1">
                    <p className="text-slate-550">For and on behalf of:</p>
                    <p className="font-bold text-slate-800">{hospitalName || '__________________________________'}</p>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-2 mt-4 space-y-1.5">
                    <p className="text-slate-555 font-mono text-[10px]">Authorized Signature & Stamp</p>
                    <div className="h-6"></div>
                    <div className="flex justify-between text-[11px] text-slate-655 border-t border-slate-100 pt-1">
                      <span>Name: ________________</span>
                      <span>Date: ________________</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-slate-100 pt-6">
            <div>
              <p className="text-[10px] text-slate-400">Glide-HIMS is a registered product of {company.legalName}.</p>
            </div>
            <div className="text-right text-[11px] text-slate-400 font-semibold">
              Section C: Implementation & Terms
            </div>
          </div>
        </div>
      </div>

      {/* Quotation Print styles */}
      <style>{`
        @media screen {
          .print-proposal {
            display: none !important;
          }
        }
        @media print {
          /* Hide the screen editor completely */
          .print\\:hidden {
            display: none !important;
          }
          
          /* Show the print proposal */
          .print-proposal {
            display: block !important;
          }

          /* Ensure layout resets for paper format */
          body {
            background: white !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* standard margins & size */
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }

          .page-break {
            page-break-before: always !important;
            break-before: page !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}
