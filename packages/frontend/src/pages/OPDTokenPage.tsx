import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import QuickRegModal from '../components/QuickRegModal';
import { confirmDialog } from '../components/ConfirmDialog';
import { useInstitutionInfo } from '../lib/useInstitutionInfo';
import { printService } from '../lib/print';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  UserCircle,
  Receipt,
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
  UserPlus,
  ChevronDown,
  Pencil,
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
import { Select as UiSelect, Badge, cn } from '../components/ui';

// Fallback quick-pick complaints (facility can override via setting `opd.common_complaints`)
const DEFAULT_COMPLAINTS = [
  'Fever',
  'Cough',
  'Headache',
  'Abdominal pain',
  'Diarrhoea',
  'Vomiting',
  'Body weakness',
  'Chest pain',
  'Wound / Injury',
  'Review',
];

type TicketEditor = 'visit' | 'department' | 'doctor' | 'payment' | null;

/** Hide values that are still PII-ciphertext (legacy rows encrypted before the key rotation). */
const displayable = (v?: string | null): string | undefined =>
  v && !String(v).startsWith('v1:') ? String(v) : undefined;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  insurance: 'Insurance',
  membership: 'Membership',
  hospital_scheme: 'Hospital Scheme',
  staff: 'Staff Benefit',
  credit: 'Credit / Corporate',
};

const VISIT_OPTIONS: Array<{ value: VisitType; label: string; icon: React.ReactNode }> = [
  { value: 'new_visit', label: 'New Visit', icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { value: 'follow_up', label: 'Follow-up', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  { value: 'emergency', label: 'Emergency', icon: <Siren className="w-3.5 h-3.5" /> },
  { value: 'referral', label: 'Referral', icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { value: 'lab_collection', label: 'Lab Only', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  { value: 'pharmacy_pickup', label: 'Pharmacy', icon: <Pill className="w-3.5 h-3.5" /> },
];

const CONDITION_OPTIONS = [
  { flag: 'elderly', label: 'Elderly', icon: <UserCircle className="w-3.5 h-3.5" /> },
  { flag: 'pregnant', label: 'Pregnant', icon: <Heart className="w-3.5 h-3.5" /> },
  { flag: 'child', label: 'Child', icon: <Baby className="w-3.5 h-3.5" /> },
  { flag: 'disabled', label: 'Wheelchair', icon: <Accessibility className="w-3.5 h-3.5" /> },
  { flag: 'appears_unwell', label: 'Unwell', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  { flag: 'emergency', label: 'Critical', icon: <Siren className="w-3.5 h-3.5" /> },
];

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

  // Clinical fields
  const [visitType, setVisitType] = useState<VisitType>('new_visit');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [conditionFlags, setConditionFlags] = useState<string[]>([]);
  const [showQuickRegModal, setShowQuickRegModal] = useState(false);

  // POS-flow UI state
  const [activeEditor, setActiveEditor] = useState<TicketEditor>(null);
  const [freeTextComplaint, setFreeTextComplaint] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    : (feePreview?.fee ?? defaultConsultationFee ?? 0);
  const CONSULTATION_FEE = effectiveConsultationFee;

  // Per-visit billing timing override; defaults to tenant setting (post_pay if unset)
  const [billingMode, setBillingMode] = useState<'pre_pay' | 'post_pay' | ''>('');
  const effectiveBillingMode: 'pre_pay' | 'post_pay' =
    billingMode || billingConfig?.mode || 'post_pay';

  // Facility-configurable quick-pick complaints
  const { data: commonComplaints } = useQuery<string[]>({
    queryKey: ['opd-common-complaints'],
    queryFn: async () => {
      try {
        const res = await api.get<{ value?: unknown }>('/settings/opd.common_complaints');
        const value = res.data?.value;
        if (Array.isArray(value) && value.every(v => typeof v === 'string') && value.length > 0) {
          return value as string[];
        }
      } catch {
        // fall through to defaults
      }
      return DEFAULT_COMPLAINTS;
    },
    staleTime: 10 * 60 * 1000,
  });
  const complaintChips = commonComplaints || DEFAULT_COMPLAINTS;

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
        paymentType: (p.metadata?.paymentType === 'insurance' ? 'insurance' : 'cash') as PatientRecord['paymentType'],
      })), ...localPatients.filter(lp => !apiList.some((ap: any) => ap.id === lp.id))]
    : localPatients;

  /**
   * Select a patient and pre-fill the ticket from what the system already
   * knows: stored payment preference, follow-up inference, last department.
   * Edit-by-exception: the receptionist only touches what's different today.
   */
  const selectPatient = useCallback((p: PatientRecord & { metadata?: Record<string, any> }) => {
    setSelectedPatient(p);
    setActiveEditor(null);
    setError(null);

    // Payment default from the patient record (set at registration)
    const meta = (p as any).metadata || {};
    if (meta.paymentType === 'insurance' || p.paymentType === 'insurance') {
      setPaymentType('insurance');
      setInsurance(prev => ({
        ...prev,
        provider: meta.insuranceProvider || prev.provider,
        policyNumber: meta.insuranceId || prev.policyNumber,
      }));
    } else {
      setPaymentType('cash');
    }

    // Follow-up + last-department inference from the most recent encounter.
    // Best-effort: any failure leaves the standard defaults untouched.
    api.get('/encounters', { params: { patientId: p.id, limit: 1 } })
      .then(res => {
        const body: any = res.data;
        const list = Array.isArray(body) ? body : (body?.data || []);
        const last = list[0];
        if (!last) return;
        const lastDate = new Date(last.startTime || last.createdAt || 0).getTime();
        const days = (Date.now() - lastDate) / 86400000;
        if (days >= 0 && days <= 14) {
          setVisitType('follow_up');
        }
        if (last.departmentId) {
          setSelectedDepartment(prev => prev || last.departmentId);
        }
      })
      .catch(() => { /* non-blocking inference */ });
  }, []);

  // Load patient from URL param (when coming from patient profile)
  useEffect(() => {
    if (urlPatientId && !selectedPatient) {
      patientsService.getById(urlPatientId).then(patient => {
        if (patient) {
          // Service Patient and store PatientRecord differ slightly (optional
          // timestamps) — shapes are display-compatible here
          selectPatient({
            ...patient,
            paymentType: 'cash' as const,
          } as unknown as PatientRecord);
        }
      }).catch(err => {
        console.error('Failed to load patient:', err);
      });
    }
  }, [urlPatientId, selectedPatient, selectPatient]);

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

  const handleRemoveFromQueue = async (id: string, patientName: string) => {
    const ok = await confirmDialog({
      title: 'Remove from queue',
      message: `Remove ${patientName} from today's queue? Their token becomes invalid.`,
      confirmLabel: 'Remove',
      variant: 'warning',
    });
    if (ok) cancelQueueMutation.mutate(id);
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

  const handlePrintToken = useCallback(() => {
    if (!issuedToken || !selectedPatient) return;
    const deptName = departments?.find(d => d.id === selectedDepartment)?.name || selectedDepartment || '';
    const invoiceNum = (issuedToken as any).invoiceNumber || '';
    const invoiceAmt = Number((issuedToken as any).invoiceAmount) || 0;
    const needsPayment = issuedToken.status === 'pending_payment';

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
  }, [issuedToken, selectedPatient, departments, selectedDepartment, inst]);

  const handleReset = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setSelectedPatient(null);
    setSearchTerm('');
    setSelectedDepartment('');
    setSelectedDoctor('any');
    setIssuedToken(null);
    setPaymentType('cash');
    setInsurance({ provider: '', policyNumber: '', expiryDate: '' });
    setMembership({ cardNumber: '', balance: 0 });
    setStaffId('');
    setBiometricVerified(false);
    setStaffCoverage(null);
    setError(null);
    setVisitType('new_visit');
    setChiefComplaint('');
    setConditionFlags([]);
    setConsultationFeeInput('');
    setBillingMode('');
    setActiveEditor(null);
    setFreeTextComplaint(false);
    setHighlightIdx(0);
    setSearchParams({});
    // Back to State A: cursor ready for the next person
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [setSearchParams]);

  // ── State C: auto-print + flash + auto-reset ──────────────────────────────
  useEffect(() => {
    if (issuedToken && selectedPatient) {
      handlePrintToken(); // printing IS the confirmation (thermal printer)
      resetTimerRef.current = setTimeout(() => handleReset(), 5000);
      return () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuedToken]);

  // ── Keyboard grammar ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Ctrl/⌘+Enter issues from anywhere (works inside fields too)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (selectedPatient && !issuedToken && !existingQueueEntry && !issueTokenMutation.isPending) {
          e.preventDefault();
          handleIssueToken();
        }
        return;
      }

      if (issuedToken) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          handleReset();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (activeEditor) {
          setActiveEditor(null);
        } else if (selectedPatient) {
          handleReset();
        }
        return;
      }

      // Plain Enter on the ticket (not inside a field) → issue
      if (e.key === 'Enter' && !inField && selectedPatient && !activeEditor) {
        if (!existingQueueEntry && !issueTokenMutation.isPending) {
          e.preventDefault();
          handleIssueToken();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, existingQueueEntry, issuedToken, activeEditor, chiefComplaint, selectedDepartment, selectedDoctor, visitType, conditionFlags, paymentType]);

  const deptName = selectedDepartment
    ? (departments?.find(d => d.id === selectedDepartment)?.name || '—')
    : 'General OPD';
  const doctorName = selectedDoctor === 'any'
    ? 'Any available'
    : (availableDoctors.find(d => d.id === selectedDoctor)?.name || '—');

  const toggleEditor = (ed: TicketEditor) =>
    setActiveEditor(prev => (prev === ed ? null : ed));

  // ── Ticket row helper ─────────────────────────────────────────────────────
  const TicketRow = ({ editor, label, value, sub }: { editor: TicketEditor; label: string; value: React.ReactNode; sub?: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleEditor(editor)}
      className={cn(
        'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors',
        activeEditor === editor ? 'bg-brand-50/60' : 'hover:bg-surface-50',
      )}
    >
      <span className="text-sm text-surface-500 w-24 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 text-right">
        <span className="text-sm font-medium text-surface-900 truncate">{value}</span>
        {sub && <span className="block text-xs text-surface-400 truncate">{sub}</span>}
      </span>
      <ChevronDown className={cn('w-4 h-4 text-surface-300 shrink-0 transition-transform', activeEditor === editor && 'rotate-180')} />
    </button>
  );

  // ═══ State C: issued — flash, auto-printed, auto-reset ═══════════════════
  if (issuedToken && selectedPatient) {
    const pending = issuedToken.status === 'pending_payment';
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center animate-fade-in max-w-md w-full px-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-sm text-surface-500 uppercase tracking-widest mb-1">Token issued · printing…</p>
          <p className="text-7xl font-mono font-extrabold text-surface-900 tracking-tight mb-3">
            {issuedToken.ticketNumber}
          </p>
          <p className="text-lg font-semibold text-surface-800 mb-1">{selectedPatient.fullName}</p>

          {pending ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-base font-semibold mt-2">
              <Banknote className="w-5 h-5" />
              Direct patient to Billing Counter
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-800 rounded-full text-base font-semibold mt-2">
              <Users className="w-5 h-5" />
              Patient joins the queue — wait to be called
            </div>
          )}

          {(issuedToken as any).invoiceNumber && (
            <p className="text-xs text-surface-500 mt-3">
              Invoice <span className="font-mono">{(issuedToken as any).invoiceNumber}</span>
              {' '}· UGX {Number((issuedToken as any).invoiceAmount || 0).toLocaleString()}
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-3">
            <button onClick={handlePrintToken} className="btn-secondary text-sm">
              Reprint
            </button>
            <button onClick={handleReset} className="btn-primary px-6" autoFocus>
              Next patient
              <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 border border-white/30 rounded">↵</kbd>
            </button>
          </div>
          <p className="text-xs text-surface-400 mt-3">Returning to search automatically…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header: title + one-line ambient queue strip */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">OPD Token</h1>
          <p className="text-surface-500 text-sm">Serve the next patient</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowQueuePanel(v => !v)}
            className="flex items-center gap-3 text-sm text-surface-500 bg-white border border-surface-200 rounded-xl px-3 py-1.5 hover:border-brand-300 transition-colors"
            title="Toggle queue details"
          >
            <span><span className="font-semibold text-surface-800">{queueAnalytics.active.length}</span> active</span>
            <span className="text-surface-300">·</span>
            <span>~{queueAnalytics.estimatedWait}m</span>
            <span className="text-surface-300">·</span>
            <span className="font-mono text-brand-600 font-medium">
              {queueAnalytics.nowServing ? `#${queueAnalytics.nowServing.ticketNumber}` : '—'} serving
            </span>
            <span className="text-surface-300">·</span>
            <span className="font-mono">last {queueAnalytics.lastIssued ? `#${queueAnalytics.lastIssued.ticketNumber}` : '—'}</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showQueuePanel && 'rotate-180')} />
          </button>
          <div className="hidden md:flex items-center gap-2 text-surface-500 text-sm bg-white border border-surface-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Collapsible queue panel (monitoring lives OFF the main flow) */}
      {showQueuePanel && (
        <div className="mb-4 card p-3 flex-shrink-0 max-h-56 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
            <div className="bg-amber-50 rounded-lg py-1.5"><p className="text-lg font-bold text-amber-700">{queueAnalytics.pendingPayment.length}</p><p className="text-xs text-amber-700">At Billing</p></div>
            <div className="bg-yellow-50 rounded-lg py-1.5"><p className="text-lg font-bold text-yellow-700">{queueAnalytics.waiting.length}</p><p className="text-xs text-yellow-700">Waiting</p></div>
            <div className="bg-brand-50 rounded-lg py-1.5"><p className="text-lg font-bold text-brand-700">{queueAnalytics.inService.length + queueAnalytics.called.length}</p><p className="text-xs text-brand-700">Serving</p></div>
            <div className="bg-emerald-50 rounded-lg py-1.5"><p className="text-lg font-bold text-emerald-700">{queueAnalytics.completed.length}</p><p className="text-xs text-emerald-700">Done</p></div>
          </div>
          {queueAnalytics.active.length > 0 ? (
            <div className="space-y-1">
              {queueAnalytics.active.slice(0, 15).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between px-2 py-1 rounded-lg text-sm bg-surface-50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-surface-700">{entry.ticketNumber}</span>
                    <span className="truncate text-surface-600">{entry.patient?.fullName || 'Patient'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {entry.status === 'called' && <Badge tone="brand">Called</Badge>}
                    {entry.status === 'in_service' && <Badge tone="brand" dot>Serving</Badge>}
                    {entry.status === 'pending_payment' && <Badge tone="warning">Pay</Badge>}
                    {entry.status === 'waiting' && <Badge tone="neutral">Waiting</Badge>}
                    <button
                      onClick={() => handleRemoveFromQueue(entry.id, entry.patient?.fullName || 'Patient')}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 rounded transition-opacity"
                      title="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-400 text-center py-2">Queue is empty</p>
          )}
        </div>
      )}

      {/* ═══ State A: WHO? — nothing but search ═══ */}
      {!selectedPatient && (
        <div className="flex-1 flex flex-col items-center pt-[8vh]">
          <div className="w-full max-w-xl px-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-surface-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type name, MRN or phone…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setHighlightIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, (patients?.length || 1) - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
                  if (e.key === 'Enter' && patients && patients[highlightIdx]) {
                    e.preventDefault();
                    selectPatient(patients[highlightIdx] as any);
                  }
                }}
                className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-surface-200 rounded-2xl shadow-sm
                  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all"
                autoFocus
              />
              {searchLoading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-brand-500" />
              )}
            </div>

            {/* Results as big tappable cards */}
            {searchTerm.length >= 2 && patients && patients.length > 0 && (
              <div className="mt-3 bg-white border border-surface-200 rounded-2xl shadow-lg divide-y divide-surface-100 overflow-hidden">
                {patients.slice(0, 8).map((patient: any, i: number) => (
                  <button
                    key={patient.id}
                    onClick={() => selectPatient(patient)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      i === highlightIdx ? 'bg-brand-50' : 'hover:bg-surface-50',
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {(patient.fullName || '?').split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-surface-900 truncate">{patient.fullName}</p>
                      <p className="text-sm text-surface-500 truncate">
                        {patient.mrn}
                        {patient.gender && <span className="capitalize"> · {patient.gender}</span>}
                        {displayable(patient.phone) && <span className="font-mono"> · {displayable(patient.phone)}</span>}
                      </p>
                    </div>
                    {i === highlightIdx && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface-100 border border-surface-200 rounded text-surface-500">↵</kbd>
                    )}
                  </button>
                ))}
              </div>
            )}

            {searchTerm.length >= 2 && !searchLoading && patients && patients.length === 0 && (
              <div className="mt-3 text-center py-6 bg-white border border-surface-200 rounded-2xl">
                <p className="text-surface-500 mb-3">No patient found for “{searchTerm}”</p>
                <button onClick={() => setShowQuickRegModal(true)} className="btn-primary inline-flex">
                  <UserPlus className="w-4 h-4" /> Register new patient
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <button onClick={() => setShowQuickRegModal(true)} className="text-brand-600 hover:underline flex items-center gap-1">
                <UserPlus className="w-4 h-4" /> New patient
              </button>
              <span className="text-surface-300">·</span>
              <Link to="/patients" className="text-brand-600 hover:underline">All patients</Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ State B: CONFIRM THE TICKET — pre-filled, edit by exception ═══ */}
      {selectedPatient && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-2 pb-6">
            <div className="bg-white rounded-2xl border border-surface-200 shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
              {/* Patient header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-50 border-b border-surface-200">
                <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
                  {(selectedPatient.fullName || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-surface-900 truncate">{selectedPatient.fullName}</p>
                  <p className="text-sm text-surface-500 truncate">
                    {selectedPatient.mrn}
                    {patientAge && ` · ${patientAge}`}
                    {selectedPatient.gender && <span className="capitalize"> · {selectedPatient.gender}</span>}
                    {displayable(selectedPatient.phone) && <span className="font-mono"> · {displayable(selectedPatient.phone)}</span>}
                  </p>
                  {selectedPatient.allergies && (
                    <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> Allergies: {String(selectedPatient.allergies)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-brand-600 hover:underline shrink-0"
                  title="Esc"
                >
                  Change
                </button>
              </div>

              {/* Already in queue → the ticket becomes a notice */}
              {existingQueueEntry ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-surface-800 font-semibold mb-1">Already in today's queue</p>
                  <p className="text-sm text-surface-500 mb-4">
                    Token <span className="font-mono font-bold text-surface-800">{existingQueueEntry.ticketNumber}</span>
                    {' '}· status: <span className="capitalize">{String(existingQueueEntry.status).replace(/_/g, ' ')}</span>
                  </p>
                  <button onClick={handleReset} className="btn-secondary">Next patient (Esc)</button>
                </div>
              ) : (
                <>
                  {/* Complaint — the ONE required input: chips first, typing optional */}
                  <div className="px-4 py-3 border-b border-surface-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-surface-500 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" /> Complaint
                        {(visitType === 'new_visit' || visitType === 'emergency') && <span className="text-rose-500">*</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFreeTextComplaint(v => !v)}
                        className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> {freeTextComplaint ? 'Quick picks' : 'Type instead'}
                      </button>
                    </div>
                    {freeTextComplaint ? (
                      <textarea
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder="e.g. Fever and headache for 3 days…"
                        rows={2}
                        className="input text-sm w-full resize-none"
                        autoFocus
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {complaintChips.map((c) => {
                          const active = chiefComplaint === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setChiefComplaint(active ? '' : c)}
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                                active
                                  ? 'bg-brand-600 text-white border-brand-600 font-medium'
                                  : 'bg-white border-surface-200 text-surface-700 hover:border-brand-300',
                              )}
                            >
                              {c}
                            </button>
                          );
                        })}
                        {chiefComplaint && !complaintChips.includes(chiefComplaint) && (
                          <span className="px-3 py-1.5 rounded-full text-sm bg-brand-600 text-white font-medium">
                            {chiefComplaint}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pre-answered lines — tap only what's different today */}
                  <div className="divide-y divide-surface-100">
                    <TicketRow
                      editor="visit"
                      label="Visit"
                      value={VISIT_OPTIONS.find(v => v.value === visitType)?.label || visitType}
                      sub={visitType === 'follow_up' ? 'inferred from recent visit' : undefined}
                    />
                    {activeEditor === 'visit' && (
                      <div className="px-4 py-3 bg-brand-50/40">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {VISIT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setVisitType(opt.value); setActiveEditor(null); }}
                              className={cn(
                                'p-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors',
                                visitType === opt.value
                                  ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                                  : 'border-surface-200 bg-white hover:border-surface-300',
                              )}
                            >
                              {opt.icon}{opt.label}
                            </button>
                          ))}
                        </div>
                        {visitType !== 'new_visit' && visitType !== 'emergency' && visitType !== 'referral' && (
                          <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                            ✓ Routes directly to {
                              visitType === 'follow_up' ? 'consultation' :
                              visitType === 'lab_collection' ? 'laboratory' :
                              visitType === 'pharmacy_pickup' ? 'pharmacy' : 'appropriate service point'
                            } — skips triage
                          </p>
                        )}
                      </div>
                    )}

                    {user?.workflowMode !== 'simple' && (
                      <>
                        <TicketRow editor="department" label="Department" value={deptName} />
                        {activeEditor === 'department' && (
                          <div className="px-4 py-3 bg-brand-50/40">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto content-start">
                              <button
                                onClick={() => { setSelectedDepartment(''); setSelectedDoctor('any'); setActiveEditor(null); }}
                                className={cn(
                                  'p-2 rounded-lg border text-left text-sm transition-colors',
                                  !selectedDepartment
                                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                                    : 'border-surface-200 bg-white hover:border-surface-300',
                                )}
                              >
                                General OPD <span className="text-surface-400">(no dept)</span>
                              </button>
                              {clinicalDepartments.map((dept) => (
                                <button
                                  key={dept.id}
                                  onClick={() => { setSelectedDepartment(dept.id); setSelectedDoctor('any'); setActiveEditor(null); }}
                                  className={cn(
                                    'p-2 rounded-lg border text-left text-sm transition-colors',
                                    selectedDepartment === dept.id
                                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                                      : 'border-surface-200 bg-white hover:border-surface-300',
                                  )}
                                >
                                  {dept.name}
                                </button>
                              ))}
                              {(!departments || departments.length === 0) && (
                                <p className="text-xs text-surface-400 col-span-2 text-center py-4">No departments configured</p>
                              )}
                              {departments && departments.length > 0 && clinicalDepartments.length === 0 && (
                                <p className="text-xs text-surface-400 col-span-2 text-center py-2">
                                  No clinical departments — use General OPD or set up departments under
                                  <Link to="/admin/hr/organisation" className="ml-1 text-brand-600 hover:underline">HR · Organisation</Link>
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <TicketRow
                      editor="doctor"
                      label="Doctor"
                      value={doctorName}
                      sub={selectedDoctor === 'any' ? 'auto-assigned · shortest wait' : undefined}
                    />
                    {activeEditor === 'doctor' && (
                      <div className="px-4 py-3 bg-brand-50/40 space-y-2">
                        {!doctorsLoading && availableDoctors.length === 0 && (
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
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
                          onChange={(e) => { setSelectedDoctor(e.target.value); setActiveEditor(null); }}
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
                        <div className="text-right">
                          <Link to="/doctors/on-duty" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Manage duty roster
                          </Link>
                        </div>
                      </div>
                    )}

                    <TicketRow
                      editor="payment"
                      label="Payment"
                      value={
                        <>
                          {PAYMENT_LABELS[paymentType] || paymentType}
                          {' — UGX '}{Number(CONSULTATION_FEE || 0).toLocaleString()}
                        </>
                      }
                      sub={
                        paymentType === 'cash'
                          ? (effectiveBillingMode === 'pre_pay' ? 'pay now at billing counter' : 'pay at checkout')
                          : paymentType === 'insurance'
                            ? (insurance.provider || 'select provider')
                            : (paymentType === 'hospital_scheme' || paymentType === 'staff')
                              ? (biometricVerified ? 'identity verified ✓' : 'fingerprint verification required')
                              : undefined
                      }
                    />
                    {activeEditor === 'payment' && (
                      <div className="px-4 py-3 bg-brand-50/40 space-y-3">
                        <PaymentMethodPicker
                          value={paymentType}
                          onChange={(m) => setPaymentType(m)}
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
                                className="input text-sm"
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
                  </div>

                  {/* Condition flags — always visible (safety) */}
                  <div className="px-4 py-3 border-t border-surface-100">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-surface-400 mr-1">Condition:</span>
                      {CONDITION_OPTIONS.map((c) => {
                        const active = conditionFlags.includes(c.flag);
                        return (
                          <button
                            key={c.flag}
                            onClick={() => setConditionFlags(active
                              ? conditionFlags.filter(f => f !== c.flag)
                              : [...conditionFlags, c.flag]
                            )}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors',
                              active
                                ? c.flag === 'emergency' || c.flag === 'appears_unwell'
                                  ? 'bg-rose-100 border-rose-400 text-rose-700 font-medium'
                                  : 'bg-amber-100 border-amber-400 text-amber-700 font-medium'
                                : 'bg-white border-surface-200 text-surface-500 hover:border-surface-400',
                            )}
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

                  {/* Error */}
                  {error && (
                    <div className="mx-4 mb-3 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  {/* The one action */}
                  <div className="p-4 pt-2">
                    <button
                      onClick={handleIssueToken}
                      disabled={issueTokenMutation.isPending || !chiefComplaint.trim()}
                      className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                      title="Enter to issue"
                    >
                      {issueTokenMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Receipt className="w-5 h-5" />
                          Issue Token — UGX {Number(CONSULTATION_FEE || 0).toLocaleString()}
                          <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 border border-white/30 rounded">↵</kbd>
                        </>
                      )}
                    </button>
                    {!chiefComplaint.trim() && (
                      <p className="text-xs text-surface-400 text-center mt-2">Pick a complaint chip above to enable</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick registration modal */}
      {showQuickRegModal && (
        <QuickRegModal
          isOpen={showQuickRegModal}
          onClose={() => setShowQuickRegModal(false)}
          onSuccess={(patient: any) => {
            setShowQuickRegModal(false);
            if (patient?.id) selectPatient(patient);
          }}
        />
      )}

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
