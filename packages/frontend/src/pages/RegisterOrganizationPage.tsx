import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2,
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
  MapPin,
  Building,
  LogIn,
  Pill,
  Smile,
  Glasses,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { setupService, type InitializeSetupData, type FacilityPreset, type PublicPlan } from '../services/setup';
import { api } from '../services/api';
import Logo from '../components/Logo';

type Step = 'business_type' | 'plan' | 'organization' | 'deployment' | 'facility' | 'admin' | 'settings' | 'review';

const steps: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'business_type', title: 'Business Type', icon: <Building2 className="w-5 h-5" /> },
  { id: 'plan', title: 'Plan', icon: <Sparkles className="w-5 h-5" /> },
  { id: 'organization', title: 'Organization', icon: <Building2 className="w-5 h-5" /> },
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
    notes: ['All core modules enabled', 'No shift management or HR', 'Ideal for one-person private clinics'],
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
    notes: ['OPD consultations, triage, vitals recording', 'No IPD, theatre, or maternity'],
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
    notes: ['Supports ward admissions and discharges', 'Theatre and maternity can be enabled later'],
  },
  {
    mode: 'multisite_opd',
    businessType: 'hospital',
    name: 'Multi-Site OPD Network',
    description: 'Multiple outpatient-only locations under one organisation with centralised reporting.',
    icon: 'map-pin',
    facilityType: 'clinic',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'billing', 'inventory', 'insurance', 'reports', 'appointments'],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier'],
    notes: ['Add branches after setup via Facilities → Add Branch', 'Centralised dashboard across all sites'],
  },
  {
    mode: 'hospital',
    businessType: 'hospital',
    name: 'Full Hospital',
    description: 'Complete hospital management: OPD, IPD, Emergency, Theatre, Maternity, HR, and Finance.',
    icon: 'building',
    facilityType: 'hospital',
    supportsMultiSite: true,
    singleUserMode: false,
    enabledModules: ['patients', 'encounters', 'vitals', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments', 'ipd', 'emergency', 'theatre', 'maternity', 'hr', 'finance'],
    recommendedRoles: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'Lab Technician', 'Cashier', 'Store Keeper', 'HR Manager', 'Accountant', 'Radiologist'],
    notes: ['All modules enabled', 'Supports multiple wards, theatres, and departments'],
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
  monitor: <Monitor className="w-6 h-6" />,
  stethoscope: <Stethoscope className="w-6 h-6" />,
  bed: <Bed className="w-6 h-6" />,
  'map-pin': <MapPin className="w-6 h-6" />,
  building: <Building className="w-6 h-6" />,
  pill: <Pill className="w-6 h-6" />,
  store: <ShoppingBag className="w-6 h-6" />,
  warehouse: <Building className="w-6 h-6" />,
  tooth: <Smile className="w-6 h-6" />,
  'tooth-specialist': <Smile className="w-6 h-6" />,
  glasses: <Glasses className="w-6 h-6" />,
  'glasses-chain': <Glasses className="w-6 h-6" />,
};

export default function RegisterOrganizationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => searchParams.get('currency')?.toUpperCase() || 'UGX');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['UGX']);
  const [currentStep, setCurrentStep] = useState<Step>('business_type');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presets, setPresets] = useState<FacilityPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<FacilityPreset | null>(null);
  const [businessType, setBusinessType] = useState('');
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get('/setup/registration-allowed')
      .then((r) => setRegistrationAllowed(!!(r.data?.data?.allowed ?? r.data?.allowed)))
      .catch(() => setRegistrationAllowed(false));
  }, []);

  useEffect(() => {
    setupService.getPresets().then(setPresets).catch((err) => console.error('Failed to load presets:', err));
  }, []);

  useEffect(() => {
    setPlansLoading(true);
    setupService.getPublicPlans(displayCurrency)
      .then((p) => {
        setPlans(p);
        const wantCode = searchParams.get('plan');
        if (wantCode) {
          const match = p.find((pl) => pl.code === wantCode);
          if (match) {
            setFormData((prev) => ({ ...prev, plan: { code: match.code, billingInterval: 'monthly' } }));
          }
        }
      })
      .catch((err) => console.error('Failed to load plans:', err))
      .finally(() => setPlansLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCurrency]);

  useEffect(() => {
    api.get('/saas-revenue/public/currency-rates')
      .then((r) => {
        const body = r.data?.data || r.data;
        if (body?.rates) setAvailableCurrencies(Object.keys(body.rates).sort());
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState<InitializeSetupData>({
    organization: { name: '', slug: '', type: 'hospital', country: 'Uganda' },
    facility: { name: '', type: 'hospital' },
    admin: { fullName: '', email: '', username: '', password: '' },
    settings: {
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      dateFormat: 'DD/MM/YYYY',
      facilityMode: 'hospital',
      enabledModules: modules.filter(m => m.default).map(m => m.id),
      workflowMode: 'simple',
    },
    plan: undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugChecking, setSlugChecking] = useState(false);
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 3 || !/^[a-z0-9-]+$/.test(slug)) return;
    setSlugChecking(true);
    try {
      await api.get(`/tenants/public/by-slug/${slug}`);
      // If found, slug is taken
      setErrors(prev => ({ ...prev, 'organization.slug': 'This organization code is already taken' }));
    } catch {
      // 404 = available
      setErrors(prev => {
        const next = { ...prev };
        if (next['organization.slug'] === 'This organization code is already taken') delete next['organization.slug'];
        return next;
      });
    } finally {
      setSlugChecking(false);
    }
  };

  const updateFormData = (section: keyof InitializeSetupData, field: string, value: any) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      };
      // Auto-generate slug from organization name if user hasn't manually edited it
      if (section === 'organization' && field === 'name') {
        const autoSlug = value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        // Only auto-fill if slug is empty or matches what would be auto-generated from old name
        const oldAutoSlug = (prev.organization.name || '')
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        if (!prev.organization.slug || prev.organization.slug === oldAutoSlug) {
          updated.organization = { ...updated.organization, slug: autoSlug };
        }
      }
      return updated;
    });
    setErrors(prev => ({ ...prev, [`${section}.${field}`]: '' }));
  };

  const toggleModule = (moduleId: string) => {
    const current = formData.settings?.enabledModules || [];
    const updated = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId];
    updateFormData('settings', 'enabledModules', updated);
  };

  const selectPreset = (preset: FacilityPreset) => {
    setSelectedPreset(preset);
    setFormData(prev => ({
      ...prev,
      facility: { ...prev.facility, type: preset.facilityType },
      settings: {
        ...prev.settings,
        facilityMode: preset.mode,
        enabledModules: preset.enabledModules,
      },
    }));
  };

  const handleBusinessTypeSelect = (type: string) => {
    setBusinessType(type);
    setSelectedPreset(null);
    switch (type) {
      case 'pharmacy':
        updateFormData('facility', 'type', 'pharmacy');
        break;
      case 'dental':
        updateFormData('facility', 'type', 'dental_clinic');
        break;
      case 'optical':
        updateFormData('facility', 'type', 'optical_center');
        break;
      default:
        break;
    }
  };

  const filteredPresets = businessType
    ? (presets.length > 0 ? presets : BUILTIN_PRESETS).filter(p => p.businessType === businessType)
    : (presets.length > 0 ? presets : BUILTIN_PRESETS);

  const businessTypeOptions = [
    { value: 'hospital', label: 'Hospital / Clinic', description: 'Hospitals, clinics, and health centers with OPD, IPD, lab, and pharmacy services.', icon: <Hospital className="w-10 h-10" /> },
    { value: 'pharmacy', label: 'Pharmacy', description: 'Retail pharmacies, pharmacy chains, and wholesale distributors.', icon: <Pill className="w-10 h-10" /> },
    { value: 'dental', label: 'Dental', description: 'General dentistry, specialist clinics, orthodontics, and periodontics.', icon: <Smile className="w-10 h-10" /> },
    { value: 'optical', label: 'Optical', description: 'Optical centers, optometry practices, and optical retail chains.', icon: <Glasses className="w-10 h-10" /> },
  ];

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 'business_type':
        if (!businessType) {
          newErrors['businessType'] = 'Please select a business type';
        }
        break;
      case 'plan':
        if (!formData.plan?.code) {
          newErrors['plan'] = 'Please select a plan to continue';
        }
        break;
      case 'organization':
        if (!formData.organization.name.trim()) {
          newErrors['organization.name'] = 'Organization name is required';
        }
        if (!formData.organization.slug?.trim()) {
          newErrors['organization.slug'] = 'Organization code is required';
        } else if (!/^[a-z0-9-]+$/.test(formData.organization.slug)) {
          newErrors['organization.slug'] = 'Only lowercase letters, numbers, and hyphens allowed';
        } else if (formData.organization.slug.length < 3) {
          newErrors['organization.slug'] = 'Organization code must be at least 3 characters';
        }
        break;
      case 'facility':
        if (!formData.facility.name.trim()) {
          newErrors['facility.name'] = 'Facility name is required';
        }
        break;
      case 'admin':
        if (!formData.admin.fullName.trim()) {
          newErrors['admin.fullName'] = 'Full name is required';
        }
        if (!formData.admin.email.trim()) {
          newErrors['admin.email'] = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin.email)) {
          newErrors['admin.email'] = 'Invalid email format';
        }
        if (!formData.admin.username.trim()) {
          newErrors['admin.username'] = 'Username is required';
        } else if (formData.admin.username.length < 3) {
          newErrors['admin.username'] = 'Username must be at least 3 characters';
        }
        if (!formData.admin.password) {
          newErrors['admin.password'] = 'Password is required';
        } else if (formData.admin.password.length < 8) {
          newErrors['admin.password'] = 'Password must be at least 8 characters';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await setupService.registerTenant(formData);
      toast.success('Organization registered successfully! You can now sign in.');
      const slug = formData.organization.slug || formData.organization.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      navigate(`/login/${slug}?registered=true`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'business_type':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">What type of business are you?</h2>
              <p className="mt-1 text-gray-600">Select the category that best describes your facility.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {businessTypeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleBusinessTypeSelect(opt.value)}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    businessType === opt.value
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
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

      case 'plan': {
        const interval = formData.plan?.billingInterval || 'monthly';
        const fmtPrice = (minor: number, currency: string) => {
          if (minor === 0) return 'Free';
          return new Intl.NumberFormat('en-US').format(Math.round(minor / 100)) + ' ' + currency;
        };
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
              <p className="mt-1 text-gray-600">Start with a free trial — no card required. You can upgrade or downgrade anytime.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm">
                {(['monthly', 'annual'] as const).map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, plan: p.plan ? { ...p.plan, billingInterval: iv } : { code: '', billingInterval: iv } }))}
                    className={`px-4 py-1.5 rounded-md font-medium ${interval === iv ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {iv === 'monthly' ? 'Monthly' : 'Annual · save up to 17%'}
                  </button>
                ))}
              </div>
              {availableCurrencies.length > 1 && (
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Show prices in:</span>
                  <select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-md bg-white font-medium"
                  >
                    {availableCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
            {plansLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading plans…</div>
            ) : plans.length === 0 ? (
              <div className="text-sm text-gray-500">No plans configured. Continuing without a plan is allowed.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((p) => {
                  const selected = formData.plan?.code === p.code;
                  const priceMinor = interval === 'annual' ? p.priceAnnualMinor : p.priceMonthlyMinor;
                  const popular = p.tier === 'professional';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, plan: { code: p.code, billingInterval: interval } }))}
                      className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                        selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      {popular && (
                        <span className="absolute -top-2.5 left-4 inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-amber-500 text-white">Most popular</span>
                      )}
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-gray-900">{p.name}</h3>
                        {selected && <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />}
                      </div>
                      <div className="mt-2 text-2xl font-bold text-gray-900">
                        {fmtPrice(priceMinor, p.currency)}
                        {priceMinor > 0 && <span className="text-sm font-normal text-gray-500"> /{interval === 'annual' ? 'yr' : 'mo'}</span>}
                      </div>
                      {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
                      <ul className="mt-3 space-y-1 text-xs text-gray-600">
                        <li>• Up to {p.maxUsers ?? '∞'} users</li>
                        <li>• {p.maxFacilities ?? '∞'} facilities</li>
                        <li>• {(p.enabledModules?.length ?? 0)} modules</li>
                        {p.trialDays > 0 && <li className="text-emerald-700 font-medium">• {p.trialDays}-day free trial</li>}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
            {errors['plan'] && <p className="text-sm text-red-500">{errors['plan']}</p>}
            <p className="text-xs text-gray-500">You can change plans later from the billing portal. Existing trial subscriptions can be upgraded or cancelled at any time.</p>
          </div>
        );
      }

      case 'organization':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Organization Details</h2>
              <p className="mt-1 text-gray-600">Enter your organization or hospital group information.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name *</label>
                <input
                  type="text"
                  value={formData.organization.name}
                  onChange={(e) => updateFormData('organization', 'name', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['organization.name'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="e.g., Kampala Medical Center"
                />
                {errors['organization.name'] && <p className="mt-1 text-sm text-red-500">{errors['organization.name']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Code (Slug) *</label>
                <input
                  type="text"
                  value={formData.organization.slug || ''}
                  onChange={(e) => updateFormData('organization', 'slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onBlur={(e) => checkSlugAvailability(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['organization.slug'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="e.g., kampala-medical"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be your login URL: <span className="font-mono text-blue-600">/login/{formData.organization.slug || 'your-code'}</span>
                  {slugChecking && <span className="ml-2 text-blue-500">Checking availability...</span>}
                </p>
                {errors['organization.slug'] && <p className="mt-1 text-sm text-red-500">{errors['organization.slug']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Type</label>
                <select
                  value={formData.organization.type}
                  onChange={(e) => updateFormData('organization', 'type', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="hospital">Hospital</option>
                  <option value="hospital_network">Hospital Network</option>
                  <option value="clinic_chain">Clinic Chain</option>
                  <option value="health_center">Health Center</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input
                  type="text"
                  value={formData.organization.country}
                  onChange={(e) => updateFormData('organization', 'country', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Uganda"
                />
              </div>
            </div>
          </div>
        );

      case 'deployment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Deployment Mode</h2>
              <p className="mt-1 text-gray-600">
                Choose how this system will be used. This sets up the right modules and roles for your facility type.
              </p>
            </div>
            <div className="grid gap-4">
              {filteredPresets.map((preset) => {
                const isSelected = selectedPreset?.mode === preset.mode ||
                  (!selectedPreset && preset.mode === formData.settings?.facilityMode);
                return (
                  <button
                    key={preset.mode}
                    type="button"
                    onClick={() => selectPreset(preset)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                        {presetIcons[preset.icon] || <Monitor className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {preset.name}
                          </span>
                          {preset.singleUserMode && (
                            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">Single User</span>
                          )}
                          {preset.supportsMultiSite && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Multi-Site</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{preset.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {preset.enabledModules.slice(0, 6).map(m => (
                            <span key={m} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{m}</span>
                          ))}
                          {preset.enabledModules.length > 6 && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                              +{preset.enabledModules.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                    {isSelected && preset.notes.length > 0 && (
                      <ul className="mt-3 ml-9 space-y-1">
                        {preset.notes.map((note, i) => (
                          <li key={i} className="text-xs text-blue-700 flex items-start gap-1">
                            <span className="mt-0.5">•</span> {note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'facility':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Main Facility</h2>
              <p className="mt-1 text-gray-600">Set up your primary facility. You can add more branches later.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Facility Name *</label>
                <input
                  type="text"
                  value={formData.facility.name}
                  onChange={(e) => updateFormData('facility', 'name', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['facility.name'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="e.g., Main Hospital"
                />
                {errors['facility.name'] && <p className="mt-1 text-sm text-red-500">{errors['facility.name']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Facility Type</label>
                <select
                  value={formData.facility.type}
                  onChange={(e) => updateFormData('facility', 'type', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                >
                  {facilityTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location/Address</label>
                <input
                  type="text"
                  value={formData.facility.location || ''}
                  onChange={(e) => updateFormData('facility', 'location', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., Plot 123, Kampala Road"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={formData.facility.phone || ''}
                    onChange={(e) => updateFormData('facility', 'phone', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="+256-700-123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.facility.email || ''}
                    onChange={(e) => updateFormData('facility', 'email', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="info@hospital.com"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Administrator Account</h2>
              <p className="mt-1 text-gray-600">Create the admin user for this organization.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={formData.admin.fullName}
                  onChange={(e) => updateFormData('admin', 'fullName', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['admin.fullName'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="e.g., Dr. John Smith"
                />
                {errors['admin.fullName'] && <p className="mt-1 text-sm text-red-500">{errors['admin.fullName']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  value={formData.admin.email}
                  onChange={(e) => updateFormData('admin', 'email', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['admin.email'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="admin@hospital.com"
                />
                {errors['admin.email'] && <p className="mt-1 text-sm text-red-500">{errors['admin.email']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username *</label>
                <input
                  type="text"
                  value={formData.admin.username}
                  onChange={(e) => updateFormData('admin', 'username', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['admin.username'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="admin"
                />
                {errors['admin.username'] && <p className="mt-1 text-sm text-red-500">{errors['admin.username']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password *</label>
                <input
                  type="password"
                  value={formData.admin.password}
                  onChange={(e) => updateFormData('admin', 'password', e.target.value)}
                  className={`mt-1 block w-full rounded-lg border ${errors['admin.password'] ? 'border-red-500' : 'border-gray-300'} px-4 py-3 focus:border-blue-500 focus:ring-blue-500`}
                  placeholder="Minimum 8 characters"
                />
                {errors['admin.password'] && <p className="mt-1 text-sm text-red-500">{errors['admin.password']}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone (Optional)</label>
                <input
                  type="tel"
                  value={formData.admin.phone || ''}
                  onChange={(e) => updateFormData('admin', 'phone', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="+256-700-123456"
                />
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
              <p className="mt-1 text-gray-600">Configure your system preferences and enabled modules.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={formData.settings?.currency}
                  onChange={(e) => updateFormData('settings', 'currency', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                >
                  {currencies.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date Format</label>
                <select
                  value={formData.settings?.dateFormat}
                  onChange={(e) => updateFormData('settings', 'dateFormat', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">How is your facility organised?</label>
                <p className="text-xs text-gray-500 mb-3">
                  Choose Simple if your team shares one queue and doctors rotate across all patients (most clinics, mid-size hospitals, mission hospitals). Choose Departmental if you have dedicated teams per specialty with separate queues, doctors, and reports (large hospitals).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${formData.settings?.workflowMode === 'simple' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="workflowMode"
                      value="simple"
                      checked={formData.settings?.workflowMode === 'simple'}
                      onChange={() => updateFormData('settings', 'workflowMode', 'simple')}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Simple workflow</div>
                      <div className="text-xs text-gray-600 mt-1">One shared queue, one duty roster, facility-wide reports. Recommended for most facilities.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${formData.settings?.workflowMode === 'departmental' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="workflowMode"
                      value="departmental"
                      checked={formData.settings?.workflowMode === 'departmental'}
                      onChange={() => updateFormData('settings', 'workflowMode', 'departmental')}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Departmental workflow</div>
                      <div className="text-xs text-gray-600 mt-1">Separate queues, doctors and reports per department (Pediatrics, Maternity, Surgery, etc.).</div>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">You can change this later under Settings → Facility.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Enabled Modules</label>
                <div className="grid grid-cols-2 gap-3">
                  {modules.map(module => (
                    <label key={module.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.settings?.enabledModules?.includes(module.id)}
                        onChange={() => toggleModule(module.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{module.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review & Register</h2>
              <p className="mt-1 text-gray-600">Review your details before registering the organization.</p>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Organization
                </h3>
                <p className="mt-1 text-gray-700">{formData.organization.name}</p>
                <p className="text-sm text-gray-500">{formData.organization.type} • {formData.organization.country}</p>
                <p className="text-sm text-blue-600 font-mono mt-1">Login URL: /login/{formData.organization.slug}</p>
              </div>
              {formData.plan?.code && (() => {
                const selected = plans.find((p) => p.code === formData.plan?.code);
                if (!selected) return null;
                const iv = formData.plan?.billingInterval || 'monthly';
                const priceMinor = iv === 'annual' ? selected.priceAnnualMinor : selected.priceMonthlyMinor;
                const priceLabel = priceMinor === 0
                  ? 'Free'
                  : `${new Intl.NumberFormat('en-US').format(Math.round(priceMinor / 100))} ${selected.currency} / ${iv === 'annual' ? 'yr' : 'mo'}`;
                return (
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Plan
                    </h3>
                    <p className="mt-1 text-emerald-900 font-medium">{selected.name} · {priceLabel}</p>
                    {selected.trialDays > 0 && (
                      <p className="text-sm text-emerald-700">{selected.trialDays}-day free trial — no charge until trial ends.</p>
                    )}
                  </div>
                );
              })()}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <Monitor className="w-4 h-4" /> Deployment Mode
                </h3>
                <p className="mt-1 text-blue-800 font-medium">
                  {selectedPreset?.name || (BUILTIN_PRESETS.find(p => p.mode === formData.settings?.facilityMode)?.name) || formData.settings?.facilityMode}
                </p>
                <p className="text-sm text-blue-600">
                  {selectedPreset?.singleUserMode ? 'Single-user mode' : selectedPreset?.supportsMultiSite ? 'Multi-site support' : 'Single site'} •{' '}
                  {formData.settings?.enabledModules?.length} modules enabled
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Hospital className="w-4 h-4" /> Main Facility
                </h3>
                <p className="mt-1 text-gray-700">{formData.facility.name}</p>
                <p className="text-sm text-gray-500">{formData.facility.type} • {formData.facility.location || 'No address'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" /> Administrator
                </h3>
                <p className="mt-1 text-gray-700">{formData.admin.fullName}</p>
                <p className="text-sm text-gray-500">@{formData.admin.username} • {formData.admin.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Settings
                </h3>
                <p className="mt-1 text-sm text-gray-700">Currency: {formData.settings?.currency}</p>
                <p className="text-sm text-gray-700">Modules: {formData.settings?.enabledModules?.length} enabled</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      {registrationAllowed === false && (
        <div className="max-w-3xl mx-auto bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-6 text-center">
          Self-service registration is currently disabled. Contact your platform administrator.
        </div>
      )}
      <div className="max-w-3xl mx-auto" style={{ pointerEvents: registrationAllowed === false ? 'none' : 'auto', opacity: registrationAllowed === false ? 0.5 : 1 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <Logo size="lg" variant="full" />
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Register Organization</h1>
          <p className="mt-2 text-gray-600">Set up a new organization on Glide HIMS.</p>
          <Link
            to="/login"
            className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <LogIn className="w-4 h-4" /> Back to Sign In
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index < currentStepIndex ? 'bg-green-500 text-white' :
                  index === currentStepIndex ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {index < currentStepIndex ? <CheckCircle className="w-5 h-5" /> : step.icon}
                </div>
                <span className={`mt-2 text-xs font-medium ${
                  index <= currentStepIndex ? 'text-blue-600' : 'text-gray-500'
                }`}>{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {renderStepContent()}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {currentStep === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Registering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Register Organization
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
