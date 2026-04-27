import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { usePatientStore, type PatientRecord } from '../store/patients';
import { useAuthStore } from '../store/auth';
import { queueService, type QueueEntry, type CreateQueueEntryDto, type VisitType, getEntryServicePoint, getPriorityFromFlags } from '../services/queue';
import { patientsService } from '../services/patients';
import { doctorDutyService, type DoctorWithDutyStatus } from '../services/doctor-duty';
import { biometricsService, type StaffCoverage } from '../services/biometrics';
import api, { getApiErrorMessage } from '../services/api';
import { formatQueueIssueError } from './opdTokenError';
import FingerprintScanner from '../components/FingerprintScanner';
import { useInstitutionInfo } from '../lib/useInstitutionInfo';
import { printService } from '../lib/print';
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
  ArrowRight,
  Baby,
  Heart,
  Accessibility,
  Siren,
  RefreshCw,
  FlaskConical,
  Pill,
  MessageSquare,
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

interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  status?: string;
}

interface InsuranceProviderInfo {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}


// Enhanced payment types
type PaymentType = 'cash' | 'mobile_money' | 'card' | 'membership' | 'insurance' | 'hospital_scheme' | 'staff';

export default function OPDTokenPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inst = useInstitutionInfo();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
  const localSearchPatients = usePatientStore((state) => state.searchPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
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

  // New clinical fields
  const [visitType, setVisitType] = useState<VisitType>('new_visit');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [conditionFlags, setConditionFlags] = useState<string[]>([]);
  const [showQuickRegModal, setShowQuickRegModal] = useState(false);

  // Fetch tenant billing defaults (mode + consultation fee) — configured in Admin → System Settings
  const { data: billingConfig } = useQuery<{ mode: 'pre_pay' | 'post_pay'; consultationFee: number | null }>({
    queryKey: ['queue-billing-config'],
    queryFn: async () => {
      const res = await api.get<{ mode: 'pre_pay' | 'post_pay'; consultationFee: number | null }>('/queue/billing-config');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch consultation fee from services API
  const { data: consultationService } = useQuery({
    queryKey: ['consultation-service'],
    queryFn: async () => {
      const response = await api.get<Array<{ id: string; code: string; name: string; basePrice: number }>>('/services');
      const services = response.data;
      // Find consultation service by code or name
      return services.find(s => 
        s.code?.toLowerCase().includes('consult') || 
        s.name?.toLowerCase().includes('consultation')
      );
    },
    staleTime: 5 * 60 * 1000,
  });
  // Default consultation fee: per-facility service catalog → tenant setting → null (must configure)
  const defaultConsultationFee: number | null =
    consultationService?.basePrice ?? billingConfig?.consultationFee ?? null;
  // Editable per-visit fee
  const [consultationFeeInput, setConsultationFeeInput] = useState<string>('');
  const effectiveConsultationFee: number = consultationFeeInput.trim() !== ''
    ? Number(consultationFeeInput) || 0
    : (defaultConsultationFee ?? 0);
  const CONSULTATION_FEE = effectiveConsultationFee;

  // Per-visit billing timing override; defaults to tenant setting (post_pay if unset)
  const [billingMode, setBillingMode] = useState<'pre_pay' | 'post_pay' | ''>('');
  const effectiveBillingMode: 'pre_pay' | 'post_pay' =
    billingMode || billingConfig?.mode || 'post_pay';

  // Search patients from API with fallback to local store
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: async () => {
      const res = await patientsService.search({ search: searchTerm, limit: 10 });
      // Defensive: handle both {data: [...], meta} and flat array responses
      const list = Array.isArray(res) ? res : (res?.data || []);
      return Array.isArray(list) ? list : [];
    },
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Combine API results with local store
  const localPatients = localSearchPatients(searchTerm);
  const apiList = apiPatients || [];
  const patients = searchTerm.length >= 2 
    ? [...apiList.map((p: any) => ({
        ...p,
        paymentType: 'cash' as const,
      })), ...localPatients.filter(lp => !apiList.some((ap: any) => ap.id === lp.id))]
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

  // Fetch facility service config (configurable service points, priority rules, OPD entry point)
  const { data: serviceConfig } = useQuery({
    queryKey: ['queue-service-config'],
    queryFn: () => queueService.getServiceConfig(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch departments for user's facility
  const effectiveFacilityId = user?.facilityId || sessionStorage.getItem('glide_active_facility_id') || undefined;
  const { data: departments } = useQuery({
    queryKey: ['departments', effectiveFacilityId],
    queryFn: async () => {
      if (!effectiveFacilityId) return [];
      const response = await api.get<DepartmentInfo[]>(`/facilities/${effectiveFacilityId}/departments`);
      return response.data;
    },
    enabled: !!effectiveFacilityId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch insurance providers from API
  const { data: insuranceProviders } = useQuery({
    queryKey: ['insurance-providers'],
    queryFn: async () => {
      const response = await api.get<InsuranceProviderInfo[]>('/insurance/providers');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select first department when loaded
  useEffect(() => {
    if (departments && departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0].id);
    }
  }, [departments, selectedDepartment]);

  // Fetch today's queue
  const { data: todayQueue } = useQuery({
    queryKey: ['queue-today'],
    queryFn: () => queueService.getQueue({ date: new Date().toISOString().split('T')[0] }),
    refetchInterval: 30000,
  });

  // Check if selected patient is already in an active queue entry
  const existingQueueEntry = useMemo(() => {
    if (!selectedPatient || !todayQueue) return null;
    const activeStatuses = ['waiting', 'called', 'in_service', 'pending_payment'];
    return todayQueue.find(
      (q: any) => q.patientId === selectedPatient.id && activeStatuses.includes(q.status)
    ) || null;
  }, [selectedPatient, todayQueue]);

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
    onError: (err: Error & { response?: { data?: { message?: string | string[]; error?: string; statusCode?: number; requestId?: string } } }) => {
      console.error('Queue error:', err.response?.data || err.message);
      const data = err.response?.data;
      const baseMessage = getApiErrorMessage(err, 'Failed to issue token. Please try again.');
      let errorMessage = formatQueueIssueError(baseMessage, data?.requestId);

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

  const handleIssueToken = async () => {
    if (!selectedPatient) return;

    // Check if biometric verification is required
    if ((paymentType === 'hospital_scheme' || paymentType === 'staff') && !biometricVerified) {
      toast.error('Biometric verification required for scheme/staff payments');
      return;
    }

    if (existingQueueEntry) {
      setError(`Patient ${selectedPatient.fullName} is already in queue with token ${existingQueueEntry.ticketNumber}`);
      return;
    }

    if (!selectedDepartment && user?.workflowMode !== 'simple') {
      setError('Department is required. Please select a department.');
      return;
    }

    if (!chiefComplaint.trim()) {
      setError('Chief complaint is required before issuing token.');
      return;
    }

    setError(null);

    const selectedDeptName = departments?.find(d => d.id === selectedDepartment)?.name || '';

    // Determine entry service point from visit type (configurable per facility)
    const entryServicePoint = getEntryServicePoint(visitType, serviceConfig);

    // Resolve priority from condition flags
    const resolvedPriority = getPriorityFromFlags(conditionFlags, serviceConfig) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10;

    const queueData: CreateQueueEntryDto = {
      patientId: selectedPatient.id,
      servicePoint: entryServicePoint,
      priority: resolvedPriority,
      priorityReason: conditionFlags.length > 0 ? conditionFlags.join(', ') : undefined,
      departmentId: selectedDepartment || undefined,
      visitType,
      chiefComplaintAtToken: chiefComplaint.trim() || undefined,
      patientConditionFlags: conditionFlags.length > 0 ? conditionFlags : undefined,
      notes: selectedDoctor !== 'any'
        ? `Preferred doctor: ${availableDoctors.find(d => d.id === selectedDoctor)?.name || 'Assigned doctor'}. Department: ${selectedDeptName}`
        : `Department: ${selectedDeptName}`,
      assignedDoctorId: selectedDoctor !== 'any' ? selectedDoctor : undefined,
      paymentType,
      consultationFee: Number(CONSULTATION_FEE),
      billingMode: effectiveBillingMode,
    };

    try {
      await queueService.validateQueueRequest(queueData);
      issueTokenMutation.mutate(queueData);
    } catch (err: any) {
      const requestId = err?.response?.data?.requestId;
      const baseMessage = getApiErrorMessage(err, 'Failed to issue token. Please try again.');
      const errorMessage = formatQueueIssueError(baseMessage, requestId);
      setError(errorMessage);
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
    if (!issuedToken || !selectedPatient) return;
    const deptName = departments?.find(d => d.id === selectedDepartment)?.name || selectedDepartment || '';
    const invoiceNum = (issuedToken as any).invoiceNumber || '';
    const invoiceAmt = Number((issuedToken as any).invoiceAmount) || 0;
    const needsPayment = ['cash', 'mobile_money', 'card'].includes(paymentType);

    const header = printService.buildHeader(inst, 'receipt');
    const body = `
      <div class="text-center py-2">
        <div class="text-xs uppercase tracking-wide text-muted">Queue Token</div>
        <div class="text-5xl font-bold font-mono" style="margin:6px 0;">${issuedToken.ticketNumber}</div>
      </div>
      <div class="border-dashed" style="margin:6px 0;"></div>
      <div style="padding:6px 0;">
        ${printService.kvRow('Patient', selectedPatient.fullName || '', true)}
        ${printService.kvRow('MRN', selectedPatient.mrn || '')}
        ${printService.kvRow('Department', deptName)}
        ${invoiceNum ? printService.kvRow('Invoice', invoiceNum) : ''}
        ${invoiceAmt > 0 ? printService.kvRow('Amount', `UGX ${invoiceAmt.toLocaleString()}`) : ''}
        ${printService.kvRow('Date/Time', new Date().toLocaleString())}
      </div>
      <div class="border-dashed" style="margin:6px 0;"></div>
      <div class="text-center font-bold" style="padding:8px 0; font-size:12px;">
        ${needsPayment ? '⟶ PROCEED TO BILLING COUNTER' : 'Please wait for your number to be called'}
      </div>
    `;
    const footer = printService.buildFooter(inst, 'receipt');
    printService.printReceipt(header + body + footer, { title: 'Queue Token' });
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
    setError(null);
    setSearchParams({});
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
          
          {/* Queue Status Badge — changes based on payment type */}
          {['cash', 'mobile_money', 'card'].includes(paymentType) ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
              <Banknote className="w-4 h-4" />
              Proceed to Billing Counter to pay
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4">
              <Users className="w-4 h-4" />
              Patient is now in queue
            </div>
          )}

          {/* Invoice info */}
          {(issuedToken as any).invoiceNumber && (
            <p className="text-xs text-gray-500 mb-2">
              Invoice: <span className="font-mono font-medium">{(issuedToken as any).invoiceNumber}</span>
              {' '}&bull;{' '}UGX {Number((issuedToken as any).invoiceAmount || 0).toLocaleString()}
            </p>
          )}
          
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
                <p className="font-medium capitalize">{departments?.find(d => d.id === selectedDepartment)?.name || selectedDepartment}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Instructions Section */}
          {['cash', 'mobile_money', 'card'].includes(paymentType) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-center">
              <Banknote className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-amber-800 mb-1">Billing Required</p>
              <p className="text-xs text-amber-700 mb-3">
                Invoice <span className="font-mono font-medium">{(issuedToken as any).invoiceNumber || ''}</span> for UGX {Number((issuedToken as any).invoiceAmount || 50000).toLocaleString()} has been created.
              </p>
              <p className="text-xs text-amber-600">
                Direct patient to <strong>Billing Counter</strong> to pay. Patient will join the waiting queue after payment is confirmed.
              </p>
            </div>
          )}

          {/* Insurance patient — skips billing counter */}
          {paymentType === 'insurance' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
              <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800 mb-1">Insurance — No Payment Needed</p>
              <p className="text-xs text-green-700">
                {insurance.provider ? `Provider: ${insurance.provider}` : 'Claim will be filed automatically.'} Patient can proceed to waiting area.
              </p>
            </div>
          )}

          {/* Scheme/Staff/Membership — skips billing counter */}
          {['hospital_scheme', 'staff', 'membership'].includes(paymentType) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
              <BadgeCheck className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800 mb-1">
                {paymentType === 'staff' ? 'Staff Benefit' : paymentType === 'hospital_scheme' ? 'Hospital Scheme' : 'Membership'} — No Payment Now
              </p>
              <p className="text-xs text-green-700">
                Charges billed to {paymentType === 'staff' ? 'HR' : 'scheme'}. Patient can proceed to waiting area.
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            {['cash', 'mobile_money', 'card'].includes(paymentType)
              ? 'Patient will join waiting queue after payment'
              : 'Please wait for your number to be called'}
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
                  <button onClick={() => { setSelectedPatient(null); setSearchParams({}); setError(null); }} className="text-xs text-blue-600 hover:underline">
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

          {/* Department Selection (hidden in simple workflow mode — auto-uses default department) */}
          {user?.workflowMode !== 'simple' && (
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">2. Select Department</h2>
            <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto content-start">
              {(departments || []).filter(d => d.status !== 'inactive').map((dept) => (
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
              {(!departments || departments.length === 0) && (
                <p className="text-xs text-gray-400 col-span-2 text-center py-4">No departments configured</p>
              )}
            </div>
          </div>
          )}
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

        {/* Column 3: Clinical Info + Queue Summary & Issue Button */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable content area */}
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pb-1">
          {/* Visit Type */}
          <div className="card p-3 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Visit Type</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { value: 'new_visit', label: 'New Visit', icon: <ArrowRight className="w-3 h-3" />, color: 'blue' },
                { value: 'follow_up', label: 'Follow-up', icon: <RefreshCw className="w-3 h-3" />, color: 'green' },
                { value: 'emergency', label: 'Emergency', icon: <Siren className="w-3 h-3" />, color: 'red' },
                { value: 'referral', label: 'Referral', icon: <ArrowRight className="w-3 h-3" />, color: 'purple' },
                { value: 'lab_collection', label: 'Lab Only', icon: <FlaskConical className="w-3 h-3" />, color: 'yellow' },
                { value: 'pharmacy_pickup', label: 'Pharmacy', icon: <Pill className="w-3 h-3" />, color: 'teal' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setVisitType(opt.value as VisitType)}
                  className={`p-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
                    visitType === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
            {visitType !== 'new_visit' && visitType !== 'emergency' && visitType !== 'referral' && (
              <p className="mt-1.5 text-xs text-green-700 bg-green-50 rounded px-2 py-1">
                ✓ Routes directly to {
                  visitType === 'follow_up' ? 'consultation' :
                  visitType === 'lab_collection' ? 'laboratory' :
                  visitType === 'pharmacy_pickup' ? 'pharmacy' : 'appropriate service point'
                } — skips triage
              </p>
            )}
          </div>

          {/* Chief Complaint */}
          <div className="card p-3 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Chief Complaint
              {visitType === 'new_visit' || visitType === 'emergency' ? (
                <span className="text-red-500 ml-0.5">*</span>
              ) : (
                <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
              )}
            </h2>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Fever and headache for 3 days..."
              rows={2}
              className="input text-sm w-full resize-none"
            />
          </div>

          {/* Patient Condition Flags */}
          <div className="card p-3 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Patient Condition</h2>
            <p className="text-xs text-gray-500 mb-2">Select all that apply — auto-adjusts priority</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { flag: 'elderly', label: 'Elderly', icon: <UserCircle className="w-3 h-3" /> },
                { flag: 'pregnant', label: 'Pregnant', icon: <Heart className="w-3 h-3" /> },
                { flag: 'child', label: 'Child', icon: <Baby className="w-3 h-3" /> },
                { flag: 'disabled', label: 'Wheelchair', icon: <Accessibility className="w-3 h-3" /> },
                { flag: 'appears_unwell', label: 'Unwell', icon: <AlertCircle className="w-3 h-3" /> },
                { flag: 'emergency', label: 'Critical', icon: <Siren className="w-3 h-3" /> },
              ].map((c) => {
                const active = conditionFlags.includes(c.flag);
                return (
                  <button
                    key={c.flag}
                    onClick={() => setConditionFlags(active
                      ? conditionFlags.filter(f => f !== c.flag)
                      : [...conditionFlags, c.flag]
                    )}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? c.flag === 'emergency' || c.flag === 'appears_unwell'
                          ? 'bg-red-100 border-red-400 text-red-700'
                          : 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {c.icon}{c.label}
                  </button>
                );
              })}
            </div>
            {conditionFlags.length > 0 && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                Priority adjusted: {
                  conditionFlags.includes('emergency') ? '🔴 Emergency' :
                  conditionFlags.includes('appears_unwell') ? '🟠 Urgent' :
                  conditionFlags.includes('elderly') ? '🟡 Elderly' :
                  conditionFlags.includes('pregnant') ? '🟡 Pregnant' :
                  conditionFlags.includes('child') ? '🟡 Pediatric' :
                  conditionFlags.includes('disabled') ? '🟡 Priority' : ''
                }
              </p>
            )}
          </div>

          <div className="card p-3 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Today's Queue</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span title="Total today">
                  <span className="font-medium text-gray-700">{todayQueue?.length || 0}</span> total
                </span>
                <span className="text-gray-300">|</span>
                <span title="Average wait time">
                  ⏱ {queueStats?.averageWaitMinutes ? `~${Math.round(queueStats.averageWaitMinutes)}m` : '~15m'}
                </span>
                <span className="text-gray-300">|</span>
                <span title="Now serving" className="font-mono text-blue-600 font-medium">
                  #{todayQueue?.find(t => t.status === 'called')?.ticketNumber || '---'}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 flex-shrink-0">
              <div className="flex items-center justify-between px-2 py-1 bg-amber-50 rounded">
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs text-amber-700">At Billing</span>
                </div>
                <span className="text-base font-bold text-amber-700">
                  {todayQueue?.filter((t) => t.status === 'pending_payment').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-yellow-50 rounded">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs text-yellow-700">Waiting</span>
                </div>
                <span className="text-base font-bold text-yellow-700">
                  {queueStats?.waiting || todayQueue?.filter((t) => t.status === 'waiting').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-blue-50 rounded">
                <div className="flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-700">Serving</span>
                </div>
                <span className="text-base font-bold text-blue-700">
                  {queueStats?.inService || todayQueue?.filter((t) => t.status === 'in_service').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-green-50 rounded">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-700">Done</span>
                </div>
                <span className="text-base font-bold text-green-700">
                  {queueStats?.completed || todayQueue?.filter((t) => t.status === 'completed').length || 0}
                </span>
              </div>
            </div>
            
            {/* Queue List */}
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-gray-500 mb-1">Patients in Queue:</p>
              <div className="overflow-y-auto space-y-1 max-h-[100px]">
                {todayQueue && todayQueue.filter(t => t.status === 'pending_payment' || t.status === 'waiting' || t.status === 'called').length > 0 ? (
                  todayQueue
                    .filter(t => t.status === 'pending_payment' || t.status === 'waiting' || t.status === 'called')
                    .slice(0, 10)
                    .map((entry) => (
                      <div 
                        key={entry.id} 
                        className={`flex items-center justify-between p-1.5 rounded text-xs group ${
                          entry.status === 'called' ? 'bg-blue-100' : entry.status === 'pending_payment' ? 'bg-amber-50' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`font-mono font-bold ${entry.status === 'called' ? 'text-blue-700' : entry.status === 'pending_payment' ? 'text-amber-700' : 'text-gray-700'}`}>
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
                          {entry.status === 'pending_payment' && (
                            <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">
                              Pay
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

          {/* Payment Type Selection */}
          {selectedPatient && (
            <div className="card p-3 flex-shrink-0">
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
                      {(insuranceProviders || []).filter(p => p.isActive).map(provider => (
                        <option key={provider.id} value={provider.code}>{provider.name}</option>
                      ))}
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
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 font-medium mb-2">
                        ⚠️ Patient not enrolled in Hospital Insurance Scheme
                      </p>
                      <p className="text-xs text-amber-700 mb-3">
                        This patient needs to be enrolled first with biometric registration.
                      </p>
                      <button
                        onClick={() => navigate(`/patients/hospital-scheme-enroll?mrn=${selectedPatient?.mrn}`)}
                        className="btn-sm bg-amber-600 hover:bg-amber-700 text-white w-full"
                      >
                        Enroll Patient Now →
                      </button>
                    </div>
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
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 font-medium mb-2">
                        ⚠️ Staff member not registered for insurance
                      </p>
                      <p className="text-xs text-amber-700 mb-3">
                        This staff member needs biometric registration. Contact HR Department.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'cash' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 font-medium">Consultation Fee (UGX)</label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={consultationFeeInput !== '' ? consultationFeeInput : (defaultConsultationFee ?? '')}
                      onChange={(e) => setConsultationFeeInput(e.target.value)}
                      placeholder={defaultConsultationFee != null ? String(defaultConsultationFee) : 'Configure default in Settings'}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {defaultConsultationFee == null && (
                      <p className="text-xs text-amber-600">
                        No default consultation fee configured. Set service <code>OPD-CONSULT</code> in the Service Catalog
                        or system_setting <code>billing.consultationFee</code>.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 font-medium">Payment Timing</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBillingMode('post_pay')}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                          effectiveBillingMode === 'post_pay'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Pay at Checkout
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingMode('pre_pay')}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border ${
                          effectiveBillingMode === 'pre_pay'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Pay Now (Billing Counter)
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {effectiveBillingMode === 'pre_pay'
                        ? 'Patient pays the consultation fee upfront before being seen by the doctor.'
                        : 'Patient is seen first; consultation, labs and pharmacy are settled in one bill at checkout.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          </div>{/* end scrollable content */}

          {/* Already in queue warning — shown immediately when patient selected */}
          {existingQueueEntry && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm mt-2">
              <p>Patient <strong>{selectedPatient?.fullName}</strong> is already in queue with token <strong>{existingQueueEntry.ticketNumber}</strong></p>
              <button
                onClick={() => { setSelectedPatient(null); setError(null); setSearchTerm(''); setSearchParams({}); }}
                className="mt-1 text-xs font-medium text-blue-600 hover:underline"
              >
                Select a different patient →
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && !existingQueueEntry && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mt-2">
              <p>{error}</p>
              {error.includes('already in queue') && (
                <button
                  onClick={() => { setSelectedPatient(null); setError(null); setSearchTerm(''); setSearchParams({}); }}
                  className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  Select a different patient →
                </button>
              )}
            </div>
          )}

          {/* Issue Button — always visible at bottom */}
          <button
            onClick={handleIssueToken}
            disabled={!selectedPatient || !!existingQueueEntry || issueTokenMutation.isPending}
            className="btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 flex-shrink-0"
          >
            {issueTokenMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Receipt className="w-5 h-5" />
                {existingQueueEntry ? 'Already in Queue' : 'Issue Token'}
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
