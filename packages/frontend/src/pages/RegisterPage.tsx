import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Building2,
  Hospital,
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import Logo from '../components/Logo';
import api from '../services/api';

type Step = 'organization' | 'facility' | 'admin' | 'review';

const steps: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'organization', title: 'Organization', icon: <Building2 className="w-5 h-5" /> },
  { id: 'facility', title: 'Facility', icon: <Hospital className="w-5 h-5" /> },
  { id: 'admin', title: 'Admin Account', icon: <User className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <CheckCircle className="w-5 h-5" /> },
];

const facilityTypes = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'health_center', label: 'Health Center' },
];

const registrationSchema = z.object({
  tenantName: z.string().min(2, 'Organization name is required'),
  tenantDescription: z.string().optional(),
  facilityName: z.string().min(2, 'Facility name is required'),
  facilityType: z.string().min(1, 'Select a facility type'),
  facilityLocation: z.string().optional(),
  adminFullName: z.string().min(2, 'Full name is required'),
  adminEmail: z.string().email('Valid email is required'),
  adminUsername: z.string().min(3, 'Username must be at least 3 characters'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.adminPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('organization');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      facilityType: 'hospital',
    },
  });

  const formData = watch();
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const validateCurrentStep = async (): Promise<boolean> => {
    switch (currentStep) {
      case 'organization':
        return trigger(['tenantName']);
      case 'facility':
        return trigger(['facilityName', 'facilityType']);
      case 'admin':
        return trigger(['adminFullName', 'adminEmail', 'adminUsername', 'adminPassword', 'confirmPassword']);
      default:
        return true;
    }
  };

  const goNext = async () => {
    const valid = await validateCurrentStep();
    if (!valid) return;
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

  const onSubmit = async (data: RegistrationForm) => {
    setIsSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...payload } = data;
      await api.post('/tenants/register', payload);
      toast.success('Registration successful! You can now log in with your admin credentials.');
      navigate('/login?registered=true');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" variant="full" />
          <h2 className="text-xl font-semibold text-gray-800 mt-2">Register Your Hospital</h2>
          <p className="text-sm text-gray-500">Set up your organization in a few simple steps</p>
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

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Organization */}
          {currentStep === 'organization' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Organization Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name *
                </label>
                <input
                  {...register('tenantName')}
                  className="input"
                  placeholder="e.g. Kitintale Medical Center"
                />
                {errors.tenantName && <p className="text-red-500 text-sm mt-1">{errors.tenantName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  {...register('tenantDescription')}
                  className="input"
                  rows={3}
                  placeholder="Brief description of your organization"
                />
              </div>
            </div>
          )}

          {/* Step 2: Facility */}
          {currentStep === 'facility' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Primary Facility</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility Name *
                </label>
                <input
                  {...register('facilityName')}
                  className="input"
                  placeholder="e.g. Kitintale Hospital"
                />
                {errors.facilityName && <p className="text-red-500 text-sm mt-1">{errors.facilityName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility Type *
                </label>
                <select {...register('facilityType')} className="input">
                  {facilityTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.facilityType && <p className="text-red-500 text-sm mt-1">{errors.facilityType.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location (optional)
                </label>
                <input
                  {...register('facilityLocation')}
                  className="input"
                  placeholder="e.g. Kitintale, Kampala"
                />
              </div>
            </div>
          )}

          {/* Step 3: Admin Account */}
          {currentStep === 'admin' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Admin Account</h3>
              <p className="text-sm text-gray-500 mb-2">This will be the Tenant Admin who manages your organization.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input {...register('adminFullName')} className="input" placeholder="e.g. John Doe" />
                {errors.adminFullName && <p className="text-red-500 text-sm mt-1">{errors.adminFullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input {...register('adminEmail')} type="email" className="input" placeholder="e.g. admin@kitintale.com" />
                {errors.adminEmail && <p className="text-red-500 text-sm mt-1">{errors.adminEmail.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input {...register('adminUsername')} className="input" placeholder="e.g. kitintale_admin" />
                {errors.adminUsername && <p className="text-red-500 text-sm mt-1">{errors.adminUsername.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    {...register('adminPassword')}
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.adminPassword && <p className="text-red-500 text-sm mt-1">{errors.adminPassword.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Re-enter your password"
                />
                {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Review & Confirm</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Organization</p>
                  <p className="text-sm font-medium">{formData.tenantName}</p>
                  {formData.tenantDescription && <p className="text-sm text-gray-500">{formData.tenantDescription}</p>}
                </div>
                <hr />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Facility</p>
                  <p className="text-sm font-medium">{formData.facilityName}</p>
                  <p className="text-sm text-gray-500">
                    {facilityTypes.find(t => t.value === formData.facilityType)?.label}
                    {formData.facilityLocation ? ` • ${formData.facilityLocation}` : ''}
                  </p>
                </div>
                <hr />
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Admin Account</p>
                  <p className="text-sm font-medium">{formData.adminFullName}</p>
                  <p className="text-sm text-gray-500">{formData.adminEmail} • @{formData.adminUsername}</p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Default departments (General Medicine, Emergency, Pharmacy, Laboratory, Radiology, Reception)
                  will be created automatically. You can manage them after logging in.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <div>
              {currentStepIndex > 0 ? (
                <button type="button" onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">
                  ← Back to Login
                </Link>
              )}
            </div>
            <div>
              {currentStep === 'review' ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Complete Registration</>
                  )}
                </button>
              ) : (
                <button type="button" onClick={goNext} className="btn-primary flex items-center gap-2">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
