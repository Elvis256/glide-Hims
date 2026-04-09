import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Hospital,
  User,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Monitor,
  Stethoscope,
  Bed,
  Building2,
  Eye,
  EyeOff,
  Pill,
  Smile,
  Glasses,
  Building,
  ShoppingBag,
  MapPin,
} from 'lucide-react';
import { setupService, type FacilityPreset } from '../services/setup';
import api from '../services/api';

type Step = 'business_type' | 'deployment' | 'facility' | 'admin' | 'settings' | 'review';

const steps: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'business_type', title: 'Business Type', icon: <Building2 className="w-5 h-5" /> },
  { id: 'deployment', title: 'Deployment', icon: <Monitor className="w-5 h-5" /> },
  { id: 'facility', title: 'Facility', icon: <Hospital className="w-5 h-5" /> },
  { id: 'admin', title: 'Admin User', icon: <User className="w-5 h-5" /> },
  { id: 'settings', title: 'Settings', icon: <Settings className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <CheckCircle className="w-5 h-5" /> },
];

const facilityTypes = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dental_clinic', label: 'Dental Clinic' },
  { value: 'optical_center', label: 'Optical Center' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'health_center', label: 'Health Center' },
];

const currencies = [
  { value: 'UGX', label: 'Ugandan Shilling (UGX)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'KES', label: 'Kenyan Shilling (KES)' },
  { value: 'TZS', label: 'Tanzanian Shilling (TZS)' },
  { value: 'RWF', label: 'Rwandan Franc (RWF)' },
];

const modules = [
  // Core
  { id: 'patients', label: 'Patient Management', default: true },
  { id: 'encounters', label: 'Encounters/Visits', default: true },
  { id: 'lab', label: 'Laboratory', default: true },
  { id: 'pharmacy', label: 'Pharmacy', default: true },
  { id: 'radiology', label: 'Radiology', default: false },
  { id: 'billing', label: 'Billing', default: true },
  { id: 'inventory', label: 'Inventory', default: true },
  { id: 'hr', label: 'HR & Payroll', default: false },
  { id: 'insurance', label: 'Insurance Claims', default: false },
  { id: 'ipd', label: 'Inpatient (IPD)', default: false },
  { id: 'emergency', label: 'Emergency', default: false },
  { id: 'theatre', label: 'Theatre / Surgery', default: false },
  { id: 'maternity', label: 'Maternity', default: false },
  { id: 'appointments', label: 'Appointments & Queue', default: false },
  { id: 'finance', label: 'Finance & Accounting', default: false },
  { id: 'reports', label: 'Reports & Analytics', default: true },
  // Pharmacy-specific
  { id: 'pos', label: 'Point of Sale', default: false },
  { id: 'drug_interactions', label: 'Drug Interaction Checks', default: false },
  { id: 'controlled_substances', label: 'Controlled Substances', default: false },
  { id: 'wholesale', label: 'Wholesale/Distribution', default: false },
  { id: 'suppliers', label: 'Supplier Management', default: false },
  // Dental-specific
  { id: 'dental_charting', label: 'Dental Charting', default: false },
  { id: 'dental_procedures', label: 'Dental Procedures & Treatment Plans', default: false },
  { id: 'dental_imaging', label: 'Dental Imaging/X-Ray', default: false },
  { id: 'dental_lab', label: 'Dental Lab Orders', default: false },
  { id: 'orthodontics', label: 'Orthodontics', default: false },
  { id: 'periodontics', label: 'Periodontics', default: false },
  { id: 'insurance_preauth', label: 'Insurance Pre-Authorization', default: false },
  // Optical-specific
  { id: 'optical_exams', label: 'Eye Examinations', default: false },
  { id: 'optical_rx', label: 'Optical Prescriptions', default: false },
  { id: 'optical_inventory', label: 'Frame & Lens Inventory', default: false },
  { id: 'contact_lenses', label: 'Contact Lens Fitting', default: false },
  { id: 'optical_lab', label: 'Lens Cutting Lab', default: false },
  { id: 'visual_field', label: 'Visual Field Testing', default: false },
];

const BUILTIN_PRESETS: FacilityPreset[] = [
  // Hospital & Clinic
  {
    mode: 'single_user',
    businessType: 'hospital',
    name: 'Single-User Clinic',
    description: 'Everything done by one person on one computer. Includes all core modules with simplified workflows.',
    icon: 'monitor',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: true,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports'],
    recommendedRoles: ['Clinic Staff'],
    notes: ['All core modules enabled', 'Ideal for one-person clinics'],
  },
  {
    mode: 'clinic_opd',
    businessType: 'hospital',
    name: 'Clinic – Outpatient Only',
    description: 'A clinic with only outpatient services. No ward admissions or inpatient care.',
    icon: 'stethoscope',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments'],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier'],
    notes: ['OPD consultations, triage, vitals recording', 'Lab and pharmacy services included', 'No IPD, theatre, or maternity modules'],
  },
  {
    mode: 'clinic_full',
    businessType: 'hospital',
    name: 'Clinic – Inpatient & Outpatient',
    description: 'A clinic that handles both outpatient visits and inpatient admissions.',
    icon: 'bed',
    facilityType: 'clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments', 'ipd'],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier', 'Store Keeper'],
    notes: ['Supports ward admissions and discharges', 'OPD and IPD billing integration', 'Theatre and maternity can be enabled later if needed'],
  },
  {
    mode: 'hospital',
    businessType: 'hospital',
    name: 'Full Hospital',
    description: 'Complete hospital management with all modules: OPD, IPD, Emergency, Theatre, Maternity, HR, and Finance.',
    icon: 'building',
    facilityType: 'hospital',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments', 'ipd', 'emergency', 'theatre', 'maternity', 'hr', 'finance'],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier', 'Store Keeper', 'HR Manager', 'Accountant', 'Radiologist'],
    notes: ['All modules enabled including HR and Finance', 'Supports multiple wards, theatres, and departments', 'Full reporting and analytics suite'],
  },
  // Pharmacy
  {
    mode: 'pharmacy_retail',
    businessType: 'pharmacy',
    name: 'Retail Pharmacy',
    description: 'Single-location retail pharmacy with POS, dispensing, stock management, and controlled substance tracking.',
    icon: 'pill',
    facilityType: 'pharmacy',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'pharmacy', 'pos', 'billing', 'inventory', 'controlled_substances', 'drug_interactions', 'insurance', 'reports', 'suppliers'],
    recommendedRoles: ['Pharmacist', 'Pharmacy Technician', 'Cashier', 'Store Keeper'],
    notes: ['Full POS with barcode scanning and receipt printing', 'Controlled substance register with DEA compliance', 'Drug interaction checking on every sale', 'Supplier management and purchase orders'],
  },
  {
    mode: 'pharmacy_chain',
    businessType: 'pharmacy',
    name: 'Pharmacy Chain',
    description: 'Multi-branch pharmacy network with centralised purchasing, stock transfers, and consolidated reporting.',
    icon: 'store',
    facilityType: 'pharmacy',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['patients', 'pharmacy', 'pos', 'billing', 'inventory', 'controlled_substances', 'drug_interactions', 'insurance', 'reports', 'suppliers', 'hr', 'finance'],
    recommendedRoles: ['Pharmacist', 'Pharmacy Technician', 'Cashier', 'Store Keeper', 'Branch Manager', 'HR Manager', 'Accountant'],
    notes: ['Central purchasing with branch-level stock transfers', 'Consolidated reporting across all branches', 'HR and finance modules for company management', 'Add branches after setup via Facilities > Add Branch'],
  },
  {
    mode: 'pharmacy_wholesale',
    businessType: 'pharmacy',
    name: 'Wholesale / Distribution Pharmacy',
    description: 'Wholesale pharmaceutical distributor with B2B sales, pricing tiers, delivery tracking, and full supply chain.',
    icon: 'warehouse',
    facilityType: 'pharmacy',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['pharmacy', 'pos', 'billing', 'inventory', 'controlled_substances', 'drug_interactions', 'wholesale', 'reports', 'suppliers', 'hr', 'finance'],
    recommendedRoles: ['Pharmacist', 'Sales Representative', 'Warehouse Manager', 'Store Keeper', 'Driver', 'HR Manager', 'Accountant'],
    notes: ['B2B order management with customer accounts', 'Tiered pricing for different customer categories', 'Delivery tracking and route management', 'Full supply chain: procurement, warehousing, distribution'],
  },
  // Dental
  {
    mode: 'dental_general',
    businessType: 'dental',
    name: 'General Dental Practice',
    description: 'General dentistry with charting, procedures, imaging, treatment plans, and dental-specific billing.',
    icon: 'tooth',
    facilityType: 'dental_clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'dental_charting', 'dental_procedures', 'dental_imaging', 'dental_lab', 'billing', 'inventory', 'insurance', 'appointments', 'reports'],
    recommendedRoles: ['Dentist', 'Dental Hygienist', 'Dental Assistant', 'Receptionist', 'Cashier'],
    notes: ['Interactive dental chart with tooth-level tracking', 'CDT procedure codes for billing', 'Treatment plan builder with multi-visit scheduling', 'Dental lab order tracking (crowns, dentures, etc.)'],
  },
  {
    mode: 'dental_specialist',
    businessType: 'dental',
    name: 'Specialist Dental Clinic',
    description: 'Multi-specialty dental clinic with orthodontics, periodontics, oral surgery, insurance pre-auth, and multi-provider scheduling.',
    icon: 'tooth-specialist',
    facilityType: 'dental_clinic',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'dental_charting', 'dental_procedures', 'dental_imaging', 'dental_lab', 'orthodontics', 'periodontics', 'billing', 'inventory', 'insurance', 'insurance_preauth', 'appointments', 'reports', 'hr', 'finance'],
    recommendedRoles: ['Dentist', 'Orthodontist', 'Periodontist', 'Oral Surgeon', 'Dental Hygienist', 'Dental Assistant', 'Receptionist', 'Cashier', 'HR Manager'],
    notes: ['Orthodontic case tracking with adjustment logs', 'Periodontal charting (6 sites per tooth)', 'Insurance pre-authorization workflow', 'Multi-provider scheduling with chair management', 'HR and finance for larger practices'],
  },
  // Optical
  {
    mode: 'optical_center',
    businessType: 'optical',
    name: 'Optical Center',
    description: 'Full-service optometry with eye exams, prescriptions, frame/lens inventory, contact lenses, and in-house lens lab.',
    icon: 'glasses',
    facilityType: 'optical_center',
    supportsMultiSite: false,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'optical_exams', 'optical_rx', 'optical_inventory', 'contact_lenses', 'optical_lab', 'visual_field', 'pos', 'billing', 'inventory', 'insurance', 'appointments', 'reports'],
    recommendedRoles: ['Optometrist', 'Optician', 'Lab Technician', 'Sales Associate', 'Receptionist', 'Cashier'],
    notes: ['Structured eye exam forms (OD/OS)', 'Optical Rx management with history comparison', 'Frame & lens inventory with barcode scanning', 'Contact lens fitting and follow-up tracking', 'In-house lens cutting lab with order queue', 'Visual field testing and progression tracking'],
  },
  {
    mode: 'optical_chain',
    businessType: 'optical',
    name: 'Optical Chain',
    description: 'Multi-branch optical network with centralised inventory, lens lab orders, insurance billing, and consolidated reporting.',
    icon: 'glasses-chain',
    facilityType: 'optical_center',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'optical_exams', 'optical_rx', 'optical_inventory', 'contact_lenses', 'optical_lab', 'visual_field', 'pos', 'billing', 'inventory', 'insurance', 'appointments', 'reports', 'hr', 'finance'],
    recommendedRoles: ['Optometrist', 'Optician', 'Lab Technician', 'Sales Associate', 'Receptionist', 'Cashier', 'Branch Manager', 'HR Manager', 'Accountant'],
    notes: ['Multi-branch inventory with stock transfers', 'Centralised lens lab processing', 'HR and finance for company management', 'Consolidated reporting across all branches', 'Add branches after setup via Facilities > Add Branch'],
  },
];

const presetIcons: Record<string, React.ReactNode> = {
  monitor: <Monitor className="w-8 h-8" />,
  stethoscope: <Stethoscope className="w-8 h-8" />,
  bed: <Bed className="w-8 h-8" />,
  building: <Building2 className="w-8 h-8" />,
  'map-pin': <MapPin className="w-8 h-8" />,
  pill: <Pill className="w-8 h-8" />,
  store: <ShoppingBag className="w-8 h-8" />,
  warehouse: <Building className="w-8 h-8" />,
  tooth: <Smile className="w-8 h-8" />,
  'tooth-specialist': <Smile className="w-8 h-8" />,
  glasses: <Glasses className="w-8 h-8" />,
  'glasses-chain': <Glasses className="w-8 h-8" />,
};

export default function TenantSetupWizardPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [currentStep, setCurrentStep] = useState<Step>('business_type');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [presets, setPresets] = useState<FacilityPreset[]>(BUILTIN_PRESETS);
  const [businessType, setBusinessType] = useState('');

  // Form data
  const [facilityMode, setFacilityMode] = useState('');
  const [facility, setFacility] = useState({ name: '', type: 'clinic', location: '', phone: '', email: '' });
  const [admin, setAdmin] = useState({ fullName: '', email: '', username: '', password: '', phone: '' });
  const [settings, setSettings] = useState({
    currency: 'UGX',
    timezone: 'Africa/Kampala',
    dateFormat: 'DD/MM/YYYY',
    enabledModules: modules.filter(m => m.default).map(m => m.id),
  });

  // Fetch tenant name and presets
  useEffect(() => {
    if (!slug) return;
    api.get(`/tenants/public/by-slug/${slug}`)
      .then((res: any) => {
        const data = res.data || res;
        setTenantName(data.name || slug);
        if (data.isSetupComplete) {
          navigate(`/login/${slug}`, { replace: true });
        }
      })
      .catch(() => {
        toast.error('Organization not found');
        navigate('/login', { replace: true });
      });

    setupService.getPresets()
      .then(p => { if (p?.length) setPresets(p); })
      .catch((err) => console.warn('Failed to load presets:', err));
  }, [slug, navigate]);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'business_type':
        return !!businessType;
      case 'deployment':
        return !!facilityMode;
      case 'facility':
        return !!facility.name && !!facility.type;
      case 'admin':
        return !!admin.fullName && !!admin.username && !!admin.email && admin.password.length >= 8 && admin.password === confirmPassword;
      case 'settings':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const handlePresetSelect = (preset: FacilityPreset) => {
    setFacilityMode(preset.mode);
    setFacility(prev => ({ ...prev, type: preset.facilityType }));
    setSettings(prev => ({ ...prev, enabledModules: preset.enabledModules }));
  };

  const handleSubmit = async () => {
    if (!slug) return;
    setSubmitting(true);
    // Strip empty strings from optional fields to avoid validation errors
    const clean = <T extends Record<string, any>>(obj: T): T => {
      const result = { ...obj };
      for (const key in result) {
        if (result[key] === '') result[key] = undefined as any;
      }
      return result;
    };
    try {
      await setupService.initializeTenant(slug, {
        facility: clean(facility),
        admin: clean(admin),
        settings: {
          ...settings,
          facilityMode,
        },
      });
      toast.success('Organization setup completed! You can now log in.');
      navigate(`/login/${slug}`, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Setup failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBusinessTypeSelect = (type: string) => {
    setBusinessType(type);
    setFacilityMode('');
    switch (type) {
      case 'pharmacy':
        setFacility(prev => ({ ...prev, type: 'pharmacy' }));
        break;
      case 'dental':
        setFacility(prev => ({ ...prev, type: 'dental_clinic' }));
        break;
      case 'optical':
        setFacility(prev => ({ ...prev, type: 'optical_center' }));
        break;
      default:
        break;
    }
  };

  const selectedPreset = presets.find(p => p.mode === facilityMode);

  const filteredPresets = businessType
    ? presets.filter(p => p.businessType === businessType)
    : presets;

  const businessTypeOptions = [
    { value: 'hospital', label: 'Hospital / Clinic', description: 'Hospitals, clinics, and health centers with OPD, IPD, lab, and pharmacy services.', icon: <Hospital className="w-10 h-10" /> },
    { value: 'pharmacy', label: 'Pharmacy', description: 'Retail pharmacies, pharmacy chains, and wholesale distributors.', icon: <Pill className="w-10 h-10" /> },
    { value: 'dental', label: 'Dental', description: 'General dentistry, specialist clinics, orthodontics, and periodontics.', icon: <Smile className="w-10 h-10" /> },
    { value: 'optical', label: 'Optical', description: 'Optical centers, optometry practices, and optical retail chains.', icon: <Glasses className="w-10 h-10" /> },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 'business_type':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">What type of business are you?</h3>
              <p className="text-sm text-gray-500 mt-1">Select the category that best describes your facility</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {businessTypeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleBusinessTypeSelect(opt.value)}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    businessType === opt.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`p-3 rounded-xl ${businessType === opt.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {opt.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{opt.label}</h4>
                      <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'deployment':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Choose Deployment Mode</h3>
              <p className="text-sm text-gray-500 mt-1">Select the mode that best describes your facility</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPresets.map(preset => (
                <button
                  key={preset.mode}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    facilityMode === preset.mode
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${facilityMode === preset.mode ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {presetIcons[preset.icon] || <Monitor className="w-8 h-8" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900">{preset.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">{preset.description}</p>
                      {preset.notes?.length > 0 && (
                        <ul className="mt-2 text-xs text-gray-400 list-disc list-inside">
                          {preset.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'facility':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Facility Details</h3>
              <p className="text-sm text-gray-500 mt-1">Configure your main facility</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name *</label>
                <input
                  type="text"
                  value={facility.name}
                  onChange={e => setFacility(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Hospital"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type *</label>
                <select
                  value={facility.type}
                  onChange={e => setFacility(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {facilityTypes.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={facility.location}
                  onChange={e => setFacility(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Plot 123, Kampala Road"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={facility.phone}
                  onChange={e => setFacility(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+256-700-123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={facility.email}
                  onChange={e => setFacility(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="info@facility.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Administrator Account</h3>
              <p className="text-sm text-gray-500 mt-1">Create the admin user who will manage this organization</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={admin.fullName}
                  onChange={e => setAdmin(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Dr. John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={admin.username}
                  onChange={e => setAdmin(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="admin"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={admin.email}
                  onChange={e => setAdmin(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@organization.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={admin.phone}
                  onChange={e => setAdmin(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+256-700-123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password * (min 8 characters)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={admin.password}
                    onChange={e => setAdmin(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="SecureP@ss123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${confirmPassword && confirmPassword !== admin.password ? 'border-red-500' : 'border-gray-300'}`}
                />
                {confirmPassword && confirmPassword !== admin.password && (
                  <p className="mt-1 text-sm text-red-500">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
              <p className="text-sm text-gray-500 mt-1">Configure defaults for your organization</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={settings.currency}
                  onChange={e => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {currencies.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={e => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Africa/Kampala">Africa/Kampala (EAT, UTC+3)</option>
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
                  <option value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (EAT, UTC+3)</option>
                  <option value="Africa/Kigali">Africa/Kigali (CAT, UTC+2)</option>
                  <option value="Africa/Bujumbura">Africa/Bujumbura (CAT, UTC+2)</option>
                  <option value="Africa/Kinshasa">Africa/Kinshasa (WAT, UTC+1)</option>
                  <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
                  <option value="Africa/Accra">Africa/Accra (GMT, UTC+0)</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST, UTC+2)</option>
                  <option value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</option>
                  <option value="Africa/Addis_Ababa">Africa/Addis Ababa (EAT, UTC+3)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                  <option value="America/New_York">America/New York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select
                  value={settings.dateFormat}
                  onChange={e => setSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Enabled Modules</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {modules.map(mod => (
                  <label key={mod.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enabledModules.includes(mod.id)}
                      onChange={e => {
                        setSettings(prev => ({
                          ...prev,
                          enabledModules: e.target.checked
                            ? [...prev.enabledModules, mod.id]
                            : prev.enabledModules.filter(id => id !== mod.id),
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Review & Complete</h3>
              <p className="text-sm text-gray-500 mt-1">Please review the details before completing setup</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Organization</h4>
                <p className="text-sm text-gray-600">{tenantName}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Deployment Mode</h4>
                <p className="text-sm text-gray-600">{selectedPreset?.name || facilityMode}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Facility</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Name:</span> {facility.name}</p>
                  <p><span className="font-medium">Type:</span> {facility.type}</p>
                  {facility.location && <p><span className="font-medium">Location:</span> {facility.location}</p>}
                  {facility.phone && <p><span className="font-medium">Phone:</span> {facility.phone}</p>}
                  {facility.email && <p><span className="font-medium">Email:</span> {facility.email}</p>}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Administrator</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Name:</span> {admin.fullName}</p>
                  <p><span className="font-medium">Username:</span> {admin.username}</p>
                  <p><span className="font-medium">Email:</span> {admin.email}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Settings</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">Currency:</span> {settings.currency}</p>
                  <p><span className="font-medium">Timezone:</span> {settings.timezone}</p>
                  <p><span className="font-medium">Modules:</span> {settings.enabledModules.length} enabled</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Organization Setup</h1>
              <p className="text-sm text-gray-500">{tenantName || 'Setting up your organization...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : index === currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={`text-xs mt-1 font-medium ${
                  index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border p-6 min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              currentStepIndex === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting Up...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Complete Setup
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
