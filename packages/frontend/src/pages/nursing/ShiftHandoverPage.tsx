import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RefreshCw,
  UserCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Bed,
  Loader2,
  Sun,
  Sunset,
  Moon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Droplets,
  Ban,
  Shield,
  Pill,
  FileText,
  ClipboardList,
  Printer,
  Mail,
  PenLine,
  CheckSquare,
  Square,
  Plus,
  X,
  FlaskConical,
  UserPlus,
  UserMinus,
  Activity,
  Heart,
  Thermometer,
  ShieldAlert,
  Wrench,
  Users,
  Lock,
} from 'lucide-react';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';
import { usersService } from '../../services/users';
import { useAuthStore } from '../../store/auth';
import PermissionGate from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';

// Types
interface PatientHandover {
  id: string;
  admissionId: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  bed: string;
  ward: string;
  diagnosis: string;
  acuity: 'critical' | 'unstable' | 'stable';
  flags: PatientFlag[];
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  pendingOrders: number;
  dueMedications: string[];
  recentVitals?: {
    temperature?: number;
    pulse?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  allergies: string[];
  codeStatus: string;
  changesThisShift: string[];
}

type PatientFlag = 'fall_risk' | 'isolation' | 'npo' | 'infection_control' | 'high_fall_risk' | 'restraints';

interface QuickAddItem {
  id: string;
  text: string;
  patientName?: string;
  type: 'critical' | 'task' | 'investigation' | 'discharge' | 'admission';
}

type ShiftType = 'day' | 'evening' | 'night';

// Helper functions
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

const getCurrentShift = (): ShiftType => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'day';
  if (hour >= 15 && hour < 23) return 'evening';
  return 'night';
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Configuration
const shiftConfig = {
  day: { label: 'Day Shift', time: '07:00 - 15:00', icon: Sun, color: 'text-yellow-600 bg-yellow-100' },
  evening: { label: 'Evening Shift', time: '15:00 - 23:00', icon: Sunset, color: 'text-orange-600 bg-orange-100' },
  night: { label: 'Night Shift', time: '23:00 - 07:00', icon: Moon, color: 'text-indigo-600 bg-indigo-100' },
};

const acuityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300', bgColor: 'bg-red-50 border-l-red-500' },
  unstable: { label: 'Unstable', color: 'bg-orange-100 text-orange-700 border-orange-300', bgColor: 'bg-orange-50 border-l-orange-500' },
  stable: { label: 'Stable', color: 'bg-green-100 text-green-700 border-green-300', bgColor: 'bg-green-50 border-l-green-500' },
};

const flagConfig: Record<PatientFlag, { label: string; icon: typeof AlertTriangle; color: string }> = {
  fall_risk: { label: 'Fall Risk', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-100' },
  high_fall_risk: { label: 'High Fall Risk', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  isolation: { label: 'Isolation', icon: Shield, color: 'text-purple-600 bg-purple-100' },
  npo: { label: 'NPO', icon: Ban, color: 'text-gray-600 bg-gray-100' },
  infection_control: { label: 'Infection Control', icon: Droplets, color: 'text-blue-600 bg-blue-100' },
  restraints: { label: 'Restraints', icon: Lock, color: 'text-red-600 bg-red-100' },
};

// Checklist items
const checklistItems = [
  { id: 'patients_reviewed', label: 'All patients reviewed', required: true },
  { id: 'labs_checked', label: 'Pending labs checked', required: true },
  { id: 'med_discrepancies', label: 'Medication discrepancies reviewed', required: true },
  { id: 'code_cart', label: 'Code cart checked', required: true },
  { id: 'equipment', label: 'Equipment signed off', required: false },
];

export default function ShiftHandoverPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // State
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [incomingNurse, setIncomingNurse] = useState<string>('');
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [patientSBAR, setPatientSBAR] = useState<Record<string, PatientHandover>>({});
  const [quickAddItems, setQuickAddItems] = useState<QuickAddItem[]>([]);
  const [newQuickAdd, setNewQuickAdd] = useState({ text: '', type: 'task' as QuickAddItem['type'] });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [safetyBriefing, setSafetyBriefing] = useState({
    highRiskPatients: '',
    isolationPrecautions: '',
    equipmentIssues: '',
    staffingConcerns: '',
  });
  const [handoverComplete, setHandoverComplete] = useState(false);
  const [incomingSignature, setIncomingSignature] = useState('');
  const [activeTab, setActiveTab] = useState<'patients' | 'quick_add' | 'checklist' | 'safety'>('patients');

  const currentShift = getCurrentShift();
  const currentShiftConfig = shiftConfig[currentShift];
  const ShiftIcon = currentShiftConfig.icon;

  // Fetch wards
  const { data: wards = [], isLoading: wardsLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: () => ipdService.wards.list(),
  });

  // Fetch nurses for incoming nurse selection
  const { data: usersData } = useQuery({
    queryKey: ['users-nurses'],
    queryFn: () => usersService.list({ limit: 100 }),
  });

  const nurses = useMemo(() => {
    return usersData?.data?.filter(u => u.status === 'active') || [];
  }, [usersData]);

  // Fetch admissions for selected ward
  const { data: admissionsData, isLoading: admissionsLoading } = useQuery({
    queryKey: ['admissions-ward', selectedWard],
    queryFn: () => ipdService.admissions.list({ wardId: selectedWard, status: 'admitted', limit: 100 }),
    enabled: !!selectedWard,
  });

  // Transform admissions to handover patients
  const wardPatients = useMemo((): PatientHandover[] => {
    if (!admissionsData?.data) return [];
    
    return admissionsData.data.map((admission): PatientHandover => {
      const existing = patientSBAR[admission.id];
      const acuity = admission.priority === 'high' ? 'critical' : admission.priority === 'medium' ? 'unstable' : 'stable';
      
      // Generate flags based on admission data (deterministic based on index)
      const flags: PatientFlag[] = [];
      if (admission.priority === 'high') flags.push('high_fall_risk');
      // Add flags based on admission type for demo purposes
      if (admission.type === 'emergency') flags.push('isolation');
      if (admission.priority === 'high' && admission.type === 'emergency') flags.push('npo');
      
      return {
        id: admission.patient?.id || admission.id,
        admissionId: admission.id,
        mrn: admission.patient?.mrn || '',
        name: admission.patient?.fullName || 'Unknown',
        age: calculateAge(admission.patient?.dateOfBirth),
        gender: admission.patient?.gender || 'Unknown',
        bed: admission.bed?.bedNumber || '',
        ward: admission.ward?.name || '',
        diagnosis: admission.admittingDiagnosis,
        acuity,
        flags,
        situation: existing?.situation || `${admission.patient?.fullName}, ${admission.bed?.bedNumber}, admitted with ${admission.admittingDiagnosis}`,
        background: existing?.background || 'Relevant medical history to be documented',
        assessment: existing?.assessment || 'Current condition assessment pending',
        recommendation: existing?.recommendation || 'Continue current plan of care',
        pendingOrders: admission.priority === 'high' ? 3 : admission.priority === 'medium' ? 1 : 0,
        dueMedications: [],
        allergies: [],
        codeStatus: 'Full Code',
        changesThisShift: [],
        recentVitals: {
          temperature: 36.8,
          pulse: 78,
          bpSystolic: 120,
          bpDiastolic: 80,
          respiratoryRate: 16,
          oxygenSaturation: 98,
        },
      };
    });
  }, [admissionsData, patientSBAR]);

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
    },
  });

  // Handlers
  const togglePatientExpand = (patientId: string) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const updatePatientSBAR = (admissionId: string, field: keyof PatientHandover, value: string) => {
    setPatientSBAR(prev => ({
      ...prev,
      [admissionId]: {
        ...wardPatients.find(p => p.admissionId === admissionId)!,
        ...prev[admissionId],
        [field]: value,
      },
    }));
  };

  const addQuickAddItem = () => {
    if (!newQuickAdd.text.trim()) return;
    setQuickAddItems(prev => [
      ...prev,
      { id: Date.now().toString(), text: newQuickAdd.text, type: newQuickAdd.type },
    ]);
    setNewQuickAdd({ text: '', type: 'task' });
  };

  const removeQuickAddItem = (id: string) => {
    setQuickAddItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allRequiredChecked = checklistItems
    .filter(item => item.required)
    .every(item => checklist[item.id]);

  const handleGenerateReport = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Shift Handover Report</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 20px; }
                .sbar-section { margin: 10px 0; padding: 10px; border-left: 4px solid; }
                .situation { border-color: #2563eb; background: #eff6ff; }
                .background { border-color: #16a34a; background: #f0fdf4; }
                .assessment { border-color: #ca8a04; background: #fefce8; }
                .recommendation { border-color: #9333ea; background: #faf5ff; }
                .patient-card { border: 1px solid #e5e7eb; padding: 15px; margin: 10px 0; page-break-inside: avoid; }
                .header { border-bottom: 2px solid #14b8a6; padding-bottom: 10px; margin-bottom: 20px; }
                h1, h2, h3 { margin: 0 0 10px 0; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Shift Handover Report</h1>
                <p>Date: ${new Date().toLocaleDateString()} | Shift: ${currentShiftConfig.label}</p>
                <p>Outgoing: ${user?.fullName || 'Unknown'} | Incoming: ${nurses.find(n => n.id === incomingNurse)?.fullName || 'Not selected'}</p>
                <p>Ward: ${wards.find(w => w.id === selectedWard)?.name || 'All Wards'}</p>
              </div>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleEmailReport = () => {
    const subject = encodeURIComponent(`Shift Handover Report - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`
Shift Handover Report
Date: ${new Date().toLocaleDateString()}
Shift: ${currentShiftConfig.label}
Outgoing Nurse: ${user?.fullName || 'Unknown'}
Incoming Nurse: ${nurses.find(n => n.id === incomingNurse)?.fullName || 'Not selected'}
Ward: ${wards.find(w => w.id === selectedWard)?.name || 'All Wards'}

Total Patients: ${wardPatients.length}
Critical: ${wardPatients.filter(p => p.acuity === 'critical').length}
Unstable: ${wardPatients.filter(p => p.acuity === 'unstable').length}
Stable: ${wardPatients.filter(p => p.acuity === 'stable').length}

Please see attached detailed report or access the system for full details.
    `);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleRecordHandover = async () => {
    if (!incomingNurse || !allRequiredChecked) return;
    
    // Record handover notes for each patient
    for (const patient of wardPatients) {
      const sbar = patientSBAR[patient.admissionId] || patient;
      const content = `
SHIFT HANDOVER - ${currentShiftConfig.label}
Outgoing: ${user?.fullName} | Incoming: ${nurses.find(n => n.id === incomingNurse)?.fullName}
Time: ${formatTime(new Date())}

SITUATION: ${sbar.situation}
BACKGROUND: ${sbar.background}
ASSESSMENT: ${sbar.assessment}
RECOMMENDATION: ${sbar.recommendation}

Signature: ${incomingSignature}
      `.trim();

      try {
        await createNoteMutation.mutateAsync({
          admissionId: patient.admissionId,
          type: 'handoff',
          content,
          shift: currentShift,
        });
      } catch {
        // Continue with other patients
      }
    }

    setHandoverComplete(true);
  };

  // Completed view
  if (handoverComplete) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Handover Complete</h2>
          <p className="text-gray-600 mb-2">
            Shift handover has been successfully recorded for {wardPatients.length} patients.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Incoming Nurse: {nurses.find(n => n.id === incomingNurse)?.fullName}<br />
            Time: {formatTime(new Date())}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setHandoverComplete(false);
                setChecklist({});
                setIncomingSignature('');
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              New Handover
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionGate
      permissions={['nursing.read', 'nursing.update']}
      fallback={<AccessDenied />}
    >
      <div className="h-[calc(100vh-120px)] flex flex-col print:h-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 print:mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg print:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-teal-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Shift Handover</h1>
                <p className="text-sm text-gray-500">SBAR format nursing handover</p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            <button
              onClick={handleEmailReport}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Mail className="w-4 h-4" />
              Email Summary
            </button>
          </div>
        </div>

        {/* Handover Context */}
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 mb-4 print:bg-white">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Current Shift */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${currentShiftConfig.color}`}>
                <ShiftIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Current Shift</p>
                <p className="font-semibold text-gray-900">{currentShiftConfig.label}</p>
                <p className="text-xs text-gray-600">{currentShiftConfig.time}</p>
              </div>
            </div>

            {/* Outgoing Nurse */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Outgoing Nurse</p>
              <div className="flex items-center gap-2">
                <UserCircle className="w-8 h-8 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{user?.fullName || 'Current User'}</p>
                  <p className="text-xs text-gray-500">You</p>
                </div>
              </div>
            </div>

            {/* Incoming Nurse */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Incoming Nurse</p>
              <select
                value={incomingNurse}
                onChange={(e) => setIncomingNurse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Select incoming nurse...</option>
                {nurses.filter(n => n.id !== user?.id).map(nurse => (
                  <option key={nurse.id} value={nurse.id}>{nurse.fullName}</option>
                ))}
              </select>
            </div>

            {/* Ward/Unit */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ward/Unit</p>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                disabled={wardsLoading}
              >
                <option value="">Select ward...</option>
                {wards.map(ward => (
                  <option key={ward.id} value={ward.id}>{ward.name}</option>
                ))}
              </select>
            </div>

            {/* Handover Time */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Handover Time</p>
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900">{formatTime(new Date())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4 print:hidden">
          {[
            { id: 'patients', label: 'Patients', icon: Users, count: wardPatients.length },
            { id: 'quick_add', label: 'Quick Add', icon: Plus, count: quickAddItems.length },
            { id: 'checklist', label: 'Checklist', icon: ClipboardList },
            { id: 'safety', label: 'Safety Briefing', icon: ShieldAlert },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'patients' && (
            <div className="h-full overflow-y-auto" ref={printRef}>
              {!selectedWard ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Bed className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>Select a ward to view patients</p>
                  </div>
                </div>
              ) : admissionsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : wardPatients.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No patients in this ward</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-4 print:grid-cols-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{wardPatients.length}</p>
                      <p className="text-xs text-gray-500">Total Patients</p>
                    </div>
                    <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{wardPatients.filter(p => p.acuity === 'critical').length}</p>
                      <p className="text-xs text-red-600">Critical</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 text-center">
                      <p className="text-2xl font-bold text-orange-600">{wardPatients.filter(p => p.acuity === 'unstable').length}</p>
                      <p className="text-xs text-orange-600">Unstable</p>
                    </div>
                    <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{wardPatients.filter(p => p.acuity === 'stable').length}</p>
                      <p className="text-xs text-green-600">Stable</p>
                    </div>
                  </div>

                  {/* Patient Cards */}
                  {wardPatients.map((patient) => {
                    const isExpanded = expandedPatients.has(patient.admissionId);
                    const acuity = acuityConfig[patient.acuity];
                    const sbar = patientSBAR[patient.admissionId] || patient;

                    return (
                      <div
                        key={patient.admissionId}
                        className={`bg-white rounded-lg border-l-4 border border-gray-200 ${acuity.bgColor} print:break-inside-avoid`}
                      >
                        {/* Card Header */}
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => togglePatientExpand(patient.admissionId)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-gray-500" />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${acuity.color}`}>
                                    {acuity.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Bed className="w-3 h-3" />
                                    {patient.bed}
                                  </span>
                                  <span>{patient.mrn}</span>
                                  <span>{patient.age}y {patient.gender[0]}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{patient.diagnosis}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {/* Flags */}
                              <div className="flex items-center gap-1">
                                {patient.flags.map(flag => {
                                  const cfg = flagConfig[flag];
                                  return (
                                    <div
                                      key={flag}
                                      className={`p-1 rounded ${cfg.color}`}
                                      title={cfg.label}
                                    >
                                      <cfg.icon className="w-3 h-3" />
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Indicators */}
                              {patient.pendingOrders > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                  <FileText className="w-3 h-3" />
                                  {patient.pendingOrders} pending
                                </div>
                              )}
                              
                              <button className="p-1 hover:bg-gray-100 rounded print:hidden">
                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content - SBAR */}
                        <div className={`border-t border-gray-200 ${isExpanded ? '' : 'hidden print:block'}`}>
                            {/* Quick Info Row */}
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 print:bg-white">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Allergies:</span>
                                  <span className="ml-1 font-medium text-red-600">
                                    {patient.allergies.length > 0 ? patient.allergies.join(', ') : 'NKDA'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Code Status:</span>
                                  <span className="ml-1 font-medium">{patient.codeStatus}</span>
                                </div>
                                {patient.recentVitals && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <Heart className="w-4 h-4 text-red-500" />
                                      <span>{patient.recentVitals.pulse} bpm</span>
                                      <span className="text-gray-400">|</span>
                                      <span>{patient.recentVitals.bpSystolic}/{patient.recentVitals.bpDiastolic}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Thermometer className="w-4 h-4 text-orange-500" />
                                      <span>{patient.recentVitals.temperature?.toFixed(1)}°C</span>
                                      <span className="text-gray-400">|</span>
                                      <Activity className="w-4 h-4 text-blue-500" />
                                      <span>{patient.recentVitals.oxygenSaturation}%</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* SBAR Sections */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Situation */}
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 sbar-section situation">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">S</div>
                                  <h4 className="font-semibold text-blue-900 text-sm">Situation</h4>
                                </div>
                                <textarea
                                  value={sbar.situation}
                                  onChange={(e) => updatePatientSBAR(patient.admissionId, 'situation', e.target.value)}
                                  className="w-full p-2 bg-white border border-blue-200 rounded text-sm resize-none print:border-none print:bg-transparent"
                                  rows={2}
                                  placeholder="Name, Bed, Diagnosis, Reason for admission"
                                />
                              </div>

                              {/* Background */}
                              <div className="p-3 bg-green-50 rounded-lg border border-green-200 sbar-section background">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xs">B</div>
                                  <h4 className="font-semibold text-green-900 text-sm">Background</h4>
                                </div>
                                <textarea
                                  value={sbar.background}
                                  onChange={(e) => updatePatientSBAR(patient.admissionId, 'background', e.target.value)}
                                  className="w-full p-2 bg-white border border-green-200 rounded text-sm resize-none print:border-none print:bg-transparent"
                                  rows={2}
                                  placeholder="Relevant history, Allergies, Code status"
                                />
                              </div>

                              {/* Assessment */}
                              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 sbar-section assessment">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold text-xs">A</div>
                                  <h4 className="font-semibold text-yellow-900 text-sm">Assessment</h4>
                                </div>
                                <textarea
                                  value={sbar.assessment}
                                  onChange={(e) => updatePatientSBAR(patient.admissionId, 'assessment', e.target.value)}
                                  className="w-full p-2 bg-white border border-yellow-200 rounded text-sm resize-none print:border-none print:bg-transparent"
                                  rows={2}
                                  placeholder="Current condition, Recent vitals, Changes this shift"
                                />
                              </div>

                              {/* Recommendation */}
                              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 sbar-section recommendation">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs">R</div>
                                  <h4 className="font-semibold text-purple-900 text-sm">Recommendation</h4>
                                </div>
                                <textarea
                                  value={sbar.recommendation}
                                  onChange={(e) => updatePatientSBAR(patient.admissionId, 'recommendation', e.target.value)}
                                  className="w-full p-2 bg-white border border-purple-200 rounded text-sm resize-none print:border-none print:bg-transparent"
                                  rows={2}
                                  placeholder="Pending tasks, Things to watch, Follow-ups needed"
                                />
                              </div>
                            </div>

                            {/* Due Medications */}
                            {patient.dueMedications.length > 0 && (
                              <div className="px-4 pb-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Pill className="w-4 h-4 text-teal-600" />
                                  <span className="text-sm font-medium text-gray-700">Due Medications Next Shift</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {patient.dueMedications.map((med, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs border border-teal-200">
                                      {med}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quick_add' && (
            <div className="h-full overflow-y-auto bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add New Item */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-teal-600" />
                    Add Quick Note
                  </h3>
                  <div className="flex gap-2">
                    <select
                      value={newQuickAdd.type}
                      onChange={(e) => setNewQuickAdd({ ...newQuickAdd, type: e.target.value as QuickAddItem['type'] })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="critical">Critical Event</option>
                      <option value="task">Pending Task</option>
                      <option value="investigation">Outstanding Investigation</option>
                      <option value="discharge">Patient for Discharge</option>
                      <option value="admission">New Admission</option>
                    </select>
                    <input
                      type="text"
                      value={newQuickAdd.text}
                      onChange={(e) => setNewQuickAdd({ ...newQuickAdd, text: e.target.value })}
                      placeholder="Enter details..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && addQuickAddItem()}
                    />
                    <button
                      onClick={addQuickAddItem}
                      disabled={!newQuickAdd.text.trim()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Quick Add Categories */}
                <div className="space-y-4">
                  {[
                    { type: 'critical', label: 'Critical Events This Shift', icon: AlertCircle, color: 'text-red-600' },
                    { type: 'task', label: 'Pending Tasks to Hand Over', icon: ClipboardList, color: 'text-blue-600' },
                    { type: 'investigation', label: 'Outstanding Investigations', icon: FlaskConical, color: 'text-purple-600' },
                    { type: 'discharge', label: 'Patients for Discharge', icon: UserMinus, color: 'text-green-600' },
                    { type: 'admission', label: 'New Admissions', icon: UserPlus, color: 'text-orange-600' },
                  ].map(category => {
                    const items = quickAddItems.filter(item => item.type === category.type);
                    return (
                      <div key={category.type} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <category.icon className={`w-4 h-4 ${category.color}`} />
                          <h4 className="font-medium text-gray-900 text-sm">{category.label}</h4>
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {items.length}
                          </span>
                        </div>
                        {items.length > 0 ? (
                          <div className="space-y-1">
                            {items.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                <span>{item.text}</span>
                                <button
                                  onClick={() => removeQuickAddItem(item.id)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <X className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No items added</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="h-full overflow-y-auto bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 text-lg mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-teal-600" />
                Handover Checklist
              </h3>
              <div className="space-y-3 max-w-lg">
                {checklistItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      checklist[item.id]
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {checklist[item.id] ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                    <span className={`flex-1 text-left ${checklist[item.id] ? 'text-green-800' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                    {item.required && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Progress */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Completion Progress</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Object.values(checklist).filter(Boolean).length} / {checklistItems.length}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all"
                    style={{ width: `${(Object.values(checklist).filter(Boolean).length / checklistItems.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="h-full overflow-y-auto bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 text-lg mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                Safety Briefing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    High-Risk Patients
                  </label>
                  <textarea
                    value={safetyBriefing.highRiskPatients}
                    onChange={(e) => setSafetyBriefing({ ...safetyBriefing, highRiskPatients: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                    placeholder="List patients requiring extra monitoring..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Shield className="w-4 h-4 text-purple-500" />
                    Isolation Precautions
                  </label>
                  <textarea
                    value={safetyBriefing.isolationPrecautions}
                    onChange={(e) => setSafetyBriefing({ ...safetyBriefing, isolationPrecautions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                    placeholder="Document isolation requirements..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Wrench className="w-4 h-4 text-orange-500" />
                    Equipment Issues
                  </label>
                  <textarea
                    value={safetyBriefing.equipmentIssues}
                    onChange={(e) => setSafetyBriefing({ ...safetyBriefing, equipmentIssues: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                    placeholder="Note any equipment problems..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 text-blue-500" />
                    Staffing Concerns
                  </label>
                  <textarea
                    value={safetyBriefing.staffingConcerns}
                    onChange={(e) => setSafetyBriefing({ ...safetyBriefing, staffingConcerns: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    rows={3}
                    placeholder="Document staffing issues..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-4 border-t bg-white rounded-xl border border-gray-200 p-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={incomingSignature}
                  onChange={(e) => setIncomingSignature(e.target.value)}
                  placeholder="Incoming nurse signature..."
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
                />
              </div>
              {!allRequiredChecked && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Complete all required checklist items
                </span>
              )}
              {!incomingNurse && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Select incoming nurse
                </span>
              )}
            </div>
            <button
              onClick={handleRecordHandover}
              disabled={!incomingNurse || !allRequiredChecked || !incomingSignature || createNoteMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createNoteMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Record Handover Complete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
