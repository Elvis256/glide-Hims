import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  UserCircle,
  Stethoscope,
  ClipboardList,
  Activity,
  ChevronDown,
  ChevronRight,
  Save,
  PlayCircle,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Clock,
  Loader2,
  FileText,
  AlertTriangle,
  AlertCircle,
  Pill,
  TestTube,
  ImageIcon,
  Calendar,
  Send,
  Printer,
  CheckCircle,
  XCircle,
  Copy,
  Mic,
  MicOff,
  Timer,
  FileCheck,
  UserPlus,
  History,
  ExternalLink,
  Plus,
  BadgeAlert,
  Beaker,
  FolderOpen,
  ChevronUp,
  Briefcase,
  Baby,
  Users,
  Wine,
  Cigarette,
  X,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Eye,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';
import { encountersService } from '../../services/encounters';
import { vitalsService } from '../../services/vitals';
import { ordersService, type CreateOrderDto } from '../../services/orders';
import { prescriptionsService, type CreatePrescriptionDto } from '../../services/prescriptions';
import { patientsService } from '../../services/patients';
import { labService } from '../../services/lab';
import { diagnosesService } from '../../services/diagnoses';
import { clinicalNotesService } from '../../services/clinical-notes';
import { servicesService } from '../../services/services';
import { useFacilityId } from '../../lib/facility';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';

// Types
interface Vitals {
  temperature: string;
  pulse: string;
  bp: string;
  respiratoryRate: string;
  spo2: string;
  painScale: number;
  recordedAt: string;
  recordedBy: string;
}

interface Diagnosis {
  id: string;
  code: string;
  description: string;
  type: 'primary' | 'secondary' | 'differential';
}

interface PlanItem {
  id: string;
  type: 'prescription' | 'lab' | 'imaging' | 'referral' | 'followup' | 'education';
  description: string;
  details?: Record<string, unknown>;
}

interface ReviewOfSystemsItem {
  system: string;
  findings: string[];
  notes: string;
  isExpanded: boolean;
}

interface PhysicalExamSection {
  system: string;
  findings: string;
  isNormal: boolean;
  isExpanded: boolean;
}

interface ConsultationForm {
  // Chief Complaint
  chiefComplaint: string;
  duration: string;
  onset: string;
  // History
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  familyHistory: string;
  socialHistory: {
    occupation: string;
    smoking: string;
    alcohol: string;
    drugs: string;
    exercise: string;
    diet: string;
  };
  // Review of Systems
  reviewOfSystems: ReviewOfSystemsItem[];
  // Physical Exam
  physicalExam: PhysicalExamSection[];
  // Assessment
  diagnoses: Diagnosis[];
  clinicalImpression: string;
  // Plan
  planItems: PlanItem[];
  followUpDate: string;
  followUpNotes: string;
  patientEducation: string;
  // Meta
  template: string;
}

interface PatientSummary {
  activeProblems: Array<{ code: string; description: string; onsetDate?: string }>;
  currentMedications: Array<{ name: string; dose: string; frequency: string }>;
  recentVitals: Vitals | null;
  recentLabResults: Array<{ test: string; value: string; unit: string; date: string; abnormal: boolean }>;
  chronicConditions: string[];
  allergies: string[];
  alerts: Array<{ type: string; message: string; severity: 'high' | 'medium' | 'low' }>;
}

// Default Review of Systems structure
const defaultReviewOfSystems: ReviewOfSystemsItem[] = [
  { system: 'Constitutional', findings: [], notes: '', isExpanded: false },
  { system: 'Eyes', findings: [], notes: '', isExpanded: false },
  { system: 'ENT/Mouth', findings: [], notes: '', isExpanded: false },
  { system: 'Cardiovascular', findings: [], notes: '', isExpanded: false },
  { system: 'Respiratory', findings: [], notes: '', isExpanded: false },
  { system: 'Gastrointestinal', findings: [], notes: '', isExpanded: false },
  { system: 'Genitourinary', findings: [], notes: '', isExpanded: false },
  { system: 'Musculoskeletal', findings: [], notes: '', isExpanded: false },
  { system: 'Skin/Integumentary', findings: [], notes: '', isExpanded: false },
  { system: 'Neurological', findings: [], notes: '', isExpanded: false },
  { system: 'Psychiatric', findings: [], notes: '', isExpanded: false },
  { system: 'Endocrine', findings: [], notes: '', isExpanded: false },
  { system: 'Hematologic/Lymphatic', findings: [], notes: '', isExpanded: false },
  { system: 'Allergic/Immunologic', findings: [], notes: '', isExpanded: false },
];

const rosFindings: Record<string, string[]> = {
  Constitutional: ['Fever', 'Chills', 'Fatigue', 'Weight loss', 'Weight gain', 'Night sweats', 'Malaise'],
  Eyes: ['Vision changes', 'Eye pain', 'Redness', 'Discharge', 'Dry eyes', 'Double vision', 'Photophobia'],
  'ENT/Mouth': ['Hearing loss', 'Tinnitus', 'Nasal congestion', 'Sore throat', 'Hoarseness', 'Epistaxis', 'Oral lesions'],
  Cardiovascular: ['Chest pain', 'Palpitations', 'Dyspnea on exertion', 'Orthopnea', 'Edema', 'Syncope', 'Claudication'],
  Respiratory: ['Cough', 'Shortness of breath', 'Wheezing', 'Hemoptysis', 'Sputum production', 'Pleuritic pain'],
  Gastrointestinal: ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Abdominal pain', 'Heartburn', 'Dysphagia', 'Blood in stool'],
  Genitourinary: ['Dysuria', 'Frequency', 'Urgency', 'Hematuria', 'Incontinence', 'Nocturia', 'Discharge'],
  Musculoskeletal: ['Joint pain', 'Joint swelling', 'Muscle pain', 'Weakness', 'Back pain', 'Stiffness', 'Limited ROM'],
  'Skin/Integumentary': ['Rash', 'Itching', 'Lesions', 'Color changes', 'Hair changes', 'Nail changes', 'Wound healing'],
  Neurological: ['Headache', 'Dizziness', 'Numbness', 'Tingling', 'Weakness', 'Tremor', 'Seizures', 'Memory loss'],
  Psychiatric: ['Depression', 'Anxiety', 'Sleep disturbance', 'Mood changes', 'Suicidal ideation', 'Hallucinations'],
  Endocrine: ['Polyuria', 'Polydipsia', 'Heat intolerance', 'Cold intolerance', 'Excessive sweating', 'Thyroid issues'],
  'Hematologic/Lymphatic': ['Easy bruising', 'Bleeding', 'Lymph node swelling', 'Anemia symptoms', 'Blood transfusions'],
  'Allergic/Immunologic': ['Seasonal allergies', 'Food allergies', 'Drug allergies', 'Frequent infections', 'Autoimmune'],
};

// Default Physical Exam structure
const defaultPhysicalExam: PhysicalExamSection[] = [
  { system: 'General Appearance', findings: 'Alert, oriented, in no acute distress', isNormal: true, isExpanded: false },
  { system: 'HEENT', findings: 'Normocephalic, atraumatic. PERRLA. TMs clear. Oropharynx clear.', isNormal: true, isExpanded: false },
  { system: 'Neck', findings: 'Supple, no lymphadenopathy, no thyromegaly', isNormal: true, isExpanded: false },
  { system: 'Cardiovascular', findings: 'Regular rate and rhythm. No murmurs, rubs, or gallops. Normal S1, S2.', isNormal: true, isExpanded: false },
  { system: 'Respiratory', findings: 'Clear to auscultation bilaterally. No wheezes, rales, or rhonchi.', isNormal: true, isExpanded: false },
  { system: 'Abdomen', findings: 'Soft, non-tender, non-distended. Normal bowel sounds. No organomegaly.', isNormal: true, isExpanded: false },
  { system: 'Extremities', findings: 'No edema, cyanosis, or clubbing. Pulses 2+ bilaterally.', isNormal: true, isExpanded: false },
  { system: 'Skin', findings: 'Warm, dry, intact. No rashes or lesions.', isNormal: true, isExpanded: false },
  { system: 'Neurological', findings: 'Alert and oriented x3. CN II-XII intact. Motor 5/5 all extremities. Sensation intact.', isNormal: true, isExpanded: false },
  { system: 'Psychiatric', findings: 'Appropriate mood and affect. Normal judgment and insight.', isNormal: true, isExpanded: false },
];

// Templates
const templates = [
  { value: '', label: 'Select a template...' },
  { value: 'general', label: 'General Consultation' },
  { value: 'followup', label: 'Follow-up Visit' },
  { value: 'pediatric', label: 'Pediatric Consultation' },
  { value: 'antenatal', label: 'Antenatal Visit' },
  { value: 'chronic', label: 'Chronic Disease Management' },
  { value: 'respiratory', label: 'Respiratory Complaint' },
  { value: 'cardiovascular', label: 'Cardiovascular Assessment' },
  { value: 'psychiatric', label: 'Psychiatric Evaluation' },
  { value: 'surgical', label: 'Surgical Consultation' },
];

const templateContent: Record<string, Partial<ConsultationForm>> = {
  general: {
    historyOfPresentIllness: 'Onset: \nLocation: \nDuration: \nCharacter: \nAggravating factors: \nRelieving factors: \nTiming: \nSeverity: ',
  },
  followup: {
    historyOfPresentIllness: 'Patient returns for follow-up of:\nCurrent status: \nMedication compliance: \nSide effects: \nNew concerns: ',
  },
  pediatric: {
    historyOfPresentIllness: 'Birth history: \nDevelopmental milestones: \nImmunization status: \nFeeding: \nCurrent illness: ',
  },
  antenatal: {
    historyOfPresentIllness: 'G_P_: \nLMP: \nEDD: \nGA: \nFetal movements: \nContractions: \nBleeding: \nDischarge: ',
  },
  chronic: {
    historyOfPresentIllness: 'Condition being managed: \nLast visit: \nCurrent medications: \nCompliance: \nHome monitoring results: \nNew symptoms: ',
  },
  respiratory: {
    historyOfPresentIllness: 'Cough: Duration_, Character_\nSputum: Color_, Amount_\nDyspnea: At rest/exertion\nWheezing: \nFever: \nExposures: \nSmoking history: ',
  },
  cardiovascular: {
    historyOfPresentIllness: 'Chest pain: Location_, Character_, Radiation_\nDyspnea: \nPalpitations: \nEdema: \nSyncope: \nExercise tolerance: ',
  },
  psychiatric: {
    historyOfPresentIllness: 'Presenting symptoms: \nDuration: \nTriggers: \nPrevious episodes: \nCurrent medications: \nSubstance use: \nSuicidal ideation: ',
  },
  surgical: {
    historyOfPresentIllness: 'Indication for surgery: \nSymptom duration: \nPrevious surgeries: \nAnesthesia history: \nNPO status: ',
  },
};

// Tabs for main content
const mainTabs = [
  { id: 'complaint', label: 'Chief Complaint', icon: FileText },
  { id: 'history', label: 'History', icon: ClipboardList },
  { id: 'ros', label: 'Review of Systems', icon: Activity },
  { id: 'exam', label: 'Physical Exam', icon: Stethoscope },
  { id: 'results', label: 'Results', icon: FlaskConical },
  { id: 'assessment', label: 'Assessment', icon: FileCheck },
  { id: 'orders', label: 'Orders', icon: TestTube },
  { id: 'prescriptions', label: 'Rx', icon: Pill },
  { id: 'plan', label: 'Plan', icon: Briefcase },
];

// Helper function to calculate age
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper function to format time
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function NewConsultationPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const facilityId = useFacilityId();
  const { hasPermission } = usePermissions();
  
  // Permission check
  const canCreate = hasPermission('encounters.create');
  const canUpdate = hasPermission('encounters.update');

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<QueueEntry | null>(null);
  const [activeTab, setActiveTab] = useState('complaint');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [consultationStartTime, setConsultationStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [icdSearchQuery, setIcdSearchQuery] = useState('');
  const [showIcdSearch, setShowIcdSearch] = useState(false);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState<ConsultationForm>({
    chiefComplaint: '',
    duration: '',
    onset: '',
    historyOfPresentIllness: '',
    pastMedicalHistory: '',
    pastSurgicalHistory: '',
    familyHistory: '',
    socialHistory: {
      occupation: '',
      smoking: 'Non-smoker',
      alcohol: 'None',
      drugs: 'None',
      exercise: '',
      diet: '',
    },
    reviewOfSystems: [...defaultReviewOfSystems],
    physicalExam: [...defaultPhysicalExam],
    diagnoses: [],
    clinicalImpression: '',
    planItems: [],
    followUpDate: '',
    followUpNotes: '',
    patientEducation: '',
    template: '',
  });

  const [patientSummary, setPatientSummary] = useState<PatientSummary>({
    activeProblems: [],
    currentMedications: [],
    recentVitals: null,
    recentLabResults: [],
    chronicConditions: [],
    allergies: [],
    alerts: [],
  });

  // Read URL params for pre-selecting patient/encounter
  const [searchParams] = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
  const urlEncounterId = searchParams.get('encounterId');

  // Fetch waiting patients from queue
  const { data: waitingPatients = [], isLoading } = useQuery({
    queryKey: ['queue', 'waiting', 'consultation'],
    queryFn: () => queueService.getWaiting('consultation'),
    refetchInterval: 30000,
  });

  // Fetch patient details
  const { data: patientDetails } = useQuery({
    queryKey: ['patient', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return null;
      return patientsService.getById(selectedPatient.patientId);
    },
    enabled: !!selectedPatient?.patientId,
  });

  // Fetch vitals for selected patient
  const { data: patientVitals } = useQuery({
    queryKey: ['vitals', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return null;
      const history = await vitalsService.getPatientHistory(selectedPatient.patientId);
      if (history && history.length > 0) {
        const latest = history[0];
        return {
          temperature: String(latest.temperature || '-'),
          pulse: String(latest.pulse || '-'),
          bp: latest.bloodPressureSystolic && latest.bloodPressureDiastolic 
            ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}` 
            : '-/-',
          respiratoryRate: String(latest.respiratoryRate || '-'),
          spo2: String(latest.oxygenSaturation || '-'),
          painScale: latest.painScale || 0,
          recordedAt: new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recordedBy: 'Nurse',
        } as Vitals;
      }
      return null;
    },
    enabled: !!selectedPatient?.patientId,
  });

  // Fetch previous encounters
  const { data: previousEncounters = [] } = useQuery({
    queryKey: ['encounters', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return [];
      const result = await encountersService.list({ patientId: selectedPatient.patientId, limit: 10 });
      return result.data || [];
    },
    enabled: !!selectedPatient?.patientId,
  });

  // Fetch patient lab results
  const { data: patientLabResults = [], isLoading: labResultsLoading } = useQuery({
    queryKey: ['lab-results', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return [];
      return labService.orders.list({ patientId: selectedPatient.patientId });
    },
    enabled: !!selectedPatient?.patientId,
  });

  // State for lab test selection
  const [showLabTestSelector, setShowLabTestSelector] = useState(false);
  const [labTestSearch, setLabTestSearch] = useState('');
  const [selectedLabTests, setSelectedLabTests] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);

  // State for imaging/radiology selection
  const [showImagingSelector, setShowImagingSelector] = useState(false);
  const [imagingSearch, setImagingSearch] = useState('');
  const [selectedImagingTests, setSelectedImagingTests] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);

  // Fetch available lab tests from system
  const { data: availableLabTests = [] } = useQuery({
    queryKey: ['lab-tests-catalog', labTestSearch],
    queryFn: () => labService.tests.list({ status: 'active', search: labTestSearch || undefined }),
    staleTime: 60000,
  });

  // Fetch available imaging/radiology services from system
  const { data: availableImagingServices = [] } = useQuery({
    queryKey: ['imaging-services-catalog', imagingSearch],
    queryFn: async () => {
      const services = await servicesService.list();
      // Filter to only imaging/radiology related services
      const imagingServices = services.filter(s => 
        s.isActive && (
          s.name.toLowerCase().includes('x-ray') ||
          s.name.toLowerCase().includes('xray') ||
          s.name.toLowerCase().includes('ultrasound') ||
          s.name.toLowerCase().includes('ct') ||
          s.name.toLowerCase().includes('mri') ||
          s.name.toLowerCase().includes('ecg') ||
          s.name.toLowerCase().includes('scan') ||
          s.name.toLowerCase().includes('imaging') ||
          s.name.toLowerCase().includes('radiology') ||
          s.name.toLowerCase().includes('mammography') ||
          s.name.toLowerCase().includes('fluoroscopy') ||
          s.category?.name?.toLowerCase().includes('radiology') ||
          s.category?.name?.toLowerCase().includes('imaging')
        )
      );
      // Apply search filter if provided
      if (imagingSearch) {
        const searchLower = imagingSearch.toLowerCase();
        return imagingServices.filter(s => 
          s.name.toLowerCase().includes(searchLower) ||
          s.code.toLowerCase().includes(searchLower)
        );
      }
      return imagingServices;
    },
    staleTime: 60000,
  });

  // WHO ICD-10 search for diagnoses - try online first, fallback to local
  const { data: whoIcdResults = [], isLoading: icdSearchLoading } = useQuery({
    queryKey: ['icd-search', icdSearchQuery],
    queryFn: async () => {
      if (icdSearchQuery.length < 2) return [];
      try {
        // Try WHO API first (uses NIH API for ICD-10, no credentials needed)
        const result = await diagnosesService.searchWHO(icdSearchQuery, 'icd10');
        console.log('WHO API result:', result);
        if (result.data && result.data.length > 0) {
          return result.data;
        }
        // If WHO returns empty, try local
        console.log('WHO returned no results, falling back to local');
        throw new Error('No WHO results');
      } catch (error) {
        console.log('WHO API error, falling back to local:', error);
        // Fallback to local database (cached/imported diagnoses)
        const localResult = await diagnosesService.search({ search: icdSearchQuery, limit: 30 });
        return (localResult.data || []).map(d => ({
          code: d.icd10Code,
          title: d.name,
          version: 'ICD-10' as const,
          score: 1,
        }));
      }
    },
    enabled: icdSearchQuery.length >= 2,
    staleTime: 60000,
  });

  // Start consultation mutation
  const startConsultMutation = useMutation({
    mutationFn: async (entry: QueueEntry) => {
      await queueService.startService(entry.id);
      return encountersService.create({
        patientId: entry.patientId,
        facilityId,
        type: 'opd',
        chiefComplaint: form.chiefComplaint,
      });
    },
    onSuccess: (encounter) => {
      setEncounterId(encounter.id);
      setConsultationStartTime(new Date());
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Consultation started');
    },
    onError: () => {
      toast.error('Failed to start consultation');
    },
  });

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save clinical notes to encounter
      if (encounterId) {
        await encountersService.update(encounterId, {
          chiefComplaint: form.chiefComplaint,
          notes: JSON.stringify({
            hpi: form.historyOfPresentIllness,
            ros: form.reviewOfSystems,
            exam: form.physicalExam,
            assessment: form.clinicalImpression,
            diagnoses: form.diagnoses,
            plan: form.planItems,
          }),
        });
      }
    },
    onSuccess: () => {
      setLastSaved(new Date());
      toast.success('Draft saved');
    },
    onError: () => {
      toast.error('Failed to save draft');
    },
  });

  // Complete consultation mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!encounterId) throw new Error('No encounter');
      // Validate required fields
      if (!form.chiefComplaint || form.diagnoses.length === 0) {
        throw new Error('Please complete chief complaint and at least one diagnosis');
      }
      
      // Build subjective section
      const subjectiveParts = [
        form.chiefComplaint ? `Chief Complaint: ${form.chiefComplaint}` : '',
        form.historyOfPresentIllness ? `HPI: ${form.historyOfPresentIllness}` : '',
        form.reviewOfSystems ? `ROS: ${form.reviewOfSystems}` : '',
      ].filter(Boolean);
      
      // Build clinical note payload - only include non-empty fields
      const clinicalNotePayload: {
        encounterId: string;
        subjective?: string;
        objective?: string;
        assessment?: string;
        plan?: string;
        diagnoses?: { code: string; description: string; type: 'primary' | 'secondary' | 'differential' }[];
      } = {
        encounterId,
        diagnoses: form.diagnoses.map(d => ({
          code: d.code,
          description: d.description,
          type: d.type,
        })),
      };
      
      if (subjectiveParts.length > 0) {
        clinicalNotePayload.subjective = subjectiveParts.join('\n\n');
      }
      if (form.physicalExam) {
        clinicalNotePayload.objective = form.physicalExam;
      }
      if (form.clinicalImpression || form.diagnoses.length > 0) {
        clinicalNotePayload.assessment = form.clinicalImpression || form.diagnoses.map(d => `${d.code}: ${d.description}`).join('; ');
      }
      if (form.planItems.length > 0) {
        clinicalNotePayload.plan = form.planItems.map(p => `• ${p}`).join('\n');
      }
      
      // 1. Save clinical note with SOAP format and diagnoses
      await clinicalNotesService.create(clinicalNotePayload);
      
      // 2. Update encounter with chief complaint
      await encountersService.update(encounterId, {
        chiefComplaint: form.chiefComplaint,
        notes: JSON.stringify({
          hpi: form.historyOfPresentIllness,
          ros: form.reviewOfSystems,
          exam: form.physicalExam,
          assessment: form.clinicalImpression,
          diagnoses: form.diagnoses,
          plan: form.planItems,
        }),
      });
      
      // 3. Mark encounter as completed
      await encountersService.updateStatus(encounterId, 'completed');
    },
    onSuccess: () => {
      toast.success('Consultation completed and signed');
      // Reset form
      setSelectedPatient(null);
      setEncounterId(null);
      setConsultationStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['clinical-notes'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to complete consultation');
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateOrderDto) => {
      return ordersService.create(data);
    },
    onSuccess: (order) => {
      toast.success(`${order.orderType === 'lab' ? 'Lab' : 'Imaging'} order created`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Create prescription mutation
  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: CreatePrescriptionDto) => {
      return prescriptionsService.create(data);
    },
    onSuccess: () => {
      toast.success('Prescription created');
    },
  });

  // Consultation timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (consultationStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - consultationStartTime.getTime()) / 1000);
        setElapsedTime(diff);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [consultationStartTime]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (encounterId && selectedPatient) {
      autoSaveTimerRef.current = setInterval(() => {
        saveMutation.mutate();
      }, 30000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [encounterId, selectedPatient]);

  // Update patient summary when patient details or lab results load
  useEffect(() => {
    if (patientDetails) {
      // Extract recent lab results for summary
      const recentLabResults: Array<{ test: string; value: string; unit: string; date: string; abnormal: boolean }> = [];
      
      if (patientLabResults && patientLabResults.length > 0) {
        const completedOrders = patientLabResults.filter(o => ['completed', 'verified', 'released', 'validated'].includes(o.status));
        for (const order of completedOrders.slice(0, 3)) {
          for (const test of order.tests || []) {
            if (test.result) {
              const result = test.result;
              const params = result.parameters || [result];
              for (const param of params.slice(0, 2)) {
                recentLabResults.push({
                  test: param.parameter || param.name || test.testName || test.name || 'Test',
                  value: String(param.numericValue ?? param.value ?? '-'),
                  unit: param.unit || '',
                  date: new Date(order.completedAt || order.createdAt).toLocaleDateString(),
                  abnormal: param.abnormalFlag ? !['normal'].includes(param.abnormalFlag) : false,
                });
              }
            }
          }
        }
      }
      
      setPatientSummary(prev => ({
        ...prev,
        allergies: patientDetails.allergies || [],
        recentVitals: patientVitals || null,
        recentLabResults: recentLabResults.slice(0, 5),
      }));
    }
  }, [patientDetails, patientVitals, patientLabResults]);

  // Load encounter from URL params (when coming from queue)
  useEffect(() => {
    if (urlEncounterId && !encounterId) {
      // Fetch the encounter and set up the consultation
      encountersService.getById(urlEncounterId).then(async encounter => {
        if (encounter) {
          setEncounterId(encounter.id);
          setConsultationStartTime(new Date());
          // Create a minimal queue entry from encounter data
          const patientEntry: QueueEntry = {
            id: encounter.id,
            patientId: encounter.patientId,
            encounterId: encounter.id,
            facilityId: encounter.facilityId,
            servicePoint: 'consultation',
            status: 'in_service',
            ticketNumber: encounter.visitNumber || '',
            notes: encounter.chiefComplaint || '',
            patient: encounter.patient,
          };
          setSelectedPatient(patientEntry);
          // Pre-populate form with existing encounter data
          if (encounter.chiefComplaint) {
            setForm(prev => ({
              ...prev,
              chiefComplaint: encounter.chiefComplaint || '',
            }));
          }
          // Parse notes if they contain clinical data
          if (encounter.notes) {
            try {
              const notes = JSON.parse(encounter.notes);
              setForm(prev => ({
                ...prev,
                historyOfPresentIllness: notes.hpi || '',
                clinicalImpression: notes.assessment || '',
              }));
            } catch {
              // Notes are plain text, not JSON
            }
          }
          
          // Load clinical notes for this encounter (includes diagnoses)
          try {
            const clinicalNotes = await clinicalNotesService.getByEncounter(encounter.id);
            if (clinicalNotes && clinicalNotes.length > 0) {
              const latestNote = clinicalNotes[0]; // Get most recent note
              setForm(prev => ({
                ...prev,
                historyOfPresentIllness: latestNote.subjective || prev.historyOfPresentIllness,
                clinicalImpression: latestNote.assessment || prev.clinicalImpression,
                diagnoses: latestNote.diagnoses?.map((d, idx) => ({
                  id: `loaded-${idx}`,
                  code: d.code,
                  description: d.description,
                  type: d.type,
                })) || prev.diagnoses,
              }));
            }
          } catch (err) {
            console.log('No clinical notes found for encounter');
          }
        }
      }).catch(err => {
        console.error('Failed to load encounter:', err);
        toast.error('Failed to load encounter');
      });
    }
  }, [urlEncounterId, encounterId]);

  // Load patient from URL params (when coming from patient detail page)
  useEffect(() => {
    if (urlPatientId && !selectedPatient && !urlEncounterId) {
      // Fetch the patient and create a temporary queue entry
      patientsService.getById(urlPatientId).then(patient => {
        if (patient) {
          const patientEntry: QueueEntry = {
            id: `temp-${patient.id}`,
            patientId: patient.id,
            facilityId: '',
            servicePoint: 'consultation',
            status: 'waiting',
            ticketNumber: '',
            notes: '',
            patient: patient,
          };
          setSelectedPatient(patientEntry);
        }
      }).catch(err => {
        console.error('Failed to load patient:', err);
        toast.error('Failed to load patient');
      });
    }
  }, [urlPatientId, selectedPatient, urlEncounterId]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return waitingPatients;
    const query = searchQuery.toLowerCase();
    return waitingPatients.filter(
      (p) =>
        p.patient?.fullName?.toLowerCase().includes(query) ||
        p.patient?.mrn?.toLowerCase().includes(query) ||
        p.ticketNumber?.toLowerCase().includes(query)
    );
  }, [searchQuery, waitingPatients]);

  const handleSelectPatient = useCallback((entry: QueueEntry) => {
    setSelectedPatient(entry);
    setEncounterId(null);
    setConsultationStartTime(null);
    setElapsedTime(0);
    setForm(prev => ({
      ...prev,
      chiefComplaint: entry.notes || '',
      reviewOfSystems: [...defaultReviewOfSystems],
      physicalExam: [...defaultPhysicalExam],
      diagnoses: [],
      planItems: [],
    }));
  }, []);

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return '0 min';
    const now = new Date();
    const created = new Date(entry.createdAt);
    const mins = Math.floor((now.getTime() - created.getTime()) / 60000);
    return `${mins} min`;
  };

  const handleTemplateChange = (templateValue: string) => {
    setForm(prev => ({
      ...prev,
      template: templateValue,
      ...(templateContent[templateValue] || {}),
    }));
  };

  const handleRosToggle = (index: number) => {
    setForm(prev => ({
      ...prev,
      reviewOfSystems: prev.reviewOfSystems.map((item, i) => 
        i === index ? { ...item, isExpanded: !item.isExpanded } : item
      ),
    }));
  };

  const handleRosFindingToggle = (systemIndex: number, finding: string) => {
    setForm(prev => ({
      ...prev,
      reviewOfSystems: prev.reviewOfSystems.map((item, i) => {
        if (i !== systemIndex) return item;
        const findings = item.findings.includes(finding)
          ? item.findings.filter(f => f !== finding)
          : [...item.findings, finding];
        return { ...item, findings };
      }),
    }));
  };

  const handleExamToggle = (index: number) => {
    setForm(prev => ({
      ...prev,
      physicalExam: prev.physicalExam.map((item, i) => 
        i === index ? { ...item, isExpanded: !item.isExpanded } : item
      ),
    }));
  };

  const handleExamFindingsChange = (index: number, findings: string) => {
    setForm(prev => ({
      ...prev,
      physicalExam: prev.physicalExam.map((item, i) => 
        i === index ? { ...item, findings, isNormal: false } : item
      ),
    }));
  };

  const handleAddDiagnosis = (code: string, description: string, type: Diagnosis['type'] = 'primary') => {
    const newDiagnosis: Diagnosis = {
      id: `diag-${Date.now()}`,
      code,
      description,
      type,
    };
    setForm(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, newDiagnosis],
    }));
    setShowIcdSearch(false);
    setIcdSearchQuery('');
  };

  const handleRemoveDiagnosis = (id: string) => {
    setForm(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.filter(d => d.id !== id),
    }));
  };

  const handleCopyFromPrevious = () => {
    if (previousEncounters.length > 0) {
      const lastEncounter = previousEncounters[0];
      if (lastEncounter.chiefComplaint) {
        setForm(prev => ({
          ...prev,
          chiefComplaint: lastEncounter.chiefComplaint || '',
        }));
        toast.success('Copied from previous visit');
      }
    }
  };

  const handleOrderLab = () => {
    if (!encounterId) {
      toast.error('Please start consultation first');
      return;
    }
    // Switch to orders tab
    setActiveTab('orders');
  };

  const handleOrderImaging = () => {
    if (!encounterId) {
      toast.error('Please start consultation first');
      return;
    }
    // Switch to orders tab
    setActiveTab('orders');
  };

  const handlePrescribe = () => {
    if (!encounterId) {
      toast.error('Please start consultation first');
      return;
    }
    // Switch to prescriptions tab
    setActiveTab('prescriptions');
  };

  const handleNavigateToFullPage = (page: 'lab' | 'radiology' | 'prescription' | 'icd') => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    const params = `patientId=${selectedPatient.patientId}&encounterId=${encounterId}`;
    switch (page) {
      case 'lab':
        navigate(`/doctor/orders/lab?${params}`);
        break;
      case 'radiology':
        navigate(`/doctor/orders/radiology?${params}`);
        break;
      case 'prescription':
        navigate(`/doctor/prescriptions/new?${params}`);
        break;
      case 'icd':
        navigate(`/doctor/diagnosis/icd?${params}`);
        break;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Use local ICD search results only (no mock data)
  const icdResults = useMemo(() => {
    if (!icdSearchQuery || icdSearchQuery.length < 2) return [];
    
    // Use local database results
    return whoIcdResults.map((r: { code: string; title?: string; description?: string }) => ({
      code: r.code,
      description: r.title || r.description || r.code,
    }));
  }, [icdSearchQuery, whoIcdResults]);

  // Permission check UI
  if (!canCreate && !canUpdate) {
    return <AccessDenied />;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Patient Header Bar - Sticky */}
      {selectedPatient && patientDetails && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm mb-4 -mx-4 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Patient Photo & Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{patientDetails.fullName}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{calculateAge(patientDetails.dateOfBirth)} yrs</span>
                    <span>•</span>
                    <span className="capitalize">{patientDetails.gender}</span>
                    <span>•</span>
                    <span>MRN: {patientDetails.mrn}</span>
                  </div>
                </div>
              </div>

              {/* Allergies Warning */}
              {patientSummary.allergies.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 border border-red-300 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">
                    Allergies: {patientSummary.allergies.join(', ')}
                  </span>
                </div>
              )}

              {/* Active Alerts */}
              {patientSummary.alerts.length > 0 && (
                <div className="flex items-center gap-2">
                  {patientSummary.alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                        alert.severity === 'high'
                          ? 'bg-red-100 text-red-700'
                          : alert.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <BadgeAlert className="w-3 h-3" />
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                <History className="w-4 h-4" />
                Full History
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                <FolderOpen className="w-4 h-4" />
                Previous Encounters ({previousEncounters.length})
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Printer className="w-4 h-4" />
                Print Summary
              </button>
            </div>
          </div>

          {/* Consultation Timer & Auto-save */}
          {consultationStartTime && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <Timer className="w-4 h-4 text-blue-600" />
                <span className="font-mono font-medium">{formatDuration(elapsedTime)}</span>
              </div>
              {lastSaved && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Auto-saved {lastSaved.toLocaleTimeString()}
                </div>
              )}
              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                  isVoiceEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isVoiceEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                Voice Dictation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Sidebar - Patient Summary / Queue */}
        <div className="w-64 flex flex-col gap-4">
          {/* Patient Queue */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1">
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : filteredPatients.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No patients waiting</p>
              ) : (
                filteredPatients.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSelectPatient(entry)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                      selectedPatient?.id === entry.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <UserCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {entry.patient?.fullName || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">{entry.patient?.mrn || entry.ticketNumber}</p>
                        <p className="text-xs text-gray-600 mt-1 truncate">{entry.notes || 'No complaint'}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{getWaitTime(entry)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Patient Summary - Only when patient selected */}
          {selectedPatient && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Patient Summary</h4>

              {/* Recent Vitals */}
              {patientVitals && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recent Vitals</p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="bg-gray-50 p-1.5 rounded text-center">
                      <span className="block font-medium">{patientVitals.bp}</span>
                      <span className="text-gray-500">BP</span>
                    </div>
                    <div className="bg-gray-50 p-1.5 rounded text-center">
                      <span className="block font-medium">{patientVitals.pulse}</span>
                      <span className="text-gray-500">HR</span>
                    </div>
                    <div className="bg-gray-50 p-1.5 rounded text-center">
                      <span className="block font-medium">{patientVitals.temperature}°</span>
                      <span className="text-gray-500">Temp</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Problems */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Active Problems</p>
                {patientSummary.activeProblems.length > 0 ? (
                  <ul className="text-xs space-y-1">
                    {patientSummary.activeProblems.slice(0, 3).map((p, i) => (
                      <li key={i} className="text-gray-700 truncate">• {p.description}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">None documented</p>
                )}
              </div>

              {/* Current Medications */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Medications</p>
                {patientSummary.currentMedications.length > 0 ? (
                  <ul className="text-xs space-y-1">
                    {patientSummary.currentMedications.slice(0, 3).map((m, i) => (
                      <li key={i} className="text-gray-700 truncate">• {m.name} {m.dose}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">None documented</p>
                )}
              </div>

              {/* Recent Lab Results */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Recent Labs</p>
                {patientSummary.recentLabResults.length > 0 ? (
                  <ul className="text-xs space-y-1">
                    {patientSummary.recentLabResults.slice(0, 3).map((l, i) => (
                      <li key={i} className={`truncate ${l.abnormal ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                        • {l.test}: {l.value} {l.unit}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">None recent</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Smart Features Bar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Template Selector */}
                  <div className="relative">
                    <select
                      value={form.template}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm appearance-none bg-white pr-8"
                    >
                      {templates.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Copy from Previous */}
                  {previousEncounters.length > 0 && (
                    <button
                      onClick={handleCopyFromPrevious}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
                    >
                      <Copy className="w-4 h-4" />
                      Copy from Previous
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Draft
                  </button>
                  {!encounterId ? (
                    <button
                      onClick={() => selectedPatient && startConsultMutation.mutate(selectedPatient)}
                      disabled={startConsultMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {startConsultMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                      Start Consultation
                    </button>
                  ) : (
                    <button
                      onClick={() => completeMutation.mutate()}
                      disabled={completeMutation.isPending || form.diagnoses.length === 0}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Sign & Complete
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-4">
                {mainTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Chief Complaint Tab */}
                {activeTab === 'complaint' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
                      <textarea
                        rows={3}
                        value={form.chiefComplaint}
                        onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Patient's main reason for visit..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                        <input
                          type="text"
                          value={form.duration}
                          onChange={(e) => setForm({ ...form, duration: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., 3 days, 2 weeks"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Onset</label>
                        <input
                          type="text"
                          value={form.onset}
                          onChange={(e) => setForm({ ...form, onset: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., Sudden, Gradual"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-2">History of Present Illness</h4>
                      <textarea
                        rows={4}
                        value={form.historyOfPresentIllness}
                        onChange={(e) => setForm({ ...form, historyOfPresentIllness: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Detailed history..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Past Medical History</h4>
                        <textarea
                          rows={3}
                          value={form.pastMedicalHistory}
                          onChange={(e) => setForm({ ...form, pastMedicalHistory: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Previous medical conditions..."
                        />
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Past Surgical History</h4>
                        <textarea
                          rows={3}
                          value={form.pastSurgicalHistory}
                          onChange={(e) => setForm({ ...form, pastSurgicalHistory: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Previous surgeries..."
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Family History</h4>
                      <textarea
                        rows={2}
                        value={form.familyHistory}
                        onChange={(e) => setForm({ ...form, familyHistory: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Relevant family medical history..."
                      />
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Social History</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            <Briefcase className="w-3 h-3 inline mr-1" />
                            Occupation
                          </label>
                          <input
                            type="text"
                            value={form.socialHistory.occupation}
                            onChange={(e) => setForm({ ...form, socialHistory: { ...form.socialHistory, occupation: e.target.value } })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            <Cigarette className="w-3 h-3 inline mr-1" />
                            Smoking
                          </label>
                          <select
                            value={form.socialHistory.smoking}
                            onChange={(e) => setForm({ ...form, socialHistory: { ...form.socialHistory, smoking: e.target.value } })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="Non-smoker">Non-smoker</option>
                            <option value="Current smoker">Current smoker</option>
                            <option value="Former smoker">Former smoker</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            <Wine className="w-3 h-3 inline mr-1" />
                            Alcohol
                          </label>
                          <select
                            value={form.socialHistory.alcohol}
                            onChange={(e) => setForm({ ...form, socialHistory: { ...form.socialHistory, alcohol: e.target.value } })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            <option value="None">None</option>
                            <option value="Occasional">Occasional</option>
                            <option value="Regular">Regular</option>
                            <option value="Heavy">Heavy</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review of Systems Tab */}
                {activeTab === 'ros' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="space-y-2">
                      {form.reviewOfSystems.map((ros, index) => (
                        <div key={ros.system} className="border border-gray-200 rounded-lg">
                          <button
                            onClick={() => handleRosToggle(index)}
                            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900">{ros.system}</span>
                              {ros.findings.length > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                  {ros.findings.length} positive
                                </span>
                              )}
                            </div>
                            {ros.isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {ros.isExpanded && (
                            <div className="px-4 pb-3 border-t border-gray-100">
                              <div className="flex flex-wrap gap-2 mt-2">
                                {rosFindings[ros.system]?.map((finding) => (
                                  <button
                                    key={finding}
                                    onClick={() => handleRosFindingToggle(index, finding)}
                                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                                      ros.findings.includes(finding)
                                        ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    {finding}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={ros.notes}
                                onChange={(e) => {
                                  const updated = [...form.reviewOfSystems];
                                  updated[index] = { ...updated[index], notes: e.target.value };
                                  setForm({ ...form, reviewOfSystems: updated });
                                }}
                                placeholder="Additional notes..."
                                className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-sm"
                                rows={2}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Physical Exam Tab */}
                {activeTab === 'exam' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="space-y-2">
                      {form.physicalExam.map((exam, index) => (
                        <div key={exam.system} className="border border-gray-200 rounded-lg">
                          <button
                            onClick={() => handleExamToggle(index)}
                            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900">{exam.system}</span>
                              {exam.isNormal ? (
                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Normal</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">Abnormal</span>
                              )}
                            </div>
                            {exam.isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {exam.isExpanded && (
                            <div className="px-4 pb-3 border-t border-gray-100">
                              <textarea
                                value={exam.findings}
                                onChange={(e) => handleExamFindingsChange(index, e.target.value)}
                                className="w-full mt-2 px-2 py-1.5 border border-gray-200 rounded text-sm"
                                rows={3}
                              />
                              <button
                                onClick={() => {
                                  const updated = [...form.physicalExam];
                                  updated[index] = {
                                    ...updated[index],
                                    findings: defaultPhysicalExam[index].findings,
                                    isNormal: true,
                                  };
                                  setForm({ ...form, physicalExam: updated });
                                }}
                                className="mt-2 text-xs text-blue-600 hover:underline"
                              >
                                Reset to normal defaults
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results Tab - Lab & Imaging Results */}
                {activeTab === 'results' && (
                  <div className="space-y-4">
                    {/* Lab Results Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <FlaskConical className="w-5 h-5 text-purple-600" />
                          Lab Results
                        </h4>
                        {labResultsLoading && (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        )}
                      </div>

                      {patientLabResults.length > 0 ? (
                        <div className="space-y-3">
                          {/* Show completed/verified/released results first */}
                          {patientLabResults
                            .filter(order => ['completed', 'verified', 'released', 'validated'].includes(order.status))
                            .slice(0, 5)
                            .map((order) => (
                              <div
                                key={order.id}
                                className="border border-gray-100 rounded-lg p-3 hover:border-gray-200"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm text-gray-900">
                                    {order.tests?.map(t => t.testName || t.name).join(', ') || 'Lab Order'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(order.completedAt || order.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                
                                {/* Show test results - iterate through parameters */}
                                {order.tests?.filter(t => t.result).map((test, idx) => {
                                  const result = test.result;
                                  const params = result?.parameters || [];
                                  
                                  // If no parameters array, show the single result
                                  if (params.length === 0 && result) {
                                    return (
                                      <div key={idx} className="flex items-center justify-between py-1 text-sm border-t border-gray-50">
                                        <span className="text-gray-600">{result.parameter || test.testName || test.name}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">
                                            {result.numericValue ?? result.value ?? '-'} {result.unit || ''}
                                          </span>
                                          {result.abnormalFlag && result.abnormalFlag !== 'normal' && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                              result.abnormalFlag === 'high' || result.abnormalFlag === 'critical_high'
                                                ? 'bg-red-100 text-red-700'
                                                : result.abnormalFlag === 'low' || result.abnormalFlag === 'critical_low'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {result.abnormalFlag === 'high' || result.abnormalFlag === 'critical_high' ? (
                                                <TrendingUp className="w-3 h-3 inline" />
                                              ) : (
                                                <TrendingDown className="w-3 h-3 inline" />
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Show first 3 parameters from the array
                                  return params.slice(0, 3).map((param: any, pIdx: number) => (
                                    <div key={`${idx}-${pIdx}`} className="flex items-center justify-between py-1 text-sm border-t border-gray-50">
                                      <span className="text-gray-600">{param.parameter || param.name}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          {param.numericValue ?? param.value ?? '-'} {param.unit || ''}
                                        </span>
                                        {param.abnormalFlag && param.abnormalFlag !== 'normal' && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                                            param.abnormalFlag === 'high' || param.abnormalFlag === 'critical_high'
                                              ? 'bg-red-100 text-red-700'
                                              : param.abnormalFlag === 'low' || param.abnormalFlag === 'critical_low'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-600'
                                          }`}>
                                            {param.abnormalFlag === 'high' || param.abnormalFlag === 'critical_high' ? (
                                              <TrendingUp className="w-3 h-3 inline" />
                                            ) : (
                                              <TrendingDown className="w-3 h-3 inline" />
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ));
                                })}
                                
                                <button 
                                  onClick={() => navigate(`/doctor/results/lab?patientId=${selectedPatient?.patientId}`)}
                                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" /> View Full Report
                                </button>
                              </div>
                            ))}
                          
                          {/* Show pending orders */}
                          {patientLabResults
                            .filter(order => !['completed', 'verified', 'released', 'validated'].includes(order.status))
                            .slice(0, 3)
                            .map((order) => (
                              <div
                                key={order.id}
                                className="border border-yellow-200 bg-yellow-50 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm text-gray-900">
                                    {order.tests?.map(t => t.testName || t.name).join(', ') || 'Lab Order'}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Ordered {new Date(order.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          
                          {/* Show message if only pending orders exist */}
                          {patientLabResults.filter(o => ['completed', 'verified', 'released', 'validated'].includes(o.status)).length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-2">
                              Results pending - check back later
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No lab results available</p>
                          <button
                            onClick={() => setActiveTab('plan')}
                            className="mt-2 text-sm text-blue-600 hover:underline"
                          >
                            Order Lab Tests →
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Imaging Results Section */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-blue-600" />
                          Imaging Results
                        </h4>
                      </div>
                      
                      <div className="text-center py-8 text-gray-400">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No imaging results available</p>
                        <button
                          onClick={() => setActiveTab('plan')}
                          className="mt-2 text-sm text-blue-600 hover:underline"
                        >
                          Order Imaging →
                        </button>
                      </div>
                    </div>

                    {/* Quick Summary */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Clinical Summary from Results</h4>
                      <p className="text-sm text-gray-600">
                        Review the results above and proceed to the Assessment tab to add your diagnosis.
                      </p>
                      <button
                        onClick={() => setActiveTab('assessment')}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Proceed to Assessment →
                      </button>
                    </div>
                  </div>
                )}

                {/* Assessment Tab */}
                {activeTab === 'assessment' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Diagnoses</h4>
                        <button
                          onClick={() => setShowIcdSearch(!showIcdSearch)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                          <Plus className="w-4 h-4" />
                          Add Diagnosis
                        </button>
                      </div>

                      {/* ICD-10/11 Search with WHO API */}
                      {showIcdSearch && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={icdSearchQuery}
                              onChange={(e) => setIcdSearchQuery(e.target.value)}
                              placeholder="Search ICD-10/11 codes (WHO database)..."
                              className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-lg text-sm"
                              autoFocus
                            />
                            {icdSearchLoading && (
                              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                            )}
                          </div>
                          {icdSearchQuery.length >= 2 && icdResults.length === 0 && !icdSearchLoading && (
                            <p className="text-sm text-gray-500 text-center py-2">
                              No results found. Try a different search term.
                            </p>
                          )}
                          {icdResults.length > 0 && (
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {icdResults.map((result) => (
                                <button
                                  key={result.code}
                                  onClick={() => handleAddDiagnosis(result.code, result.description, form.diagnoses.length === 0 ? 'primary' : 'secondary')}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-white rounded border border-transparent hover:border-gray-200"
                                >
                                  <span className="font-medium text-blue-600">{result.code}</span>
                                  <span className="text-gray-600 ml-2">{result.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Diagnoses List */}
                      {form.diagnoses.length > 0 ? (
                        <div className="space-y-2">
                          {form.diagnoses.map((diagnosis) => (
                            <div
                              key={diagnosis.id}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                                diagnosis.type === 'primary'
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div>
                                <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                                  diagnosis.type === 'primary' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {diagnosis.type}
                                </span>
                                <span className="font-medium text-sm">{diagnosis.code}</span>
                                <span className="text-sm text-gray-600 ml-2">{diagnosis.description}</span>
                              </div>
                              <button
                                onClick={() => handleRemoveDiagnosis(diagnosis.id)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No diagnoses added yet</p>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Clinical Impression</h4>
                      <textarea
                        rows={3}
                        value={form.clinicalImpression}
                        onChange={(e) => setForm({ ...form, clinicalImpression: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Summary of clinical findings and reasoning..."
                      />
                    </div>
                  </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    {/* Lab Orders */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <TestTube className="w-4 h-4 text-purple-600" />
                        Laboratory Orders
                      </h4>
                      <div className="space-y-3">
                        {/* Search and Select Tests */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search lab tests..."
                              value={labTestSearch}
                              onChange={(e) => setLabTestSearch(e.target.value)}
                              onFocus={() => setShowLabTestSelector(true)}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                          
                          {/* Test Dropdown */}
                          {showLabTestSelector && (
                            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg">
                              {availableLabTests.length === 0 ? (
                                <p className="text-sm text-gray-500 p-3 text-center">
                                  {labTestSearch ? 'No tests found' : 'No lab tests configured. Add tests in Admin → Lab → Test Catalog'}
                                </p>
                              ) : (
                                availableLabTests.map((test) => (
                                  <button
                                    key={test.id}
                                    onClick={() => {
                                      if (!selectedLabTests.find(t => t.id === test.id)) {
                                        setSelectedLabTests([...selectedLabTests, { id: test.id, code: test.code, name: test.name, price: test.price }]);
                                      }
                                      setLabTestSearch('');
                                      setShowLabTestSelector(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-purple-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                                  >
                                    <div>
                                      <span className="text-sm font-medium text-gray-900">{test.name}</span>
                                      <span className="text-xs text-gray-500 ml-2">({test.code})</span>
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {test.price > 0 ? `UGX ${test.price.toLocaleString()}` : 'Free'}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          
                          {/* Selected Tests */}
                          {selectedLabTests.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700">Selected Tests:</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedLabTests.map((test) => (
                                  <span
                                    key={test.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-lg text-sm"
                                  >
                                    {test.name}
                                    <button
                                      onClick={() => setSelectedLabTests(selectedLabTests.filter(t => t.id !== test.id))}
                                      className="hover:text-purple-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  if (selectedLabTests.length === 0) return;
                                  const order: CreateOrderDto = {
                                    encounterId: encounterId!,
                                    orderType: 'lab',
                                    testCodes: selectedLabTests.map(t => ({ code: t.code, name: t.name })),
                                    priority: 'routine',
                                    clinicalNotes: form.chiefComplaint,
                                  };
                                  createOrderMutation.mutate(order);
                                  setSelectedLabTests([]);
                                }}
                                disabled={!encounterId || createOrderMutation.isPending || selectedLabTests.length === 0}
                                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {createOrderMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                                Order {selectedLabTests.length} Test{selectedLabTests.length !== 1 ? 's' : ''}
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Pending Orders */}
                        {patientLabResults && patientLabResults.length > 0 ? (
                          <div className="space-y-2 pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-600">Pending/Active Orders:</p>
                            {patientLabResults.filter(r => r.status !== 'completed').map((order) => (
                              <div key={order.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
                                <span className="text-sm">{order.testCodes?.map(t => t.name).join(', ')}</span>
                                <span className="text-xs text-yellow-700 capitalize">{order.status}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-2">No active lab orders</p>
                        )}
                      </div>
                    </div>

                    {/* Imaging Orders */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                        Imaging Orders
                      </h4>
                      
                      {/* Search Imaging */}
                      <div className="mb-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search imaging services..."
                            value={imagingSearch}
                            onChange={(e) => {
                              setImagingSearch(e.target.value);
                              setShowImagingSelector(true);
                            }}
                            onFocus={() => setShowImagingSelector(true)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        
                        {/* Imaging dropdown */}
                        {showImagingSelector && (
                          <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-lg">
                            {availableImagingServices.length > 0 ? (
                              availableImagingServices.map((service) => (
                                <button
                                  key={service.id}
                                  onClick={() => {
                                    if (!selectedImagingTests.find(t => t.id === service.id)) {
                                      setSelectedImagingTests([...selectedImagingTests, { id: service.id, code: service.code, name: service.name, price: service.basePrice }]);
                                    }
                                    setShowImagingSelector(false);
                                    setImagingSearch('');
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm flex justify-between items-center"
                                >
                                  <span>{service.name}</span>
                                  <span className="text-xs text-gray-500">{service.code}</span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2 text-sm text-gray-500">No imaging services found. Add services in Admin → Services</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Selected Imaging */}
                      {selectedImagingTests.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-600 mb-2">Selected:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedImagingTests.map((test) => (
                              <span key={test.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm">
                                {test.name}
                                <button
                                  onClick={() => setSelectedImagingTests(selectedImagingTests.filter(t => t.id !== test.id))}
                                  className="hover:text-blue-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (selectedImagingTests.length === 0) return;
                              const order: CreateOrderDto = {
                                encounterId: encounterId!,
                                orderType: 'radiology',
                                testCodes: selectedImagingTests.map(t => ({ code: t.code, name: t.name })),
                                priority: 'routine',
                                clinicalNotes: form.chiefComplaint,
                              };
                              createOrderMutation.mutate(order);
                              setSelectedImagingTests([]);
                            }}
                            disabled={!encounterId || createOrderMutation.isPending || selectedImagingTests.length === 0}
                            className="w-full mt-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {createOrderMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                            Order {selectedImagingTests.length} Imaging{selectedImagingTests.length !== 1 ? 's' : ''}
                          </button>
                        </div>
                      )}

                      {/* Quick buttons for common imaging */}
                      <div className="border-t border-gray-100 pt-3 mt-3">
                        <p className="text-xs text-gray-500 mb-2">Quick Add:</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              const order: CreateOrderDto = {
                                encounterId: encounterId!,
                                orderType: 'radiology',
                                testCodes: [{ code: 'CXR', name: 'Chest X-Ray PA' }],
                                priority: 'routine',
                                clinicalNotes: form.chiefComplaint,
                              };
                              createOrderMutation.mutate(order);
                            }}
                            disabled={!encounterId || createOrderMutation.isPending}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            Chest X-Ray
                          </button>
                          <button
                            onClick={() => {
                              const order: CreateOrderDto = {
                                encounterId: encounterId!,
                                orderType: 'radiology',
                                testCodes: [{ code: 'ABDUS', name: 'Abdominal Ultrasound' }],
                                priority: 'routine',
                                clinicalNotes: form.chiefComplaint,
                              };
                              createOrderMutation.mutate(order);
                            }}
                            disabled={!encounterId || createOrderMutation.isPending}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            Abd. Ultrasound
                          </button>
                          <button
                            onClick={() => {
                              const order: CreateOrderDto = {
                                encounterId: encounterId!,
                                orderType: 'radiology',
                                testCodes: [{ code: 'ECG', name: 'Electrocardiogram' }],
                                priority: 'routine',
                                clinicalNotes: form.chiefComplaint,
                              };
                              createOrderMutation.mutate(order);
                            }}
                            disabled={!encounterId || createOrderMutation.isPending}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            ECG
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prescriptions Tab */}
                {activeTab === 'prescriptions' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-green-600" />
                        Prescription
                      </h4>
                      
                      {/* Drug Search */}
                      <div className="mb-4">
                        <label className="block text-sm text-gray-600 mb-1">Search Drug</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search medications..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                            onChange={(e) => {
                              // Drug search would be implemented here
                            }}
                          />
                        </div>
                      </div>

                      {/* Common Medications */}
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Quick Add:</p>
                        <div className="flex flex-wrap gap-2">
                          {['Paracetamol 500mg', 'Amoxicillin 500mg', 'Ibuprofen 400mg', 'Omeprazole 20mg', 'Metformin 500mg'].map((drug) => (
                            <button
                              key={drug}
                              onClick={() => {
                                const [name, strength] = drug.split(' ');
                                setForm(prev => ({
                                  ...prev,
                                  planItems: [
                                    ...prev.planItems,
                                    {
                                      id: `rx-${Date.now()}`,
                                      type: 'prescription',
                                      description: `${drug} - TDS x 5 days`,
                                      details: { drugName: name, strength, frequency: 'TDS', duration: '5 days' }
                                    }
                                  ]
                                }));
                                toast.success(`Added ${drug} to prescription`);
                              }}
                              className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                            >
                              {drug}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Current Prescription Items */}
                      <div className="border-t border-gray-100 pt-4">
                        <p className="text-sm text-gray-600 mb-2">Current Prescription:</p>
                        {form.planItems.filter(p => p.type === 'prescription').length > 0 ? (
                          <div className="space-y-2">
                            {form.planItems.filter(p => p.type === 'prescription').map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Pill className="w-4 h-4 text-green-600" />
                                  <span className="text-sm">{item.description}</span>
                                </div>
                                <button
                                  onClick={() => setForm(prev => ({ ...prev, planItems: prev.planItems.filter(p => p.id !== item.id) }))}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">No medications added yet</p>
                        )}
                      </div>

                      {/* Submit Prescription */}
                      {form.planItems.filter(p => p.type === 'prescription').length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => {
                              const rxItems = form.planItems.filter(p => p.type === 'prescription');
                              const prescriptionData: CreatePrescriptionDto = {
                                patientId: selectedPatient!.patientId,
                                encounterId: encounterId!,
                                items: rxItems.map(item => ({
                                  drugId: 'generic',
                                  drugName: item.details?.drugName as string || item.description,
                                  dosage: item.details?.strength as string || '',
                                  frequency: item.details?.frequency as string || 'TDS',
                                  duration: item.details?.duration as string || '5 days',
                                  quantity: 15,
                                  instructions: '',
                                })),
                                notes: form.clinicalImpression,
                              };
                              createPrescriptionMutation.mutate(prescriptionData);
                            }}
                            disabled={createPrescriptionMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {createPrescriptionMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Send to Pharmacy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Plan Tab */}
                {activeTab === 'plan' && (
                  <div className="space-y-4">
                    {/* Plan Items */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Treatment Plan</h4>
                      {form.planItems.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {form.planItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {item.type === 'prescription' && <Pill className="w-4 h-4 text-green-600" />}
                                {item.type === 'lab' && <TestTube className="w-4 h-4 text-purple-600" />}
                                {item.type === 'imaging' && <ImageIcon className="w-4 h-4 text-blue-600" />}
                                {item.type === 'referral' && <Send className="w-4 h-4 text-orange-600" />}
                                {item.type === 'followup' && <Calendar className="w-4 h-4 text-teal-600" />}
                                <span className="text-sm">{item.description}</span>
                              </div>
                              <button
                                onClick={() => setForm({ ...form, planItems: form.planItems.filter(p => p.id !== item.id) })}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4 mb-4">No plan items added</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handlePrescribe}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <Pill className="w-4 h-4 text-green-600" />
                          Add Prescription
                        </button>
                        <button
                          onClick={handleOrderLab}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <TestTube className="w-4 h-4 text-purple-600" />
                          Order Lab
                        </button>
                        <button
                          onClick={handleOrderImaging}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          Order Imaging
                        </button>
                      </div>
                    </div>

                    {/* Follow-up */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Follow-up</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Follow-up Date</label>
                          <input
                            type="date"
                            value={form.followUpDate}
                            onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Notes</label>
                          <input
                            type="text"
                            value={form.followUpNotes}
                            onChange={(e) => setForm({ ...form, followUpNotes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Follow-up instructions..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Patient Education */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Patient Education</h4>
                      <textarea
                        rows={3}
                        value={form.patientEducation}
                        onChange={(e) => setForm({ ...form, patientEducation: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Patient education and instructions provided..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-center">
                <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Patient</h3>
                <p className="text-sm text-gray-500">Choose a patient from the queue to start documentation</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Quick Actions */}
        {selectedPatient && encounterId && showQuickActions && (
          <div className="w-56 bg-white rounded-xl border border-gray-200 p-3 space-y-2 h-fit">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900 text-sm">Quick Actions</h4>
              <button
                onClick={() => setShowQuickActions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleOrderLab}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-purple-50 rounded-lg border border-gray-200"
            >
              <TestTube className="w-4 h-4 text-purple-600" />
              Order Lab
            </button>
            <button
              onClick={handleOrderImaging}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 rounded-lg border border-gray-200"
            >
              <ImageIcon className="w-4 h-4 text-blue-600" />
              Order Imaging
            </button>
            <button
              onClick={handlePrescribe}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-green-50 rounded-lg border border-gray-200"
            >
              <Pill className="w-4 h-4 text-green-600" />
              Prescribe
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-orange-50 rounded-lg border border-gray-200">
              <Send className="w-4 h-4 text-orange-600" />
              Refer
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-teal-50 rounded-lg border border-gray-200">
              <Calendar className="w-4 h-4 text-teal-600" />
              Schedule Follow-up
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 rounded-lg border border-gray-200">
              <Plus className="w-4 h-4 text-red-600" />
              Add to Problem List
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-lg border border-gray-200">
              <FileCheck className="w-4 h-4 text-gray-600" />
              Generate Certificate
            </button>

            <hr className="my-2" />

            {/* Finalization */}
            <button
              onClick={handlePrint}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 rounded-lg border border-gray-200"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              Print Summary
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50 rounded-lg border border-gray-200">
              <Send className="w-4 h-4 text-indigo-600" />
              Send to Next Dept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
