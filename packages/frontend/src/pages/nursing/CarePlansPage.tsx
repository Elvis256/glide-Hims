import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Edit2,
  Target,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertTriangle,
  Printer,
  FileText,
  Clock,
  Activity,
  BookOpen,
  Stethoscope,
  Copy,
  Lock,
  Flag,
  CheckSquare,
  Square,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';
import { usePermissions } from '../../components/PermissionGate';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface Intervention {
  id: string;
  description: string;
  category: 'assessment' | 'therapeutic' | 'educational';
  frequency: 'q_shift' | 'q4h' | 'q8h' | 'daily' | 'prn' | 'once';
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

interface Evaluation {
  id: string;
  date: string;
  evaluator: string;
  goalStatus: 'met' | 'partially_met' | 'not_met' | 'revised';
  progressNotes: string;
  nextSteps: string;
}

interface CarePlan {
  id: string;
  patientId: string;
  nursingDiagnosis: string;
  relatedTo: string;
  asEvidencedBy: string;
  goals: { id: string; description: string; isSmart: boolean }[];
  interventions: Intervention[];
  evaluations: Evaluation[];
  status: 'active' | 'met' | 'on_hold' | 'discontinued';
  priority: 'high' | 'medium' | 'low';
  startDate: string;
  targetDate: string;
  updatedDate: string;
  progress: number;
  outcomeCriteria: string;
  createdBy?: string;
}

interface CarePlanTemplate {
  id: string;
  name: string;
  category: string;
  nursingDiagnosis: string;
  relatedTo: string;
  asEvidencedBy: string;
  goals: string[];
  interventions: { description: string; category: 'assessment' | 'therapeutic' | 'educational'; frequency: string }[];
  outcomeCriteria: string;
}

// Calculate age from date of birth
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

const statusConfig = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700', icon: Activity },
  met: { label: 'Met', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  discontinued: { label: 'Discontinued', color: 'bg-gray-100 text-gray-700', icon: X },
};

const priorityConfig = {
  high: { label: 'High', color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Flag },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-300', icon: Flag },
};

const interventionCategoryConfig = {
  assessment: { label: 'Assessment', color: 'bg-blue-50 text-blue-700', icon: Stethoscope },
  therapeutic: { label: 'Therapeutic', color: 'bg-purple-50 text-purple-700', icon: Activity },
  educational: { label: 'Educational', color: 'bg-teal-50 text-teal-700', icon: BookOpen },
};

const frequencyConfig = {
  q_shift: 'Q Shift',
  q4h: 'Q4H',
  q8h: 'Q8H',
  daily: 'Daily',
  prn: 'PRN',
  once: 'Once',
};

const goalStatusConfig = {
  met: { label: 'Met', color: 'bg-green-100 text-green-700' },
  partially_met: { label: 'Partially Met', color: 'bg-yellow-100 text-yellow-700' },
  not_met: { label: 'Not Met', color: 'bg-red-100 text-red-700' },
  revised: { label: 'Revised', color: 'bg-blue-100 text-blue-700' },
};

// NANDA-I Nursing Diagnoses (sample)
const NANDA_DIAGNOSES = [
  { code: '00004', label: 'Risk for Infection', domain: 'Safety/Protection' },
  { code: '00046', label: 'Impaired Skin Integrity', domain: 'Safety/Protection' },
  { code: '00047', label: 'Risk for Impaired Skin Integrity', domain: 'Safety/Protection' },
  { code: '00085', label: 'Impaired Physical Mobility', domain: 'Activity/Rest' },
  { code: '00088', label: 'Impaired Walking', domain: 'Activity/Rest' },
  { code: '00132', label: 'Acute Pain', domain: 'Comfort' },
  { code: '00133', label: 'Chronic Pain', domain: 'Comfort' },
  { code: '00155', label: 'Risk for Falls', domain: 'Safety/Protection' },
  { code: '00025', label: 'Risk for Imbalanced Fluid Volume', domain: 'Nutrition' },
  { code: '00026', label: 'Excess Fluid Volume', domain: 'Nutrition' },
  { code: '00027', label: 'Deficient Fluid Volume', domain: 'Nutrition' },
  { code: '00030', label: 'Impaired Gas Exchange', domain: 'Elimination/Exchange' },
  { code: '00031', label: 'Ineffective Airway Clearance', domain: 'Elimination/Exchange' },
  { code: '00032', label: 'Ineffective Breathing Pattern', domain: 'Elimination/Exchange' },
  { code: '00146', label: 'Anxiety', domain: 'Coping/Stress Tolerance' },
  { code: '00148', label: 'Fear', domain: 'Coping/Stress Tolerance' },
  { code: '00002', label: 'Imbalanced Nutrition: Less Than Body Requirements', domain: 'Nutrition' },
  { code: '00011', label: 'Constipation', domain: 'Elimination/Exchange' },
  { code: '00016', label: 'Impaired Urinary Elimination', domain: 'Elimination/Exchange' },
  { code: '00095', label: 'Insomnia', domain: 'Activity/Rest' },
];

// Care Plan Templates
const CARE_PLAN_TEMPLATES: CarePlanTemplate[] = [
  {
    id: 'fall-prevention',
    name: 'Fall Prevention',
    category: 'Safety',
    nursingDiagnosis: 'Risk for Falls',
    relatedTo: 'Impaired mobility, medication side effects, environmental hazards',
    asEvidencedBy: 'History of falls, unsteady gait, use of assistive devices',
    goals: [
      'Patient will remain free from falls during hospitalization',
      'Patient will demonstrate safe ambulation techniques',
      'Patient will identify personal risk factors for falls',
    ],
    interventions: [
      { description: 'Assess fall risk using standardized tool', category: 'assessment', frequency: 'q_shift' },
      { description: 'Keep bed in lowest position with brakes locked', category: 'therapeutic', frequency: 'q_shift' },
      { description: 'Ensure call light is within reach', category: 'therapeutic', frequency: 'q_shift' },
      { description: 'Assist with ambulation as needed', category: 'therapeutic', frequency: 'prn' },
      { description: 'Educate patient on fall prevention strategies', category: 'educational', frequency: 'daily' },
    ],
    outcomeCriteria: 'No falls during hospital stay; patient demonstrates understanding of fall prevention',
  },
  {
    id: 'pain-management',
    name: 'Pain Management',
    category: 'Comfort',
    nursingDiagnosis: 'Acute Pain',
    relatedTo: 'Surgical intervention, tissue trauma, disease process',
    asEvidencedBy: 'Patient reports pain, facial grimacing, guarding behavior',
    goals: [
      'Patient will report pain level at 4 or below on 0-10 scale',
      'Patient will demonstrate use of non-pharmacological pain relief methods',
      'Patient will report ability to perform daily activities with minimal pain interference',
    ],
    interventions: [
      { description: 'Assess pain using validated pain scale', category: 'assessment', frequency: 'q4h' },
      { description: 'Administer prescribed analgesics as ordered', category: 'therapeutic', frequency: 'prn' },
      { description: 'Reposition patient for comfort', category: 'therapeutic', frequency: 'q4h' },
      { description: 'Apply ice/heat as appropriate', category: 'therapeutic', frequency: 'prn' },
      { description: 'Teach relaxation and distraction techniques', category: 'educational', frequency: 'daily' },
    ],
    outcomeCriteria: 'Pain controlled at acceptable level; patient uses pain management strategies effectively',
  },
  {
    id: 'skin-integrity',
    name: 'Skin Integrity',
    category: 'Safety',
    nursingDiagnosis: 'Risk for Impaired Skin Integrity',
    relatedTo: 'Immobility, poor nutrition, incontinence, altered circulation',
    asEvidencedBy: 'Limited mobility, Braden score indicating risk, presence of moisture',
    goals: [
      'Patient will maintain intact skin without pressure injuries',
      'Patient will demonstrate understanding of skin care measures',
      'Patient will participate in repositioning schedule',
    ],
    interventions: [
      { description: 'Assess skin condition with focus on bony prominences', category: 'assessment', frequency: 'q_shift' },
      { description: 'Reposition patient every 2 hours', category: 'therapeutic', frequency: 'q4h' },
      { description: 'Keep skin clean and dry', category: 'therapeutic', frequency: 'q_shift' },
      { description: 'Apply protective barrier cream as needed', category: 'therapeutic', frequency: 'prn' },
      { description: 'Ensure adequate nutrition and hydration', category: 'therapeutic', frequency: 'daily' },
      { description: 'Educate patient/family on pressure injury prevention', category: 'educational', frequency: 'once' },
    ],
    outcomeCriteria: 'Skin remains intact; no new pressure injuries develop',
  },
  {
    id: 'mobility',
    name: 'Impaired Mobility',
    category: 'Activity',
    nursingDiagnosis: 'Impaired Physical Mobility',
    relatedTo: 'Musculoskeletal impairment, pain, decreased strength',
    asEvidencedBy: 'Limited range of motion, difficulty with ambulation, decreased muscle strength',
    goals: [
      'Patient will demonstrate improved mobility within functional limits',
      'Patient will participate in prescribed physical therapy',
      'Patient will use assistive devices correctly',
    ],
    interventions: [
      { description: 'Assess mobility status and functional abilities', category: 'assessment', frequency: 'q_shift' },
      { description: 'Perform passive/active ROM exercises', category: 'therapeutic', frequency: 'q8h' },
      { description: 'Assist with ambulation using appropriate assistive devices', category: 'therapeutic', frequency: 'daily' },
      { description: 'Coordinate with physical therapy', category: 'therapeutic', frequency: 'daily' },
      { description: 'Teach proper body mechanics and transfer techniques', category: 'educational', frequency: 'once' },
    ],
    outcomeCriteria: 'Progressive improvement in mobility; patient demonstrates safe use of assistive devices',
  },
  {
    id: 'infection-prevention',
    name: 'Infection Prevention',
    category: 'Safety',
    nursingDiagnosis: 'Risk for Infection',
    relatedTo: 'Invasive procedures, compromised immune system, surgical incision',
    asEvidencedBy: 'Presence of IV lines, urinary catheter, surgical wound',
    goals: [
      'Patient will remain free from signs of infection',
      'Patient will demonstrate understanding of infection prevention measures',
      'Patient will maintain normal WBC and temperature',
    ],
    interventions: [
      { description: 'Monitor for signs/symptoms of infection', category: 'assessment', frequency: 'q_shift' },
      { description: 'Monitor temperature and WBC results', category: 'assessment', frequency: 'q_shift' },
      { description: 'Perform hand hygiene before and after patient contact', category: 'therapeutic', frequency: 'prn' },
      { description: 'Maintain aseptic technique for invasive procedures', category: 'therapeutic', frequency: 'prn' },
      { description: 'Assess and care for IV sites per protocol', category: 'therapeutic', frequency: 'q_shift' },
      { description: 'Educate patient on hand hygiene and infection prevention', category: 'educational', frequency: 'once' },
    ],
    outcomeCriteria: 'No signs of infection; vital signs within normal limits',
  },
  {
    id: 'anxiety-management',
    name: 'Anxiety Management',
    category: 'Psychosocial',
    nursingDiagnosis: 'Anxiety',
    relatedTo: 'Hospitalization, unknown diagnosis, fear of procedures',
    asEvidencedBy: 'Verbalized worry, restlessness, increased heart rate',
    goals: [
      'Patient will report decreased anxiety level',
      'Patient will demonstrate use of coping strategies',
      'Patient will verbalize understanding of condition and treatment plan',
    ],
    interventions: [
      { description: 'Assess anxiety level using standardized scale', category: 'assessment', frequency: 'q_shift' },
      { description: 'Provide calm, reassuring environment', category: 'therapeutic', frequency: 'prn' },
      { description: 'Encourage verbalization of fears and concerns', category: 'therapeutic', frequency: 'daily' },
      { description: 'Administer anxiolytics as prescribed', category: 'therapeutic', frequency: 'prn' },
      { description: 'Teach relaxation techniques (deep breathing, guided imagery)', category: 'educational', frequency: 'daily' },
    ],
    outcomeCriteria: 'Patient reports manageable anxiety; uses coping techniques effectively',
  },
];

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function CarePlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  // Permission checks
  const canCreate = hasPermission('nursing.create');
  const canUpdate = hasPermission('nursing.update');
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'met' | 'on_hold' | 'discontinued'>('all');
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'info' | 'interventions' | 'evaluations'>('info');
  
  // Form state for new care plan
  const [formData, setFormData] = useState({
    nursingDiagnosis: '',
    relatedTo: '',
    asEvidencedBy: '',
    goals: [] as { id: string; description: string; isSmart: boolean }[],
    interventions: [] as Intervention[],
    status: 'active' as CarePlan['status'],
    priority: 'medium' as CarePlan['priority'],
    targetDate: '',
    outcomeCriteria: '',
  });
  
  // Evaluation form state
  const [evaluationData, setEvaluationData] = useState({
    goalStatus: 'partially_met' as Evaluation['goalStatus'],
    progressNotes: '',
    nextSteps: '',
  });
  
  // New goal input
  const [newGoal, setNewGoal] = useState('');
  
  // New intervention input
  const [newIntervention, setNewIntervention] = useState({
    description: '',
    category: 'assessment' as Intervention['category'],
    frequency: 'q_shift' as Intervention['frequency'],
  });

  // Demo care plans data
  const [demoCarePlans, setDemoCarePlans] = useState<CarePlan[]>([]);

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  // Get current admission for selected patient
  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch nursing notes for the patient's admission (as care plans)
  const { data: nursingNotes, isLoading: notesLoading } = useQuery({
    queryKey: ['nursing-notes', admission?.id],
    queryFn: () => ipdService.nursingNotes.list(admission!.id),
    enabled: !!admission?.id,
  });

  // Create nursing note mutation for care plans
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setSaved(true);
      setShowAddModal(false);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
    }));
  }, [apiPatients, searchTerm]);

  // Transform nursing notes to care plans format and combine with demo plans
  const carePlans = useMemo((): CarePlan[] => {
    const apiPlans: CarePlan[] = [];
    if (nursingNotes) {
      nursingNotes
        .filter(note => note.type === 'assessment' || note.type === 'progress')
        .forEach(note => {
          apiPlans.push({
            id: note.id,
            patientId: selectedPatient?.id || '',
            nursingDiagnosis: note.content.split('.')[0] || note.content,
            relatedTo: '',
            asEvidencedBy: '',
            goals: note.content.includes('Goals:') 
              ? note.content.split('Goals:')[1]?.split('Interventions:')[0]?.split(',').map((g, idx) => ({ id: `g-${idx}`, description: g.trim(), isSmart: false })) || [] 
              : [],
            interventions: note.content.includes('Interventions:') 
              ? note.content.split('Interventions:')[1]?.split(',').map((i, idx) => ({
                  id: `int-${idx}`,
                  description: i.trim(),
                  category: 'therapeutic' as const,
                  frequency: 'daily' as const,
                  status: 'pending' as const,
                })) || [] 
              : [],
            evaluations: [],
            status: 'active' as const,
            priority: 'medium' as const,
            startDate: new Date(note.createdAt).toISOString().split('T')[0],
            targetDate: new Date(new Date(note.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            updatedDate: new Date(note.createdAt).toISOString().split('T')[0],
            progress: 0,
            outcomeCriteria: '',
          });
        });
    }
    return [...apiPlans, ...demoCarePlans.filter(p => p.patientId === selectedPatient?.id)];
  }, [nursingNotes, selectedPatient, demoCarePlans]);

  const saving = createNoteMutation.isPending;

  const patientCarePlans = useMemo(() => {
    let plans = carePlans.filter((cp) => cp.patientId === selectedPatient?.id);
    if (statusFilter !== 'all') {
      plans = plans.filter((cp) => cp.status === statusFilter);
    }
    return plans;
  }, [carePlans, selectedPatient, statusFilter]);

  // Calculate care plan stats
  const carePlanStats = useMemo(() => {
    const active = patientCarePlans.filter(p => p.status === 'active').length;
    const met = patientCarePlans.filter(p => p.status === 'met').length;
    const total = patientCarePlans.length;
    const highPriority = patientCarePlans.filter(p => p.priority === 'high' && p.status === 'active').length;
    return { active, met, total, highPriority };
  }, [patientCarePlans]);

  // Toggle expanded card
  const toggleExpanded = useCallback((planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      nursingDiagnosis: '',
      relatedTo: '',
      asEvidencedBy: '',
      goals: [],
      interventions: [],
      status: 'active',
      priority: 'medium',
      targetDate: '',
      outcomeCriteria: '',
    });
    setNewGoal('');
    setNewIntervention({
      description: '',
      category: 'assessment',
      frequency: 'q_shift',
    });
  }, []);

  const handleOpenAdd = useCallback(() => {
    resetForm();
    setEditingPlan(null);
    setShowAddModal(true);
  }, [resetForm]);

  const handleOpenEdit = useCallback((plan: CarePlan) => {
    setFormData({
      nursingDiagnosis: plan.nursingDiagnosis,
      relatedTo: plan.relatedTo,
      asEvidencedBy: plan.asEvidencedBy,
      goals: [...plan.goals],
      interventions: [...plan.interventions],
      status: plan.status,
      priority: plan.priority,
      targetDate: plan.targetDate,
      outcomeCriteria: plan.outcomeCriteria,
    });
    setEditingPlan(plan);
    setShowAddModal(true);
  }, []);

  const handleViewDetail = useCallback((plan: CarePlan) => {
    setSelectedPlan(plan);
    setActiveTab('info');
    setShowDetailModal(true);
  }, []);

  // Add goal
  const handleAddGoal = useCallback(() => {
    if (!newGoal.trim()) return;
    setFormData(prev => ({
      ...prev,
      goals: [...prev.goals, { id: generateId(), description: newGoal.trim(), isSmart: false }],
    }));
    setNewGoal('');
  }, [newGoal]);

  // Remove goal
  const handleRemoveGoal = useCallback((goalId: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter(g => g.id !== goalId),
    }));
  }, []);

  // Add intervention
  const handleAddIntervention = useCallback(() => {
    if (!newIntervention.description.trim()) return;
    setFormData(prev => ({
      ...prev,
      interventions: [...prev.interventions, {
        id: generateId(),
        description: newIntervention.description.trim(),
        category: newIntervention.category,
        frequency: newIntervention.frequency,
        status: 'pending',
      }],
    }));
    setNewIntervention({ description: '', category: 'assessment', frequency: 'q_shift' });
  }, [newIntervention]);

  // Remove intervention
  const handleRemoveIntervention = useCallback((intId: string) => {
    setFormData(prev => ({
      ...prev,
      interventions: prev.interventions.filter(i => i.id !== intId),
    }));
  }, []);

  // Apply template
  const handleApplyTemplate = useCallback((template: CarePlanTemplate) => {
    setFormData({
      nursingDiagnosis: template.nursingDiagnosis,
      relatedTo: template.relatedTo,
      asEvidencedBy: template.asEvidencedBy,
      goals: template.goals.map(g => ({ id: generateId(), description: g, isSmart: true })),
      interventions: template.interventions.map(i => ({
        id: generateId(),
        description: i.description,
        category: i.category,
        frequency: i.frequency as Intervention['frequency'],
        status: 'pending' as const,
      })),
      status: 'active',
      priority: 'medium',
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      outcomeCriteria: template.outcomeCriteria,
    });
    setShowTemplateModal(false);
  }, []);

  // Toggle intervention completion
  const handleToggleIntervention = useCallback((planId: string, intId: string) => {
    setDemoCarePlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      const updatedInterventions = plan.interventions.map(int => {
        if (int.id !== intId) return int;
        return {
          ...int,
          status: int.status === 'completed' ? 'pending' as const : 'completed' as const,
          completedAt: int.status === 'completed' ? undefined : new Date().toISOString(),
          completedBy: int.status === 'completed' ? undefined : 'Current User',
        };
      });
      return {
        ...plan,
        interventions: updatedInterventions,
        progress: Math.round((updatedInterventions.filter(i => i.status === 'completed').length / updatedInterventions.length) * 100),
      };
    }));
    
    // Update selected plan if viewing detail
    if (selectedPlan?.id === planId) {
      setSelectedPlan(prev => {
        if (!prev) return null;
        const updatedInterventions = prev.interventions.map(int => {
          if (int.id !== intId) return int;
          return {
            ...int,
            status: int.status === 'completed' ? 'pending' as const : 'completed' as const,
            completedAt: int.status === 'completed' ? undefined : new Date().toISOString(),
            completedBy: int.status === 'completed' ? undefined : 'Current User',
          };
        });
        return {
          ...prev,
          interventions: updatedInterventions,
          progress: Math.round((updatedInterventions.filter(i => i.status === 'completed').length / updatedInterventions.length) * 100),
        };
      });
    }
  }, [selectedPlan]);

  // Add evaluation
  const handleAddEvaluation = useCallback(() => {
    if (!selectedPlan || !evaluationData.progressNotes.trim()) return;
    
    const newEvaluation: Evaluation = {
      id: generateId(),
      date: new Date().toISOString(),
      evaluator: 'Current User',
      goalStatus: evaluationData.goalStatus,
      progressNotes: evaluationData.progressNotes,
      nextSteps: evaluationData.nextSteps,
    };
    
    setDemoCarePlans(prev => prev.map(plan => {
      if (plan.id !== selectedPlan.id) return plan;
      return {
        ...plan,
        evaluations: [...plan.evaluations, newEvaluation],
        status: evaluationData.goalStatus === 'met' ? 'met' : plan.status,
      };
    }));
    
    setSelectedPlan(prev => prev ? {
      ...prev,
      evaluations: [...prev.evaluations, newEvaluation],
      status: evaluationData.goalStatus === 'met' ? 'met' : prev.status,
    } : null);
    
    setEvaluationData({ goalStatus: 'partially_met', progressNotes: '', nextSteps: '' });
    setShowEvaluationModal(false);
  }, [selectedPlan, evaluationData]);

  // Save care plan
  const handleSave = useCallback(() => {
    if (!selectedPatient) return;
    
    const newPlan: CarePlan = {
      id: editingPlan?.id || generateId(),
      patientId: selectedPatient.id,
      nursingDiagnosis: formData.nursingDiagnosis,
      relatedTo: formData.relatedTo,
      asEvidencedBy: formData.asEvidencedBy,
      goals: formData.goals,
      interventions: formData.interventions,
      evaluations: editingPlan?.evaluations || [],
      status: formData.status,
      priority: formData.priority,
      startDate: editingPlan?.startDate || new Date().toISOString().split('T')[0],
      targetDate: formData.targetDate,
      updatedDate: new Date().toISOString().split('T')[0],
      progress: 0,
      outcomeCriteria: formData.outcomeCriteria,
      createdBy: 'Current User',
    };
    
    if (editingPlan) {
      setDemoCarePlans(prev => prev.map(p => p.id === editingPlan.id ? newPlan : p));
    } else {
      setDemoCarePlans(prev => [...prev, newPlan]);
    }
    
    // Also save to API if admission exists
    if (admission?.id) {
      const content = `Care Plan - ${formData.nursingDiagnosis}. Related to: ${formData.relatedTo}. Goals: ${formData.goals.map(g => g.description).join(', ')}. Interventions: ${formData.interventions.map(i => i.description).join(', ')}. Target: ${formData.targetDate}`;
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'assessment',
        content,
      });
    } else {
      setSaved(true);
      setShowAddModal(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [selectedPatient, formData, editingPlan, admission, createNoteMutation]);

  // Print care plan
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Update care plan status
  const handleUpdateStatus = useCallback((planId: string, newStatus: CarePlan['status']) => {
    setDemoCarePlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan;
      return { ...plan, status: newStatus, updatedDate: new Date().toISOString().split('T')[0] };
    }));
    
    if (selectedPlan?.id === planId) {
      setSelectedPlan(prev => prev ? { ...prev, status: newStatus } : null);
    }
  }, [selectedPlan]);


  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Care Plans</h1>
            <p className="text-sm text-gray-500">Nursing care plans management</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Care plan saved</span>
          </div>
        )}
        {!canCreate && !canUpdate && (
          <div className="ml-auto flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">View only mode</span>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => {
                  const activePlans = carePlans.filter((cp) => cp.patientId === patient.id && cp.status === 'active').length;
                  const highPriorityPlans = carePlans.filter((cp) => cp.patientId === patient.id && cp.priority === 'high' && cp.status === 'active').length;
                  return (
                    <button
                      key={patient.id}
                      onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedPatient?.id === patient.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-8 h-8 text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y {patient.gender}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {activePlans > 0 && (
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">{activePlans} active</span>
                          )}
                          {highPriorityPlans > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">{highPriorityPlans} high</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500"><p className="text-sm">No patients found</p></div>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y {selectedPatient.gender}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-teal-200 grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-teal-600">{carePlanStats.active}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-green-600">{carePlanStats.met}</p>
                    <p className="text-xs text-gray-500">Met</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
          </div>
        </div>

        {/* Care Plans List */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{patientCarePlans.length} care plan(s)</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="met">Met</option>
                    <option value="on_hold">On Hold</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                  {canCreate && (
                    <>
                      <button
                        onClick={() => setShowTemplateModal(true)}
                        className="flex items-center gap-2 px-3 py-2 border border-teal-300 text-teal-700 rounded-lg text-sm hover:bg-teal-50"
                      >
                        <Copy className="w-4 h-4" />
                        Templates
                      </button>
                      <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                      >
                        <Plus className="w-4 h-4" />
                        New Care Plan
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
                {notesLoading ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
                ) : patientCarePlans.length > 0 ? (
                  patientCarePlans.map((plan) => {
                    const isExpanded = expandedPlans.has(plan.id);
                    const StatusIcon = statusConfig[plan.status]?.icon || Activity;
                    const completedInterventions = plan.interventions.filter(i => i.status === 'completed').length;
                    const totalInterventions = plan.interventions.length;
                    const progressPercent = totalInterventions > 0 ? Math.round((completedInterventions / totalInterventions) * 100) : 0;

                    return (
                      <div key={plan.id} className={`border rounded-lg overflow-hidden transition-all ${plan.priority === 'high' ? 'border-red-200' : 'border-gray-200'} hover:shadow-sm`}>
                        <div className={`p-4 cursor-pointer ${plan.priority === 'high' ? 'bg-red-50/50' : 'bg-white'}`} onClick={() => toggleExpanded(plan.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <button className="mt-1 text-gray-400">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[plan.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                                    <StatusIcon className="w-3 h-3 inline mr-1" />{statusConfig[plan.status]?.label || plan.status}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityConfig[plan.priority]?.color || 'bg-gray-100 text-gray-700'}`}>
                                    {priorityConfig[plan.priority]?.label || plan.priority} Priority
                                  </span>
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />Target: {plan.targetDate}
                                  </span>
                                </div>
                                <h3 className="font-medium text-gray-900">{plan.nursingDiagnosis}</h3>
                                {plan.relatedTo && <p className="text-sm text-gray-500 mt-1"><span className="font-medium">R/T:</span> {plan.relatedTo}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right mr-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${progressPercent === 100 ? 'bg-green-500' : progressPercent > 50 ? 'bg-teal-500' : 'bg-yellow-500'}`} style={{ width: `${progressPercent}%` }} />
                                  </div>
                                  <span className="text-xs font-medium text-gray-600">{progressPercent}%</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{completedInterventions}/{totalInterventions} interventions</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleViewDetail(plan); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="View Details">
                                <FileText className="w-4 h-4" />
                              </button>
                              {canUpdate && (
                                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(plan); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Edit">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                  <Target className="w-4 h-4 text-teal-600" />Goals ({plan.goals.length})
                                </h4>
                                <ul className="space-y-1">
                                  {plan.goals.slice(0, 3).map((goal) => (
                                    <li key={goal.id} className="text-sm text-gray-600 flex items-start gap-2">
                                      <CheckCircle className="w-3 h-3 text-teal-500 mt-1 flex-shrink-0" />
                                      <span>{goal.description}</span>
                                      {goal.isSmart && <span className="px-1 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">SMART</span>}
                                    </li>
                                  ))}
                                  {plan.goals.length > 3 && <li className="text-xs text-teal-600 cursor-pointer" onClick={() => handleViewDetail(plan)}>+{plan.goals.length - 3} more goals</li>}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                  <ClipboardList className="w-4 h-4 text-teal-600" />Interventions ({plan.interventions.length})
                                </h4>
                                <ul className="space-y-1">
                                  {plan.interventions.slice(0, 3).map((intervention) => (
                                    <li key={intervention.id} className="text-sm text-gray-600 flex items-start gap-2">
                                      {intervention.status === 'completed' ? <CheckSquare className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" /> : <Square className="w-3 h-3 text-gray-400 mt-1 flex-shrink-0" />}
                                      <span className={intervention.status === 'completed' ? 'line-through text-gray-400' : ''}>{intervention.description}</span>
                                      <span className={`px-1 py-0.5 rounded text-xs ${interventionCategoryConfig[intervention.category]?.color || 'bg-gray-100'}`}>{frequencyConfig[intervention.frequency]}</span>
                                    </li>
                                  ))}
                                  {plan.interventions.length > 3 && <li className="text-xs text-teal-600 cursor-pointer" onClick={() => handleViewDetail(plan)}>+{plan.interventions.length - 3} more interventions</li>}
                                </ul>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                              <div className="text-xs text-gray-400">Started: {plan.startDate} • Updated: {plan.updatedDate}</div>
                              <button onClick={() => handleViewDetail(plan)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">View Full Details →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No care plans found</p>
                      {canCreate && <button onClick={handleOpenAdd} className="mt-3 text-teal-600 hover:text-teal-700 text-sm font-medium">Create first care plan →</button>}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view care plans</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Care Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{editingPlan ? 'Edit Care Plan' : 'New Care Plan'}</h2>
              <div className="flex items-center gap-2">
                {!editingPlan && (
                  <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded-lg text-sm">
                    <Copy className="w-4 h-4" />Use Template
                  </button>
                )}
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-teal-600" />Nursing Diagnosis (NANDA-I)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Diagnosis *</label>
                    <select value={formData.nursingDiagnosis} onChange={(e) => setFormData({ ...formData, nursingDiagnosis: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="">Select nursing diagnosis...</option>
                      {NANDA_DIAGNOSES.map((diag) => (<option key={diag.code} value={diag.label}>[{diag.code}] {diag.label} ({diag.domain})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Related To (Etiology)</label>
                    <textarea rows={2} value={formData.relatedTo} onChange={(e) => setFormData({ ...formData, relatedTo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="e.g., Immobility, poor nutrition..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">As Evidenced By (Signs/Symptoms)</label>
                    <textarea rows={2} value={formData.asEvidencedBy} onChange={(e) => setFormData({ ...formData, asEvidencedBy: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="e.g., Redness over bony prominences..." />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-teal-600" />Goals (SMART Goals)</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Enter a SMART goal..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()} />
                    <button onClick={handleAddGoal} disabled={!newGoal.trim()} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    {formData.goals.map((goal) => (
                      <div key={goal.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        <span className="flex-1 text-sm">{goal.description}</span>
                        <button onClick={() => handleRemoveGoal(goal.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {formData.goals.length === 0 && <p className="text-sm text-gray-400 italic">No goals added yet</p>}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-teal-600" />Interventions</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <input type="text" value={newIntervention.description} onChange={(e) => setNewIntervention({ ...newIntervention, description: e.target.value })} placeholder="Intervention description..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <select value={newIntervention.category} onChange={(e) => setNewIntervention({ ...newIntervention, category: e.target.value as Intervention['category'] })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="assessment">Assessment</option>
                      <option value="therapeutic">Therapeutic</option>
                      <option value="educational">Educational</option>
                    </select>
                    <div className="flex gap-2">
                      <select value={newIntervention.frequency} onChange={(e) => setNewIntervention({ ...newIntervention, frequency: e.target.value as Intervention['frequency'] })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="q_shift">Q Shift</option>
                        <option value="q4h">Q4H</option>
                        <option value="q8h">Q8H</option>
                        <option value="daily">Daily</option>
                        <option value="prn">PRN</option>
                        <option value="once">Once</option>
                      </select>
                      <button onClick={handleAddIntervention} disabled={!newIntervention.description.trim()} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {formData.interventions.map((intervention) => {
                      const CategoryIcon = interventionCategoryConfig[intervention.category]?.icon || Activity;
                      return (
                        <div key={intervention.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                          <CategoryIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="flex-1 text-sm">{intervention.description}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${interventionCategoryConfig[intervention.category]?.color || 'bg-gray-100'}`}>{interventionCategoryConfig[intervention.category]?.label}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{frequencyConfig[intervention.frequency]}</span>
                          <button onClick={() => handleRemoveIntervention(intervention.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                      );
                    })}
                    {formData.interventions.length === 0 && <p className="text-sm text-gray-400 italic">No interventions added yet</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Outcome Criteria</label>
                  <textarea rows={3} value={formData.outcomeCriteria} onChange={(e) => setFormData({ ...formData, outcomeCriteria: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Measurable outcome criteria..." />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Target Date</label>
                    <input type="date" value={formData.targetDate} onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
                      <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as CarePlan['priority'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CarePlan['status'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="met">Met</option>
                        <option value="discontinued">Discontinued</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.nursingDiagnosis} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Care Plan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Care Plan Detail Modal */}
      {showDetailModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Care Plan Details</h2>
                <p className="text-sm text-gray-500">{selectedPlan.nursingDiagnosis}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  <Printer className="w-4 h-4" />Print
                </button>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="border-b px-4">
              <div className="flex gap-4">
                {(['info', 'interventions', 'evaluations'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'info' && 'Information'}
                    {tab === 'interventions' && `Interventions (${selectedPlan.interventions.length})`}
                    {tab === 'evaluations' && `Evaluations (${selectedPlan.evaluations.length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'info' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedPlan.status]?.color || 'bg-gray-100'}`}>{statusConfig[selectedPlan.status]?.label}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${priorityConfig[selectedPlan.priority]?.color || 'bg-gray-100'}`}>{priorityConfig[selectedPlan.priority]?.label} Priority</span>
                    {canUpdate && selectedPlan.status === 'active' && (
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => handleUpdateStatus(selectedPlan.id, 'on_hold')} className="px-3 py-1 border border-yellow-300 text-yellow-700 rounded-lg text-sm hover:bg-yellow-50">Put On Hold</button>
                        <button onClick={() => handleUpdateStatus(selectedPlan.id, 'met')} className="px-3 py-1 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50">Mark as Met</button>
                        <button onClick={() => handleUpdateStatus(selectedPlan.id, 'discontinued')} className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Discontinue</button>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-medium text-teal-600">{selectedPlan.progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${selectedPlan.progress === 100 ? 'bg-green-500' : 'bg-teal-500'}`} style={{ width: `${selectedPlan.progress}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Nursing Diagnosis</h4>
                      <p className="text-gray-900">{selectedPlan.nursingDiagnosis}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Related To</h4>
                      <p className="text-gray-900">{selectedPlan.relatedTo || 'Not specified'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">As Evidenced By</h4>
                    <p className="text-gray-900">{selectedPlan.asEvidencedBy || 'Not specified'}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-teal-600" />Goals</h4>
                    <ul className="space-y-2">
                      {selectedPlan.goals.map((goal) => (
                        <li key={goal.id} className="flex items-start gap-2 p-2 bg-white rounded border">
                          <CheckCircle className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{goal.description}</span>
                          {goal.isSmart && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">SMART</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Outcome Criteria</h4>
                    <p className="text-gray-900">{selectedPlan.outcomeCriteria || 'Not specified'}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Start Date</p>
                      <p className="font-medium">{selectedPlan.startDate}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Target Date</p>
                      <p className="font-medium">{selectedPlan.targetDate}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Last Updated</p>
                      <p className="font-medium">{selectedPlan.updatedDate}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'interventions' && (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(interventionCategoryConfig).map(([key, config]) => {
                      const count = selectedPlan.interventions.filter(i => i.category === key).length;
                      const Icon = config.icon;
                      return (<span key={key} className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${config.color}`}><Icon className="w-3 h-3" />{config.label} ({count})</span>);
                    })}
                  </div>
                  <div className="space-y-2">
                    {selectedPlan.interventions.map((intervention) => {
                      const CategoryIcon = interventionCategoryConfig[intervention.category]?.icon || Activity;
                      return (
                        <div key={intervention.id} className={`p-3 rounded-lg border ${intervention.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                          <div className="flex items-center gap-3">
                            {canUpdate && (
                              <button onClick={() => handleToggleIntervention(selectedPlan.id, intervention.id)} className="flex-shrink-0">
                                {intervention.status === 'completed' ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5 text-gray-400 hover:text-teal-600" />}
                              </button>
                            )}
                            <div className="flex-1">
                              <p className={`text-sm ${intervention.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>{intervention.description}</p>
                              {intervention.completedAt && <p className="text-xs text-gray-400 mt-1">Completed by {intervention.completedBy} at {new Date(intervention.completedAt).toLocaleString()}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs ${interventionCategoryConfig[intervention.category]?.color || 'bg-gray-100'}`}><CategoryIcon className="w-3 h-3 inline mr-1" />{interventionCategoryConfig[intervention.category]?.label}</span>
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{frequencyConfig[intervention.frequency]}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'evaluations' && (
                <div className="space-y-4">
                  {canUpdate && (
                    <button onClick={() => setShowEvaluationModal(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
                      <Plus className="w-4 h-4" />Add Evaluation
                    </button>
                  )}
                  {selectedPlan.evaluations.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPlan.evaluations.map((evaluation) => (
                        <div key={evaluation.id} className="p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-teal-600" />
                              <span className="font-medium text-gray-900">{evaluation.evaluator}</span>
                              <span className="text-sm text-gray-500">{new Date(evaluation.date).toLocaleDateString()}</span>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${goalStatusConfig[evaluation.goalStatus]?.color || 'bg-gray-100'}`}>{goalStatusConfig[evaluation.goalStatus]?.label}</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Progress Notes</p>
                              <p className="text-sm text-gray-900">{evaluation.progressNotes}</p>
                            </div>
                            {evaluation.nextSteps && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Next Steps</p>
                                <p className="text-sm text-gray-900">{evaluation.nextSteps}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No evaluations recorded yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Care Plan Templates</h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CARE_PLAN_TEMPLATES.map((template) => (
                  <button key={template.id} onClick={() => handleApplyTemplate(template)} className="p-4 border border-gray-200 rounded-lg text-left hover:border-teal-300 hover:bg-teal-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-teal-100 rounded-lg"><ClipboardList className="w-5 h-5 text-teal-600" /></div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        <p className="text-xs text-teal-600 mb-1">{template.category}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{template.nursingDiagnosis}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{template.goals.length} goals</span>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{template.interventions.length} interventions</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Modal */}
      {showEvaluationModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Evaluation</h2>
              <button onClick={() => setShowEvaluationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Goal Status *</label>
                <select value={evaluationData.goalStatus} onChange={(e) => setEvaluationData({ ...evaluationData, goalStatus: e.target.value as Evaluation['goalStatus'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="met">Met</option>
                  <option value="partially_met">Partially Met</option>
                  <option value="not_met">Not Met</option>
                  <option value="revised">Revised</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Progress Notes *</label>
                <textarea rows={4} value={evaluationData.progressNotes} onChange={(e) => setEvaluationData({ ...evaluationData, progressNotes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Document patient progress..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Next Steps</label>
                <textarea rows={2} value={evaluationData.nextSteps} onChange={(e) => setEvaluationData({ ...evaluationData, nextSteps: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Plan for next evaluation period..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowEvaluationModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddEvaluation} disabled={!evaluationData.progressNotes.trim()} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                <Save className="w-4 h-4" />Save Evaluation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Print Care Plan</h2>
              <button onClick={() => setShowPrintModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 print:p-0" id="print-content">
              <div className="space-y-4">
                <div className="text-center border-b pb-4">
                  <h1 className="text-xl font-bold">Nursing Care Plan</h1>
                  <p className="text-gray-500">Patient: {selectedPatient?.name} ({selectedPatient?.mrn})</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Diagnosis:</strong> {selectedPlan.nursingDiagnosis}</div>
                  <div><strong>Priority:</strong> {priorityConfig[selectedPlan.priority]?.label}</div>
                  <div><strong>Start Date:</strong> {selectedPlan.startDate}</div>
                  <div><strong>Target Date:</strong> {selectedPlan.targetDate}</div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Related To:</h3>
                  <p className="text-sm">{selectedPlan.relatedTo || 'Not specified'}</p>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Goals:</h3>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {selectedPlan.goals.map(goal => (<li key={goal.id}>{goal.description}</li>))}
                  </ul>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Interventions:</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Intervention</th>
                        <th className="border p-2 text-left">Category</th>
                        <th className="border p-2 text-left">Frequency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlan.interventions.map(int => (
                        <tr key={int.id}>
                          <td className="border p-2">{int.description}</td>
                          <td className="border p-2">{interventionCategoryConfig[int.category]?.label}</td>
                          <td className="border p-2">{frequencyConfig[int.frequency]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Outcome Criteria:</h3>
                  <p className="text-sm">{selectedPlan.outcomeCriteria || 'Not specified'}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t print:hidden">
              <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
                <Printer className="w-4 h-4" />Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
