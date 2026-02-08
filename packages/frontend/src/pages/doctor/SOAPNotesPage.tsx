import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search,
  UserCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  CheckCircle,
  Clock,
  Loader2,
  PenLine,
  Clipboard,
  Microscope,
  ListChecks,
  AlertTriangle,
  Printer,
  Download,
  History,
  Copy,
  FileCheck,
  FilePlus,
  Lock,
  Send,
  Mic,
  MicOff,
  Pill,
  Activity,
  Stethoscope,
  ClipboardList,
  BookOpen,
  Settings,
  X,
  ChevronRight,
  AlertCircle,
  Info,
  ExternalLink,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Eye,
  Ear,
  Brain,
  Bone,
  Zap,
  UserPlus,
  Calendar,
  Star,
  RefreshCw,
  Check,
  Shield,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { patientsService, type Patient as ApiPatient } from '../../services/patients';
import { encountersService, type Encounter } from '../../services/encounters';
import { vitalsService, type VitalRecord } from '../../services/vitals';
import { diagnosesService, type Diagnosis } from '../../services/diagnoses';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { printContent } from '../../lib/print';

// ============ INTERFACES ============

interface PatientWithEncounter {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  encounterId: string;
  encounterType: string;
  startTime: string;
  allergies?: Allergy[];
  medications?: Medication[];
}

interface Allergy {
  id: string;
  allergen: string;
  type: 'drug' | 'food' | 'environmental' | 'other';
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
}

interface DiagnosisEntry {
  id: string;
  code: string;
  name: string;
  type: 'primary' | 'secondary' | 'differential';
}

interface SOAPSubjective {
  chiefComplaint: string;
  hpiNarrative: string;
  rosGeneral: string;
  rosCardiovascular: string;
  rosRespiratory: string;
  rosGI: string;
  rosGU: string;
  rosMusculoskeletal: string;
  rosNeurological: string;
  rosPsych: string;
  rosSkin: string;
  rosENT: string;
  rosEyes: string;
  rosOther: string;
}

interface SOAPObjective {
  vitalsNotes: string;
  physicalExamGeneral: string;
  physicalExamHEENT: string;
  physicalExamCardio: string;
  physicalExamRespiratory: string;
  physicalExamAbdomen: string;
  physicalExamExtremities: string;
  physicalExamNeuro: string;
  physicalExamSkin: string;
  labResults: string;
  imagingResults: string;
}

interface SOAPAssessment {
  diagnoses: DiagnosisEntry[];
  differentialDiagnoses: string;
  clinicalImpression: string;
}

interface SOAPPlan {
  medications: string;
  orders: string;
  followUp: string;
  patientEducation: string;
  referrals: string;
}

interface SOAPNote {
  id: string;
  encounterId: string;
  patientId: string;
  subjective: SOAPSubjective;
  objective: SOAPObjective;
  assessment: SOAPAssessment;
  plan: SOAPPlan;
  status: 'draft' | 'signed' | 'addendum' | 'cosign_pending';
  signedBy?: string;
  signedAt?: string;
  coSignedBy?: string;
  coSignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface HistoricalSOAPNote {
  id: string;
  encounterId: string;
  encounterDate: string;
  chiefComplaint: string;
  status: 'draft' | 'signed' | 'addendum';
  signedBy?: string;
}

interface QuickPhrase {
  id: string;
  label: string;
  text: string;
  category: string;
}

interface SOAPTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  subjective: Partial<SOAPSubjective>;
  objective: Partial<SOAPObjective>;
  assessment: Partial<SOAPAssessment>;
  plan: Partial<SOAPPlan>;
  isPersonal: boolean;
}

interface ClinicalAlert {
  id: string;
  type: 'allergy' | 'interaction' | 'guideline' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  link?: string;
}

// ============ CONSTANTS ============

const STORAGE_KEYS = {
  QUICK_PHRASES: 'glide_soap_quick_phrases',
  PERSONAL_TEMPLATES: 'glide_soap_personal_templates',
  DRAFT_PREFIX: 'glide_soap_draft_',
};

const defaultQuickPhrases: QuickPhrase[] = [
  // Subjective
  { id: 's1', label: 'No complaints', text: 'Patient denies any current complaints.', category: 'subjective' },
  { id: 's2', label: 'Pain improved', text: 'Patient reports improvement in pain since last visit.', category: 'subjective' },
  { id: 's3', label: 'Medication effective', text: 'Patient states current medications are effective.', category: 'subjective' },
  { id: 's4', label: 'Fever onset', text: 'Patient reports fever onset approximately', category: 'subjective' },
  { id: 's5', label: 'Cough productive', text: 'Patient reports productive cough with yellow/green sputum.', category: 'subjective' },
  { id: 's6', label: 'SOB exertion', text: 'Patient reports shortness of breath on exertion.', category: 'subjective' },
  // Objective
  { id: 'o1', label: 'NAD', text: 'Patient appears in no acute distress.', category: 'objective' },
  { id: 'o2', label: 'A&O x3', text: 'Patient is alert and oriented to person, place, and time.', category: 'objective' },
  { id: 'o3', label: 'Lungs clear', text: 'Lungs are clear to auscultation bilaterally, no wheezes, rales, or rhonchi.', category: 'objective' },
  { id: 'o4', label: 'Heart RRR', text: 'Heart has regular rate and rhythm, no murmurs, gallops, or rubs.', category: 'objective' },
  { id: 'o5', label: 'Abdomen soft', text: 'Abdomen soft, non-tender, non-distended, positive bowel sounds.', category: 'objective' },
  { id: 'o6', label: 'HEENT normal', text: 'HEENT: Normocephalic, atraumatic. PERRL. TMs clear bilaterally. Oropharynx without erythema or exudate.', category: 'objective' },
  // Assessment
  { id: 'a1', label: 'Stable', text: 'Condition is stable, continue current management.', category: 'assessment' },
  { id: 'a2', label: 'Improving', text: 'Condition is improving on current treatment.', category: 'assessment' },
  { id: 'a3', label: 'Worsening', text: 'Condition has worsened, requires adjustment in treatment.', category: 'assessment' },
  { id: 'a4', label: 'Well controlled', text: 'Chronic condition is well controlled on current regimen.', category: 'assessment' },
  // Plan
  { id: 'p1', label: 'Continue meds', text: 'Continue current medications as prescribed.', category: 'plan' },
  { id: 'p2', label: 'Follow-up 2wks', text: 'Follow-up in 2 weeks for reassessment.', category: 'plan' },
  { id: 'p3', label: 'Follow-up 4wks', text: 'Follow-up in 4 weeks or sooner if symptoms worsen.', category: 'plan' },
  { id: 'p4', label: 'Lab work', text: 'Order laboratory investigations including CBC, CMP, and', category: 'plan' },
  { id: 'p5', label: 'Return precautions', text: 'Patient instructed to return if symptoms worsen, develop new symptoms, or have any concerns.', category: 'plan' },
  { id: 'p6', label: 'Diet counseling', text: 'Discussed importance of diet modification and exercise.', category: 'plan' },
];

const defaultTemplates: SOAPTemplate[] = [
  {
    id: 'tpl-general',
    name: 'General Visit',
    description: 'Standard template for general outpatient visits',
    category: 'General',
    subjective: { chiefComplaint: '', hpiNarrative: '' },
    objective: { physicalExamGeneral: 'Patient appears well-developed, well-nourished, in no acute distress.\nVital signs reviewed and documented.' },
    assessment: { clinicalImpression: '' },
    plan: { followUp: 'Return to clinic as needed or if symptoms worsen.' },
    isPersonal: false,
  },
  {
    id: 'tpl-followup',
    name: 'Follow-up Visit',
    description: 'For routine follow-up appointments',
    category: 'General',
    subjective: { chiefComplaint: 'Follow-up visit', hpiNarrative: 'Patient presents for scheduled follow-up. Reports compliance with treatment plan.' },
    objective: { physicalExamGeneral: 'Patient appears comfortable. No acute distress.' },
    assessment: { clinicalImpression: 'Chronic conditions stable on current management.' },
    plan: { medications: 'Continue current medications.', followUp: 'Return in 3 months for routine follow-up.' },
    isPersonal: false,
  },
  {
    id: 'tpl-acute',
    name: 'Acute Illness',
    description: 'For acute illness presentations',
    category: 'Acute',
    subjective: { rosGeneral: 'Positive for: fever, malaise, fatigue' },
    objective: { physicalExamGeneral: 'Patient appears ill but in no acute distress.' },
    assessment: {},
    plan: { patientEducation: 'Discussed expected course of illness, warning signs, and when to seek emergency care.', followUp: 'Return in 3-5 days if not improving, or sooner if worsening.' },
    isPersonal: false,
  },
  {
    id: 'tpl-chronic',
    name: 'Chronic Disease Review',
    description: 'For chronic disease management visits',
    category: 'Chronic',
    subjective: { chiefComplaint: 'Chronic disease management', hpiNarrative: 'Patient presents for routine chronic disease management. Medication compliance reviewed.' },
    objective: { labResults: 'Recent labs reviewed and discussed with patient.' },
    assessment: { clinicalImpression: 'Chronic condition(s) - current control status assessed.' },
    plan: { medications: 'Medications adjusted as documented.', patientEducation: 'Reviewed disease self-management, diet, exercise, and medication adherence.', followUp: 'Return in 3 months for chronic disease follow-up with repeat labs 2 weeks prior.' },
    isPersonal: false,
  },
  {
    id: 'tpl-prenatal',
    name: 'Prenatal Visit',
    description: 'For routine prenatal care visits',
    category: 'OB/GYN',
    subjective: { chiefComplaint: 'Routine prenatal visit', hpiNarrative: 'Patient presents for scheduled prenatal care. No vaginal bleeding, contractions, or decreased fetal movement. Fetal movement noted.' },
    objective: { physicalExamAbdomen: 'Fundal height appropriate for gestational age. Fetal heart tones documented.' },
    assessment: { clinicalImpression: 'Intrauterine pregnancy at ___ weeks gestation. Normal progress.' },
    plan: { patientEducation: 'Reviewed warning signs, when to call or go to L&D.', followUp: 'Return in 4 weeks (or 2 weeks if 28+ weeks, weekly if 36+ weeks).' },
    isPersonal: false,
  },
  {
    id: 'tpl-wellchild',
    name: 'Well-Child Visit',
    description: 'For pediatric wellness examinations',
    category: 'Pediatrics',
    subjective: { chiefComplaint: 'Well-child examination', hpiNarrative: 'Child presents for routine wellness examination and immunizations.\nDevelopmental milestones reviewed with parent/guardian.' },
    objective: { physicalExamGeneral: 'Child appears well-developed, well-nourished, active, and interactive.\nGrowth parameters plotted on age-appropriate growth chart.' },
    assessment: { clinicalImpression: 'Healthy child. Development appropriate for age.' },
    plan: { medications: 'Immunizations administered per schedule.', patientEducation: 'Anticipatory guidance provided for age-appropriate topics.', followUp: 'Return for next well-child visit per schedule.' },
    isPersonal: false,
  },
];

const rosSystemIcons: Record<string, any> = {
  rosGeneral: Activity,
  rosCardiovascular: Heart,
  rosRespiratory: Wind,
  rosGI: Droplets,
  rosGU: Droplets,
  rosMusculoskeletal: Bone,
  rosNeurological: Brain,
  rosPsych: Brain,
  rosSkin: Shield,
  rosENT: Ear,
  rosEyes: Eye,
  rosOther: ClipboardList,
};

const rosSystemLabels: Record<string, string> = {
  rosGeneral: 'General',
  rosCardiovascular: 'Cardiovascular',
  rosRespiratory: 'Respiratory',
  rosGI: 'Gastrointestinal',
  rosGU: 'Genitourinary',
  rosMusculoskeletal: 'Musculoskeletal',
  rosNeurological: 'Neurological',
  rosPsych: 'Psychiatric',
  rosSkin: 'Skin',
  rosENT: 'ENT',
  rosEyes: 'Eyes',
  rosOther: 'Other',
};

const physicalExamLabels: Record<string, string> = {
  physicalExamGeneral: 'General Appearance',
  physicalExamHEENT: 'HEENT',
  physicalExamCardio: 'Cardiovascular',
  physicalExamRespiratory: 'Respiratory',
  physicalExamAbdomen: 'Abdomen',
  physicalExamExtremities: 'Extremities',
  physicalExamNeuro: 'Neurological',
  physicalExamSkin: 'Skin',
};

// ============ HELPER FUNCTIONS ============

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

function transformEncounterToPatient(encounter: Encounter): PatientWithEncounter | null {
  if (!encounter.patient) return null;
  // Patient metadata might contain allergies/medications - cast to access it safely
  const patientWithMeta = encounter.patient as typeof encounter.patient & { metadata?: { allergies?: Allergy[]; medications?: Medication[] } };
  const metadata = patientWithMeta.metadata;
  return {
    id: encounter.patient.id,
    name: encounter.patient.fullName,
    mrn: encounter.patient.mrn,
    dateOfBirth: encounter.patient.dateOfBirth,
    age: calculateAge(encounter.patient.dateOfBirth),
    gender: encounter.patient.gender.charAt(0).toUpperCase() + encounter.patient.gender.slice(1),
    encounterId: encounter.visitNumber,
    encounterType: encounter.type.toUpperCase(),
    startTime: new Date(encounter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    allergies: metadata?.allergies || [],
    medications: metadata?.medications || [],
  };
}

function getEmptySubjective(): SOAPSubjective {
  return {
    chiefComplaint: '',
    hpiNarrative: '',
    rosGeneral: '',
    rosCardiovascular: '',
    rosRespiratory: '',
    rosGI: '',
    rosGU: '',
    rosMusculoskeletal: '',
    rosNeurological: '',
    rosPsych: '',
    rosSkin: '',
    rosENT: '',
    rosEyes: '',
    rosOther: '',
  };
}

function getEmptyObjective(): SOAPObjective {
  return {
    vitalsNotes: '',
    physicalExamGeneral: '',
    physicalExamHEENT: '',
    physicalExamCardio: '',
    physicalExamRespiratory: '',
    physicalExamAbdomen: '',
    physicalExamExtremities: '',
    physicalExamNeuro: '',
    physicalExamSkin: '',
    labResults: '',
    imagingResults: '',
  };
}

function getEmptyAssessment(): SOAPAssessment {
  return {
    diagnoses: [],
    differentialDiagnoses: '',
    clinicalImpression: '',
  };
}

function getEmptyPlan(): SOAPPlan {
  return {
    medications: '',
    orders: '',
    followUp: '',
    patientEducation: '',
    referrals: '',
  };
}

function formatVitals(vitals: VitalRecord): string {
  const parts: string[] = [];
  if (vitals.temperature) parts.push(`Temp: ${vitals.temperature}°C`);
  if (vitals.pulse) parts.push(`HR: ${vitals.pulse} bpm`);
  if (vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic) {
    parts.push(`BP: ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`);
  }
  if (vitals.respiratoryRate) parts.push(`RR: ${vitals.respiratoryRate}/min`);
  if (vitals.oxygenSaturation) parts.push(`SpO2: ${vitals.oxygenSaturation}%`);
  if (vitals.weight) parts.push(`Weight: ${vitals.weight} kg`);
  if (vitals.height) parts.push(`Height: ${vitals.height} cm`);
  if (vitals.bloodGlucose) parts.push(`Glucose: ${vitals.bloodGlucose} mg/dL`);
  if (vitals.painScale !== undefined && vitals.painScale !== null) parts.push(`Pain: ${vitals.painScale}/10`);
  return parts.join(' | ');
}

function checkVitalAbnormalities(vitals: VitalRecord): { field: string; value: number; severity: 'warning' | 'critical' }[] {
  const abnormalities: { field: string; value: number; severity: 'warning' | 'critical' }[] = [];
  
  if (vitals.temperature) {
    if (vitals.temperature >= 39 || vitals.temperature < 35) {
      abnormalities.push({ field: 'Temperature', value: vitals.temperature, severity: 'critical' });
    } else if (vitals.temperature >= 37.5 || vitals.temperature < 36) {
      abnormalities.push({ field: 'Temperature', value: vitals.temperature, severity: 'warning' });
    }
  }
  if (vitals.pulse) {
    if (vitals.pulse > 120 || vitals.pulse < 40) {
      abnormalities.push({ field: 'Heart Rate', value: vitals.pulse, severity: 'critical' });
    } else if (vitals.pulse > 100 || vitals.pulse < 60) {
      abnormalities.push({ field: 'Heart Rate', value: vitals.pulse, severity: 'warning' });
    }
  }
  if (vitals.bloodPressureSystolic) {
    if (vitals.bloodPressureSystolic >= 180 || vitals.bloodPressureSystolic < 90) {
      abnormalities.push({ field: 'Systolic BP', value: vitals.bloodPressureSystolic, severity: 'critical' });
    } else if (vitals.bloodPressureSystolic >= 140 || vitals.bloodPressureSystolic < 100) {
      abnormalities.push({ field: 'Systolic BP', value: vitals.bloodPressureSystolic, severity: 'warning' });
    }
  }
  if (vitals.oxygenSaturation) {
    if (vitals.oxygenSaturation < 90) {
      abnormalities.push({ field: 'SpO2', value: vitals.oxygenSaturation, severity: 'critical' });
    } else if (vitals.oxygenSaturation < 95) {
      abnormalities.push({ field: 'SpO2', value: vitals.oxygenSaturation, severity: 'warning' });
    }
  }
  return abnormalities;
}

function generateSOAPPrintContent(
  patient: PatientWithEncounter,
  subjective: SOAPSubjective,
  objective: SOAPObjective,
  assessment: SOAPAssessment,
  plan: SOAPPlan,
  vitals?: VitalRecord
): string {
  const formatDate = format(new Date(), 'MMMM dd, yyyy HH:mm');
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
        <h1 style="margin: 0; font-size: 24px;">SOAP Note</h1>
        <p style="margin: 5px 0; color: #666;">${formatDate}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; background: #f5f5f5; padding: 15px; border-radius: 8px;">
        <div>
          <p style="margin: 5px 0;"><strong>Patient:</strong> ${patient.name}</p>
          <p style="margin: 5px 0;"><strong>MRN:</strong> ${patient.mrn}</p>
          <p style="margin: 5px 0;"><strong>DOB:</strong> ${format(new Date(patient.dateOfBirth), 'MM/dd/yyyy')} (${patient.age}y)</p>
        </div>
        <div>
          <p style="margin: 5px 0;"><strong>Gender:</strong> ${patient.gender}</p>
          <p style="margin: 5px 0;"><strong>Encounter:</strong> ${patient.encounterId}</p>
          <p style="margin: 5px 0;"><strong>Type:</strong> ${patient.encounterType}</p>
        </div>
      </div>

      ${vitals ? `
      <div style="margin-bottom: 20px; padding: 10px; background: #e8f4e8; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #2d5a2d;">Vital Signs</h3>
        <p style="margin: 0;">${formatVitals(vitals)}</p>
      </div>
      ` : ''}

      <div style="margin-bottom: 20px;">
        <h2 style="background: #3b82f6; color: white; padding: 10px; margin: 0; border-radius: 8px 8px 0 0;">SUBJECTIVE</h2>
        <div style="border: 1px solid #3b82f6; border-top: none; padding: 15px; border-radius: 0 0 8px 8px;">
          ${subjective.chiefComplaint ? `<p><strong>Chief Complaint:</strong> ${subjective.chiefComplaint}</p>` : ''}
          ${subjective.hpiNarrative ? `<p><strong>HPI:</strong> ${subjective.hpiNarrative}</p>` : ''}
          ${Object.entries(subjective).filter(([k, v]) => k.startsWith('ros') && v).length > 0 ? `
            <p><strong>Review of Systems:</strong></p>
            <ul style="margin: 5px 0;">
              ${Object.entries(subjective).filter(([k, v]) => k.startsWith('ros') && v).map(([k, v]) => `<li><strong>${rosSystemLabels[k] || k}:</strong> ${v}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="background: #22c55e; color: white; padding: 10px; margin: 0; border-radius: 8px 8px 0 0;">OBJECTIVE</h2>
        <div style="border: 1px solid #22c55e; border-top: none; padding: 15px; border-radius: 0 0 8px 8px;">
          ${Object.entries(objective).filter(([k, v]) => k.startsWith('physicalExam') && v).map(([k, v]) => `<p><strong>${physicalExamLabels[k] || k}:</strong> ${v}</p>`).join('')}
          ${objective.labResults ? `<p><strong>Lab Results:</strong> ${objective.labResults}</p>` : ''}
          ${objective.imagingResults ? `<p><strong>Imaging Results:</strong> ${objective.imagingResults}</p>` : ''}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="background: #a855f7; color: white; padding: 10px; margin: 0; border-radius: 8px 8px 0 0;">ASSESSMENT</h2>
        <div style="border: 1px solid #a855f7; border-top: none; padding: 15px; border-radius: 0 0 8px 8px;">
          ${assessment.diagnoses.length > 0 ? `
            <p><strong>Diagnoses:</strong></p>
            <ol style="margin: 5px 0;">
              ${assessment.diagnoses.map(d => `<li>${d.code} - ${d.name} (${d.type})</li>`).join('')}
            </ol>
          ` : ''}
          ${assessment.differentialDiagnoses ? `<p><strong>Differential Diagnoses:</strong> ${assessment.differentialDiagnoses}</p>` : ''}
          ${assessment.clinicalImpression ? `<p><strong>Clinical Impression:</strong> ${assessment.clinicalImpression}</p>` : ''}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h2 style="background: #f97316; color: white; padding: 10px; margin: 0; border-radius: 8px 8px 0 0;">PLAN</h2>
        <div style="border: 1px solid #f97316; border-top: none; padding: 15px; border-radius: 0 0 8px 8px;">
          ${plan.medications ? `<p><strong>Medications:</strong> ${plan.medications}</p>` : ''}
          ${plan.orders ? `<p><strong>Orders:</strong> ${plan.orders}</p>` : ''}
          ${plan.followUp ? `<p><strong>Follow-up:</strong> ${plan.followUp}</p>` : ''}
          ${plan.patientEducation ? `<p><strong>Patient Education:</strong> ${plan.patientEducation}</p>` : ''}
          ${plan.referrals ? `<p><strong>Referrals:</strong> ${plan.referrals}</p>` : ''}
        </div>
      </div>

      <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 5px 0;"><strong>Provider Signature:</strong> _______________________</p>
            <p style="margin: 5px 0;"><strong>Date/Time:</strong> ${formatDate}</p>
          </div>
          <div>
            <p style="margin: 5px 0;"><strong>Co-Signature (if applicable):</strong> _______________________</p>
            <p style="margin: 5px 0;"><strong>Date/Time:</strong> _______________________</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============ MAIN COMPONENT ============

export default function SOAPNotesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  // Permission checks
  const canCreate = hasPermission('clinical-notes.create');
  const canUpdate = hasPermission('clinical-notes.update');
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithEncounter | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  
  // SOAP Data State
  const [subjective, setSubjective] = useState<SOAPSubjective>(getEmptySubjective());
  const [objective, setObjective] = useState<SOAPObjective>(getEmptyObjective());
  const [assessment, setAssessment] = useState<SOAPAssessment>(getEmptyAssessment());
  const [plan, setPlan] = useState<SOAPPlan>(getEmptyPlan());
  const [noteStatus, setNoteStatus] = useState<'draft' | 'signed' | 'addendum' | 'cosign_pending'>('draft');
  
  // UI State
  const [expandedSections, setExpandedSections] = useState({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
  });
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({
    chiefComplaint: true,
    hpi: true,
    ros: false,
    vitals: true,
    physicalExam: true,
    results: false,
    diagnoses: true,
    planSections: true,
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecordingField, setActiveRecordingField] = useState<string | null>(null);
  
  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuickPhraseModal, setShowQuickPhraseModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showDiagnosisSearch, setShowDiagnosisSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Quick Phrases & Templates
  const [quickPhrases, setQuickPhrases] = useState<QuickPhrase[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUICK_PHRASES);
    return saved ? JSON.parse(saved) : defaultQuickPhrases;
  });
  const [personalTemplates, setPersonalTemplates] = useState<SOAPTemplate[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PERSONAL_TEMPLATES);
    return saved ? JSON.parse(saved) : [];
  });
  
  // Clinical Alerts
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);
  const [diagnosisSearchQuery, setDiagnosisSearchQuery] = useState('');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch active encounters
  const { data: encountersData, isLoading: encountersLoading } = useQuery({
    queryKey: ['encounters', 'active'],
    queryFn: () => encountersService.list({ status: 'in_consultation', limit: 50 }),
  });

  // Fetch vitals for selected encounter
  const { data: encounterVitals } = useQuery({
    queryKey: ['vitals', 'encounter', selectedEncounterId],
    queryFn: async () => {
      if (!selectedEncounterId || !encountersData?.data) return null;
      const encounter = encountersData.data.find(e => e.visitNumber === selectedEncounterId);
      if (!encounter) return null;
      return vitalsService.getLatestByEncounter(encounter.id);
    },
    enabled: !!selectedEncounterId && !!encountersData?.data,
  });

  // Fetch patient history
  const { data: patientHistory } = useQuery({
    queryKey: ['encounters', 'history', selectedPatient?.id],
    queryFn: () => encountersService.list({ patientId: selectedPatient!.id, limit: 10 }),
    enabled: !!selectedPatient?.id,
  });

  // Diagnosis search
  const { data: diagnosisResults, isLoading: diagnosisLoading } = useQuery({
    queryKey: ['diagnoses', 'search', diagnosisSearchQuery],
    queryFn: () => diagnosesService.search({ search: diagnosisSearchQuery, limit: 20 }),
    enabled: diagnosisSearchQuery.length >= 2,
  });

  // Save mutation
  const saveSoapMutation = useMutation({
    mutationFn: async ({ encounterId, notes, status }: { encounterId: string; notes: string; status: string }) => {
      const encounter = encountersData?.data.find(e => e.visitNumber === encounterId);
      if (!encounter) throw new Error('Encounter not found');
      // Update notes first
      await encountersService.update(encounter.id, { notes });
      // Then update status if needed
      if (status === 'signed') {
        return encountersService.updateStatus(encounter.id, 'completed');
      }
      return encountersService.getById(encounter.id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
      setAutoSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());
      if (variables.status === 'signed') {
        setNoteStatus('signed');
        toast.success('SOAP note signed and locked!');
      }
    },
    onError: () => setAutoSaveStatus('pending'),
  });

  // Transform encounters to patient list
  const activePatients: PatientWithEncounter[] = useMemo(() => {
    return encountersData?.data
      .map(transformEncounterToPatient)
      .filter((p): p is PatientWithEncounter => p !== null)
      .filter((p) => {
        if (!debouncedSearch) return true;
        const query = debouncedSearch.toLowerCase();
        return p.name.toLowerCase().includes(query) || p.mrn.toLowerCase().includes(query);
      }) || [];
  }, [encountersData, debouncedSearch]);

  // Generate clinical alerts based on patient data
  useEffect(() => {
    if (!selectedPatient) {
      setClinicalAlerts([]);
      return;
    }
    
    const alerts: ClinicalAlert[] = [];
    
    // Allergy alerts
    if (selectedPatient.allergies && selectedPatient.allergies.length > 0) {
      selectedPatient.allergies.forEach(allergy => {
        if (allergy.severity === 'severe' || allergy.severity === 'life-threatening') {
          alerts.push({
            id: `allergy-${allergy.id}`,
            type: 'allergy',
            severity: 'critical',
            title: `Drug Allergy: ${allergy.allergen}`,
            message: `Reaction: ${allergy.reaction}. Severity: ${allergy.severity}`,
          });
        }
      });
    }
    
    // Vital abnormalities
    if (encounterVitals) {
      const abnormalities = checkVitalAbnormalities(encounterVitals);
      abnormalities.forEach(abn => {
        alerts.push({
          id: `vital-${abn.field}`,
          type: 'recommendation',
          severity: abn.severity,
          title: `Abnormal ${abn.field}`,
          message: `Current value: ${abn.value}. Consider clinical evaluation.`,
        });
      });
    }
    
    // Drug interaction check (mock - would integrate with real service)
    if (plan.medications && selectedPatient.medications && selectedPatient.medications.length > 0) {
      const newMeds = plan.medications.toLowerCase();
      if (newMeds.includes('warfarin') && selectedPatient.medications.some(m => m.name.toLowerCase().includes('aspirin'))) {
        alerts.push({
          id: 'interaction-warfarin-aspirin',
          type: 'interaction',
          severity: 'warning',
          title: 'Potential Drug Interaction',
          message: 'Warfarin + Aspirin may increase bleeding risk. Monitor INR closely.',
          link: 'https://www.drugs.com/interactions',
        });
      }
    }
    
    setClinicalAlerts(alerts);
  }, [selectedPatient, encounterVitals, plan.medications]);

  // Auto-expand abnormal sections
  useEffect(() => {
    if (encounterVitals) {
      const abnormalities = checkVitalAbnormalities(encounterVitals);
      if (abnormalities.length > 0) {
        setExpandedSections(prev => ({ ...prev, objective: true }));
        setExpandedSubsections(prev => ({ ...prev, vitals: true }));
      }
    }
  }, [encounterVitals]);

  // Auto-save effect
  useEffect(() => {
    if (!selectedPatient || !selectedEncounterId || noteStatus === 'signed') return;
    
    const hasContent = subjective.chiefComplaint || subjective.hpiNarrative || 
      Object.values(objective).some(v => v) || 
      assessment.diagnoses.length > 0 || assessment.clinicalImpression ||
      Object.values(plan).some(v => v);
    
    if (!hasContent) return;

    setAutoSaveStatus('pending');
    const timer = setTimeout(() => {
      setAutoSaveStatus('saving');
      const notes = serializeSOAPNote();
      saveSoapMutation.mutate({ encounterId: selectedEncounterId, notes, status: 'draft' });
      
      // Save to local storage as backup
      localStorage.setItem(
        `${STORAGE_KEYS.DRAFT_PREFIX}${selectedEncounterId}`,
        JSON.stringify({ subjective, objective, assessment, plan, timestamp: Date.now() })
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [subjective, objective, assessment, plan, selectedPatient, selectedEncounterId, noteStatus]);

  const serializeSOAPNote = useCallback(() => {
    const formatSection = (title: string, content: Record<string, any>) => {
      const lines: string[] = [`=== ${title.toUpperCase()} ===`];
      Object.entries(content).forEach(([key, value]) => {
        if (value && (typeof value === 'string' ? value.trim() : true)) {
          if (Array.isArray(value)) {
            lines.push(`${key}: ${value.map((v: any) => `${v.code} - ${v.name}`).join('; ')}`);
          } else {
            lines.push(`${key}: ${value}`);
          }
        }
      });
      return lines.join('\n');
    };

    return [
      formatSection('SUBJECTIVE', subjective),
      formatSection('OBJECTIVE', objective),
      formatSection('ASSESSMENT', assessment),
      formatSection('PLAN', plan),
    ].join('\n\n');
  }, [subjective, objective, assessment, plan]);

  const handleSelectPatient = (patient: PatientWithEncounter) => {
    // Check for unsaved changes
    if (selectedPatient && autoSaveStatus === 'pending') {
      const notes = serializeSOAPNote();
      saveSoapMutation.mutate({ encounterId: selectedEncounterId!, notes, status: 'draft' });
    }
    
    setSelectedPatient(patient);
    setSelectedEncounterId(patient.encounterId);
    setNoteStatus('draft');
    
    // Try to load draft from local storage
    const savedDraft = localStorage.getItem(`${STORAGE_KEYS.DRAFT_PREFIX}${patient.encounterId}`);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
          setSubjective(parsed.subjective || getEmptySubjective());
          setObjective(parsed.objective || getEmptyObjective());
          setAssessment(parsed.assessment || getEmptyAssessment());
          setPlan(parsed.plan || getEmptyPlan());
          toast.info('Draft restored from local storage');
          return;
        }
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    }
    
    // Reset to empty
    setSubjective(getEmptySubjective());
    setObjective(getEmptyObjective());
    setAssessment(getEmptyAssessment());
    setPlan(getEmptyPlan());
    setLastSaved(null);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSubsection = (subsection: string) => {
    setExpandedSubsections(prev => ({ ...prev, [subsection]: !prev[subsection] }));
  };

  const insertQuickPhrase = (field: string, text: string) => {
    const [section, subfield] = field.split('.');
    
    if (section === 'subjective') {
      setSubjective(prev => ({
        ...prev,
        [subfield]: prev[subfield as keyof SOAPSubjective] 
          ? `${prev[subfield as keyof SOAPSubjective]}\n${text}` 
          : text,
      }));
    } else if (section === 'objective') {
      setObjective(prev => ({
        ...prev,
        [subfield]: prev[subfield as keyof SOAPObjective]
          ? `${prev[subfield as keyof SOAPObjective]}\n${text}`
          : text,
      }));
    } else if (section === 'assessment') {
      setAssessment(prev => ({
        ...prev,
        [subfield]: prev[subfield as keyof SOAPAssessment]
          ? `${prev[subfield as keyof SOAPAssessment]}\n${text}`
          : text,
      }));
    } else if (section === 'plan') {
      setPlan(prev => ({
        ...prev,
        [subfield]: prev[subfield as keyof SOAPPlan]
          ? `${prev[subfield as keyof SOAPPlan]}\n${text}`
          : text,
      }));
    }
  };

  const applyTemplate = (template: SOAPTemplate) => {
    if (template.subjective) {
      setSubjective(prev => ({ ...prev, ...template.subjective }));
    }
    if (template.objective) {
      setObjective(prev => ({ ...prev, ...template.objective }));
    }
    if (template.assessment) {
      setAssessment(prev => ({ ...prev, ...template.assessment }));
    }
    if (template.plan) {
      setPlan(prev => ({ ...prev, ...template.plan }));
    }
    setShowTemplateModal(false);
    toast.success(`Template "${template.name}" applied`);
  };

  const saveAsPersonalTemplate = () => {
    const name = prompt('Enter template name:');
    if (!name) return;
    
    const newTemplate: SOAPTemplate = {
      id: `personal-${Date.now()}`,
      name,
      description: 'Personal template',
      category: 'Personal',
      subjective,
      objective,
      assessment,
      plan,
      isPersonal: true,
    };
    
    const updated = [...personalTemplates, newTemplate];
    setPersonalTemplates(updated);
    localStorage.setItem(STORAGE_KEYS.PERSONAL_TEMPLATES, JSON.stringify(updated));
    toast.success('Template saved!');
  };

  const addDiagnosis = (diagnosis: Diagnosis) => {
    const entry: DiagnosisEntry = {
      id: diagnosis.id,
      code: diagnosis.icd10Code,
      name: diagnosis.name,
      type: assessment.diagnoses.length === 0 ? 'primary' : 'secondary',
    };
    setAssessment(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, entry],
    }));
    setShowDiagnosisSearch(false);
    setDiagnosisSearchQuery('');
  };

  const removeDiagnosis = (id: string) => {
    setAssessment(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.filter(d => d.id !== id),
    }));
  };

  const copyFromPrevious = (field: string) => {
    // This would copy from previous visit - mock implementation
    toast.info('Copy from previous visit - feature coming soon');
  };

  const handleSign = (action: 'sign' | 'draft' | 'cosign' | 'addendum') => {
    if (!selectedEncounterId) return;
    
    const notes = serializeSOAPNote();
    
    switch (action) {
      case 'sign':
        saveSoapMutation.mutate(
          { encounterId: selectedEncounterId, notes, status: 'signed' },
          { onSuccess: () => setShowSignModal(false) }
        );
        break;
      case 'draft':
        saveSoapMutation.mutate({ encounterId: selectedEncounterId, notes, status: 'draft' });
        toast.success('Saved as draft');
        setShowSignModal(false);
        break;
      case 'cosign':
        setNoteStatus('cosign_pending');
        saveSoapMutation.mutate({ encounterId: selectedEncounterId, notes, status: 'cosign_pending' });
        toast.success('Co-sign request submitted');
        setShowSignModal(false);
        break;
      case 'addendum':
        setNoteStatus('addendum');
        toast.info('You can now add an addendum to the signed note');
        setShowSignModal(false);
        break;
    }
  };

  const handlePrint = () => {
    if (!selectedPatient) return;
    const content = generateSOAPPrintContent(selectedPatient, subjective, objective, assessment, plan, encounterVitals || undefined);
    printContent(content, `SOAP Note - ${selectedPatient.name}`);
  };

  const handleExportPDF = () => {
    // In a real implementation, this would generate a PDF
    toast.info('PDF export - would generate PDF file');
    setShowExportMenu(false);
  };

  const handleSendToPortal = () => {
    // In a real implementation, this would send to patient portal
    toast.info('Sent to patient portal');
    setShowExportMenu(false);
  };

  const toggleVoiceRecording = (field: string) => {
    if (isRecording && activeRecordingField === field) {
      setIsRecording(false);
      setActiveRecordingField(null);
      toast.info('Voice recording stopped');
    } else {
      setIsRecording(true);
      setActiveRecordingField(field);
      toast.info('Voice recording started (simulated)');
    }
  };

  // Permission check
  if (!canCreate && !canUpdate) {
    return <AccessDenied />;
  }

  // ============ RENDER ============

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">SOAP Notes</h1>
            <p className="text-sm text-gray-500">Document clinical encounters in SOAP format</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save indicator */}
          {selectedPatient && (
            <div className="flex items-center gap-2 text-sm">
              {autoSaveStatus === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-blue-600">Saving...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && lastSaved && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-500">Saved at {lastSaved}</span>
                </>
              )}
              {autoSaveStatus === 'pending' && (
                <>
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Pending...</span>
                </>
              )}
              {noteStatus === 'signed' && (
                <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded">
                  <Lock className="w-3 h-3" /> Signed
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {selectedPatient && (
            <>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                <FileText className="w-4 h-4" />
                Templates
              </button>
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                <History className="w-4 h-4" />
                History
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                    <button
                      onClick={handlePrint}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" /> Export PDF
                    </button>
                    <button
                      onClick={handleSendToPortal}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Send className="w-4 h-4" /> Send to Portal
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowSignModal(true)}
                disabled={noteStatus === 'signed' || !canUpdate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                Sign & Lock
              </button>
            </>
          )}
        </div>
      </div>

      {/* Clinical Alerts Banner */}
      {clinicalAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {clinicalAlerts.filter(a => a.severity === 'critical').map(alert => (
            <div key={alert.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-800">{alert.title}</p>
                <p className="text-sm text-red-600">{alert.message}</p>
              </div>
              {alert.link && (
                <a href={alert.link} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-800">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
          {clinicalAlerts.filter(a => a.severity === 'warning').map(alert => (
            <div key={alert.id} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">{alert.title}</p>
                <p className="text-sm text-amber-600">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Patient Sidebar */}
        <div className="w-72 bg-white rounded-xl border border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Active Encounters</h3>
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
            {encountersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : activePatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No active encounters found
              </div>
            ) : (
              activePatients.map((patient) => (
                <button
                  key={`${patient.id}-${patient.encounterId}`}
                  onClick={() => handleSelectPatient(patient)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    selectedPatient?.encounterId === patient.encounterId
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <UserCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                          {patient.encounterType}
                        </span>
                      </div>
                      {patient.allergies && patient.allergies.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-500">{patient.allergies.length} allergy</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* SOAP Form */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedPatient ? (
            <>
              {/* Patient Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 text-lg">{selectedPatient.name}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedPatient.age}y {selectedPatient.gender} • MRN: {selectedPatient.mrn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-indigo-700">{selectedPatient.encounterType}</p>
                    <p className="text-xs text-gray-500">Encounter: {selectedPatient.encounterId}</p>
                    <p className="text-xs text-gray-400">Started: {selectedPatient.startTime}</p>
                  </div>
                </div>

                {/* Vitals Summary */}
                {encounterVitals && (
                  <div className="mt-3 pt-3 border-t border-indigo-200">
                    <div className="flex items-center gap-2 text-sm">
                      <Thermometer className="w-4 h-4 text-indigo-500" />
                      <span className="text-gray-600">{formatVitals(encounterVitals)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SOAP Sections - Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* SUBJECTIVE Section */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('subjective')}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <PenLine className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">Subjective</h3>
                      {(subjective.chiefComplaint || subjective.hpiNarrative) && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {expandedSections.subjective ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedSections.subjective && (
                    <div className="p-4 space-y-4">
                      {/* Chief Complaint */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={subjective.chiefComplaint}
                            onChange={(e) => setSubjective(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Patient's primary reason for visit..."
                            disabled={noteStatus === 'signed'}
                          />
                          <button
                            onClick={() => toggleVoiceRecording('subjective.chiefComplaint')}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
                              isRecording && activeRecordingField === 'subjective.chiefComplaint'
                                ? 'text-red-500 bg-red-50'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            {isRecording && activeRecordingField === 'subjective.chiefComplaint' ? (
                              <MicOff className="w-4 h-4" />
                            ) : (
                              <Mic className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* HPI */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-gray-700">History of Present Illness</label>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyFromPrevious('hpi')}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" /> Copy from previous
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={4}
                          value={subjective.hpiNarrative}
                          onChange={(e) => setSubjective(prev => ({ ...prev, hpiNarrative: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Detailed narrative of the present illness..."
                          disabled={noteStatus === 'signed'}
                          spellCheck
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {quickPhrases.filter(p => p.category === 'subjective').slice(0, 5).map(phrase => (
                            <button
                              key={phrase.id}
                              onClick={() => insertQuickPhrase('subjective.hpiNarrative', phrase.text)}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                              disabled={noteStatus === 'signed'}
                            >
                              + {phrase.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Review of Systems */}
                      <div>
                        <button
                          onClick={() => toggleSubsection('ros')}
                          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
                        >
                          {expandedSubsections.ros ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Review of Systems
                        </button>
                        {expandedSubsections.ros && (
                          <div className="grid grid-cols-2 gap-3 pl-4">
                            {Object.entries(rosSystemLabels).map(([key, label]) => {
                              const Icon = rosSystemIcons[key] || ClipboardList;
                              return (
                                <div key={key} className="flex items-start gap-2">
                                  <Icon className="w-4 h-4 text-gray-400 mt-2" />
                                  <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-600">{label}</label>
                                    <input
                                      type="text"
                                      value={subjective[key as keyof SOAPSubjective] || ''}
                                      onChange={(e) => setSubjective(prev => ({ ...prev, [key]: e.target.value }))}
                                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                      placeholder={`${label} findings...`}
                                      disabled={noteStatus === 'signed'}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* OBJECTIVE Section */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('objective')}
                    className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Microscope className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900">Objective</h3>
                      {Object.values(objective).some(v => v) && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {expandedSections.objective ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedSections.objective && (
                    <div className="p-4 space-y-4">
                      {/* Vitals Display */}
                      {encounterVitals && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-600" />
                            Vital Signs
                            {checkVitalAbnormalities(encounterVitals).length > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                {checkVitalAbnormalities(encounterVitals).length} abnormal
                              </span>
                            )}
                          </h4>
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            {encounterVitals.temperature && (
                              <div className={`p-2 rounded ${encounterVitals.temperature >= 37.5 ? 'bg-amber-50 border border-amber-200' : 'bg-white border'}`}>
                                <p className="text-xs text-gray-500">Temp</p>
                                <p className="font-medium">{encounterVitals.temperature}°C</p>
                              </div>
                            )}
                            {encounterVitals.pulse && (
                              <div className={`p-2 rounded ${encounterVitals.pulse > 100 || encounterVitals.pulse < 60 ? 'bg-amber-50 border border-amber-200' : 'bg-white border'}`}>
                                <p className="text-xs text-gray-500">HR</p>
                                <p className="font-medium">{encounterVitals.pulse} bpm</p>
                              </div>
                            )}
                            {encounterVitals.bloodPressureSystolic && (
                              <div className={`p-2 rounded ${encounterVitals.bloodPressureSystolic >= 140 ? 'bg-amber-50 border border-amber-200' : 'bg-white border'}`}>
                                <p className="text-xs text-gray-500">BP</p>
                                <p className="font-medium">{encounterVitals.bloodPressureSystolic}/{encounterVitals.bloodPressureDiastolic}</p>
                              </div>
                            )}
                            {encounterVitals.oxygenSaturation && (
                              <div className={`p-2 rounded ${encounterVitals.oxygenSaturation < 95 ? 'bg-red-50 border border-red-200' : 'bg-white border'}`}>
                                <p className="text-xs text-gray-500">SpO2</p>
                                <p className="font-medium">{encounterVitals.oxygenSaturation}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Physical Exam */}
                      <div>
                        <button
                          onClick={() => toggleSubsection('physicalExam')}
                          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
                        >
                          {expandedSubsections.physicalExam ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Physical Examination
                        </button>
                        {expandedSubsections.physicalExam && (
                          <div className="space-y-3 pl-4">
                            {Object.entries(physicalExamLabels).map(([key, label]) => (
                              <div key={key}>
                                <label className="text-xs font-medium text-gray-600">{label}</label>
                                <textarea
                                  rows={2}
                                  value={objective[key as keyof SOAPObjective] || ''}
                                  onChange={(e) => setObjective(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full px-2 py-1 border border-gray-200 rounded text-sm resize-none"
                                  placeholder={`${label} findings...`}
                                  disabled={noteStatus === 'signed'}
                                  spellCheck
                                />
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {quickPhrases.filter(p => p.category === 'objective').slice(0, 3).map(phrase => (
                                    <button
                                      key={phrase.id}
                                      onClick={() => insertQuickPhrase(`objective.${key}`, phrase.text)}
                                      className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                                      disabled={noteStatus === 'signed'}
                                    >
                                      + {phrase.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lab/Imaging Results */}
                      <div>
                        <button
                          onClick={() => toggleSubsection('results')}
                          className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2"
                        >
                          {expandedSubsections.results ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Lab & Imaging Results
                        </button>
                        {expandedSubsections.results && (
                          <div className="space-y-3 pl-4">
                            <div>
                              <label className="text-xs font-medium text-gray-600">Lab Results</label>
                              <textarea
                                rows={2}
                                value={objective.labResults}
                                onChange={(e) => setObjective(prev => ({ ...prev, labResults: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm resize-none"
                                placeholder="Recent lab findings..."
                                disabled={noteStatus === 'signed'}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600">Imaging Results</label>
                              <textarea
                                rows={2}
                                value={objective.imagingResults}
                                onChange={(e) => setObjective(prev => ({ ...prev, imagingResults: e.target.value }))}
                                className="w-full px-2 py-1 border border-gray-200 rounded text-sm resize-none"
                                placeholder="X-ray, CT, MRI findings..."
                                disabled={noteStatus === 'signed'}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ASSESSMENT Section */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('assessment')}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clipboard className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">Assessment</h3>
                      {(assessment.diagnoses.length > 0 || assessment.clinicalImpression) && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {expandedSections.assessment ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedSections.assessment && (
                    <div className="p-4 space-y-4">
                      {/* Diagnoses with ICD-10 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">Diagnoses (ICD-10)</label>
                          <button
                            onClick={() => setShowDiagnosisSearch(true)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            disabled={noteStatus === 'signed'}
                          >
                            <Plus className="w-4 h-4" /> Add Diagnosis
                          </button>
                        </div>
                        
                        {assessment.diagnoses.length === 0 ? (
                          <div className="text-center py-4 text-gray-400 text-sm border border-dashed rounded-lg">
                            No diagnoses added. Click "Add Diagnosis" to search ICD-10 codes.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {assessment.diagnoses.map((dx, index) => (
                              <div
                                key={dx.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  dx.type === 'primary' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                                    dx.type === 'primary' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-900">{dx.name}</p>
                                    <p className="text-sm text-gray-500">{dx.code}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={dx.type}
                                    onChange={(e) => {
                                      const newDiagnoses = [...assessment.diagnoses];
                                      newDiagnoses[index].type = e.target.value as 'primary' | 'secondary' | 'differential';
                                      setAssessment(prev => ({ ...prev, diagnoses: newDiagnoses }));
                                    }}
                                    className="text-xs border rounded px-2 py-1"
                                    disabled={noteStatus === 'signed'}
                                  >
                                    <option value="primary">Primary</option>
                                    <option value="secondary">Secondary</option>
                                    <option value="differential">Differential</option>
                                  </select>
                                  <button
                                    onClick={() => removeDiagnosis(dx.id)}
                                    className="text-gray-400 hover:text-red-500"
                                    disabled={noteStatus === 'signed'}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Differential Diagnoses */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Differential Diagnoses</label>
                        <textarea
                          rows={2}
                          value={assessment.differentialDiagnoses}
                          onChange={(e) => setAssessment(prev => ({ ...prev, differentialDiagnoses: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Other diagnoses being considered..."
                          disabled={noteStatus === 'signed'}
                          spellCheck
                        />
                      </div>

                      {/* Clinical Impression */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Clinical Impression</label>
                        <textarea
                          rows={3}
                          value={assessment.clinicalImpression}
                          onChange={(e) => setAssessment(prev => ({ ...prev, clinicalImpression: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Overall clinical assessment and reasoning..."
                          disabled={noteStatus === 'signed'}
                          spellCheck
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {quickPhrases.filter(p => p.category === 'assessment').map(phrase => (
                            <button
                              key={phrase.id}
                              onClick={() => insertQuickPhrase('assessment.clinicalImpression', phrase.text)}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                              disabled={noteStatus === 'signed'}
                            >
                              + {phrase.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Clinical Guidelines Link */}
                      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-700">View clinical guidelines:</span>
                        <a href="https://www.uptodate.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          UpToDate <ExternalLink className="w-3 h-3" />
                        </a>
                        <a href="https://www.dynamed.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          DynaMed <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* PLAN Section */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleSection('plan')}
                    className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">Plan</h3>
                      {Object.values(plan).some(v => v) && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {expandedSections.plan ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                  
                  {expandedSections.plan && (
                    <div className="p-4 space-y-4">
                      {/* Medications */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <Pill className="w-4 h-4 text-orange-500" />
                          Medications
                        </label>
                        <textarea
                          rows={3}
                          value={plan.medications}
                          onChange={(e) => setPlan(prev => ({ ...prev, medications: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="New prescriptions, medication changes, or continue current meds..."
                          disabled={noteStatus === 'signed'}
                          spellCheck
                        />
                      </div>

                      {/* Orders */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-orange-500" />
                          Orders (Labs, Imaging, Procedures)
                        </label>
                        <textarea
                          rows={2}
                          value={plan.orders}
                          onChange={(e) => setPlan(prev => ({ ...prev, orders: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Lab orders, imaging orders, procedure requests..."
                          disabled={noteStatus === 'signed'}
                        />
                      </div>

                      {/* Follow-up */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-orange-500" />
                          Follow-up
                        </label>
                        <textarea
                          rows={2}
                          value={plan.followUp}
                          onChange={(e) => setPlan(prev => ({ ...prev, followUp: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Follow-up timeline and instructions..."
                          disabled={noteStatus === 'signed'}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {quickPhrases.filter(p => p.category === 'plan').slice(0, 4).map(phrase => (
                            <button
                              key={phrase.id}
                              onClick={() => insertQuickPhrase('plan.followUp', phrase.text)}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                              disabled={noteStatus === 'signed'}
                            >
                              + {phrase.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Patient Education */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-orange-500" />
                          Patient Education
                        </label>
                        <textarea
                          rows={2}
                          value={plan.patientEducation}
                          onChange={(e) => setPlan(prev => ({ ...prev, patientEducation: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Education provided, lifestyle modifications, warning signs..."
                          disabled={noteStatus === 'signed'}
                        />
                      </div>

                      {/* Referrals */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-orange-500" />
                          Referrals
                        </label>
                        <textarea
                          rows={2}
                          value={plan.referrals}
                          onChange={(e) => setPlan(prev => ({ ...prev, referrals: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                          placeholder="Specialist referrals, consultations..."
                          disabled={noteStatus === 'signed'}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select an Encounter</h3>
                <p className="text-sm text-gray-500">Choose a patient with an active encounter to document SOAP notes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">SOAP Templates</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {/* Default Templates */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">System Templates</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {defaultTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className="text-left p-3 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500">{template.description}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block">
                          {template.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal Templates */}
                {personalTemplates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Personal Templates</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {personalTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="text-left p-3 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900">{template.name}</p>
                            <Star className="w-4 h-4 text-yellow-500" />
                          </div>
                          <p className="text-xs text-gray-500">{template.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save as Template */}
                <button
                  onClick={saveAsPersonalTemplate}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center gap-2"
                >
                  <FilePlus className="w-5 h-5" />
                  Save Current Note as Personal Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Previous SOAP Notes</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {patientHistory?.data && patientHistory.data.length > 0 ? (
                <div className="space-y-3">
                  {patientHistory.data.slice(0, 10).map((enc) => (
                    <div key={enc.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{format(new Date(enc.createdAt), 'MMM dd, yyyy')}</p>
                          <p className="text-sm text-gray-500">{enc.type} - {enc.visitNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              toast.info('Compare feature - would show side-by-side comparison');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Compare
                          </button>
                          <button
                            onClick={() => {
                              toast.info('Copy from previous - would copy sections');
                            }}
                            className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                      </div>
                      {enc.notes && (
                        <p className="text-sm text-gray-600 line-clamp-2">{enc.notes.substring(0, 200)}...</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No previous encounters found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sign & Lock Modal */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Sign-off Options</h2>
              <button onClick={() => setShowSignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleSign('sign')}
                disabled={saveSoapMutation.isPending}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Lock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Sign & Lock Note</p>
                  <p className="text-sm text-gray-500">Finalize and lock the note from further edits</p>
                </div>
              </button>

              <button
                onClick={() => handleSign('draft')}
                disabled={saveSoapMutation.isPending}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Save as Draft</p>
                  <p className="text-sm text-gray-500">Save progress and continue editing later</p>
                </div>
              </button>

              <button
                onClick={() => handleSign('cosign')}
                disabled={saveSoapMutation.isPending}
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Request Co-signature</p>
                  <p className="text-sm text-gray-500">For residents/students requiring attending approval</p>
                </div>
              </button>

              {noteStatus === 'signed' && (
                <button
                  onClick={() => handleSign('addendum')}
                  className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <FilePlus className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Add Addendum</p>
                    <p className="text-sm text-gray-500">Add additional information to signed note</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis Search Modal */}
      {showDiagnosisSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Search ICD-10 Diagnoses</h2>
              <button onClick={() => { setShowDiagnosisSearch(false); setDiagnosisSearchQuery(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={diagnosisSearchQuery}
                  onChange={(e) => setDiagnosisSearchQuery(e.target.value)}
                  placeholder="Search diagnoses by name or ICD-10 code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                {diagnosisLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                ) : diagnosisResults?.data && diagnosisResults.data.length > 0 ? (
                  <div className="space-y-2">
                    {diagnosisResults.data.map((dx) => (
                      <button
                        key={dx.id}
                        onClick={() => addDiagnosis(dx)}
                        className="w-full text-left p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{dx.name}</p>
                            <p className="text-sm text-indigo-600">{dx.icd10Code}</p>
                          </div>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </div>
                        {dx.isChronic && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mt-1 inline-block">
                            Chronic
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : diagnosisSearchQuery.length >= 2 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No diagnoses found</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Enter at least 2 characters to search
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
