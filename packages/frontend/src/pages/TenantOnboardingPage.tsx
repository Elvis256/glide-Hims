import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Monitor,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Stethoscope,
  Bed,
  MapPin,
  Building,
  Package,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuthStore } from '../store/auth';
import api from '../services/api';

type Step = 'preset' | 'modules' | 'settings' | 'complete';

const steps: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'preset', title: 'Facility Type', icon: <Monitor className="w-5 h-5" /> },
  { id: 'modules', title: 'Modules', icon: <Package className="w-5 h-5" /> },
  { id: 'settings', title: 'Settings', icon: <Settings className="w-5 h-5" /> },
  { id: 'complete', title: 'Complete', icon: <CheckCircle className="w-5 h-5" /> },
];

interface Preset {
  mode: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabledModules: string[];
  notes: string[];
}

const presets: Preset[] = [
  {
    mode: 'single_user',
    name: 'Single-User Clinic',
    description: 'One person handles everything — registration, consultation, billing, and dispensing.',
    icon: <Monitor className="w-8 h-8" />,
    enabledModules: ['patients', 'encounters', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports'],
    notes: ['Ideal for small private clinics', 'All core modules enabled'],
  },
  {
    mode: 'clinic_opd',
    name: 'Clinic — Outpatient Only',
    description: 'A clinic with outpatient services only. No ward admissions.',
    icon: <Stethoscope className="w-8 h-8" />,
    enabledModules: ['patients', 'encounters', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments'],
    notes: ['OPD consultations, triage, vitals', 'No inpatient or theatre'],
  },
  {
    mode: 'clinic_full',
    name: 'Clinic — Inpatient & Outpatient',
    description: 'Handles both outpatient visits and inpatient admissions with wards.',
    icon: <Bed className="w-8 h-8" />,
    enabledModules: ['patients', 'encounters', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments', 'ipd'],
    notes: ['Ward admissions and discharges', 'Theatre and maternity can be added later'],
  },
  {
    mode: 'multisite_opd',
    name: 'Multi-Site Network',
    description: 'Multiple locations under one organisation with centralised reporting.',
    icon: <MapPin className="w-8 h-8" />,
    enabledModules: ['patients', 'encounters', 'lab', 'pharmacy', 'billing', 'inventory', 'insurance', 'reports', 'appointments'],
    notes: ['Add branches later via Facilities', 'Centralised dashboard across all sites'],
  },
  {
    mode: 'hospital',
    name: 'Full Hospital',
    description: 'Complete hospital: OPD, IPD, Emergency, Theatre, Maternity, HR, Finance.',
    icon: <Building className="w-8 h-8" />,
    enabledModules: ['patients', 'encounters', 'lab', 'pharmacy', 'radiology', 'billing', 'inventory', 'insurance', 'reports', 'appointments', 'ipd', 'emergency', 'theatre', 'maternity', 'hr', 'finance'],
    notes: ['All modules enabled', 'Supports multiple wards and departments'],
  },
];

const allModules = [
  { id: 'patients', label: 'Patient Management', core: true },
  { id: 'encounters', label: 'Encounters / Visits', core: true },
  { id: 'lab', label: 'Laboratory', core: false },
  { id: 'pharmacy', label: 'Pharmacy', core: false },
  { id: 'radiology', label: 'Radiology', core: false },
  { id: 'billing', label: 'Billing', core: false },
  { id: 'inventory', label: 'Inventory', core: false },
  { id: 'insurance', label: 'Insurance Claims', core: false },
  { id: 'reports', label: 'Reports & Analytics', core: true },
  { id: 'appointments', label: 'Appointments & Queue', core: false },
  { id: 'ipd', label: 'Inpatient (IPD)', core: false },
  { id: 'emergency', label: 'Emergency', core: false },
  { id: 'theatre', label: 'Theatre / Surgery', core: false },
  { id: 'maternity', label: 'Maternity', core: false },
  { id: 'hr', label: 'HR & Payroll', core: false },
  { id: 'finance', label: 'Finance & Accounting', core: false },
];

const currencies = [
  { value: 'UGX', label: 'Ugandan Shilling (UGX)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'KES', label: 'Kenyan Shilling (KES)' },
  { value: 'TZS', label: 'Tanzanian Shilling (TZS)' },
  { value: 'RWF', label: 'Rwandan Franc (RWF)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

const timezones = [
  { value: 'Africa/Kampala', label: 'East Africa (Kampala)' },
  { value: 'Africa/Nairobi', label: 'East Africa (Nairobi)' },
  { value: 'Africa/Dar_es_Salaam', label: 'East Africa (Dar es Salaam)' },
  { value: 'Africa/Kigali', label: 'Central Africa (Kigali)' },
  { value: 'Africa/Lagos', label: 'West Africa (Lagos)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'America/New_York', label: 'Eastern (New York)' },
];

export default function TenantOnboardingPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [currentStep, setCurrentStep] = useState<Step>('preset');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [currency, setCurrency] = useState('UGX');
  const [timezone, setTimezone] = useState('Africa/Kampala');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const goNext = () => {
    if (currentStep === 'preset' && !selectedPreset) {
      toast.error('Please select a facility type');
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const selectPreset = (preset: Preset) => {
    setSelectedPreset(preset);
    setEnabledModules([...preset.enabledModules]);
  };

  const toggleModule = (moduleId: string) => {
    const mod = allModules.find(m => m.id === moduleId);
    if (mod?.core) return; // Can't disable core modules
    setEnabledModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await api.post('/tenants/me/complete-setup', {
        preset: selectedPreset?.mode,
        enabledModules,
        currency,
        timezone,
        dateFormat,
      });
      // Update the user's facility to mark setupCompleted
      if (user?.facility) {
        setUser({ ...user, facility: { ...user.facility, setupCompleted: true } });
      }
      toast.success('Your facility has been configured! Welcome to Glide HIMS.');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" variant="full" />
          <h2 className="text-xl font-semibold text-gray-800 mt-3">
            Welcome, {user?.fullName || 'Admin'}! 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Let's configure your facility. This takes less than a minute.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  index === currentStepIndex
                    ? 'bg-blue-100 text-blue-700'
                    : index < currentStepIndex
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step.icon}
                <span className="hidden sm:inline">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${index < currentStepIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Preset Selection */}
        {currentStep === 'preset' && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">What type of facility are you?</h3>
            <p className="text-sm text-gray-500 mb-4">Choose the option that best describes your setup. You can customize modules in the next step.</p>
            <div className="space-y-3">
              {presets.map(preset => (
                <button
                  key={preset.mode}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPreset?.mode === preset.mode
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedPreset?.mode === preset.mode ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                      {preset.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{preset.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{preset.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {preset.notes.map((note, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{note}</span>
                        ))}
                      </div>
                    </div>
                    {selectedPreset?.mode === preset.mode && (
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Module Configuration */}
        {currentStep === 'modules' && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Configure Modules</h3>
            <p className="text-sm text-gray-500 mb-4">
              Based on "{selectedPreset?.name}", these modules are pre-selected. Toggle any you'd like to add or remove.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {allModules.map(mod => {
                const isEnabled = enabledModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    disabled={mod.core}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      isEnabled
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    } ${mod.core ? 'opacity-75 cursor-not-allowed' : 'hover:border-blue-300'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isEnabled ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {isEnabled && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{mod.label}</span>
                      {mod.core && <span className="text-xs text-gray-400 ml-2">(required)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Settings */}
        {currentStep === 'settings' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Regional Settings</h3>
            <p className="text-sm text-gray-500 mb-4">Configure currency, timezone, and date format for your facility.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="input">
                {currencies.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input">
                {timezones.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
              <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="input">
                <option value="DD/MM/YYYY">DD/MM/YYYY (27/02/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (02/27/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-27)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 'complete' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Review & Complete</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Facility Type</p>
                <p className="text-sm font-medium">{selectedPreset?.name}</p>
              </div>
              <hr />
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Enabled Modules ({enabledModules.length})</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {enabledModules.map(m => {
                    const mod = allModules.find(am => am.id === m);
                    return (
                      <span key={m} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {mod?.label || m}
                      </span>
                    );
                  })}
                </div>
              </div>
              <hr />
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Regional Settings</p>
                <p className="text-sm text-gray-700">
                  {currencies.find(c => c.value === currency)?.label} • {timezones.find(t => t.value === timezone)?.label} • {dateFormat}
                </p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">
                You can change these settings later from the Admin panel. Click "Complete Setup" to start using the system.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {currentStepIndex > 0 && (
              <button type="button" onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div>
            {currentStep === 'complete' ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Complete Setup</>
                )}
              </button>
            ) : (
              <button type="button" onClick={goNext} className="btn-primary flex items-center gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
