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
  Wallet,
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


// Use canonical shared payment-method type for the entire platform.
import type { PaymentMethod as PaymentType } from '../shared/payment-methods';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { Select as UiSelect } from '../components/ui';

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

  // Live preview of the resolved consultation fee for the currently-selected doctor + dept.
  // Resolves the same chain the backend uses: doctor profile → specialty → tenant default.
  const { data: feePreview } = useQuery<{
    fee: number;
    source: string;
    feeMode?: string;
    employmentType?: string;
    isFollowUp?: boolean;
  } | null>({
    queryKey: ['doctor-fee-preview', selectedDoctor, selectedDepartment],
    enabled: selectedDoctor !== 'any',
    queryFn: async () => {
      const res = await api.get('/doctor-fees/preview', {
        params: {
          doctorId: selectedDoctor,
          departmentId: selectedDepartment || undefined,
        },
      });
      return res.data;
    },
    staleTime: 30 * 1000,
  });
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
          // Service Patient and store PatientRecord differ slightly (optional
          // timestamps) — shapes are display-compatible here
          setSelectedPatient({
            ...patient,
            paymentType: 'cash' as const,
          } as unknown as PatientRecord);
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

  // Department is optional — do NOT auto-select. Reception may leave it blank
  // for general OPD; assignment happens at consultation if needed.

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

  // Derived queue analytics — single source of truth so counters & banners agree.
  const NON_CLINICAL_DEPT_PATTERN =
    /\b(admin|administration|procure|procurement|it|i\.?t\.?|information\s*tech|hr|human\s*resources?|finance|accounting?|billing\s*office|management|directors?|board)\b/i;
  const clinicalDepartments = useMemo(
    () =>
      (departments || []).filter(
        (d) => d.status !== 'inactive' && !NON_CLINICAL_DEPT_PATTERN.test(d.name || ''),
      ),
    [departments],
  );

  const queueAnalytics = useMemo(() => {
    const list = todayQueue || [];
    const byStatus = (s: string | string[]) =>
      list.filter((t: any) => (Array.isArray(s) ? s : [s]).includes(t.status));
    const pendingPayment = byStatus('pending_payment');
    const waiting = byStatus('waiting');
    const called = byStatus('called');
    const inService = byStatus('in_service');
    const completed = byStatus('completed');
    const active = [...pendingPayment, ...waiting, ...called, ...inService];
    const sortedByTicket = [...list].sort((a: any, b: any) => {
      const numA = parseInt(String(a.ticketNumber).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.ticketNumber).replace(/\D/g, ''), 10) || 0;
      return numB - numA;
    });
    const lastIssued = sortedByTicket[0] || null;
    const nowServing = called[0] || inService[0] || null;
    // Estimated wait = (waiting + pending payment) × avg consultation (15m)
    // Cap at backend value if reasonable; otherwise compute from queue length.
    const avgPerPatient = 15;
    const computedWait = (waiting.length + pendingPayment.length) * avgPerPatient;
    const rawBackendWait = queueStats?.averageWaitMinutes;
    const estimatedWait =
      rawBackendWait && rawBackendWait > 0 && rawBackendWait < 120
        ? Math.round(rawBackendWait)
        : computedWait;
    return {
      pendingPayment,
      waiting,
      called,
      inService,
      completed,
      active,
      totalToday: list.length,
      lastIssued,
      nowServing,
      estimatedWait,
    };
  }, [todayQueue, queueStats]);

  // Patient age helper
  const patientAge = useMemo(() => {
    if (!selectedPatient?.dateOfBirth) return null;
    const dob = new Date(selectedPatient.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const diff = Date.now() - dob.getTime();
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    if (years < 2) {
      const months = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
      return `${months}mo`;
    }
    return `${years}y`;
  }, [selectedPatient]);

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

    // Department is optional — patient defaults to General OPD pool when not chosen.
    // (Validation removed; backend already accepts undefined departmentId.)

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

  // Keyboard shortcut: Ctrl/⌘+Enter to issue token from anywhere on the page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (selectedPatient && !existingQueueEntry && !issueTokenMutation.isPending) {
          e.preventDefault();
          handleIssueToken();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, existingQueueEntry, chiefComplaint, selectedDepartment, selectedDoctor, visitType, conditionFlags, paymentType]);
  
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
      <div className="max-w-lg mx-auto p-6">
        {/* Screen View */}
        <div className="print:hidden">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-surface-900 mb-2">Token Issued!</h2>

            {/*
             * Truth source = backend-issued queue status:
             *   pending_payment → patient must clear billing counter first (pre-pay flows)
             *   anything else (waiting/called/in_service) → patient is already in queue
             *     (post-pay flows, or coverage methods that bypass the counter)
             */}
            {issuedToken.status === 'pending_payment' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                <Banknote className="w-4 h-4" />
                Proceed to Billing Counter to pay
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                <Users className="w-4 h-4" />
                Patient is now in queue
              </span>
            )}
          </div>

          {/* Paper token */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-[0_8px_30px_rgba(15,23,42,0.08)] overflow-hidden mb-4">
            {/* Facility strip */}
            <div className="bg-brand-700 text-white text-center px-4 py-2.5">
              <p className="text-sm font-semibold tracking-wide">{inst.name}</p>
              <p className="text-[11px] text-brand-200 uppercase tracking-widest">OPD Queue Token</p>
            </div>

            <div className="px-6 py-5 text-center">
              <p className="text-xs text-surface-500 uppercase tracking-widest mb-1">Token Number</p>
              <p className="text-6xl font-mono font-extrabold text-surface-900 tracking-tight leading-none">
                {issuedToken.ticketNumber}
              </p>
            </div>

            {/* Perforation */}
            <div className="relative border-t-2 border-dashed border-surface-200 mx-4">
              <span className="absolute -left-6 -top-2.5 w-5 h-5 bg-surface-50 rounded-full border border-surface-200" />
              <span className="absolute -right-6 -top-2.5 w-5 h-5 bg-surface-50 rounded-full border border-surface-200" />
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center justify-center gap-2 text-surface-800 mb-1">
                <UserCircle className="w-5 h-5 text-surface-400" />
                <span className="font-semibold">{selectedPatient.fullName}</span>
              </div>
              <p className="text-sm text-surface-500 text-center mb-4">MRN: {selectedPatient.mrn}</p>

              <div className="grid grid-cols-2 gap-3 text-sm bg-surface-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-surface-500">Department</p>
                  <p className="font-medium text-surface-900 capitalize">{departments?.find(d => d.id === selectedDepartment)?.name || selectedDepartment}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500">Date</p>
                  <p className="font-medium text-surface-900">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* Invoice info */}
              {(issuedToken as any).invoiceNumber && (
                <p className="text-xs text-surface-500 text-center mt-3">
                  Invoice <span className="font-mono font-medium">{(issuedToken as any).invoiceNumber}</span>
                  {' '}&bull;{' '}UGX {Number((issuedToken as any).invoiceAmount || 0).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Payment Instructions Section — only when backend marked the entry pending_payment. */}
          {issuedToken.status === 'pending_payment' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-center">
              <Banknote className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-amber-800 mb-1">Billing Required</p>
              <p className="text-xs text-amber-700 mb-3">
                Invoice <span className="font-mono font-medium">{(issuedToken as any).invoiceNumber || ''}</span> for UGX {Number((issuedToken as any).invoiceAmount || 0).toLocaleString()} has been created.
              </p>
              <p className="text-xs text-amber-600">
                Direct patient to <strong>Billing Counter</strong> to pay. Patient will join the waiting queue after payment is confirmed.
              </p>
            </div>
          )}

          {/* Post-pay flow with a counter-payable method — let cashier know charges accrue to a checkout bill. */}
          {issuedToken.status !== 'pending_payment' && ['cash', 'mobile_money', 'card'].includes(paymentType) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-center">
              <Wallet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-blue-800 mb-1">Pay at Checkout</p>
              {(issuedToken as any).invoiceNumber ? (
                <p className="text-xs text-blue-700 mb-1">
                  Consultation logged to invoice{' '}
                  <span className="font-mono font-medium">{(issuedToken as any).invoiceNumber}</span>
                  {' '}(UGX {Number((issuedToken as any).invoiceAmount || 0).toLocaleString()}).
                </p>
              ) : null}
              <p className="text-xs text-blue-700">
                Consultation, labs and pharmacy will be settled together when the patient checks out.
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

          <p className="text-sm text-surface-500 mb-4 text-center">
            {issuedToken.status === 'pending_payment'
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
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">OPD Token</h1>
          <p className="text-surface-500 text-sm">Issue queue tokens for outpatient visits</p>
        </div>
        <div className="flex items-center gap-2 text-surface-500 text-sm bg-white border border-surface-200 rounded-xl px-3 py-1.5">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main Content — sequential flow (left) + context rail (right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: the flow */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-1">
          {/* Step 1: Patient */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${selectedPatient ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-400'}`}>
                {selectedPatient ? '✓' : '1'}
              </span>
              Patient
            </h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                        <span>{selectedPatient.mrn}</span>
                        {patientAge && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{patientAge}</span>
                          </>
                        )}
                        {selectedPatient.gender && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="capitalize">{selectedPatient.gender}</span>
                          </>
                        )}
                        {selectedPatient.phone && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="font-mono">{selectedPatient.phone}</span>
                          </>
                        )}
                        {selectedPatient.bloodGroup && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded">
                            {selectedPatient.bloodGroup}
                          </span>
                        )}
                      </div>
                      {selectedPatient.allergies && (
                        <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Allergies: {selectedPatient.allergies}
                        </p>
                      )}
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

          {/* Step 2: Visit details — appears once a patient is chosen */}
          {selectedPatient && (
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-400 flex items-center justify-center text-xs font-bold">2</span>
              Visit Details
            </h2>
            <div className="space-y-4">

            {/* Department (hidden in simple workflow mode — auto-uses default department) */}
            {user?.workflowMode !== 'simple' && (
            <div>
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Department <span className="text-surface-400 font-normal normal-case">(optional — General OPD if blank)</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto content-start">
              <button
                onClick={() => { setSelectedDepartment(''); setSelectedDoctor('any'); }}
                className={`p-2 rounded border text-left transition-colors text-xs ${
                  !selectedDepartment
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                General OPD <span className="text-gray-400">(no dept)</span>
              </button>
              {clinicalDepartments.map((dept) => (
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
              {departments && departments.length > 0 && clinicalDepartments.length === 0 && (
                <p className="text-xs text-gray-400 col-span-2 text-center py-2">
                  No clinical departments — use General OPD or set up departments under
                  <Link to="/admin/hr/organisation" className="ml-1 text-blue-600 hover:underline">HR · Organisation</Link>
                </p>
              )}
            </div>
            </div>
            )}

            {/* Doctor — compact row (optional; usually "Any") */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Doctor <span className="text-surface-400 font-normal normal-case">(optional)</span></h3>
                <Link
                  to="/doctors/on-duty"
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1"
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

              <UiSelect
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                disabled={doctorsLoading}
              >
                <option value="any">Any available doctor — auto-assigned, shortest wait</option>
                {availableDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id} disabled={!doctor.available}>
                    {doctor.name} — {doctor.specialization}
                    {doctor.roomNumber ? ` · Room ${doctor.roomNumber}` : ''}
                    {doctor.available ? ` · ${doctor.currentQueue} waiting` : ' · unavailable'}
                  </option>
                ))}
              </UiSelect>
            </div>

            {/* Visit Type */}
            <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Visit Type</h3>
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
          <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Chief Complaint
              {visitType === 'new_visit' || visitType === 'emergency' ? (
                <span className="text-rose-500 ml-0.5">*</span>
              ) : (
                <span className="text-surface-400 font-normal normal-case ml-1">(optional)</span>
              )}
            </h3>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Fever and headache for 3 days..."
              rows={2}
              className="input text-sm w-full resize-none"
            />
          </div>

          {/* Patient Condition Flags */}
          <div>
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Patient Condition</h3>
            <p className="text-xs text-surface-500 mb-2">Select all that apply — auto-adjusts priority</p>
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

          </div>{/* end step-2 sections */}
          </div>
          )}{/* end step 2 */}

          {/* Step 3: Payment */}
          {selectedPatient && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-400 flex items-center justify-center text-xs font-bold">3</span>
                Payment
              </h2>
              
              {/* Canonical payment-method picker — driven by Admin → Finance → Payment Methods.
                  Replaces the previous bespoke two-row chip grid so every payment surface
                  (OPD, POS, billing, vendors) renders identical options. */}
              <PaymentMethodPicker
                value={paymentType}
                onChange={(m) => setPaymentType(m)}
                className="mb-3"
              />

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
                      value={consultationFeeInput !== '' ? consultationFeeInput : (feePreview?.fee ?? defaultConsultationFee ?? '')}
                      onChange={(e) => setConsultationFeeInput(e.target.value)}
                      placeholder={feePreview?.fee != null ? String(feePreview.fee) : (defaultConsultationFee != null ? String(defaultConsultationFee) : 'Configure default in Settings')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {feePreview && (() => {
                      const docName =
                        availableDoctors.find((d) => d.id === selectedDoctor)?.name ||
                        'Selected doctor';
                      const empMap: Record<string, string> = {
                        permanent: 'Permanent staff',
                        visiting: 'Visiting consultant',
                        locum: 'Locum',
                        contract: 'Contract',
                      };
                      let basis = '';
                      switch (feePreview.feeMode) {
                        case 'flat':
                          basis = `${docName}'s flat rate`;
                          break;
                        case 'percent_of_specialty':
                          basis = `${docName} — % of specialty rate`;
                          break;
                        case 'split':
                          basis = `${docName} — revenue share`;
                          break;
                        default:
                          basis = feePreview.isFollowUp
                            ? `${docName} — follow-up rate`
                            : `${docName}'s rate`;
                      }
                      const empLabel = feePreview.employmentType
                        ? empMap[feePreview.employmentType] || feePreview.employmentType
                        : null;
                      return (
                        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                          Resolved: <strong>{feePreview.fee.toLocaleString()} UGX</strong>
                          {' · '}{basis}
                          {feePreview.isFollowUp && feePreview.feeMode !== undefined && ' · follow-up'}
                          {empLabel && <span className="text-blue-600/70"> · {empLabel}</span>}
                        </p>
                      );
                    })()}
                    {!feePreview && defaultConsultationFee == null && (
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

          </div>{/* end left scroll region */}

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

          {/* Sticky action bar — fee summary + Issue always visible */}
          <div className="mt-2 flex items-center gap-3 bg-white border border-surface-200 rounded-2xl px-4 py-3 shadow-[0_-2px_12px_rgba(15,23,42,0.06)] flex-shrink-0">
            <div className="min-w-0">
              <p className="text-xs text-surface-500">Consultation fee</p>
              <p className="text-base font-bold text-surface-900 leading-tight">
                UGX {Number(CONSULTATION_FEE || 0).toLocaleString()}
                <span className="ml-2 text-xs font-medium text-surface-500 capitalize">{paymentType.replace(/_/g, ' ')}</span>
              </p>
            </div>
            <div className="flex-1" />
            <button
              onClick={handleIssueToken}
              disabled={!selectedPatient || !!existingQueueEntry || issueTokenMutation.isPending}
              className="btn-primary py-3 px-8 flex items-center justify-center gap-2 disabled:opacity-50"
              title="Tip: Ctrl/⌘+Enter to issue"
            >
              {issueTokenMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  {existingQueueEntry ? 'Already in Queue' : 'Issue Token'}
                  {selectedPatient && !existingQueueEntry && (
                    <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 border border-white/30 rounded">
                      Ctrl+↵
                    </kbd>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right rail: live token preview + queue monitor */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pb-1">
          {/* Token preview — builds up as the form is filled */}
          <div className="bg-white rounded-2xl border border-surface-200 shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden flex-shrink-0">
            <div className="bg-brand-700 text-white text-center px-4 py-2">
              <p className="text-[11px] uppercase tracking-widest text-brand-200">Token Preview</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-4xl font-mono font-extrabold tracking-tight leading-none text-surface-300">
                {queueAnalytics.lastIssued ? `#${String(queueAnalytics.lastIssued.ticketNumber).replace(/^#/, '')}` : '#—'}
              </p>
              <p className="text-[10px] text-surface-400 mt-1 uppercase tracking-wide">last issued — new token follows</p>
            </div>
            <div className="border-t-2 border-dashed border-surface-200 mx-3" />
            <div className="px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-surface-500">Patient</span>
                <span className="font-medium text-surface-900 truncate">{selectedPatient?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-surface-500">Department</span>
                <span className="font-medium text-surface-900 truncate">
                  {selectedDepartment ? (departments?.find(d => d.id === selectedDepartment)?.name || '—') : 'General OPD'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-surface-500">Doctor</span>
                <span className="font-medium text-surface-900 truncate">
                  {selectedDoctor === 'any' ? 'Any available' : (availableDoctors.find(d => d.id === selectedDoctor)?.name || '—')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-surface-500">Visit</span>
                <span className="font-medium text-surface-900 capitalize">{visitType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between gap-2 pt-1 border-t border-surface-100">
                <span className="text-surface-500">Fee</span>
                <span className="font-bold text-surface-900">UGX {Number(CONSULTATION_FEE || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Queue monitor */}
          <div className="card p-3 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Today's Queue</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span title="Active in queue today (waiting + serving + billing)">
                  <span className="font-medium text-gray-700">{queueAnalytics.active.length}</span> active
                  {queueAnalytics.totalToday > queueAnalytics.active.length && (
                    <span className="text-gray-400"> / {queueAnalytics.totalToday}</span>
                  )}
                </span>
                <span className="text-gray-300">|</span>
                <span title={queueAnalytics.estimatedWait > 0 ? `Based on ${queueAnalytics.waiting.length + queueAnalytics.pendingPayment.length} ahead × ~15m` : 'No wait'}>
                  ⏱ {queueAnalytics.estimatedWait > 0 ? `~${queueAnalytics.estimatedWait}m` : '0m'}
                </span>
              </div>
            </div>
            {/* Currently-serving banner */}
            {queueAnalytics.nowServing && (
              <div className="mb-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-blue-700">#{queueAnalytics.nowServing.ticketNumber}</span>
                  <span className="truncate text-gray-700">
                    {queueAnalytics.nowServing.patient?.fullName || 'Patient'}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-blue-600 font-medium">
                  {queueAnalytics.nowServing.status === 'called' ? 'Called' : 'In service'}
                </span>
              </div>
            )}

            {/* Last issued ticket */}
            {queueAnalytics.lastIssued && (
              <div className="mb-2 text-[11px] text-gray-500 flex items-center justify-between">
                <span>Last issued</span>
                <span className="font-mono font-medium text-gray-700">
                  #{queueAnalytics.lastIssued.ticketNumber}
                </span>
              </div>
            )}

            <div className="space-y-1.5 flex-shrink-0">
              <div className="flex items-center justify-between px-2 py-1 bg-amber-50 rounded">
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs text-amber-700">At Billing</span>
                </div>
                <span className="text-base font-bold text-amber-700">
                  {queueAnalytics.pendingPayment.length}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-yellow-50 rounded">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                  <span className="text-xs text-yellow-700">Waiting</span>
                </div>
                <span className="text-base font-bold text-yellow-700">
                  {queueAnalytics.waiting.length}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-blue-50 rounded">
                <div className="flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-700">Serving</span>
                </div>
                <span className="text-base font-bold text-blue-700">
                  {queueAnalytics.inService.length + queueAnalytics.called.length}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-green-50 rounded">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs text-green-700">Done</span>
                </div>
                <span className="text-base font-bold text-green-700">
                  {queueAnalytics.completed.length}
                </span>
              </div>
            </div>
            
            {/* Queue List */}
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-gray-500 mb-1">Patients in Queue:</p>
              <div className="overflow-y-auto space-y-1 max-h-[100px]">
                {queueAnalytics.active.length > 0 ? (
                  queueAnalytics.active
                    .slice(0, 10)
                    .map((entry) => (
                      <div 
                        key={entry.id} 
                        className={`flex items-center justify-between p-1.5 rounded text-xs group ${
                          entry.status === 'called' || entry.status === 'in_service'
                            ? 'bg-blue-100'
                            : entry.status === 'pending_payment'
                            ? 'bg-amber-50'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`font-mono font-bold ${
                            entry.status === 'called' || entry.status === 'in_service'
                              ? 'text-blue-700'
                              : entry.status === 'pending_payment'
                              ? 'text-amber-700'
                              : 'text-gray-700'
                          }`}>
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
                          {entry.status === 'in_service' && (
                            <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                              Serving
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
                {queueAnalytics.active.length > 10 && (
                  <p className="text-xs text-gray-400 text-center">
                    +{queueAnalytics.active.length - 10} more...
                  </p>
                )}
              </div>
            </div>
          </div>
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
