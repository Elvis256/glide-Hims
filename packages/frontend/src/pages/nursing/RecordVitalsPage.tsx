import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Heart,
  Search,
  UserCircle,
  Thermometer,
  Activity,
  Wind,
  Droplets,
  Scale,
  Ruler,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RotateCcw,
  Info,
  Clock,
  X,
  AlertCircle,
  ChevronRight,
  Zap,
} from 'lucide-react';
import AccessDenied from '../../components/AccessDenied';
import { patientsService } from '../../services/patients';
import { vitalsService, type CreateVitalDto, type VitalRecord } from '../../services/vitals';
import { encountersService } from '../../services/encounters';
import { queueService } from '../../services/queue';
import { useFacilityId } from '../../lib/facility';
import PermissionGate, { usePermissions } from '../../components/PermissionGate';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
  admissionId?: string;
  photoUrl?: string;
  allergies?: string[];
  bloodGroup?: string;
  queueId?: string;
  ticketNumber?: string;
  servicePoint?: string;
}

interface VitalRanges {
  min: number;
  max: number;
  criticalLow?: number;
  criticalHigh?: number;
  unit: string;
  label: string;
}

const vitalRanges: Record<string, VitalRanges> = {
  temperature: { min: 36.1, max: 37.2, criticalLow: 35, criticalHigh: 39.5, unit: '°C', label: 'Temperature' },
  pulse: { min: 60, max: 100, criticalLow: 40, criticalHigh: 150, unit: 'bpm', label: 'Pulse Rate' },
  bpSystolic: { min: 90, max: 120, criticalLow: 70, criticalHigh: 180, unit: 'mmHg', label: 'Systolic BP' },
  bpDiastolic: { min: 60, max: 80, criticalLow: 40, criticalHigh: 120, unit: 'mmHg', label: 'Diastolic BP' },
  respiratoryRate: { min: 12, max: 20, criticalLow: 8, criticalHigh: 30, unit: '/min', label: 'Respiratory Rate' },
  oxygenSaturation: { min: 95, max: 100, criticalLow: 90, criticalHigh: undefined, unit: '%', label: 'SpO2' },
  bloodGlucose: { min: 70, max: 140, criticalLow: 50, criticalHigh: 400, unit: 'mg/dL', label: 'Blood Glucose' },
};

// Backend validation limits - must match backend DTO validation
const backendLimits: Record<string, { min: number; max: number }> = {
  temperature: { min: 30, max: 45 }, // Celsius
  pulse: { min: 20, max: 250 },
  bpSystolic: { min: 50, max: 300 },
  bpDiastolic: { min: 30, max: 200 },
  respiratoryRate: { min: 5, max: 60 },
  oxygenSaturation: { min: 50, max: 100 },
  weight: { min: 0.5, max: 500 }, // kg
  height: { min: 20, max: 300 }, // cm
  bloodGlucose: { min: 0, max: 500 },
  painScale: { min: 0, max: 10 },
};

const quickTags = [
  'Febrile',
  'Hypotensive',
  'Hypertensive',
  'Tachycardic',
  'Bradycardic',
  'Tachypneic',
  'Hypoxic',
  'Hyperglycemic',
  'Hypoglycemic',
  'Diaphoretic',
  'Lethargic',
  'Anxious',
];

const painFaces = ['😊', '🙂', '😐', '😕', '😟', '😣', '😖', '😫', '😭', '😱', '🤯'];

const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const celsiusToFahrenheit = (c: number): number => (c * 9/5) + 32;
const fahrenheitToCelsius = (f: number): number => (f - 32) * 5/9;
const kgToLbs = (kg: number): number => kg * 2.20462;
const lbsToKg = (lbs: number): number => lbs / 2.20462;
const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  return { feet: Math.floor(totalInches / 12), inches: Math.round(totalInches % 12) };
};
const feetInchesToCm = (feet: number, inches: number): number => (feet * 12 + inches) * 2.54;
const calculateMAP = (systolic: number, diastolic: number): number => {
  return Math.round(diastolic + (systolic - diastolic) / 3);
};

export default function RecordVitalsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const { hasPermission } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check if patient was passed from triage or another page
  useEffect(() => {
    const passedPatient = location.state?.patient;
    if (passedPatient && !selectedPatient) {
      // Transform triage patient format to vitals patient format
      setSelectedPatient({
        id: passedPatient.patientId || passedPatient.id,
        mrn: passedPatient.mrn,
        name: passedPatient.name,
        age: passedPatient.age,
        gender: passedPatient.gender,
        queueId: passedPatient.id,
        ticketNumber: passedPatient.queueNumber?.toString() || passedPatient.ticketNumber,
        servicePoint: 'triage',
      });
    }
  }, [location.state, selectedPatient]);
  
  // Unit toggles
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  
  // Modals
  const [showRangesModal, setShowRangesModal] = useState(false);
  const [showCriticalModal, setShowCriticalModal] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<'continue' | 'next' | 'triage' | null>(null);
  
  // Selected quick tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [vitals, setVitals] = useState({
    temperature: '',
    pulse: '',
    bpSystolic: '',
    bpDiastolic: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    heightFeet: '',
    heightInches: '',
    bloodGlucose: '',
    painScale: '',
    notes: '',
  });

  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Fetch patients waiting for vitals in the queue
  const { data: vitalsQueue, isLoading: queueLoading } = useQuery({
    queryKey: ['vitals-queue'],
    queryFn: () => queueService.getWaiting('vitals'),
    staleTime: 10000,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Also fetch triage queue (patients coming from triage may need vitals)
  const { data: triageQueue } = useQuery({
    queryKey: ['triage-queue-for-vitals'],
    queryFn: () => queueService.getWaiting('triage'),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  // Combine queue patients for display
  const queuePatients: Patient[] = useMemo(() => {
    const patients: Patient[] = [];
    const seenIds = new Set<string>();

    // Add vitals queue patients first
    (vitalsQueue || []).forEach(entry => {
      if (entry.patient && !seenIds.has(entry.patient.id)) {
        seenIds.add(entry.patient.id);
        patients.push({
          id: entry.patient.id,
          mrn: entry.patient.mrn,
          name: entry.patient.fullName,
          age: 0, // Will be shown as waiting patient
          gender: '',
          queueId: entry.id,
          ticketNumber: entry.ticketNumber || entry.tokenNumber,
          servicePoint: 'vitals',
        });
      }
    });

    // Add triage queue patients
    (triageQueue || []).forEach(entry => {
      if (entry.patient && !seenIds.has(entry.patient.id)) {
        seenIds.add(entry.patient.id);
        patients.push({
          id: entry.patient.id,
          mrn: entry.patient.mrn,
          name: entry.patient.fullName,
          age: 0,
          gender: '',
          queueId: entry.id,
          ticketNumber: entry.ticketNumber || entry.tokenNumber,
          servicePoint: 'triage',
        });
      }
    });

    return patients;
  }, [vitalsQueue, triageQueue]);

  const { data: activeEncounter, isLoading: encounterLoading } = useQuery({
    queryKey: ['patient-active-encounter', selectedPatient?.id],
    queryFn: async () => {
      const response = await encountersService.list({ 
        patientId: selectedPatient!.id, 
        limit: 1 
      });
      if (response.data.length > 0) {
        const encounter = response.data[0];
        const activeStatuses = ['registered', 'waiting', 'triage', 'in_consultation', 'pending_lab', 'pending_pharmacy'];
        if (activeStatuses.includes(encounter.status)) {
          return encounter;
        }
      }
      return null;
    },
    enabled: !!selectedPatient?.id,
  });

  const { data: lastVitals } = useQuery({
    queryKey: ['patient-last-vitals', selectedPatient?.id],
    queryFn: () => vitalsService.getPatientHistory(selectedPatient!.id, 1),
    enabled: !!selectedPatient?.id,
  });

  const createEncounterMutation = useMutation({
    mutationFn: () => encountersService.create({
      patientId: selectedPatient!.id,
      facilityId,
      type: 'opd',
      chiefComplaint: 'Vital signs recording',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-active-encounter', selectedPatient?.id] });
    },
  });

  const createVitalsMutation = useMutation({
    mutationFn: (data: CreateVitalDto) => vitalsService.create(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
      queryClient.invalidateQueries({ queryKey: ['patient-vitals'] });
      queryClient.invalidateQueries({ queryKey: ['patient-last-vitals', selectedPatient?.id] });
      queryClient.invalidateQueries({ queryKey: ['vitals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['triage-queue'] });
      
      toast.success('Vitals recorded successfully');
      setError(null);
      
      if (pendingSaveAction === 'continue') {
        // Stay on same patient, just clear the vital values (not the patient)
        setVitals({
          temperature: '',
          pulse: '',
          bpSystolic: '',
          bpDiastolic: '',
          respiratoryRate: '',
          oxygenSaturation: '',
          weight: '',
          height: '',
          heightFeet: '',
          heightInches: '',
          bloodGlucose: '',
          painScale: '',
          notes: '',
        });
        setSelectedTags([]);
      } else if (pendingSaveAction === 'next') {
        // Clear form AND deselect patient so user can pick the next one
        handleReset();
      } else if (pendingSaveAction === 'triage') {
        // Navigate back to triage page with patient info
        navigate('/nursing/triage', { state: { patientId: selectedPatient?.id } });
      }
      setPendingSaveAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save vitals');
      setError(err.message || 'Failed to save vitals');
    },
  });

  const filteredPatients: Patient[] = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
      bloodGroup: p.bloodGroup,
    }));
  }, [apiPatients, searchTerm]);

  const getVitalStatus = useCallback((field: string, value: string): 'normal' | 'warning' | 'critical' => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'normal';
    const range = vitalRanges[field];
    if (!range) return 'normal';
    
    if ((range.criticalLow && num <= range.criticalLow) || (range.criticalHigh && num >= range.criticalHigh)) {
      return 'critical';
    }
    if (num < range.min || num > range.max) {
      return 'warning';
    }
    return 'normal';
  }, []);

  const getTemperatureStatus = useCallback((value: string): { status: 'normal' | 'fever' | 'high-fever' | 'hypothermia'; label: string } => {
    const num = parseFloat(value);
    if (isNaN(num)) return { status: 'normal', label: '' };
    
    let tempC = tempUnit === 'F' ? fahrenheitToCelsius(num) : num;
    
    if (tempC < 35) return { status: 'hypothermia', label: 'Hypothermia' };
    if (tempC >= 39.5) return { status: 'high-fever', label: 'High Fever' };
    if (tempC >= 37.5) return { status: 'fever', label: 'Fever' };
    return { status: 'normal', label: 'Normal' };
  }, [tempUnit]);

  const getPulseStatus = useCallback((value: string): { status: 'normal' | 'bradycardia' | 'tachycardia'; label: string } => {
    const num = parseInt(value);
    if (isNaN(num)) return { status: 'normal', label: '' };
    
    if (num < 60) return { status: 'bradycardia', label: 'Bradycardia' };
    if (num > 100) return { status: 'tachycardia', label: 'Tachycardia' };
    return { status: 'normal', label: 'Normal' };
  }, []);

  const getSpO2Status = useCallback((value: string): { status: 'normal' | 'mild' | 'severe'; label: string; color: string } => {
    const num = parseInt(value);
    if (isNaN(num)) return { status: 'normal', label: '', color: '' };
    
    if (num < 90) return { status: 'severe', label: 'Severe Hypoxia', color: 'text-red-600' };
    if (num < 95) return { status: 'mild', label: 'Mild Hypoxia', color: 'text-yellow-600' };
    return { status: 'normal', label: 'Normal', color: 'text-green-600' };
  }, []);

  const getBPStatus = useCallback((sys: string, dia: string): { status: 'normal' | 'hypotension' | 'hypertension'; label: string } => {
    const sysNum = parseInt(sys);
    const diaNum = parseInt(dia);
    if (isNaN(sysNum) || isNaN(diaNum)) return { status: 'normal', label: '' };
    
    if (sysNum < 90 || diaNum < 60) return { status: 'hypotension', label: 'Hypotension' };
    if (sysNum >= 140 || diaNum >= 90) return { status: 'hypertension', label: 'Hypertension' };
    return { status: 'normal', label: 'Normal' };
  }, []);

  const getGlucoseStatus = useCallback((value: string): { status: 'normal' | 'low' | 'high'; label: string } => {
    const num = parseFloat(value);
    if (isNaN(num)) return { status: 'normal', label: '' };
    
    if (num < 70) return { status: 'low', label: 'Hypoglycemia' };
    if (num > 140) return { status: 'high', label: 'Hyperglycemia' };
    return { status: 'normal', label: 'Normal' };
  }, []);

  const hasCriticalValues = useCallback((): boolean => {
    return (
      getVitalStatus('temperature', vitals.temperature) === 'critical' ||
      getVitalStatus('pulse', vitals.pulse) === 'critical' ||
      getVitalStatus('bpSystolic', vitals.bpSystolic) === 'critical' ||
      getVitalStatus('bpDiastolic', vitals.bpDiastolic) === 'critical' ||
      getVitalStatus('respiratoryRate', vitals.respiratoryRate) === 'critical' ||
      getVitalStatus('oxygenSaturation', vitals.oxygenSaturation) === 'critical' ||
      getVitalStatus('bloodGlucose', vitals.bloodGlucose) === 'critical'
    );
  }, [vitals, getVitalStatus]);

  const getCriticalFields = useCallback((): string[] => {
    const fields: string[] = [];
    if (getVitalStatus('temperature', vitals.temperature) === 'critical') fields.push('Temperature');
    if (getVitalStatus('pulse', vitals.pulse) === 'critical') fields.push('Pulse Rate');
    if (getVitalStatus('bpSystolic', vitals.bpSystolic) === 'critical') fields.push('Systolic BP');
    if (getVitalStatus('bpDiastolic', vitals.bpDiastolic) === 'critical') fields.push('Diastolic BP');
    if (getVitalStatus('respiratoryRate', vitals.respiratoryRate) === 'critical') fields.push('Respiratory Rate');
    if (getVitalStatus('oxygenSaturation', vitals.oxygenSaturation) === 'critical') fields.push('SpO2');
    if (getVitalStatus('bloodGlucose', vitals.bloodGlucose) === 'critical') fields.push('Blood Glucose');
    return fields;
  }, [vitals, getVitalStatus]);

  // Validate vitals against backend limits before submission
  const validateVitals = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Temperature validation (convert if in Fahrenheit)
    if (vitals.temperature) {
      let tempC = parseFloat(vitals.temperature);
      if (tempUnit === 'F') {
        tempC = fahrenheitToCelsius(tempC);
      }
      if (tempC < backendLimits.temperature.min || tempC > backendLimits.temperature.max) {
        errors.push(`Temperature must be between ${backendLimits.temperature.min}°C and ${backendLimits.temperature.max}°C`);
      }
    }

    // Other vitals validation
    const vitalValidations: { field: keyof typeof vitals; name: string; key: string }[] = [
      { field: 'pulse', name: 'Pulse', key: 'pulse' },
      { field: 'bpSystolic', name: 'Systolic BP', key: 'bpSystolic' },
      { field: 'bpDiastolic', name: 'Diastolic BP', key: 'bpDiastolic' },
      { field: 'respiratoryRate', name: 'Respiratory Rate', key: 'respiratoryRate' },
      { field: 'oxygenSaturation', name: 'SpO2', key: 'oxygenSaturation' },
      { field: 'bloodGlucose', name: 'Blood Glucose', key: 'bloodGlucose' },
      { field: 'painScale', name: 'Pain Scale', key: 'painScale' },
    ];

    vitalValidations.forEach(({ field, name, key }) => {
      const value = vitals[field];
      if (value) {
        const num = parseFloat(value);
        const limits = backendLimits[key];
        if (limits && (num < limits.min || num > limits.max)) {
          errors.push(`${name} must be between ${limits.min} and ${limits.max}`);
        }
      }
    });

    // Weight validation (convert if in lbs)
    if (vitals.weight) {
      let weightKg = parseFloat(vitals.weight);
      if (weightUnit === 'lbs') {
        weightKg = lbsToKg(weightKg);
      }
      if (weightKg < backendLimits.weight.min || weightKg > backendLimits.weight.max) {
        errors.push(`Weight must be between ${backendLimits.weight.min}kg and ${backendLimits.weight.max}kg`);
      }
    }

    // Height validation (convert if in feet)
    let heightCm: number | undefined;
    if (heightUnit === 'ft' && (vitals.heightFeet || vitals.heightInches)) {
      heightCm = feetInchesToCm(parseInt(vitals.heightFeet) || 0, parseInt(vitals.heightInches) || 0);
    } else if (vitals.height) {
      heightCm = parseFloat(vitals.height);
    }
    if (heightCm !== undefined && (heightCm < backendLimits.height.min || heightCm > backendLimits.height.max)) {
      errors.push(`Height must be between ${backendLimits.height.min}cm and ${backendLimits.height.max}cm`);
    }

    return { valid: errors.length === 0, errors };
  }, [vitals, tempUnit, weightUnit, heightUnit]);

  const handleUseLastValues = useCallback(() => {
    if (lastVitals && lastVitals.length > 0) {
      const last = lastVitals[0];
      setVitals({
        temperature: last.temperature?.toString() || '',
        pulse: last.pulse?.toString() || '',
        bpSystolic: last.bloodPressureSystolic?.toString() || '',
        bpDiastolic: last.bloodPressureDiastolic?.toString() || '',
        respiratoryRate: last.respiratoryRate?.toString() || '',
        oxygenSaturation: last.oxygenSaturation?.toString() || '',
        weight: last.weight?.toString() || '',
        height: last.height?.toString() || '',
        heightFeet: '',
        heightInches: '',
        bloodGlucose: last.bloodGlucose?.toString() || '',
        painScale: last.painScale?.toString() || '',
        notes: '',
      });
      toast.success('Previous vitals loaded');
    } else {
      toast.error('No previous vitals found');
    }
  }, [lastVitals]);

  const handleReset = () => {
    setSelectedPatient(null);
    setVitals({
      temperature: '',
      pulse: '',
      bpSystolic: '',
      bpDiastolic: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      heightFeet: '',
      heightInches: '',
      bloodGlucose: '',
      painScale: '',
      notes: '',
    });
    setSelectedTags([]);
    setError(null);
  };

  const handleClearAll = () => {
    setVitals({
      temperature: '',
      pulse: '',
      bpSystolic: '',
      bpDiastolic: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      heightFeet: '',
      heightInches: '',
      bloodGlucose: '',
      painScale: '',
      notes: '',
    });
    setSelectedTags([]);
    toast.success('Form cleared');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const performSave = async () => {
    try {
      let encounterId = activeEncounter?.id;
      
      if (!encounterId) {
        const newEncounter = await createEncounterMutation.mutateAsync();
        encounterId = newEncounter.id;
      }

      let temperatureValue = vitals.temperature ? parseFloat(vitals.temperature) : undefined;
      if (temperatureValue && tempUnit === 'F') {
        temperatureValue = fahrenheitToCelsius(temperatureValue);
      }

      let weightValue = vitals.weight ? parseFloat(vitals.weight) : undefined;
      if (weightValue && weightUnit === 'lbs') {
        weightValue = lbsToKg(weightValue);
      }

      let heightValue: number | undefined;
      if (heightUnit === 'ft' && (vitals.heightFeet || vitals.heightInches)) {
        heightValue = feetInchesToCm(
          parseInt(vitals.heightFeet) || 0, 
          parseInt(vitals.heightInches) || 0
        );
      } else if (vitals.height) {
        heightValue = parseInt(vitals.height);
      }

      const notesWithTags = selectedTags.length > 0 
        ? `[${selectedTags.join(', ')}] ${vitals.notes}`.trim()
        : vitals.notes;

      const vitalData: CreateVitalDto = {
        encounterId,
        temperature: temperatureValue,
        pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined,
        bpSystolic: vitals.bpSystolic ? parseInt(vitals.bpSystolic) : undefined,
        bpDiastolic: vitals.bpDiastolic ? parseInt(vitals.bpDiastolic) : undefined,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation) : undefined,
        weight: weightValue,
        height: heightValue,
        bloodGlucose: vitals.bloodGlucose ? parseFloat(vitals.bloodGlucose) : undefined,
        painScale: vitals.painScale ? parseInt(vitals.painScale) : undefined,
        notes: notesWithTags || undefined,
      };

      createVitalsMutation.mutate(vitalData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to create encounter: ${errorMessage}`);
    }
  };

  const handleSave = async (action: 'continue' | 'next' | 'triage') => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    const hasVitals = vitals.temperature || vitals.pulse || vitals.bpSystolic || 
                      vitals.respiratoryRate || vitals.oxygenSaturation || 
                      vitals.weight || vitals.height || vitals.bloodGlucose || vitals.painScale;
    
    if (!hasVitals) {
      toast.error('Please enter at least one vital sign');
      return;
    }

    // Validate vitals against backend limits
    const validation = validateVitals();
    if (!validation.valid) {
      validation.errors.forEach(err => toast.error(err));
      setError(validation.errors.join(', '));
      return;
    }

    if (hasCriticalValues() && !showCriticalModal) {
      setPendingSaveAction(action);
      setShowCriticalModal(true);
      return;
    }

    setPendingSaveAction(action);
    await performSave();
  };

  const saving = createVitalsMutation.isPending || createEncounterMutation.isPending;

  const bmi = useMemo(() => {
    let w = parseFloat(vitals.weight);
    let h: number;
    
    if (weightUnit === 'lbs' && w) {
      w = lbsToKg(w);
    }
    
    if (heightUnit === 'ft') {
      h = feetInchesToCm(parseInt(vitals.heightFeet) || 0, parseInt(vitals.heightInches) || 0) / 100;
    } else {
      h = parseFloat(vitals.height) / 100;
    }
    
    if (w > 0 && h > 0) {
      const bmiValue = w / (h * h);
      let category = '';
      if (bmiValue < 18.5) category = 'Underweight';
      else if (bmiValue < 25) category = 'Normal';
      else if (bmiValue < 30) category = 'Overweight';
      else category = 'Obese';
      return { value: bmiValue.toFixed(1), category };
    }
    return null;
  }, [vitals.weight, vitals.height, vitals.heightFeet, vitals.heightInches, weightUnit, heightUnit]);

  const map = useMemo(() => {
    const sys = parseInt(vitals.bpSystolic);
    const dia = parseInt(vitals.bpDiastolic);
    if (sys > 0 && dia > 0) {
      return calculateMAP(sys, dia);
    }
    return null;
  }, [vitals.bpSystolic, vitals.bpDiastolic]);

  const getInputClassName = (field: string, value: string) => {
    const status = getVitalStatus(field, value);
    if (status === 'critical') return 'border-red-500 bg-red-50 ring-2 ring-red-200';
    if (status === 'warning') return 'border-yellow-400 bg-yellow-50';
    return 'border-gray-300';
  };

  if (!hasPermission('vitals.create')) {
    return <AccessDenied />;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Record Vitals</h1>
              <p className="text-sm text-gray-500">Capture patient vital signs</p>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        {selectedPatient && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleUseLastValues}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
            >
              <Clock className="w-4 h-4" />
              Use Last Values
            </button>
            <button
              onClick={() => setShowRangesModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Info className="w-4 h-4" />
              Normal Ranges
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                        {patient.photoUrl ? (
                          <img src={patient.photoUrl} alt={patient.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
              )
            ) : selectedPatient ? (
              <div className="p-4 rounded-lg border-2 border-teal-500 bg-teal-50">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedPatient.photoUrl ? (
                      <img src={selectedPatient.photoUrl} alt={selectedPatient.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-8 h-8 text-teal-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-lg">{selectedPatient.name}</p>
                    <p className="text-sm text-gray-600">{selectedPatient.mrn}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.age}y • {selectedPatient.gender}</p>
                    {selectedPatient.ticketNumber && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full mr-1">
                        #{selectedPatient.ticketNumber}
                      </span>
                    )}
                    {selectedPatient.bloodGroup && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        {selectedPatient.bloodGroup}
                      </span>
                    )}
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Allergies: {selectedPatient.allergies.length}
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={handleReset} className="p-1 hover:bg-teal-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            ) : queueLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              </div>
            ) : queuePatients.length > 0 ? (
              <>
                <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Patients Waiting ({queuePatients.length})
                </p>
                {queuePatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-teal-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center overflow-hidden">
                        <span className="text-sm font-bold text-teal-700">
                          #{patient.ticketNumber}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        patient.servicePoint === 'vitals' 
                          ? 'bg-teal-100 text-teal-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {patient.servicePoint === 'vitals' ? 'Vitals' : 'Triage'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No patients waiting</p>
                <p className="text-xs text-gray-400 mt-1">Search to find a patient</p>
              </div>
            )}
          </div>
        </div>

        {/* Vital Signs Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Vital Signs</h2>
            {hasCriticalValues() && (
              <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full animate-pulse">
                <AlertCircle className="w-3 h-3" />
                Critical Values Detected
              </span>
            )}
          </div>
          
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Temperature */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-4 h-4 text-red-500" />
                      Temperature
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTempUnit('C')}
                        className={`px-1.5 py-0.5 text-xs rounded ${tempUnit === 'C' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        °C
                      </button>
                      <button
                        onClick={() => setTempUnit('F')}
                        className={`px-1.5 py-0.5 text-xs rounded ${tempUnit === 'F' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        °F
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={tempUnit === 'C' ? '36.5' : '97.7'}
                      value={vitals.temperature}
                      onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${getInputClassName('temperature', vitals.temperature)}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">°{tempUnit}</span>
                  </div>
                  {vitals.temperature && (
                    <p className={`text-xs flex items-center gap-1 ${
                      getTemperatureStatus(vitals.temperature).status === 'high-fever' ? 'text-red-600' :
                      getTemperatureStatus(vitals.temperature).status === 'fever' ? 'text-yellow-600' :
                      getTemperatureStatus(vitals.temperature).status === 'hypothermia' ? 'text-blue-600' :
                      'text-green-600'
                    }`}>
                      {getTemperatureStatus(vitals.temperature).status !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                      {getTemperatureStatus(vitals.temperature).label}
                    </p>
                  )}
                </div>

                {/* Pulse */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Activity className="w-4 h-4 text-pink-500" />
                    Pulse Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="72"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${getInputClassName('pulse', vitals.pulse)}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">bpm</span>
                  </div>
                  {vitals.pulse && (
                    <p className={`text-xs flex items-center gap-1 ${
                      getPulseStatus(vitals.pulse).status === 'bradycardia' ? 'text-blue-600' :
                      getPulseStatus(vitals.pulse).status === 'tachycardia' ? 'text-red-600' :
                      'text-green-600'
                    }`}>
                      {getPulseStatus(vitals.pulse).status !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                      {getPulseStatus(vitals.pulse).label}
                    </p>
                  )}
                </div>

                {/* Blood Pressure */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Heart className="w-4 h-4 text-red-500" />
                    Blood Pressure
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="120"
                      value={vitals.bpSystolic}
                      onChange={(e) => setVitals({ ...vitals, bpSystolic: e.target.value })}
                      className={`w-full px-2 py-2 border rounded-lg text-sm ${getInputClassName('bpSystolic', vitals.bpSystolic)}`}
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      placeholder="80"
                      value={vitals.bpDiastolic}
                      onChange={(e) => setVitals({ ...vitals, bpDiastolic: e.target.value })}
                      className={`w-full px-2 py-2 border rounded-lg text-sm ${getInputClassName('bpDiastolic', vitals.bpDiastolic)}`}
                    />
                  </div>
                  <div className="flex justify-between">
                    {map && <span className="text-xs text-gray-500">MAP: {map}</span>}
                    {(vitals.bpSystolic || vitals.bpDiastolic) && (
                      <p className={`text-xs flex items-center gap-1 ${
                        getBPStatus(vitals.bpSystolic, vitals.bpDiastolic).status === 'hypotension' ? 'text-blue-600' :
                        getBPStatus(vitals.bpSystolic, vitals.bpDiastolic).status === 'hypertension' ? 'text-red-600' :
                        'text-green-600'
                      }`}>
                        {getBPStatus(vitals.bpSystolic, vitals.bpDiastolic).status !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                        {getBPStatus(vitals.bpSystolic, vitals.bpDiastolic).label}
                      </p>
                    )}
                  </div>
                </div>

                {/* Respiratory Rate */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Wind className="w-4 h-4 text-blue-500" />
                    Respiratory Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="16"
                      value={vitals.respiratoryRate}
                      onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${getInputClassName('respiratoryRate', vitals.respiratoryRate)}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">/min</span>
                  </div>
                  {vitals.respiratoryRate && getVitalStatus('respiratoryRate', vitals.respiratoryRate) !== 'normal' && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Abnormal
                    </p>
                  )}
                </div>

                {/* SpO2 */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    SpO2
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="98"
                      value={vitals.oxygenSaturation}
                      onChange={(e) => setVitals({ ...vitals, oxygenSaturation: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${getInputClassName('oxygenSaturation', vitals.oxygenSaturation)}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                  </div>
                  {vitals.oxygenSaturation && (
                    <p className={`text-xs flex items-center gap-1 ${getSpO2Status(vitals.oxygenSaturation).color}`}>
                      {getSpO2Status(vitals.oxygenSaturation).status !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                      {getSpO2Status(vitals.oxygenSaturation).label}
                    </p>
                  )}
                </div>

                {/* Blood Glucose */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Droplets className="w-4 h-4 text-purple-500" />
                    Blood Glucose
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="95"
                      value={vitals.bloodGlucose}
                      onChange={(e) => setVitals({ ...vitals, bloodGlucose: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${getInputClassName('bloodGlucose', vitals.bloodGlucose)}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">mg/dL</span>
                  </div>
                  {vitals.bloodGlucose && (
                    <p className={`text-xs flex items-center gap-1 ${
                      getGlucoseStatus(vitals.bloodGlucose).status === 'low' ? 'text-blue-600' :
                      getGlucoseStatus(vitals.bloodGlucose).status === 'high' ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {getGlucoseStatus(vitals.bloodGlucose).status !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                      {getGlucoseStatus(vitals.bloodGlucose).label}
                    </p>
                  )}
                </div>

                {/* Weight */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1">
                      <Scale className="w-4 h-4 text-gray-500" />
                      Weight
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setWeightUnit('kg')}
                        className={`px-1.5 py-0.5 text-xs rounded ${weightUnit === 'kg' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        kg
                      </button>
                      <button
                        onClick={() => setWeightUnit('lbs')}
                        className={`px-1.5 py-0.5 text-xs rounded ${weightUnit === 'lbs' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        lbs
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder={weightUnit === 'kg' ? '70' : '154'}
                      value={vitals.weight}
                      onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{weightUnit}</span>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-1">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1">
                      <Ruler className="w-4 h-4 text-gray-500" />
                      Height
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setHeightUnit('cm')}
                        className={`px-1.5 py-0.5 text-xs rounded ${heightUnit === 'cm' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        cm
                      </button>
                      <button
                        onClick={() => setHeightUnit('ft')}
                        className={`px-1.5 py-0.5 text-xs rounded ${heightUnit === 'ft' ? 'bg-teal-600 text-white' : 'bg-gray-100'}`}
                      >
                        ft
                      </button>
                    </div>
                  </label>
                  {heightUnit === 'cm' ? (
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="170"
                        value={vitals.height}
                        onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">cm</span>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="5"
                          value={vitals.heightFeet}
                          onChange={(e) => setVitals({ ...vitals, heightFeet: e.target.value })}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">ft</span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="7"
                          value={vitals.heightInches}
                          onChange={(e) => setVitals({ ...vitals, heightInches: e.target.value })}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">in</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* BMI */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">BMI</label>
                  <div className={`px-3 py-2 rounded-lg text-sm ${
                    bmi 
                      ? bmi.category === 'Normal' 
                        ? 'bg-green-50 text-green-700' 
                        : bmi.category === 'Overweight' 
                          ? 'bg-yellow-50 text-yellow-700'
                          : bmi.category === 'Obese'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {bmi ? `${bmi.value} kg/m² (${bmi.category})` : 'Enter weight & height'}
                  </div>
                </div>

                {/* Pain Scale */}
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <label className="text-sm font-medium text-gray-700">Pain Scale (0-10)</label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => setVitals({ ...vitals, painScale: num.toString() })}
                        className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-xs font-medium rounded transition-colors ${
                          vitals.painScale === num.toString()
                            ? num <= 3
                              ? 'bg-green-500 text-white'
                              : num <= 6
                              ? 'bg-yellow-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="text-base">{painFaces[num]}</span>
                        <span>{num}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Tags */}
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <label className="text-sm font-medium text-gray-700">Quick Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {quickTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedTags.includes(tag)
                            ? 'bg-teal-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <label className="text-sm font-medium text-gray-700">Additional Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Additional observations..."
                    value={vitals.notes}
                    onChange={(e) => setVitals({ ...vitals, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Save Buttons */}
              <div className="flex flex-wrap justify-end gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => handleSave('continue')}
                  disabled={saving || encounterLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving && pendingSaveAction === 'continue' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save & Continue
                </button>
                <button
                  onClick={() => handleSave('next')}
                  disabled={saving || encounterLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving && pendingSaveAction === 'next' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Save & Next Patient
                </button>
                <button
                  onClick={() => handleSave('triage')}
                  disabled={saving || encounterLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving && pendingSaveAction === 'triage' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  Save & Go to Triage
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to record vitals</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Normal Ranges Modal */}
      {showRangesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Normal Vital Ranges</h3>
              <button onClick={() => setShowRangesModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(vitalRanges).map(([key, range]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{range.label}</span>
                  <div className="text-right">
                    <span className="text-sm text-green-600">{range.min} - {range.max} {range.unit}</span>
                    {(range.criticalLow || range.criticalHigh) && (
                      <p className="text-xs text-red-500">
                        Critical: {range.criticalLow && `<${range.criticalLow}`} {range.criticalHigh && `>${range.criticalHigh}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Critical Values Confirmation Modal */}
      {showCriticalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Critical Values Detected</h3>
                <p className="text-sm text-gray-600">The following vitals are in critical range:</p>
              </div>
            </div>
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <ul className="space-y-1">
                {getCriticalFields().map((field) => (
                  <li key={field} className="flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {field}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              An alert will be generated and the patient will be prioritized for immediate attention.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCriticalModal(false);
                  setPendingSaveAction(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCriticalModal(false);
                  performSave();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
