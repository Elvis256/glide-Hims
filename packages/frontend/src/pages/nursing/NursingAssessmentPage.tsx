import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardCheck,
  UserCircle,
  Heart,
  Activity,
  Brain,
  Wind,
  Droplets,
  Save,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  Eye,
  Stethoscope,
  Utensils,
  Syringe,
  Smile,
  Shield,
  FileText,
  History,
  Copy,
  FilePlus,
  LayoutTemplate,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';
import { patientsService } from '../../services/patients';
import { usePermissions } from '../../components/PermissionGate';

// Types
interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
  dateOfBirth?: string;
  bloodType?: string;
  allergies?: string[];
  admissionId?: string;
}

interface SectionAssessment {
  status: 'normal' | 'abnormal' | 'not-assessed';
  findings: Record<string, string>;
  notes: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

interface AssessmentData {
  generalAppearance: SectionAssessment;
  cardiovascular: SectionAssessment;
  respiratory: SectionAssessment;
  gastrointestinal: SectionAssessment;
  genitourinary: SectionAssessment;
  neurological: SectionAssessment;
  pain: SectionAssessment;
  psychosocial: SectionAssessment;
  skinWounds: SectionAssessment;
  ivAccess: SectionAssessment;
}

interface AssessmentHistory {
  id: string;
  date: string;
  type: string;
  assessor: string;
  summary: string;
  data: AssessmentData;
}

interface SavedTemplate {
  id: string;
  name: string;
  type: 'admission' | 'shift' | 'quick' | 'custom';
  data: Partial<AssessmentData>;
}

// Section Configurations
const SECTION_CONFIG = {
  generalAppearance: {
    label: 'General Appearance',
    icon: Eye,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    fields: {
      consciousness: { label: 'Level of Consciousness (AVPU)', options: ['Alert', 'Verbal', 'Pain', 'Unresponsive'] },
      orientation: { label: 'Orientation', options: ['Oriented x4', 'Oriented x3', 'Oriented x2', 'Oriented x1', 'Disoriented'] },
      mobility: { label: 'Mobility', options: ['Ambulatory', 'Ambulatory with aid', 'Wheelchair', 'Bedbound', 'Requires assistance'] },
      skinCondition: { label: 'Skin Condition', options: ['Warm and dry', 'Cool and dry', 'Warm and moist', 'Cool and clammy', 'Diaphoretic', 'Pale', 'Cyanotic', 'Jaundiced'] },
    },
    normalValues: { consciousness: 'Alert', orientation: 'Oriented x4', mobility: 'Ambulatory', skinCondition: 'Warm and dry' },
  },
  cardiovascular: {
    label: 'Cardiovascular',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    fields: {
      heartSounds: { label: 'Heart Sounds', options: ['S1S2 normal', 'S1S2 with murmur', 'S3 present', 'S4 present', 'Irregular rhythm', 'Distant sounds'] },
      peripheralPulses: { label: 'Peripheral Pulses', options: ['Strong bilateral', 'Weak bilateral', 'Weak unilateral', 'Absent', 'Bounding'] },
      edema: { label: 'Edema', options: ['None', '1+ pitting', '2+ pitting', '3+ pitting', '4+ pitting', 'Non-pitting'] },
      capillaryRefill: { label: 'Capillary Refill', options: ['< 2 seconds', '2-3 seconds', '> 3 seconds', 'Sluggish'] },
    },
    normalValues: { heartSounds: 'S1S2 normal', peripheralPulses: 'Strong bilateral', edema: 'None', capillaryRefill: '< 2 seconds' },
  },
  respiratory: {
    label: 'Respiratory',
    icon: Wind,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-50',
    fields: {
      breathSounds: { label: 'Breath Sounds', options: ['Clear bilateral', 'Diminished', 'Crackles/Rales', 'Wheezes', 'Rhonchi', 'Stridor', 'Absent'] },
      cough: { label: 'Cough', options: ['None', 'Dry', 'Productive', 'Nonproductive', 'Hacking'] },
      oxygenTherapy: { label: 'Oxygen Therapy', options: ['Room air', 'Nasal cannula', 'Simple mask', 'Non-rebreather', 'Venturi mask', 'High-flow', 'BiPAP/CPAP', 'Ventilator'] },
      workOfBreathing: { label: 'Work of Breathing', options: ['Unlabored', 'Mild distress', 'Moderate distress', 'Severe distress', 'Using accessory muscles', 'Nasal flaring'] },
    },
    normalValues: { breathSounds: 'Clear bilateral', cough: 'None', oxygenTherapy: 'Room air', workOfBreathing: 'Unlabored' },
  },
  gastrointestinal: {
    label: 'Gastrointestinal',
    icon: Utensils,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    fields: {
      diet: { label: 'Diet', options: ['Regular', 'NPO', 'Clear liquids', 'Full liquids', 'Soft', 'Mechanical soft', 'Pureed', 'Tube feeding', 'TPN'] },
      bowelSounds: { label: 'Bowel Sounds', options: ['Active all quadrants', 'Hypoactive', 'Hyperactive', 'Absent', 'High-pitched'] },
      lastBM: { label: 'Last BM', options: ['Today', 'Yesterday', '2 days ago', '3+ days ago', 'Unknown'] },
      nauseaVomiting: { label: 'Nausea/Vomiting', options: ['None', 'Nausea only', 'Emesis x1', 'Emesis x2', 'Emesis multiple', 'Coffee ground', 'Bloody'] },
    },
    normalValues: { diet: 'Regular', bowelSounds: 'Active all quadrants', lastBM: 'Today', nauseaVomiting: 'None' },
  },
  genitourinary: {
    label: 'Genitourinary',
    icon: Droplets,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    fields: {
      urineOutput: { label: 'Urine Output', options: ['Adequate', 'Decreased', 'Concentrated', 'Dilute', 'Anuria', 'Polyuria'] },
      catheter: { label: 'Catheter', options: ['None', 'Foley', 'Condom', 'Suprapubic', 'Intermittent'] },
      continence: { label: 'Continence', options: ['Continent', 'Urinary incontinence', 'Fecal incontinence', 'Total incontinence'] },
    },
    normalValues: { urineOutput: 'Adequate', catheter: 'None', continence: 'Continent' },
  },
  neurological: {
    label: 'Neurological',
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    fields: {
      pupils: { label: 'Pupils', options: ['PERRLA', 'Sluggish', 'Fixed', 'Dilated', 'Constricted', 'Unequal', 'Anisocoria'] },
      gcs: { label: 'GCS Score', options: ['15 (fully alert)', '14', '13', '12', '11', '10', '9', '8 (severe injury)', '< 8'] },
      motorFunction: { label: 'Motor Function', options: ['Moves all extremities', 'Weakness noted', 'Paralysis/Paresis', 'Hemiplegia', 'Quadriplegia'] },
      sensation: { label: 'Sensation', options: ['Intact bilaterally', 'Decreased', 'Numbness', 'Tingling/Paresthesia', 'Absent'] },
    },
    normalValues: { pupils: 'PERRLA', gcs: '15 (fully alert)', motorFunction: 'Moves all extremities', sensation: 'Intact bilaterally' },
  },
  pain: {
    label: 'Pain Assessment',
    icon: Activity,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    fields: {
      location: { label: 'Location', options: ['None', 'Head', 'Chest', 'Abdomen', 'Back', 'Extremities', 'Multiple sites', 'Diffuse'] },
      type: { label: 'Type', options: ['None', 'Sharp', 'Dull/Aching', 'Burning', 'Throbbing', 'Stabbing', 'Cramping', 'Radiating'] },
      intensity: { label: 'Intensity (0-10)', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      interventions: { label: 'Interventions', options: ['None needed', 'PRN medication', 'Scheduled medication', 'Non-pharmacological', 'Position change', 'Ice/Heat'] },
    },
    normalValues: { location: 'None', type: 'None', intensity: '0', interventions: 'None needed' },
  },
  psychosocial: {
    label: 'Psychosocial',
    icon: Smile,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    fields: {
      mood: { label: 'Mood', options: ['Calm/Cooperative', 'Anxious', 'Depressed', 'Agitated', 'Tearful', 'Flat affect', 'Euphoric'] },
      anxiety: { label: 'Anxiety Level', options: ['None', 'Mild', 'Moderate', 'Severe', 'Panic'] },
      sleep: { label: 'Sleep', options: ['Restful', 'Interrupted', 'Insomnia', 'Hypersomnia', 'Day/night reversal'] },
      supportSystem: { label: 'Support System', options: ['Family present', 'Friends involved', 'Minimal support', 'No support', 'Requesting chaplain/social worker'] },
    },
    normalValues: { mood: 'Calm/Cooperative', anxiety: 'None', sleep: 'Restful', supportSystem: 'Family present' },
  },
  skinWounds: {
    label: 'Skin/Wounds',
    icon: Shield,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    fields: {
      pressureAreas: { label: 'Pressure Areas', options: ['Intact', 'Reddened', 'Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Unstageable', 'Deep tissue injury'] },
      existingWounds: { label: 'Existing Wounds', options: ['None', 'Surgical incision', 'Skin tear', 'Laceration', 'Pressure ulcer', 'Diabetic ulcer', 'Venous ulcer'] },
      bradenScore: { label: 'Braden Score', options: ['23 (No risk)', '19-22 (Low risk)', '15-18 (Moderate risk)', '13-14 (High risk)', '9-12 (Very high risk)', '< 9 (Severe risk)'] },
    },
    normalValues: { pressureAreas: 'Intact', existingWounds: 'None', bradenScore: '23 (No risk)' },
  },
  ivAccess: {
    label: 'IV Access',
    icon: Syringe,
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
    fields: {
      site: { label: 'Site', options: ['None', 'Right hand', 'Left hand', 'Right forearm', 'Left forearm', 'Right AC', 'Left AC', 'Right upper arm', 'Left upper arm', 'Central line', 'PICC'] },
      type: { label: 'Type', options: ['None', 'Peripheral IV', 'PICC', 'Central venous catheter', 'Port', 'Midline'] },
      condition: { label: 'Condition', options: ['N/A', 'Patent and flushed', 'Redness at site', 'Swelling', 'Infiltrated', 'Phlebitis', 'Occluded'] },
      dueForChange: { label: 'Due for Change', options: ['N/A', 'Not due', 'Due today', 'Overdue', 'Changed this shift'] },
    },
    normalValues: { site: 'None', type: 'None', condition: 'N/A', dueForChange: 'N/A' },
  },
} as const;

type SectionKey = keyof typeof SECTION_CONFIG;

const TEMPLATES: SavedTemplate[] = [
  { id: 'admission', name: 'Admission Assessment (Full)', type: 'admission', data: {} },
  { id: 'shift', name: 'Shift Assessment (Focused)', type: 'shift', data: {} },
  { id: 'quick', name: 'Quick Check (Minimal)', type: 'quick', data: {} },
];

const SEVERITY_COLORS = {
  none: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  mild: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-400' },
  moderate: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400' },
  severe: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
};

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

const createEmptySection = (): SectionAssessment => ({
  status: 'not-assessed',
  findings: {},
  notes: '',
  severity: 'none',
});

const createInitialAssessment = (): AssessmentData => ({
  generalAppearance: createEmptySection(),
  cardiovascular: createEmptySection(),
  respiratory: createEmptySection(),
  gastrointestinal: createEmptySection(),
  genitourinary: createEmptySection(),
  neurological: createEmptySection(),
  pain: createEmptySection(),
  psychosocial: createEmptySection(),
  skinWounds: createEmptySection(),
  ivAccess: createEmptySection(),
});

export default function NursingAssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const patientFromQueue = location.state?.patient;

  const canCreate = hasPermission('nursing.create');
  const canUpdate = hasPermission('nursing.update');
  const hasAccess = canCreate || canUpdate;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    patientFromQueue ? {
      id: patientFromQueue.id || '',
      mrn: patientFromQueue.mrn || '',
      name: patientFromQueue.name || '',
      age: patientFromQueue.age || 0,
      gender: patientFromQueue.gender || '',
      admissionId: patientFromQueue.admissionId,
    } : null
  );
  const [assessment, setAssessment] = useState<AssessmentData>(createInitialAssessment());
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    generalAppearance: true, cardiovascular: false, respiratory: false, gastrointestinal: false,
    genitourinary: false, neurological: false, pain: false, psychosocial: false, skinWounds: false, ivAccess: false,
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('admission');
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  const assessmentHistory: AssessmentHistory[] = useMemo(() => {
    if (!selectedPatient) return [];
    return [
      { id: '1', date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), type: 'Shift Assessment', assessor: 'RN Sarah Johnson', summary: 'Patient stable, pain 3/10, clear breath sounds', data: createInitialAssessment() },
      { id: '2', date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), type: 'Admission Assessment', assessor: 'RN Michael Chen', summary: 'Initial assessment complete, moderate pain reported', data: createInitialAssessment() },
    ];
  }, [selectedPatient]);

  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nursing-notes'] }); setSaved(true); },
  });

  const saving = createNoteMutation.isPending;

  const filteredPatients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({ id: p.id, mrn: p.mrn, name: p.fullName, age: calculateAge(p.dateOfBirth), gender: p.gender, dateOfBirth: p.dateOfBirth }));
  }, [apiPatients, searchTerm]);

  const progress = useMemo(() => {
    const sections = Object.keys(assessment) as SectionKey[];
    const assessed = sections.filter(key => assessment[key].status !== 'not-assessed').length;
    return Math.round((assessed / sections.length) * 100);
  }, [assessment]);

  const abnormalFindings = useMemo(() => {
    const findings: { section: string; issues: string[]; severity: string }[] = [];
    (Object.entries(assessment) as [SectionKey, SectionAssessment][]).forEach(([key, section]) => {
      if (section.status === 'abnormal') {
        const config = SECTION_CONFIG[key];
        const issues: string[] = [];
        Object.entries(section.findings).forEach(([fieldKey, value]) => {
          const fieldConfig = config.fields[fieldKey as keyof typeof config.fields] as { label: string; options: readonly string[] } | undefined;
          const normalValue = config.normalValues[fieldKey as keyof typeof config.normalValues];
          if (fieldConfig && value && value !== normalValue) issues.push(`${fieldConfig.label}: ${value}`);
        });
        if (section.notes) issues.push(`Notes: ${section.notes}`);
        if (issues.length > 0) findings.push({ section: config.label, issues, severity: section.severity });
      }
    });
    return findings;
  }, [assessment]);

  const suggestedDiagnoses = useMemo(() => {
    const diagnoses: string[] = [];
    if (assessment.respiratory.status === 'abnormal') { diagnoses.push('Impaired Gas Exchange'); diagnoses.push('Ineffective Breathing Pattern'); }
    if (assessment.cardiovascular.status === 'abnormal') { diagnoses.push('Decreased Cardiac Output'); diagnoses.push('Risk for Peripheral Neurovascular Dysfunction'); }
    if (assessment.pain.status === 'abnormal' && assessment.pain.findings.intensity && parseInt(assessment.pain.findings.intensity) > 3) diagnoses.push('Acute Pain');
    if (assessment.skinWounds.status === 'abnormal') { diagnoses.push('Impaired Skin Integrity'); diagnoses.push('Risk for Infection'); }
    if (assessment.neurological.status === 'abnormal') { diagnoses.push('Risk for Falls'); diagnoses.push('Disturbed Sensory Perception'); }
    if (assessment.psychosocial.status === 'abnormal') { diagnoses.push('Anxiety'); diagnoses.push('Disturbed Sleep Pattern'); }
    return diagnoses;
  }, [assessment]);

  const priorityProblems = useMemo(() => {
    return abnormalFindings.filter(f => f.severity === 'severe' || f.severity === 'moderate')
      .sort((a, b) => { const order = { severe: 0, moderate: 1, mild: 2, none: 3 }; return order[a.severity as keyof typeof order] - order[b.severity as keyof typeof order]; });
  }, [abnormalFindings]);

  const toggleSection = useCallback((key: SectionKey) => { setExpandedSections(prev => ({ ...prev, [key]: !prev[key] })); }, []);

  const updateSection = useCallback((key: SectionKey, updates: Partial<SectionAssessment>) => {
    setAssessment(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  }, []);

  const updateSectionField = useCallback((sectionKey: SectionKey, fieldKey: string, value: string) => {
    setAssessment(prev => {
      const section = prev[sectionKey];
      const config = SECTION_CONFIG[sectionKey];
      const newFindings = { ...section.findings, [fieldKey]: value };
      const isAbnormal = Object.entries(newFindings).some(([fKey, fValue]) => {
        const normal = config.normalValues[fKey as keyof typeof config.normalValues];
        return fValue && fValue !== normal;
      });
      return { ...prev, [sectionKey]: { ...section, findings: newFindings, status: isAbnormal ? 'abnormal' : 'normal' } };
    });
  }, []);

  const fillNormalValues = useCallback((sectionKey: SectionKey) => {
    const config = SECTION_CONFIG[sectionKey];
    setAssessment(prev => ({ ...prev, [sectionKey]: { ...prev[sectionKey], findings: { ...config.normalValues }, status: 'normal', severity: 'none', notes: '' } }));
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const newAssessment = createInitialAssessment();
    const sectionsToExpand: Record<SectionKey, boolean> = {} as Record<SectionKey, boolean>;
    if (templateId === 'admission') { Object.keys(SECTION_CONFIG).forEach(key => { sectionsToExpand[key as SectionKey] = true; }); }
    else if (templateId === 'shift') { sectionsToExpand.generalAppearance = true; sectionsToExpand.cardiovascular = true; sectionsToExpand.respiratory = true; sectionsToExpand.pain = true; sectionsToExpand.ivAccess = true; }
    else if (templateId === 'quick') { sectionsToExpand.generalAppearance = true; sectionsToExpand.pain = true; }
    setAssessment(newAssessment);
    setExpandedSections(prev => ({ ...prev, ...sectionsToExpand }));
    setSelectedTemplate(templateId);
    setShowTemplates(false);
  }, []);

  const buildAssessmentContent = useCallback(() => {
    const sections: string[] = [];
    (Object.entries(assessment) as [SectionKey, SectionAssessment][]).forEach(([key, section]) => {
      if (section.status !== 'not-assessed') {
        const config = SECTION_CONFIG[key];
        const findings = Object.entries(section.findings).filter(([, value]) => value).map(([fieldKey, value]) => {
          const fieldConfig = config.fields[fieldKey as keyof typeof config.fields] as { label: string; options: readonly string[] } | undefined;
          return fieldConfig ? `${fieldConfig.label}: ${value}` : value;
        }).join(', ');
        sections.push(`${config.label}: ${section.status.toUpperCase()}. ${findings}${section.notes ? '. Notes: ' + section.notes : ''}`);
      }
    });
    return sections.join(' | ');
  }, [assessment]);

  const handleSave = useCallback((asDraft = false) => {
    const admissionId = admission?.id || selectedPatient?.admissionId;
    if (!admissionId) { setIsDraft(asDraft); setSaved(true); return; }
    const content = buildAssessmentContent();
    createNoteMutation.mutate({ admissionId, type: 'assessment', content: `Nursing Assessment${asDraft ? ' (Draft)' : ''} (${TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Custom'}): ${content}` });
    setIsDraft(asDraft);
  }, [admission, selectedPatient, buildAssessmentContent, createNoteMutation, selectedTemplate]);

  const handleGenerateCarePlan = useCallback(() => {
    navigate('/nursing/care-plans', { state: { patient: selectedPatient, diagnoses: suggestedDiagnoses, findings: abnormalFindings } });
  }, [navigate, selectedPatient, suggestedDiagnoses, abnormalFindings]);

  const handleReset = useCallback(() => { setSelectedPatient(null); setAssessment(createInitialAssessment()); setSaved(false); setIsDraft(false); setSearchTerm(''); }, []);

  if (!hasAccess) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to access nursing assessments.<br />Required: nursing.create or nursing.update</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Go Back</button>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{isDraft ? 'Assessment Saved as Draft' : 'Assessment Complete'}</h2>
          <p className="text-gray-600 mb-4">{selectedPatient?.name}'s nursing assessment has been {isDraft ? 'saved as draft' : 'completed'}.</p>
          {abnormalFindings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
              <p className="font-medium text-amber-800 text-sm mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />Abnormal Findings Documented</p>
              <ul className="text-sm text-amber-700 space-y-1">
                {abnormalFindings.slice(0, 3).map((finding, idx) => (<li key={idx}>• {finding.section}: {finding.issues.slice(0, 2).join(', ')}</li>))}
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => navigate('/nursing/triage')} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Back to Queue</button>
            <button onClick={handleGenerateCarePlan} className="px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50">Generate Care Plan</button>
            <button onClick={handleReset} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">New Assessment</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nursing Assessment</h1>
              <p className="text-sm text-gray-500">Comprehensive patient assessment</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-medium text-gray-600">{progress}%</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
              <LayoutTemplate className="w-4 h-4" />Templates<ChevronDown className="w-4 h-4" />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {TEMPLATES.map(template => (
                  <button key={template.id} onClick={() => applyTemplate(template.id)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 ${selectedTemplate === template.id ? 'bg-teal-50 text-teal-700' : ''}`}>
                    <FileText className="w-4 h-4" /><span className="text-sm">{template.name}</span>{selectedTemplate === template.id && <CheckCircle className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
                <div className="border-t">
                  <button onClick={() => setShowTemplates(false)} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-teal-600">
                    <FilePlus className="w-4 h-4" /><span className="text-sm">Save Current as Template</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          {selectedPatient && (
            <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${showHistory ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 hover:bg-gray-50'}`}>
              <History className="w-4 h-4" />History
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Patient Selection Panel */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><UserCircle className="w-5 h-5 text-teal-600" />Patient Selection</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name or MRN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
              ) : filteredPatients.length > 0 ? (
                <div className="space-y-2">
                  {filteredPatients.map((patient) => (
                    <button key={patient.id} onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors">
                      <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y {patient.gender}</p>
                    </button>
                  ))}
                </div>
              ) : (<div className="text-center py-8 text-gray-500"><p className="text-sm">No patients found</p></div>)
            ) : selectedPatient ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                  <div className="flex items-start justify-between">
                    <div><p className="font-medium text-gray-900">{selectedPatient.name}</p><p className="text-xs text-gray-500">{selectedPatient.mrn}</p></div>
                    <button onClick={() => setSelectedPatient(null)} className="p-1 hover:bg-teal-100 rounded"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Age</span><span className="text-gray-900">{selectedPatient.age} years</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Gender</span><span className="text-gray-900 capitalize">{selectedPatient.gender}</span></div>
                  {selectedPatient.ward && (<div className="flex justify-between text-sm"><span className="text-gray-500">Ward/Bed</span><span className="text-gray-900">{selectedPatient.ward} / {selectedPatient.bed}</span></div>)}
                  {admission && (<div className="flex justify-between text-sm"><span className="text-gray-500">Admission</span><span className="text-gray-900 text-xs">{new Date(admission.admittedAt).toLocaleDateString()}</span></div>)}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500"><UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm">Search for a patient to begin</p></div>
            )}
          </div>
        </div>

        {/* Assessment Sections */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {selectedPatient ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {(Object.entries(SECTION_CONFIG) as [SectionKey, typeof SECTION_CONFIG[SectionKey]][]).map(([key, config]) => {
                  const section = assessment[key];
                  const isExpanded = expandedSections[key];
                  const Icon = config.icon;
                  return (
                    <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <button onClick={() => toggleSection(key)} className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 ${isExpanded ? 'border-b' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.bgColor}`}><Icon className={`w-5 h-5 ${config.color}`} /></div>
                          <div className="text-left">
                            <h3 className="font-semibold text-gray-900">{config.label}</h3>
                            <p className="text-xs text-gray-500">{section.status === 'not-assessed' ? 'Not assessed' : section.status === 'normal' ? 'Normal findings' : 'Abnormal findings'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${section.status === 'not-assessed' ? 'bg-gray-100 text-gray-600' : section.status === 'normal' ? 'bg-green-100 text-green-700' : SEVERITY_COLORS[section.severity].bg + ' ' + SEVERITY_COLORS[section.severity].text}`}>
                            {section.status === 'not-assessed' ? 'Pending' : section.status === 'normal' ? 'Normal' : section.severity.charAt(0).toUpperCase() + section.severity.slice(1)}
                          </div>
                          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <button onClick={() => fillNormalValues(key)} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">
                              <CheckCircle className="w-4 h-4" />Mark All Normal
                            </button>
                            {section.status === 'abnormal' && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Severity:</span>
                                {(['mild', 'moderate', 'severe'] as const).map(sev => (
                                  <button key={sev} onClick={() => updateSection(key, { severity: sev })} className={`px-2 py-1 rounded text-xs font-medium border ${section.severity === sev ? SEVERITY_COLORS[sev].bg + ' ' + SEVERITY_COLORS[sev].text + ' ' + SEVERITY_COLORS[sev].border : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(config.fields).map(([fieldKey, fieldConfig]) => (
                              <div key={fieldKey}>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">{fieldConfig.label}</label>
                                <select value={section.findings[fieldKey] || ''} onChange={(e) => updateSectionField(key, fieldKey, e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm ${section.findings[fieldKey] && section.findings[fieldKey] !== config.normalValues[fieldKey as keyof typeof config.normalValues] ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`}>
                                  <option value="">Select...</option>
                                  {fieldConfig.options.map((opt: string) => (<option key={opt} value={opt}>{opt}</option>))}
                                </select>
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes {section.status === 'abnormal' && <span className="text-red-500">*</span>}</label>
                            <textarea value={section.notes} onChange={(e) => updateSection(key, { notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Document abnormal findings, interventions, or additional observations..." />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex-shrink-0 pt-4 border-t mt-4 flex items-center justify-between">
                <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4" />Reset</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleSave(true)} disabled={saving || progress === 0} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"><Clock className="w-4 h-4" />Save as Draft</button>
                  <button onClick={() => handleSave(false)} disabled={saving || progress < 30} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {saving ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4" />Complete Assessment</>)}
                  </button>
                  <button onClick={handleGenerateCarePlan} disabled={abnormalFindings.length === 0} className="flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 disabled:opacity-50"><FileText className="w-4 h-4" />Generate Care Plan</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200">
              <div className="text-center"><Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Select a patient to begin assessment</p></div>
            </div>
          )}
        </div>

        {/* Summary / History Panel */}
        {selectedPatient && (showHistory || abnormalFindings.length > 0) && (
          <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 flex flex-col overflow-hidden">
            <div className="flex border-b mb-4">
              <button onClick={() => setShowHistory(false)} className={`flex-1 pb-2 text-sm font-medium border-b-2 ${!showHistory ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>Summary</button>
              <button onClick={() => setShowHistory(true)} className={`flex-1 pb-2 text-sm font-medium border-b-2 ${showHistory ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500'}`}>History</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {showHistory ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Previous Assessments</h3>
                  {assessmentHistory.length > 0 ? (
                    assessmentHistory.map(hist => (
                      <div key={hist.id} onClick={() => setSelectedHistoryId(selectedHistoryId === hist.id ? null : hist.id)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedHistoryId === hist.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-medium text-teal-600">{hist.type}</span>
                          <span className="text-xs text-gray-500">{new Date(hist.date).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{hist.assessor}</p>
                        <p className="text-sm text-gray-700">{hist.summary}</p>
                        {selectedHistoryId === hist.id && (
                          <div className="mt-3 pt-3 border-t flex gap-2">
                            <button className="flex-1 text-xs py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">View Full</button>
                            <button onClick={(e) => { e.stopPropagation(); setAssessment(hist.data); }} className="flex-1 text-xs py-1.5 bg-teal-100 text-teal-700 rounded hover:bg-teal-200 flex items-center justify-center gap-1">
                              <Copy className="w-3 h-3" />Copy to Current
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (<div className="text-center py-8 text-gray-500"><History className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm">No previous assessments</p></div>)}
                </div>
              ) : (
                <div className="space-y-4">
                  {abnormalFindings.length > 0 ? (
                    <>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-orange-500" />Abnormal Findings</h3>
                        <div className="space-y-2">
                          {abnormalFindings.map((finding, idx) => (
                            <div key={idx} className={`p-2 rounded-lg border ${SEVERITY_COLORS[finding.severity as keyof typeof SEVERITY_COLORS].bg} ${SEVERITY_COLORS[finding.severity as keyof typeof SEVERITY_COLORS].border}`}>
                              <p className={`font-medium text-sm ${SEVERITY_COLORS[finding.severity as keyof typeof SEVERITY_COLORS].text}`}>{finding.section}</p>
                              <ul className="text-xs text-gray-600 mt-1">{finding.issues.slice(0, 3).map((issue, i) => (<li key={i}>• {issue}</li>))}</ul>
                            </div>
                          ))}
                        </div>
                      </div>
                      {priorityProblems.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" />Priority Problems</h3>
                          <ol className="text-sm space-y-1">
                            {priorityProblems.map((problem, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${problem.severity === 'severe' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>{idx + 1}</span>
                                <span className="text-gray-700">{problem.section}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {suggestedDiagnoses.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-1"><Stethoscope className="w-4 h-4 text-teal-500" />Suggested Nursing Diagnoses</h3>
                          <ul className="text-sm space-y-1">{suggestedDiagnoses.map((diagnosis, idx) => (<li key={idx} className="flex items-center gap-2 text-gray-700"><ChevronRight className="w-4 h-4 text-gray-400" />{diagnosis}</li>))}</ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
                      <p className="text-sm">No abnormal findings documented</p>
                      <p className="text-xs text-gray-400 mt-1">Complete assessment to generate summary</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
