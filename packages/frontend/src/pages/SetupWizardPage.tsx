import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { setupService, type InitializeSetupData } from '../services/setup';

type Step = 'organization' | 'facility' | 'admin' | 'settings' | 'review';

const steps: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'organization', title: 'Organization', icon: <Building2 className="w-5 h-5" /> },
  { id: 'facility', title: 'Facility', icon: <Hospital className="w-5 h-5" /> },
  { id: 'admin', title: 'Admin User', icon: <User className="w-5 h-5" /> },
  { id: 'settings', title: 'Settings', icon: <Settings className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <CheckCircle className="w-5 h-5" /> },
];

const facilityTypes = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
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
  { id: 'patients', label: 'Patient Management', default: true },
  { id: 'encounters', label: 'Encounters/Visits', default: true },
  { id: 'lab', label: 'Laboratory', default: true },
  { id: 'pharmacy', label: 'Pharmacy', default: true },
  { id: 'radiology', label: 'Radiology', default: false },
  { id: 'billing', label: 'Billing', default: true },
  { id: 'inventory', label: 'Inventory', default: true },
  { id: 'hr', label: 'HR & Payroll', default: false },
  { id: 'insurance', label: 'Insurance Claims', default: false },
];

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('organization');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<InitializeSetupData>({
    organization: { name: '', type: 'hospital', country: 'Uganda' },
    facility: { name: '', type: 'hospital' },
    admin: { fullName: '', email: '', username: '', password: '' },
    settings: {
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      dateFormat: 'DD/MM/YYYY',
      enabledModules: modules.filter(m => m.default).map(m => m.id),
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const updateFormData = (section: keyof InitializeSetupData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
    setErrors(prev => ({ ...prev, [`${section}.${field}`]: '' }));
  };

  const toggleModule = (moduleId: string) => {
    const current = formData.settings?.enabledModules || [];
    const updated = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId];
    updateFormData('settings', 'enabledModules', updated);
  };

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 'organization':
        if (!formData.organization.name.trim()) {
          newErrors['organization.name'] = 'Organization name is required';
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
      await setupService.initialize(formData);
      toast.success('System setup completed successfully!');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
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
              <p className="mt-1 text-gray-600">Create the first admin user who will have full system access.</p>
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
              <h2 className="text-2xl font-bold text-gray-900">Review & Complete</h2>
              <p className="mt-1 text-gray-600">Review your settings before completing the setup.</p>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Organization
                </h3>
                <p className="mt-1 text-gray-700">{formData.organization.name}</p>
                <p className="text-sm text-gray-500">{formData.organization.type} • {formData.organization.country}</p>
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Glide HIMS Setup</h1>
          <p className="mt-2 text-gray-600">Welcome! Let's set up your hospital management system.</p>
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
                {index < steps.length - 1 && (
                  <div className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`} style={{ transform: 'translateX(50%)' }} />
                )}
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
                    <Loader2 className="w-4 h-4 animate-spin" /> Setting up...
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
