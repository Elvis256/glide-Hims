import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePatientStore, type PatientRecord } from '../store/patients';
import { patientsService, type CreatePatientDto } from '../services/patients';
import { queueService } from '../services/queue';
import { fetchAllCountries } from '../services/countriesService';
import { useUgandaLocation } from '../hooks/useUgandaLocation';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import SearchableSelect from '../components/SearchableSelect';
import {
  UserPlus,
  CheckCircle,
  ArrowLeft,
  User,
  Phone,
  Users,
  AlertTriangle,
  Camera,
  Upload,
  X,
  Check,
  Wallet,
  Stethoscope,
  Pencil,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  Badge,
  PageHeader,
  Steps,
  cn,
} from '../components/ui';

// Uganda Districts — now loaded dynamically via useUgandaLocation hook

// Religion options
const RELIGIONS = [
  'Catholic',
  'Protestant/Anglican',
  'Muslim',
  'Pentecostal/Born Again',
  'SDA',
  'Orthodox',
  'Traditional',
  'Other'
];

// Insurance providers
const INSURANCE_PROVIDERS = [
  'UAP',
  'Jubilee',
  'AAR',
  'ICEA',
  'Sanlam',
  'Liberty',
  'APA',
  'CIC',
  'GA Insurance',
  'Other'
];

// Corporate companies (sample list)
const CORPORATE_COMPANIES = [
  'MTN Uganda',
  'Airtel Uganda',
  'Stanbic Bank',
  'DFCU Bank',
  'Centenary Bank',
  'Bank of Uganda',
  'NSSF',
  'Uganda Revenue Authority',
  'Total Energies',
  'UMEME',
  'NWSC',
  'Parliament of Uganda',
  'Makerere University',
  'Other'
];

// Nationalities — now loaded dynamically from REST Countries API

interface FormData {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationality?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  allergies?: string;
  religion?: string;
  district?: string;
  subcounty?: string;
  parish?: string;
  paymentType?: 'cash' | 'insurance' | 'corporate';
  insuranceProvider?: string;
  insuranceId?: string;
  corporateName?: string;
  photoUrl?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

// NIN validation: 2 letters + 8 digits + 5 alphanumeric
const NIN_REGEX = /^[A-Z]{2}\d{8}[A-Z0-9]{5}$/i;

const validateNIN = (nin: string): boolean => {
  if (!nin) return false;
  return NIN_REGEX.test(nin.toUpperCase());
};

// Calculate age from DOB
const calculateAge = (dob: string): string => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  const today = new Date();

  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();

  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }

  if (today.getDate() < birthDate.getDate()) {
    months--;
    if (months < 0) months += 12;
  }

  if (years === 0) {
    return months === 1 ? '1 month' : `${months} months`;
  } else if (years === 1) {
    return '1 year';
  }
  return `${years} years`;
};

const STEPS = ['Identity', 'Contact & Address', 'Payment & Next of Kin'];

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addPatient = usePatientStore((state) => state.addPatient);
  const bizConfig = useBusinessConfig();
  const entityName = bizConfig.entityName;
  const regFields = bizConfig.registrationFields;
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<{ id: string; mrn: string; fullName: string } | null>(null);
  const [duplicates, setDuplicates] = useState<Array<{
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    gender: string;
    dateOfBirth: string;
    confidenceScore: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    matchReasons: string[];
    lastVisit?: string;
  }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [quickRegistration, setQuickRegistration] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [billImmediately, setBillImmediately] = useState(false);
  const [step, setStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Countries (all countries via REST Countries API with offline fallback)
  const [countries, setCountries] = useState<{ value: string; label: string; prefix: string }[]>([]);
  useEffect(() => {
    fetchAllCountries().then(list =>
      setCountries(list.map(c => ({ value: c.name, label: c.name, prefix: c.flag })))
    );
  }, []);

  // Uganda location cascade (district → sub-county → parish → village)
  const location = useUgandaLocation();

  const districtOptions = useMemo(
    () => location.districts.map(d => ({ value: d.name, label: d.name, prefix: d.region })),
    [location.districts]
  );
  const subcountyOptions = useMemo(
    () => location.subcounties.map(s => ({ value: s.name, label: s.name })),
    [location.subcounties]
  );
  const parishOptions = useMemo(
    () => location.parishes.map(p => ({ value: p.name, label: p.name })),
    [location.parishes]
  );

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    gender: 'male',
    dateOfBirth: '',
    nationality: '',
    nationalId: '',
    phone: '',
    email: '',
    address: '',
    occupation: '',
    maritalStatus: '',
    bloodGroup: '',
    allergies: '',
    religion: '',
    district: '',
    paymentType: 'cash',
    insuranceProvider: '',
    insuranceId: '',
    corporateName: '',
    photoUrl: '',
    nextOfKin: { name: '', phone: '', relationship: '' },
  });

  // Form validation
  const isNINValid = formData.nationalId ? validateNIN(formData.nationalId) : null;
  const calculatedAge = calculateAge(formData.dateOfBirth);

  const isFormValid =
    formData.fullName.trim() !== '' &&
    formData.gender !== undefined &&
    formData.dateOfBirth !== '';

  const isIdentityComplete = isFormValid && (isNINValid !== false);

  // Webcam handlers
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      streamRef.current = stream;
      setShowWebcam(true);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      toast.error('Could not access webcam. Please check permissions.');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowWebcam(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, photoUrl: dataUrl }));
        stopWebcam();
      }
    }
  }, [stopWebcam]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const removePhoto = useCallback(() => {
    setFormData(prev => ({ ...prev, photoUrl: '' }));
  }, []);

  // Attach stream to video element once modal renders
  useEffect(() => {
    if (showWebcam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [showWebcam]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle nationality change - auto-prefix phone with +256 for Ugandan
  const handleNationalityChange = (nationality: string) => {
    if (nationality === 'Ugandan') {
      // Set phone to +256 if empty or doesn't start with +256
      const currentPhone = formData.phone || '';
      if (!currentPhone.startsWith('+256')) {
        setFormData({ ...formData, nationality, phone: '+256' });
      } else {
        setFormData({ ...formData, nationality });
      }
    } else {
      // For non-Ugandan, clear the +256 prefix if it was auto-added
      const currentPhone = formData.phone || '';
      if (currentPhone === '+256') {
        setFormData({ ...formData, nationality, phone: '' });
      } else {
        setFormData({ ...formData, nationality });
      }
    }
  };

  // Check for duplicates mutation
  const checkDuplicatesMutation = useMutation({
    mutationFn: async (data: CreatePatientDto) => {
      return patientsService.checkDuplicates(data);
    },
    onSuccess: (result) => {
      if (result.hasDuplicates) {
        setDuplicates(result.duplicates);
        setShowDuplicateWarning(true);
      } else {
        // No duplicates, proceed with registration
        createMutation.mutate(formData);
      }
    },
    onError: () => {
      // If check fails, proceed anyway (backend will validate)
      createMutation.mutate(formData);
    },
  });

  // Create patient mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Construct address from village/parish/subcounty/district
      const address = [data.parish, data.subcounty, data.district].filter(Boolean).join(', ') || data.address;

      const apiData: CreatePatientDto = {
        fullName: data.fullName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        nationalId: data.nationalId || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: address || undefined,
        bloodGroup: data.bloodGroup || undefined,
        allergies: data.allergies ? data.allergies.split(',').map((a: string) => a.trim()).filter(Boolean) : undefined,
        maritalStatus: data.maritalStatus || undefined,
        occupation: data.occupation || undefined,
        nextOfKin: data.nextOfKin?.name ? {
          name: data.nextOfKin.name,
          phone: data.nextOfKin.phone,
          relationship: data.nextOfKin.relationship,
        } : undefined,
        metadata: {
          religion: data.religion,
          district: data.district,
          nationality: data.nationality,
          paymentType: data.paymentType,
          insuranceProvider: data.insuranceProvider,
          insuranceId: data.insuranceId,
          corporateName: data.corporateName,
          photoUrl: data.photoUrl,
        },
      };

      return patientsService.create(apiData);
    },
    onSuccess: (patient) => {
      // Add to shared patient store for local access
      const patientRecord: PatientRecord = {
        id: patient.id,
        mrn: patient.mrn,
        fullName: patient.fullName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        nationalId: patient.nationalId,
        bloodGroup: patient.bloodGroup,
        createdAt: patient.createdAt,
        // 'corporate' predates the PatientRecord union — kept as-is for the local cache
        paymentType: (formData.paymentType || 'cash') as PatientRecord['paymentType'],
        nextOfKin: formData.nextOfKin,
      };

      addPatient(patientRecord);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setCreatedPatient({
        id: patient.id,
        mrn: patient.mrn,
        fullName: patient.fullName,
      });
      setShowSuccess(true);
      setShowDuplicateWarning(false);

      if (billImmediately) {
          toast.success("Patient registered! Redirecting to Billing...");
          navigate(`/billing/opd/new?patientId=${patient.id}`);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // First check for duplicates
    const apiData: CreatePatientDto = {
      fullName: formData.fullName,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth,
      nationalId: formData.nationalId || undefined,
      phone: formData.phone || undefined,
    };

    checkDuplicatesMutation.mutate(apiData);
  };

  const handleProceedAnyway = () => {
    setShowDuplicateWarning(false);
    createMutation.mutate(formData);
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      gender: 'male',
      dateOfBirth: '',
      nationality: '',
      nationalId: '',
      phone: '',
      email: '',
      address: '',
      occupation: '',
      maritalStatus: '',
      bloodGroup: '',
      allergies: '',
      religion: '',
      district: '',
      subcounty: '',
      parish: '',
      paymentType: 'cash',
      insuranceProvider: '',
      insuranceId: '',
      corporateName: '',
      photoUrl: '',
      nextOfKin: { name: '', phone: '', relationship: '' },
    });
    location.setDistrict('');
    setShowSuccess(false);
    setCreatedPatient(null);
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setQuickRegistration(false);
    setStep(0);
    stopWebcam();
  };

  // Send to triage queue mutation
  const sendToTriageMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return queueService.addToQueue({
        patientId,
        servicePoint: 'triage',
        priority: 5, // Default routine priority
      });
    },
    onSuccess: (data) => {
      toast.success(`Patient sent to triage queue - Token: ${data.ticketNumber}`);
      navigate('/nursing/triage');
    },
    onError: () => {
      toast.error('Failed to add patient to triage queue');
    },
  });

  const isLastStep = quickRegistration || step === STEPS.length - 1;
  const isSubmitting = createMutation.isPending || checkDuplicatesMutation.isPending;

  // Collapsed summaries for completed steps
  const identitySummary = [
    formData.fullName,
    formData.gender,
    calculatedAge,
    formData.nationalId && `NIN ${formData.nationalId}`,
  ].filter(Boolean).join(' · ');

  const contactSummary = [
    formData.phone,
    formData.email,
    [formData.parish, formData.subcounty, formData.district].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ') || 'No contact details provided';

  // Duplicate Warning Modal
  if (showDuplicateWarning && duplicates.length > 0) {
    const confidenceCard = (level: string) => {
      if (level === 'high') return 'bg-rose-50 border-rose-200';
      if (level === 'medium') return 'bg-amber-50 border-amber-200';
      return 'bg-brand-50 border-brand-200';
    };
    const confidenceTone = (level: string): 'danger' | 'warning' | 'info' =>
      level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'info';

    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-1 text-center">Possible Duplicate Found</h2>
          <p className="text-surface-500 mb-6 text-center text-sm">
            We found existing patients that may match this registration. Review carefully before proceeding.
          </p>

          {/* New Patient Data */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-4">
            <div className="text-xs font-semibold text-brand-800 uppercase tracking-wide mb-2">New Registration</div>
            <p className="font-medium text-surface-900">{formData.fullName}</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-surface-600">
              <div>DOB: {formData.dateOfBirth}</div>
              <div className="capitalize">Gender: {formData.gender}</div>
              {formData.phone && <div>Phone: {formData.phone}</div>}
              {formData.nationalId && <div>National ID: {formData.nationalId}</div>}
            </div>
          </div>

          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Potential Matches</div>
          <div className="space-y-3 mb-5 max-h-96 overflow-y-auto">
            {duplicates.map((dup) => (
              <div key={dup.id} className={cn('border rounded-xl p-4', confidenceCard(dup.confidenceLevel))}>
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div>
                    <p className="font-medium text-surface-900">{dup.fullName}</p>
                    <p className="text-sm text-surface-600">MRN: {dup.mrn}</p>
                  </div>
                  <Badge tone={confidenceTone(dup.confidenceLevel)}>
                    {dup.confidenceScore}% match · {dup.confidenceLevel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-surface-600 mb-2">
                  <div>DOB: {dup.dateOfBirth}</div>
                  <div className="capitalize">Gender: {dup.gender}</div>
                  {dup.phone && <div>Phone: {dup.phone}</div>}
                </div>

                {dup.lastVisit && (
                  <p className="text-xs text-surface-500 mb-2">
                    Last Visit: {new Date(dup.lastVisit).toLocaleDateString()}
                  </p>
                )}

                {dup.matchReasons.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-surface-200">
                    <p className="text-xs font-semibold text-surface-700 mb-1">Match Reasons:</p>
                    <ul className="text-xs text-surface-600 space-y-0.5">
                      {dup.matchReasons.map((reason, idx) => (
                        <li key={idx}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/patients/${dup.id}`)}
                  className="mt-3 text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  View Full Record →
                </button>
              </div>
            ))}
          </div>

          <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-surface-600">
              <strong>Note:</strong> Families may share phone numbers. Review all details carefully.
              If this is truly a new patient, click "Register Anyway".
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowDuplicateWarning(false)}>
              Go Back & Edit
            </Button>
            <Button className="flex-1" onClick={handleProceedAnyway} loading={createMutation.isPending}>
              Register Anyway
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (showSuccess && createdPatient) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <Card className="text-center py-8">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 mb-1">{entityName.singular} Registered!</h2>
          <p className="text-surface-500 mb-5">
            {createdPatient.fullName} has been registered successfully.
          </p>
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-surface-600">{entityName.singular} ID</p>
            <p className="text-2xl font-mono font-bold text-brand-700">{createdPatient.mrn}</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleReset}>
                Register Another
              </Button>
              <Button className="flex-1" onClick={() => navigate('/opd/token')}>
                Issue OPD Token
              </Button>
            </div>
            <Button
              variant="secondary"
              icon={Stethoscope}
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => sendToTriageMutation.mutate(createdPatient.id)}
              loading={sendToTriageMutation.isPending}
            >
              Send to Triage Queue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Step sections ────────────────────────────────────────────────────────

  const identityStep = (
    <div className="space-y-4">
      {/* Photo + name row */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {formData.photoUrl ? (
            <div className="relative">
              <img
                src={formData.photoUrl}
                alt="Patient"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-surface-200"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 hover:bg-rose-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center border-2 border-dashed border-surface-300">
              <User className="w-8 h-8 text-surface-400" />
            </div>
          )}
          <div className="flex gap-1 mt-2 justify-center">
            <Button variant="ghost" size="sm" icon={Camera} onClick={startWebcam} title="Capture photo" />
            <Button variant="ghost" size="sm" icon={Upload} onClick={() => fileInputRef.current?.click()} title="Upload photo" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <Input
            label="Full Name"
            placeholder={`${entityName.singular}'s full name`}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'other' })}
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Date of Birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              required
              hint={calculatedAge ? `Age: ${calculatedAge}` : undefined}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!quickRegistration && (
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Nationality</label>
            <SearchableSelect
              options={countries}
              value={formData.nationality ?? ''}
              onChange={(val) => handleNationalityChange(val)}
              placeholder="Select country..."
              loading={countries.length === 0}
            />
          </div>
        )}
        <Input
          label="National ID (NIN)"
          placeholder="CM12345678ABCDE"
          value={formData.nationalId}
          onChange={(e) => setFormData({ ...formData, nationalId: e.target.value.toUpperCase() })}
          maxLength={15}
          error={formData.nationalId && !isNINValid ? 'Invalid NIN format' : undefined}
          hint={
            formData.nationalId && isNINValid
              ? 'Valid NIN'
              : 'Format: 2 letters + 8 digits + 5 alphanumeric'
          }
        />
      </div>

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-surface-900">Capture Photo</h3>
              <Button variant="ghost" size="sm" icon={X} onClick={stopWebcam} />
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl mb-3" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={stopWebcam}>
                Cancel
              </Button>
              <Button className="flex-1" icon={Camera} onClick={capturePhoto}>
                Capture
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  const contactStep = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Phone"
          type="tel"
          placeholder="+256..."
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          placeholder="email@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">District</label>
          <SearchableSelect
            options={districtOptions}
            value={location.selectedDistrict}
            onChange={(val) => {
              location.setDistrict(val);
              setFormData(prev => ({ ...prev, district: val, subcounty: '', parish: '' }));
            }}
            placeholder="Select district..."
            loading={location.loadingDistricts}
            noOptionsText="No districts found"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">Sub-county</label>
          <SearchableSelect
            options={subcountyOptions}
            value={location.selectedSubcounty}
            onChange={(val) => {
              location.setSubcounty(val);
              setFormData(prev => ({ ...prev, subcounty: val, parish: '' }));
            }}
            placeholder={location.loadingSubcounties ? 'Loading sub-counties...' : 'Type to search...'}
            loading={location.loadingSubcounties}
            disabled={false}
            noOptionsText="No sub-counties found"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">Parish/Village</label>
          <SearchableSelect
            options={parishOptions}
            value={location.selectedParish}
            onChange={(val) => {
              location.setParish(val);
              setFormData(prev => ({ ...prev, parish: val }));
            }}
            placeholder={location.selectedSubcounty ? 'Select parish/village...' : 'Select sub-county first'}
            loading={location.loadingParishes}
            disabled={!location.selectedSubcounty}
            noOptionsText="No parishes found"
          />
        </div>
      </div>
    </div>
  );

  const detailsStep = (
    <div className="space-y-5">
      {/* Payment */}
      <div>
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Payment</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Payment Type"
            value={formData.paymentType}
            onChange={(e) => setFormData({ ...formData, paymentType: e.target.value as 'cash' | 'insurance' | 'corporate' })}
          >
            <option value="cash">Cash</option>
            <option value="insurance">Insurance</option>
            <option value="corporate">Corporate</option>
          </Select>
          {formData.paymentType === 'insurance' && (
            <>
              <Select
                label="Insurance Provider"
                value={formData.insuranceProvider}
                onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
              >
                <option value="">Select...</option>
                {INSURANCE_PROVIDERS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Input
                label="Member / Policy No."
                placeholder="Policy number"
                value={formData.insuranceId}
                onChange={(e) => setFormData({ ...formData, insuranceId: e.target.value })}
              />
            </>
          )}
          {formData.paymentType === 'corporate' && (
            <Select
              label="Company"
              value={formData.corporateName}
              onChange={(e) => setFormData({ ...formData, corporateName: e.target.value })}
            >
              <option value="">Select...</option>
              {CORPORATE_COMPANIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* Next of Kin */}
      {regFields.nextOfKin && (
        <div>
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Next of Kin</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Full Name"
              placeholder="Next of kin name"
              value={formData.nextOfKin?.name || ''}
              onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, name: e.target.value } })}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+256..."
              value={formData.nextOfKin?.phone || ''}
              onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, phone: e.target.value } })}
            />
            <Select
              label="Relationship"
              value={formData.nextOfKin?.relationship || ''}
              onChange={(e) => setFormData({ ...formData, nextOfKin: { ...formData.nextOfKin, relationship: e.target.value } })}
            >
              <option value="">Select...</option>
              <option value="spouse">Spouse</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="sibling">Sibling</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>
      )}

      {/* Additional details */}
      <div>
        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Additional Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {regFields.religion && (
            <Select
              label="Religion"
              value={formData.religion}
              onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
            >
              <option value="">Select...</option>
              {RELIGIONS.map(rel => (
                <option key={rel} value={rel}>{rel}</option>
              ))}
            </Select>
          )}
          {regFields.maritalStatus && (
            <Select
              label="Marital Status"
              value={formData.maritalStatus}
              onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
            >
              <option value="">Select...</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </Select>
          )}
          {regFields.bloodGroup && (
            <Select
              label="Blood Group"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
            >
              <option value="">Select...</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </Select>
          )}
          <Input
            label="Occupation"
            placeholder="Occupation"
            value={formData.occupation}
            onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
          />
          <Input
            label="Known Allergies"
            placeholder="Comma-separated, e.g. Penicillin"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  const stepContent = [identityStep, contactStep, detailsStep];
  const stepSummaries = [identitySummary, contactSummary];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-surface-100 rounded-lg text-surface-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            Register New {entityName.singular}
          </span>
        }
        subtitle={`Enter ${entityName.singular.toLowerCase()} details to create a new record`}
        actions={
          <Button
            variant={quickRegistration ? 'primary' : 'secondary'}
            icon={Zap}
            onClick={() => setQuickRegistration(!quickRegistration)}
          >
            Quick Registration
          </Button>
        }
      >
        {!quickRegistration && (
          <Steps steps={STEPS} current={step} onStepClick={(i) => setStep(i)} />
        )}
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-3">
        {quickRegistration ? (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-surface-900">Quick Registration</h2>
              <Badge tone="brand">essentials only</Badge>
            </div>
            {identityStep}
          </Card>
        ) : (
          <>
            {/* Collapsed completed steps */}
            {STEPS.map((label, i) => {
              if (i >= step) return null;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  className="w-full flex items-center justify-between gap-3 bg-white rounded-2xl border border-surface-200/70 px-5 py-3 text-left hover:border-brand-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-surface-900">{label}</div>
                      <div className="text-sm text-surface-500 truncate capitalize">{stepSummaries[i]}</div>
                    </div>
                  </div>
                  <Pencil className="w-4 h-4 text-surface-400 shrink-0" />
                </button>
              );
            })}

            {/* Active step */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                {step === 0 && <User className="w-4 h-4 text-brand-600" />}
                {step === 1 && <Phone className="w-4 h-4 text-brand-600" />}
                {step === 2 && <Users className="w-4 h-4 text-brand-600" />}
                <h2 className="font-semibold text-surface-900">{STEPS[step]}</h2>
              </div>
              {stepContent[step]}
            </Card>
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <div className="flex-1" />
          {isLastStep && (
            <label className="flex items-center gap-2 text-sm font-medium text-surface-700 bg-surface-50 border border-surface-200 rounded-xl px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={billImmediately}
                onChange={(e) => setBillImmediately(e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              <Wallet className="w-4 h-4 text-brand-600" />
              Bill after registration
            </label>
          )}
          {/* Distinct keys force a NEW DOM node when Continue becomes Register.
              Without them the same <button> morphs to type="submit" during the
              click's re-render and the browser fires a form submit. */}
          {!isLastStep ? (
            <Button
              key="continue"
              icon={ArrowRight}
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !isIdentityComplete}
            >
              Continue
            </Button>
          ) : (
            <Button
              key="register"
              type="submit"
              icon={UserPlus}
              loading={isSubmitting}
              disabled={!isFormValid || isSubmitting}
              size="lg"
            >
              Register {entityName.singular}
            </Button>
          )}
        </div>

        {createMutation.isError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-sm">
            Failed to register patient. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}
