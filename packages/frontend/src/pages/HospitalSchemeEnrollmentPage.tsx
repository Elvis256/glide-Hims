import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Shield,
  Fingerprint,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Building2,
  Phone,
  Mail,
  Calendar,
  User,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { patientsService } from '../services/patients';
import { usersService } from '../services/users';
import { biometricsService } from '../services/biometrics';
import FingerprintScanner from '../components/FingerprintScanner';

type EnrollmentStep = 'search-patient' | 'create-account' | 'register-fingerprint' | 'complete';

export default function HospitalSchemeEnrollmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prefilledMRN = searchParams.get('mrn');

  const [step, setStep] = useState<EnrollmentStep>('search-patient');
  const [searchMRN, setSearchMRN] = useState(prefilledMRN || '');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [accountData, setAccountData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    phone: '',
  });
  const [createdUserId, setCreatedUserId] = useState<string>('');
  const [biometricMode, setBiometricMode] = useState<'register' | 'verify'>('register');

  // Search patient by MRN
  const searchPatient = useMutation({
    mutationFn: async (mrn: string) => {
      return patientsService.getByMRN(mrn);
    },
    onSuccess: (patient) => {
      // Check if already has user account
      if (patient.userId) {
        // Patient already has account, skip to fingerprint registration
        setSelectedPatient(patient);
        setCreatedUserId(patient.userId);
        setStep('register-fingerprint');
        toast.info('Patient account found. Proceeding to fingerprint registration.');
        return;
      }
      setSelectedPatient(patient);
      // Pre-fill account data
      setAccountData({
        ...accountData,
        username: patient.mrn.toLowerCase(),
        email: patient.email || '',
        phone: patient.phone || '',
      });
      setStep('create-account');
    },
    onError: () => {
      toast.error('Patient not found. Please check the MRN.');
    },
  });

  // Create user account
  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof accountData) => {
      return usersService.create({
        username: data.username,
        password: data.password,
        fullName: selectedPatient.fullName,
        email: data.email,
        phone: data.phone,
      });
    },
    onSuccess: (response) => {
      setCreatedUserId(response.id);
      setStep('register-fingerprint');
      toast.success('User account created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create account');
    },
  });

  // Link user to patient
  const linkUserMutation = useMutation({
    mutationFn: async () => {
      return patientsService.linkUser(selectedPatient.id, createdUserId);
    },
    onSuccess: () => {
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['patient', selectedPatient.id] });
      toast.success('Enrollment complete!');
    },
  });

  const handleSearchPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchMRN.trim()) {
      toast.error('Please enter an MRN');
      return;
    }
    searchPatient.mutate(searchMRN.trim());
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (accountData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (accountData.password !== accountData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    createAccountMutation.mutate(accountData);
  };

  const handleBiometricSuccess = () => {
    toast.success('Fingerprint registered successfully');
    // Link user to patient
    linkUserMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hospital Insurance Scheme Enrollment</h1>
          <p className="text-gray-600">Enroll patients in the hospital's insurance scheme with biometric verification</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-8">
          {[
            { key: 'search-patient', label: 'Find Patient', icon: User },
            { key: 'create-account', label: 'Create Account', icon: UserPlus },
            { key: 'register-fingerprint', label: 'Register Fingerprint', icon: Fingerprint },
            { key: 'complete', label: 'Complete', icon: CheckCircle },
          ].map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.key;
            const isPast = ['search-patient', 'create-account', 'register-fingerprint', 'complete'].indexOf(step) > idx;
            
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 ${isActive ? 'text-primary-600' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-primary-100' : isPast ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {isPast ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className="text-sm font-medium hidden md:block">{s.label}</span>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-1 mx-4 ${isPast ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Search Patient */}
        {step === 'search-patient' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">About Hospital Insurance Scheme</h3>
                  <p className="text-sm text-blue-700">
                    Patients enrolled in this scheme get medical coverage with biometric verification for identity confirmation.
                    Enrollment requires creating a user account and registering fingerprints.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSearchPatient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient MRN (Medical Record Number)
                </label>
                <input
                  type="text"
                  value={searchMRN}
                  onChange={(e) => setSearchMRN(e.target.value)}
                  placeholder="Enter MRN (e.g., MRN26000001)"
                  className="input"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  The patient must be already registered in the system
                </p>
              </div>

              <button
                type="submit"
                disabled={searchPatient.isPending}
                className="btn-primary w-full"
              >
                {searchPatient.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Find Patient
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Create Account */}
        {step === 'create-account' && selectedPatient && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-2">Patient Found</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                <div>Name: {selectedPatient.fullName}</div>
                <div>MRN: {selectedPatient.mrn}</div>
                <div>DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</div>
                <div>Gender: {selectedPatient.gender}</div>
              </div>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <h3 className="font-medium text-gray-900">Create User Account</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={accountData.username}
                  onChange={(e) => setAccountData({ ...accountData, username: e.target.value })}
                  className="input"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: MRN in lowercase. Patient will use this to login.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={accountData.password}
                      onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                      className="input pr-10"
                      required
                      minLength={8}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accountData.confirmPassword}
                    onChange={(e) => setAccountData({ ...accountData, confirmPassword: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={accountData.email}
                  onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={accountData.phone}
                  onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('search-patient')}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createAccountMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Register Fingerprint */}
        {step === 'register-fingerprint' && createdUserId && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Register Fingerprint</h3>
                  <p className="text-sm text-blue-700">
                    Register at least one fingerprint for {selectedPatient?.fullName}.
                    This will be used to verify identity when using the hospital scheme.
                  </p>
                </div>
              </div>
            </div>

            <FingerprintScanner
              userId={createdUserId}
              mode="register"
              onSuccess={handleBiometricSuccess}
              onCancel={() => setStep('create-account')}
            />
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Enrollment Complete!</h2>
            <p className="text-gray-600">
              {selectedPatient?.fullName} has been successfully enrolled in the Hospital Insurance Scheme.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md mx-auto">
              <div className="space-y-2 text-sm text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient:</span>
                  <span className="font-medium">{selectedPatient?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MRN:</span>
                  <span className="font-medium">{selectedPatient?.mrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Username:</span>
                  <span className="font-medium">{accountData.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">✓ Enrolled</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => {
                  setStep('search-patient');
                  setSearchMRN('');
                  setSelectedPatient(null);
                  setAccountData({
                    username: '',
                    password: '',
                    confirmPassword: '',
                    email: '',
                    phone: '',
                  });
                  setCreatedUserId('');
                }}
                className="btn-secondary"
              >
                Enroll Another Patient
              </button>
              <button
                onClick={() => navigate(`/patients/${selectedPatient.id}`)}
                className="btn-primary"
              >
                View Patient Record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
