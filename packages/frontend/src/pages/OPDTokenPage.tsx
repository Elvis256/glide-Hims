import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { usePatientStore, type PatientRecord } from '../store/patients';
import { queueService, type QueueEntry, type CreateQueueEntryDto } from '../services/queue';
import { patientsService } from '../services/patients';
import { doctorDutyService, type DoctorWithDutyStatus } from '../services/doctor-duty';
import { biometricsService, type StaffCoverage } from '../services/biometrics';
import FingerprintScanner from '../components/FingerprintScanner';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  UserCircle,
  Receipt,
  Printer,
  CheckCircle,
  Clock,
  Calendar,
  Stethoscope,
  Users,
  Shield,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  UserCheck,
  BadgeCheck,
  AlertCircle,
  X,
  Fingerprint,
} from 'lucide-react';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  department: string;
  available: boolean;
  currentQueue: number;
  roomNumber?: string;
}

// Enhanced payment types
type PaymentType = 'cash' | 'mobile_money' | 'card' | 'membership' | 'insurance' | 'hospital_scheme' | 'staff';

export default function OPDTokenPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
  const localSearchPatients = usePatientStore((state) => state.searchPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('general');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('any'); // 'any' or doctor id
  const [issuedToken, setIssuedToken] = useState<QueueEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Enhanced payment type selection
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'mtn' | 'airtel'>('mtn');
  const [cardType, setCardType] = useState<'visa' | 'mastercard'>('visa');
  const [insurance, setInsurance] = useState({ provider: '', policyNumber: '', expiryDate: '' });
  const [membership, setMembership] = useState({ cardNumber: '', balance: 0 });
  const [staffId, setStaffId] = useState('');
  
  // Biometric verification state
  const [showFingerprintScanner, setShowFingerprintScanner] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricMode, setBiometricMode] = useState<'register' | 'verify'>('verify');
  const [staffCoverage, setStaffCoverage] = useState<StaffCoverage | null>(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  const CONSULTATION_FEE = 50000; // UGX - TODO: Fetch from services API

  // Search patients from API with fallback to local store
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Combine API results with local store
  const localPatients = localSearchPatients(searchTerm);
  const patients = searchTerm.length >= 2 
    ? [...(apiPatients?.data || []).map(p => ({
        ...p,
        paymentType: 'cash' as const,
      })), ...localPatients.filter(lp => !apiPatients?.data?.some(ap => ap.id === lp.id))]
    : localPatients;

  // Load patient from URL param (when coming from patient profile)
  useEffect(() => {
    if (urlPatientId && !selectedPatient) {
      patientsService.getById(urlPatientId).then(patient => {
        if (patient) {
          setSelectedPatient({
            ...patient,
            paymentType: 'cash' as const,
          });
        }
      }).catch(err => {
        console.error('Failed to load patient:', err);
      });
    }
  }, [urlPatientId, selectedPatient]);

  // Fetch queue statistics
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => queueService.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch today's queue
  const { data: todayQueue } = useQuery({
    queryKey: ['queue-today'],
    queryFn: () => queueService.getQueue({ date: new Date().toISOString().split('T')[0] }),
    refetchInterval: 30000,
  });

  // Fetch doctors on duty (from doctor-duty service)
  const { data: doctorsOnDuty, isLoading: doctorsLoading } = useQuery({
    queryKey: ['doctors-on-duty'],
    queryFn: () => doctorDutyService.getDoctorsWithStatus(),
    refetchInterval: 30000,
  });

  // Map doctors on duty to Doctor interface
  const availableDoctors: Doctor[] = useMemo(() => {
    if (!doctorsOnDuty) return [];
    return doctorsOnDuty
      .filter((d: DoctorWithDutyStatus) => d.status !== 'off_duty')
      .map((d: DoctorWithDutyStatus) => ({
        id: d.id,
        name: d.fullName,
        specialization: d.roles?.join(', ') || 'General Medicine',
        department: selectedDepartment,
        available: d.status === 'on_duty' || d.status === 'in_consultation',
        currentQueue: d.currentQueueCount,
        roomNumber: d.roomNumber,
      }));
  }, [doctorsOnDuty, selectedDepartment]);

  // Issue token mutation using real API
  const issueTokenMutation = useMutation({
    mutationFn: async (data: CreateQueueEntryDto) => {
      return queueService.addToQueue(data);
    },
    onSuccess: (token) => {
      setIssuedToken(token);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['queue-today'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: Error & { response?: { data?: { message?: string | string[]; error?: string; statusCode?: number } } }) => {
      console.error('Queue error:', err.response?.data || err.message);
      const data = err.response?.data;
      let errorMessage = 'Failed to issue token. Please try again.';
      
      if (data?.message) {
        errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Handle specific error cases
      if (data?.statusCode === 401 || err.message?.includes('401')) {
        errorMessage = 'Session expired. Please login again.';
      }
      
      setError(errorMessage);
    },
  });

  // Cancel/remove from queue mutation
  const cancelQueueMutation = useMutation({
    mutationFn: async (id: string) => {
      return queueService.cancel(id, 'Removed by reception');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-today'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const handleRemoveFromQueue = (id: string, patientName: string) => {
    if (confirm(`Remove ${patientName} from queue?`)) {
      cancelQueueMutation.mutate(id);
    }
  };

  const handleIssueToken = () => {
    if (selectedPatient) {
      // Check if biometric verification is required
      if ((paymentType === 'hospital_scheme' || paymentType === 'staff') && !biometricVerified) {
        toast.error('Biometric verification required for scheme/staff payments');
        return;
      }
      
      setError(null); // Clear any previous error
      // Map UI department to backend service point
      const servicePointMap: Record<string, 'consultation' | 'triage' | 'vitals' | 'laboratory' | 'radiology' | 'pharmacy'> = {
        general: 'consultation',
        consultation: 'consultation',
        pediatrics: 'consultation',
        gynecology: 'consultation',
        orthopedics: 'consultation',
        dental: 'consultation',
        ent: 'consultation',
        ophthalmology: 'consultation',
        dermatology: 'consultation',
        cardiology: 'consultation',
        triage: 'triage',
        vitals: 'vitals',
      };
      
      const queueData: CreateQueueEntryDto = {
        patientId: selectedPatient.id,
        servicePoint: servicePointMap[selectedDepartment] || 'consultation',
        priority: 3, // Normal priority (1=highest, 10=lowest)
        notes: selectedDoctor !== 'any' 
          ? `Preferred doctor: ${availableDoctors.find(d => d.id === selectedDoctor)?.name || 'Assigned doctor'}`
          : undefined,
        assignedDoctorId: selectedDoctor !== 'any' ? selectedDoctor : undefined,
      };
      issueTokenMutation.mutate(queueData);
    }
  };
  
  // Handle biometric verification for scheme/staff payments
  const handleStartBiometricVerification = async () => {
    if (!selectedPatient?.userId) {
      toast.error('This patient does not have a linked user account');
      return;
    }
    
    setCheckingCoverage(true);
    try {
      // Check if user has enrolled fingerprints
      const enrollment = await biometricsService.checkEnrollment(selectedPatient.userId);
      
      if (enrollment.enrolled) {
        setBiometricMode('verify');
      } else {
        setBiometricMode('register');
        toast.info('No fingerprints registered. Please register first.');
      }
      
      // For staff payment, also check coverage
      if (paymentType === 'staff') {
        const coverage = await biometricsService.checkStaffCoverage(selectedPatient.userId);
        setStaffCoverage(coverage);
        
        if (!coverage.hasEmployee) {
          toast.error('This user is not linked to an employee record');
          setCheckingCoverage(false);
          return;
        }
        
        if (!coverage.coverage?.enabled) {
          toast.error('Staff insurance coverage is not enabled for this employee');
          setCheckingCoverage(false);
          return;
        }
        
        if (coverage.coverage?.expired) {
          toast.error('Staff insurance coverage has expired');
          setCheckingCoverage(false);
          return;
        }
      }
      
      setShowFingerprintScanner(true);
    } catch (err) {
      toast.error('Failed to check enrollment status');
    } finally {
      setCheckingCoverage(false);
    }
  };
  
  const handleBiometricSuccess = () => {
    setBiometricVerified(true);
    setShowFingerprintScanner(false);
    toast.success('Identity verified successfully');
  };

  const handlePrintToken = () => {
    window.print();
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setSelectedDoctor('any');
    setIssuedToken(null);
    setPaymentType('cash');
    setInsurance({ provider: '', policyNumber: '', expiryDate: '' });
    setMembership({ cardNumber: '', balance: 0 });
    setStaffId('');
    setBiometricVerified(false);
    setStaffCoverage(null);
  };

  // Success screen after token issued
  if (issuedToken && selectedPatient) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Screen View */}
        <div className="card text-center py-6 print:hidden">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Token Issued!</h2>
          
          {/* Queue Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            Patient is now in queue
          </div>
          
          <div className="bg-blue-50 rounded-lg p-6 my-4">
            <p className="text-sm text-gray-600 mb-1">Token Number</p>
            <p className="text-4xl font-mono font-bold text-blue-700 mb-4">
              {issuedToken.ticketNumber}
            </p>
            
            <div className="border-t border-blue-200 pt-4 mt-4">
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                <UserCircle className="w-5 h-5" />
                <span className="font-medium">{selectedPatient.fullName}</span>
              </div>
              <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
            </div>
            
            <div className="border-t border-blue-200 pt-4 mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Department</p>
                <p className="font-medium capitalize">{selectedDepartment}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Options Section */}
          {paymentType === 'cash' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">Payment Options:</p>
              <div className="space-y-2">
                <button 
                  onClick={() => navigate('/billing/reception/new', { 
                    state: { 
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.fullName,
                      mrn: selectedPatient.mrn,
                      serviceType: 'consultation'
                    }
                  })}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Banknote className="w-5 h-5" />
                  Pay Consultation Fee Now (UGX {CONSULTATION_FEE.toLocaleString()})
                </button>
                <button 
                  onClick={handleReset}
                  className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  Pay All at Checkout (After Visit)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Patient can proceed to doctor and pay total bill at the end
              </p>
            </div>
          )}

          {/* Insurance patient */}
          {paymentType === 'insurance' && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">{insurance.provider || 'Insurance'}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Policy: {insurance.policyNumber || 'Not provided'}</p>
              <button 
                onClick={() => navigate('/insurance/preauth')}
                className="w-full py-3 px-4 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Proceed to Pre-Authorization
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Or patient can proceed - billing will be sent to insurance
              </p>
            </div>
          )}

          {/* Mobile Money patient */}
          {paymentType === 'mobile_money' && (
            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-yellow-700 mb-2">
                <Smartphone className="w-5 h-5" />
                <span className="font-medium">{mobileMoneyProvider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}</span>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Payment will be collected at billing via {mobileMoneyProvider === 'mtn' ? 'MTN' : 'Airtel'} Mobile Money
              </p>
            </div>
          )}

          {/* Card payment patient */}
          {paymentType === 'card' && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">{cardType === 'visa' ? 'Visa' : 'Mastercard'} Card</span>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Payment will be collected via POS at billing counter
              </p>
            </div>
          )}

          {/* Membership patient */}
          {paymentType === 'membership' && (
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-purple-700">
                <BadgeCheck className="w-5 h-5" />
                <span className="font-medium">Membership Card</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Card: {membership.cardNumber || 'Not provided'} • Balance deducted at checkout
              </p>
            </div>
          )}

          {/* Hospital Scheme patient */}
          {paymentType === 'hospital_scheme' && (
            <div className="bg-teal-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-teal-700">
                <Building2 className="w-5 h-5" />
                <span className="font-medium">Hospital Scheme</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Charges will be billed to hospital insurance scheme
              </p>
            </div>
          )}

          {/* Staff patient */}
          {paymentType === 'staff' && (
            <div className="bg-orange-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-orange-700">
                <UserCheck className="w-5 h-5" />
                <span className="font-medium">Staff Benefit</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                ID: {staffId || 'Not provided'} • HR policy applies
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            Please wait for your number to be called
          </p>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary flex-1">
              Issue Another
            </button>
            <button
              onClick={handlePrintToken}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print Token
            </button>
          </div>
        </div>

        {/* Print Receipt - Clean thermal printer format */}
        <div className="hidden print:block bg-white p-4 text-center" style={{ width: '80mm', margin: '0 auto' }}>
          <div className="border-b-2 border-dashed border-gray-400 pb-3 mb-3">
            <h1 className="text-lg font-bold">GLIDE HIMS</h1>
            <p className="text-xs text-gray-600">Healthcare Management System</p>
          </div>
          
          <div className="py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Queue Token</p>
            <p className="text-5xl font-mono font-black my-2">
              {issuedToken.ticketNumber}
            </p>
          </div>
          
          <div className="border-t border-b border-dashed border-gray-300 py-3 my-3 text-left text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Patient:</span>
              <span className="font-medium">{selectedPatient.fullName}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">MRN:</span>
              <span className="font-mono">{selectedPatient.mrn}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Department:</span>
              <span className="font-medium capitalize">{selectedDepartment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date/Time:</span>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <p className="text-sm font-medium my-4">
            Please wait for your number to be called
          </p>
          
          <div className="text-xs text-gray-400 border-t border-dashed border-gray-300 pt-3">
            <p>Thank you for visiting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">OPD Token</h1>
          <p className="text-gray-500 text-sm">Issue queue tokens for outpatient visits</p>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main Content - 3 columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Column 1: Patient & Department */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Patient Search */}
          <div className="card p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">1. Select Patient</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600 hover:underline">
                    Change
                  </button>
                </div>
                {/* Payment Status */}
                <div className="border-t border-blue-200 pt-2 mt-1">
                  {paymentType === 'cash' && (
                    <div className="flex items-center gap-1 text-xs">
                      <Banknote className="w-3 h-3 text-green-600" />
                      <span className="text-gray-700">Cash</span>
                    </div>
                  )}
                  {paymentType === 'mobile_money' && (
                    <div className="flex items-center gap-1 text-xs">
                      <Smartphone className="w-3 h-3 text-yellow-600" />
                      <span className="text-gray-700">{mobileMoneyProvider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}</span>
                    </div>
                  )}
                  {paymentType === 'card' && (
                    <div className="flex items-center gap-1 text-xs">
                      <CreditCard className="w-3 h-3 text-blue-600" />
                      <span className="text-gray-700">{cardType === 'visa' ? 'Visa' : 'Mastercard'}</span>
                    </div>
                  )}
                  {paymentType === 'membership' && (
                    <div className="flex items-center gap-1 text-xs">
                      <BadgeCheck className="w-3 h-3 text-purple-600" />
                      <span className="text-gray-700">Member: {membership.cardNumber || 'Card'}</span>
                    </div>
                  )}
                  {paymentType === 'insurance' && (
                    <div className="flex items-center gap-1 text-xs">
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span className="text-gray-700">{insurance.provider || 'Insurance'}</span>
                    </div>
                  )}
                  {paymentType === 'hospital_scheme' && (
                    <div className="flex items-center gap-1 text-xs">
                      <Building2 className="w-3 h-3 text-teal-600" />
                      <span className="text-gray-700">Hospital Scheme</span>
                    </div>
                  )}
                  {paymentType === 'staff' && (
                    <div className="flex items-center gap-1 text-xs">
                      <UserCheck className="w-3 h-3 text-orange-600" />
                      <span className="text-gray-700">Staff: {staffId || 'Benefit'}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patient..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-8 py-1.5 text-sm"
                    autoFocus
                  />
                </div>
                {searchLoading && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                )}
                {patients && patients.length > 0 && (
                  <div className="border rounded divide-y max-h-32 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                      >
                        <UserCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department Selection */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">2. Select Department</h2>
            <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto content-start">
              {[
                { id: 'general', name: 'General' },
                { id: 'pediatrics', name: 'Pediatrics' },
                { id: 'gynecology', name: 'Gynecology' },
                { id: 'orthopedics', name: 'Orthopedics' },
                { id: 'dental', name: 'Dental' },
                { id: 'ent', name: 'ENT' },
                { id: 'ophthalmology', name: 'Eye' },
                { id: 'dermatology', name: 'Skin' },
                { id: 'cardiology', name: 'Cardiology' },
              ].map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => { setSelectedDepartment(dept.id); setSelectedDoctor('any'); }}
                  className={`p-2 rounded border text-left transition-colors text-xs ${
                    selectedDepartment === dept.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Doctor Selection */}
        <div className="card p-4 flex flex-col min-h-0 lg:col-span-2">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2 className="text-sm font-semibold">3. Select Doctor (Optional)</h2>
            <Link 
              to="/doctors/on-duty" 
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3" />
              Manage
            </Link>
          </div>
          
          {/* Warning if no doctors on duty */}
          {!doctorsLoading && availableDoctors.length === 0 && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-amber-800">No doctors checked in</p>
                <p className="text-amber-600">
                  <Link to="/doctors/on-duty" className="underline">Check in doctors</Link> to assign patients
                </p>
              </div>
            </div>
          )}
          
          {/* Any Doctor Option */}
          <button
            onClick={() => setSelectedDoctor('any')}
            className={`w-full p-2 rounded border-2 text-left mb-2 flex-shrink-0 ${
              selectedDoctor === 'any' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className={`w-5 h-5 ${selectedDoctor === 'any' ? 'text-blue-600' : 'text-gray-500'}`} />
              <div>
                <p className={`text-sm font-medium ${selectedDoctor === 'any' ? 'text-blue-700' : 'text-gray-900'}`}>
                  Any Available Doctor
                </p>
                <p className="text-xs text-gray-500">Auto-assigned • Shortest wait</p>
              </div>
            </div>
          </button>

          {/* Doctor List */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {doctorsLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            )}
            {availableDoctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => doctor.available && setSelectedDoctor(doctor.id)}
                disabled={!doctor.available}
                className={`w-full p-2 rounded border text-left transition-colors ${
                  selectedDoctor === doctor.id
                    ? 'border-blue-500 bg-blue-50'
                    : doctor.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className={`w-4 h-4 ${selectedDoctor === doctor.id ? 'text-blue-600' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${selectedDoctor === doctor.id ? 'text-blue-700' : 'text-gray-900'}`}>
                        {doctor.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doctor.specialization}
                        {doctor.roomNumber && ` • Room ${doctor.roomNumber}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {doctor.available ? (
                      <>
                        <p className="text-xs font-medium">{doctor.currentQueue} waiting</p>
                        <p className="text-xs text-green-600">Available</p>
                      </>
                    ) : (
                      <p className="text-xs text-red-500">Unavailable</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Column 3: Queue Summary & Issue Button */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Today's Queue</h2>
            <div className="space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">Waiting</span>
                </div>
                <span className="text-lg font-bold text-yellow-700">
                  {queueStats?.waiting || todayQueue?.filter((t) => t.status === 'waiting').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700">Serving</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {queueStats?.inService || todayQueue?.filter((t) => t.status === 'in_service').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">Done</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {queueStats?.completed || todayQueue?.filter((t) => t.status === 'completed').length || 0}
                </span>
              </div>
            </div>
            
            {/* Queue List */}
            <div className="mt-3 pt-3 border-t flex-1 min-h-0 overflow-hidden flex flex-col">
              <p className="text-xs text-gray-500 mb-2 flex-shrink-0">Patients in Queue:</p>
              <div className="flex-1 overflow-y-auto space-y-1">
                {todayQueue && todayQueue.filter(t => t.status === 'waiting' || t.status === 'called').length > 0 ? (
                  todayQueue
                    .filter(t => t.status === 'waiting' || t.status === 'called')
                    .slice(0, 10)
                    .map((entry) => (
                      <div 
                        key={entry.id} 
                        className={`flex items-center justify-between p-1.5 rounded text-xs group ${
                          entry.status === 'called' ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`font-mono font-bold ${entry.status === 'called' ? 'text-blue-700' : 'text-gray-700'}`}>
                            {entry.ticketNumber}
                          </span>
                          <span className="truncate text-gray-600">
                            {entry.patient?.fullName || 'Patient'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {entry.status === 'called' && (
                            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                              Now
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveFromQueue(entry.id, entry.patient?.fullName || 'Patient')}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                            title="Remove from queue"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No patients waiting</p>
                )}
                {todayQueue && todayQueue.filter(t => t.status === 'waiting').length > 10 && (
                  <p className="text-xs text-gray-400 text-center">
                    +{todayQueue.filter(t => t.status === 'waiting').length - 10} more...
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-3">Quick Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Today</span>
                <span className="font-medium">{todayQueue?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg. Wait</span>
                <span className="font-medium">{queueStats?.averageWaitMinutes ? `~${Math.round(queueStats.averageWaitMinutes)} min` : '~15 min'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Now Serving</span>
                <span className="font-mono font-medium text-blue-600">
                  {todayQueue?.find(t => t.status === 'called')?.ticketNumber || '---'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Type Selection */}
          {selectedPatient && (
            <div className="card p-4 flex-shrink-0">
              <h2 className="text-sm font-semibold mb-2">4. Payment Method</h2>
              
              {/* Primary payment options */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1 ${
                    paymentType === 'cash' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('mobile_money')}
                  className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1 ${
                    paymentType === 'mobile_money' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('card')}
                  className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors flex flex-col items-center gap-1 ${
                    paymentType === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Card
                </button>
              </div>
              
              {/* Secondary payment options */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('membership')}
                  className={`py-1.5 px-1 text-[10px] font-medium rounded transition-colors ${
                    paymentType === 'membership' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('insurance')}
                  className={`py-1.5 px-1 text-[10px] font-medium rounded transition-colors ${
                    paymentType === 'insurance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Insurance
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('hospital_scheme')}
                  className={`py-1.5 px-1 text-[10px] font-medium rounded transition-colors ${
                    paymentType === 'hospital_scheme' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Scheme
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('staff')}
                  className={`py-1.5 px-1 text-[10px] font-medium rounded transition-colors ${
                    paymentType === 'staff' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Staff
                </button>
              </div>

              {/* Mobile Money Options */}
              {paymentType === 'mobile_money' && (
                <div className="space-y-2 p-2 bg-yellow-50 rounded-lg">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMobileMoneyProvider('mtn')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        mobileMoneyProvider === 'mtn' ? 'bg-yellow-400 text-black' : 'bg-white border'
                      }`}
                    >
                      MTN MoMo
                    </button>
                    <button
                      onClick={() => setMobileMoneyProvider('airtel')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        mobileMoneyProvider === 'airtel' ? 'bg-red-500 text-white' : 'bg-white border'
                      }`}
                    >
                      Airtel Money
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Fee: UGX {CONSULTATION_FEE.toLocaleString()} • Payment at billing
                  </p>
                </div>
              )}

              {/* Card Options */}
              {paymentType === 'card' && (
                <div className="space-y-2 p-2 bg-blue-50 rounded-lg">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCardType('visa')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        cardType === 'visa' ? 'bg-blue-700 text-white' : 'bg-white border'
                      }`}
                    >
                      Visa
                    </button>
                    <button
                      onClick={() => setCardType('mastercard')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                        cardType === 'mastercard' ? 'bg-orange-500 text-white' : 'bg-white border'
                      }`}
                    >
                      Mastercard
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Fee: UGX {CONSULTATION_FEE.toLocaleString()} • POS at billing
                  </p>
                </div>
              )}

              {paymentType === 'insurance' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Insurance Provider</label>
                    <select
                      value={insurance.provider}
                      onChange={(e) => setInsurance({ ...insurance, provider: e.target.value })}
                      className="input text-sm py-1.5"
                    >
                      <option value="">Select provider...</option>
                      <option value="AAR">AAR Insurance</option>
                      <option value="Jubilee">Jubilee Insurance</option>
                      <option value="UAP">UAP Old Mutual</option>
                      <option value="ICEA">ICEA Lion</option>
                      <option value="Sanlam">Sanlam Insurance</option>
                      <option value="Liberty">Liberty Insurance</option>
                      <option value="Prudential">Prudential Insurance</option>
                      <option value="CIC">CIC Insurance</option>
                      <option value="GA">GA Insurance</option>
                      <option value="Britam">Britam Insurance</option>
                      <option value="APA">APA Insurance</option>
                      <option value="Madison">Madison Insurance</option>
                      <option value="NHIF">NHIF</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Policy / Member Number</label>
                    <input
                      type="text"
                      value={insurance.policyNumber}
                      onChange={(e) => setInsurance({ ...insurance, policyNumber: e.target.value })}
                      className="input text-sm py-1.5"
                      placeholder="Policy #"
                    />
                  </div>
                </div>
              )}

              {paymentType === 'hospital_scheme' && (
                <div className="space-y-3 p-3 bg-teal-50 rounded-lg">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Hospital Insurance Scheme</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    For patients covered under hospital's own insurance scheme.
                    Fingerprint verification required.
                  </p>
                  
                  {/* Biometric Verification Status */}
                  {biometricVerified ? (
                    <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Identity Verified</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartBiometricVerification}
                      disabled={checkingCoverage || !selectedPatient?.userId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                      {checkingCoverage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Fingerprint className="w-4 h-4" />
                      )}
                      Verify Fingerprint
                    </button>
                  )}
                  
                  {!selectedPatient?.userId && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Patient must have a linked user account for biometric verification
                    </p>
                  )}
                </div>
              )}

              {paymentType === 'membership' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Membership Card Number</label>
                    <input
                      type="text"
                      value={membership.cardNumber}
                      onChange={(e) => setMembership({ ...membership, cardNumber: e.target.value })}
                      className="input text-sm py-1.5"
                      placeholder="Scan or enter card #"
                    />
                  </div>
                  {membership.cardNumber && (
                    <div className="p-2 bg-purple-50 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Prepaid Balance:</span>
                        <span className="font-bold text-purple-700">UGX {membership.balance.toLocaleString()}</span>
                      </div>
                      {membership.balance < CONSULTATION_FEE && (
                        <p className="text-xs text-red-500 mt-1">
                          ⚠️ Insufficient balance. Top-up required.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'staff' && (
                <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-700">
                    <UserCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Staff Benefit</span>
                  </div>
                  
                  {/* Staff Coverage Info */}
                  {staffCoverage?.coverage && (
                    <div className="text-xs space-y-1 p-2 bg-white rounded">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Plan:</span>
                        <span className="font-medium">{staffCoverage.coverage.planType || 'Standard'}</span>
                      </div>
                      {staffCoverage.coverage.coverageLimit && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Limit:</span>
                            <span className="font-medium">UGX {staffCoverage.coverage.coverageLimit.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Remaining:</span>
                            <span className={`font-medium ${(staffCoverage.coverage.remainingAmount || 0) < CONSULTATION_FEE ? 'text-red-600' : 'text-green-600'}`}>
                              UGX {(staffCoverage.coverage.remainingAmount || 0).toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Biometric Verification */}
                  {biometricVerified ? (
                    <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Identity Verified</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartBiometricVerification}
                      disabled={checkingCoverage || !selectedPatient?.userId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      {checkingCoverage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Fingerprint className="w-4 h-4" />
                      )}
                      Verify Staff Identity
                    </button>
                  )}
                  
                  {!selectedPatient?.userId && (
                    <p className="text-xs text-amber-600">
                      ⚠️ Patient must have a linked user account for staff verification
                    </p>
                  )}
                </div>
              )}

              {paymentType === 'cash' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Consultation Fee</span>
                    <span className="font-medium">UGX {CONSULTATION_FEE.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500">Patient will pay at billing counter</p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Issue Button */}
          <button
            onClick={handleIssueToken}
            disabled={!selectedPatient || issueTokenMutation.isPending}
            className="btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
          >
            {issueTokenMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Receipt className="w-5 h-5" />
                Issue Token
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Fingerprint Scanner Modal */}
      {showFingerprintScanner && selectedPatient?.userId && (
        <FingerprintScanner
          userId={selectedPatient.userId}
          mode={biometricMode}
          userName={selectedPatient.fullName}
          onSuccess={handleBiometricSuccess}
          onCancel={() => setShowFingerprintScanner(false)}
        />
      )}
    </div>
  );
}
