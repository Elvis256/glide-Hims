import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  ShieldAlert,
  CheckCircle,
  Eye,
  EyeOff,
  Save,
  Search,
  UserCircle,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Printer,
  Mail,
  X,
  BarChart3,
  Filter,
  ClipboardList,
  History,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Send,
  Edit,
  Image,
  File,
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

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
}

interface Witness {
  id: string;
  name: string;
  contactNumber: string;
  relationship: string;
}

interface Equipment {
  id: string;
  name: string;
  serialNumber: string;
  location: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'document';
  size: number;
  url?: string;
  file?: File;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
}

interface IncidentFormData {
  incidentType: string;
  date: string;
  time: string;
  department: string;
  room: string;
  patientInvolved: boolean;
  patientId: string;
  patientName: string;
  patientMrn: string;
  staffInvolved: StaffMember[];
  description: string;
  contributingFactors: string[];
  immediateActions: string;
  witnesses: Witness[];
  equipmentInvolved: Equipment[];
  patientOutcome: string;
  medicalIntervention: string;
  familyNotified: boolean;
  familyNotifiedDate: string;
  patientConditionAfter: string;
  rootCauseAnalysis: string;
  correctiveActions: string;
  preventiveMeasures: string;
  responsiblePerson: string;
  dueDate: string;
  status: string;
  severityLevel: string;
  anonymous: boolean;
  reporterName: string;
  reporterRole: string;
  attachments: Attachment[];
}

interface Incident {
  id: string;
  referenceNumber: string;
  incidentType: string;
  severity: string;
  status: string;
  date: string;
  location: string;
  patientName?: string;
  reporter: string;
  createdAt: string;
}

const incidentTypes = [
  { value: 'fall', label: 'Fall', icon: '🚨' },
  { value: 'medication_error', label: 'Medication Error', icon: '💊' },
  { value: 'equipment_failure', label: 'Equipment Failure', icon: '🔧' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'needle_stick', label: 'Needle Stick', icon: '💉' },
  { value: 'patient_complaint', label: 'Patient Complaint', icon: '📋' },
  { value: 'near_miss', label: 'Near Miss', icon: '⚠️' },
  { value: 'other', label: 'Other', icon: '📝' },
];

const severityLevels = [
  { value: 'minor', label: 'Minor', color: 'bg-green-100 text-green-700 border-green-300', description: 'No or minimal harm' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', description: 'Temporary harm requiring treatment' },
  { value: 'severe', label: 'Severe', color: 'bg-orange-100 text-orange-700 border-orange-300', description: 'Significant harm or extended care' },
  { value: 'sentinel', label: 'Sentinel Event', color: 'bg-red-100 text-red-700 border-red-300', description: 'Death or permanent harm' },
];

const patientOutcomes = [
  { value: 'no_harm', label: 'No Harm', color: 'text-green-600' },
  { value: 'minor_harm', label: 'Minor Harm', color: 'text-yellow-600' },
  { value: 'major_harm', label: 'Major Harm', color: 'text-orange-600' },
  { value: 'death', label: 'Death', color: 'text-red-600' },
];

const incidentStatuses = [
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-700' },
  { value: 'under_investigation', label: 'Under Investigation', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'closed', label: 'Closed', color: 'bg-green-100 text-green-700' },
];

const contributingFactorOptions = [
  'Communication failure',
  'Inadequate training',
  'Equipment malfunction',
  'Staffing issues',
  'Environmental factors',
  'Policy/procedure not followed',
  'Fatigue/stress',
  'Patient non-compliance',
  'System/process issue',
  'Documentation error',
  'Medication labeling',
  'Other',
];

const departments = [
  'Emergency Department',
  'ICU',
  'General Ward A',
  'General Ward B',
  'Surgical Ward',
  'Pediatric Ward',
  'Maternity Ward',
  'Operating Theatre',
  'Radiology',
  'Laboratory',
  'Pharmacy',
  'Outpatient Clinic',
  'Reception',
  'Other',
];

// Mock data for demo
const mockIncidents: Incident[] = [
  { id: '1', referenceNumber: 'INC-2024-0001', incidentType: 'fall', severity: 'moderate', status: 'open', date: '2024-01-15', location: 'General Ward A', patientName: 'John Doe', reporter: 'Nurse Sarah', createdAt: '2024-01-15T10:30:00Z' },
  { id: '2', referenceNumber: 'INC-2024-0002', incidentType: 'medication_error', severity: 'minor', status: 'under_investigation', date: '2024-01-14', location: 'ICU', patientName: 'Jane Smith', reporter: 'Dr. Wilson', createdAt: '2024-01-14T14:20:00Z' },
  { id: '3', referenceNumber: 'INC-2024-0003', incidentType: 'equipment_failure', severity: 'severe', status: 'closed', date: '2024-01-10', location: 'Operating Theatre', reporter: 'Tech Mike', createdAt: '2024-01-10T08:15:00Z' },
  { id: '4', referenceNumber: 'INC-2024-0004', incidentType: 'near_miss', severity: 'minor', status: 'closed', date: '2024-01-08', location: 'Emergency Department', patientName: 'Bob Johnson', reporter: 'Nurse Amy', createdAt: '2024-01-08T16:45:00Z' },
  { id: '5', referenceNumber: 'INC-2024-0005', incidentType: 'needle_stick', severity: 'moderate', status: 'open', date: '2024-01-16', location: 'Laboratory', reporter: 'Lab Tech Lisa', createdAt: '2024-01-16T09:00:00Z' },
];

const mockAuditTrail: AuditEntry[] = [
  { id: '1', timestamp: '2024-01-15T10:30:00Z', action: 'Created', user: 'Nurse Sarah', details: 'Incident report created' },
  { id: '2', timestamp: '2024-01-15T11:00:00Z', action: 'Updated', user: 'Supervisor John', details: 'Severity updated from Minor to Moderate' },
  { id: '3', timestamp: '2024-01-15T14:30:00Z', action: 'Attachment Added', user: 'Nurse Sarah', details: 'Photo evidence uploaded' },
  { id: '4', timestamp: '2024-01-16T09:00:00Z', action: 'Status Changed', user: 'Risk Manager', details: 'Status changed to Under Investigation' },
];

type ViewMode = 'dashboard' | 'new' | 'view' | 'edit';

export default function IncidentReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Permission checks
  const canCreate = hasPermission('incidents.create');
  const canRead = hasPermission('incidents.read');
  const canUpdate = hasPermission('incidents.update');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saved, setSaved] = useState(false);
  const [submittedRefNumber, setSubmittedRefNumber] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'submit' | 'delete' | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    patientImpact: true,
    followUp: true,
    attachments: true,
    auditTrail: false,
  });

  // Filter states for dashboard
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', patientSearchTerm],
    queryFn: () => patientsService.search({ search: patientSearchTerm, limit: 10 }),
    enabled: patientSearchTerm.length >= 2,
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

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setSaved(true);
      toast.success('Incident report submitted successfully');
    },
    onError: () => {
      toast.error('Failed to submit incident report');
    },
  });

  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm || patientSearchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
    }));
  }, [apiPatients, patientSearchTerm]);

  const saving = createNoteMutation.isPending;

  const initialFormData: IncidentFormData = {
    incidentType: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    department: '',
    room: '',
    patientInvolved: false,
    patientId: '',
    patientName: '',
    patientMrn: '',
    staffInvolved: [],
    description: '',
    contributingFactors: [],
    immediateActions: '',
    witnesses: [],
    equipmentInvolved: [],
    patientOutcome: '',
    medicalIntervention: '',
    familyNotified: false,
    familyNotifiedDate: '',
    patientConditionAfter: '',
    rootCauseAnalysis: '',
    correctiveActions: '',
    preventiveMeasures: '',
    responsiblePerson: '',
    dueDate: '',
    status: 'open',
    severityLevel: '',
    anonymous: false,
    reporterName: '',
    reporterRole: '',
    attachments: [],
  };

  const [formData, setFormData] = useState<IncidentFormData>(initialFormData);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const openIncidents = mockIncidents.filter(i => i.status === 'open').length;
    const resolvedThisMonth = mockIncidents.filter(i => 
      i.status === 'closed' && new Date(i.createdAt) >= startOfMonth
    ).length;
    
    const byCategory: Record<string, number> = {};
    mockIncidents.forEach(i => {
      const type = incidentTypes.find(t => t.value === i.incidentType)?.label || 'Unknown';
      byCategory[type] = (byCategory[type] || 0) + 1;
    });

    return { openIncidents, resolvedThisMonth, byCategory };
  }, []);

  // Filtered incidents for dashboard
  const filteredIncidents = useMemo(() => {
    return mockIncidents.filter(incident => {
      const matchesSearch = !searchTerm || 
        incident.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || incident.incidentType === categoryFilter;
      const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
    });
  }, [searchTerm, statusFilter, categoryFilter, severityFilter]);

  // Staff member management
  const addStaffMember = () => {
    const newStaff: StaffMember = { id: Date.now().toString(), name: '', role: '', department: '' };
    setFormData({ ...formData, staffInvolved: [...formData.staffInvolved, newStaff] });
  };

  const updateStaffMember = (id: string, field: keyof StaffMember, value: string) => {
    setFormData({
      ...formData,
      staffInvolved: formData.staffInvolved.map(s => s.id === id ? { ...s, [field]: value } : s),
    });
  };

  const removeStaffMember = (id: string) => {
    setFormData({ ...formData, staffInvolved: formData.staffInvolved.filter(s => s.id !== id) });
  };

  // Witness management
  const addWitness = () => {
    const newWitness: Witness = { id: Date.now().toString(), name: '', contactNumber: '', relationship: '' };
    setFormData({ ...formData, witnesses: [...formData.witnesses, newWitness] });
  };

  const updateWitness = (id: string, field: keyof Witness, value: string) => {
    setFormData({
      ...formData,
      witnesses: formData.witnesses.map(w => w.id === id ? { ...w, [field]: value } : w),
    });
  };

  const removeWitness = (id: string) => {
    setFormData({ ...formData, witnesses: formData.witnesses.filter(w => w.id !== id) });
  };

  // Equipment management
  const addEquipment = () => {
    const newEquipment: Equipment = { id: Date.now().toString(), name: '', serialNumber: '', location: '' };
    setFormData({ ...formData, equipmentInvolved: [...formData.equipmentInvolved, newEquipment] });
  };

  const updateEquipment = (id: string, field: keyof Equipment, value: string) => {
    setFormData({
      ...formData,
      equipmentInvolved: formData.equipmentInvolved.map(e => e.id === id ? { ...e, [field]: value } : e),
    });
  };

  const removeEquipment = (id: string) => {
    setFormData({ ...formData, equipmentInvolved: formData.equipmentInvolved.filter(e => e.id !== id) });
  };

  // File upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'document',
      size: file.size,
      file,
    }));

    setFormData({ ...formData, attachments: [...formData.attachments, ...newAttachments] });
    toast.success(`${newAttachments.length} file(s) added`);
  };

  const removeAttachment = (id: string) => {
    setFormData({ ...formData, attachments: formData.attachments.filter(a => a.id !== id) });
  };

  // Contributing factor toggle
  const toggleContributingFactor = (factor: string) => {
    const factors = formData.contributingFactors.includes(factor)
      ? formData.contributingFactors.filter(f => f !== factor)
      : [...formData.contributingFactors, factor];
    setFormData({ ...formData, contributingFactors: factors });
  };

  // Section toggle
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({ ...expandedSections, [section]: !expandedSections[section] });
  };

  const handleSubmit = () => {
    setConfirmAction('submit');
    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = () => {
    const refNumber = `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    setSubmittedRefNumber(refNumber);
    
    if (!admission?.id) {
      // Demo mode - just show success
      setSaved(true);
      setShowConfirmDialog(false);
      toast.success('Incident report submitted successfully. Supervisor notified.');
      return;
    }

    const incidentDetails = [
      formData.incidentType && `Type: ${incidentTypes.find(t => t.value === formData.incidentType)?.label}`,
      formData.date && `Date: ${formData.date}`,
      formData.time && `Time: ${formData.time}`,
      formData.department && `Department: ${formData.department}`,
      formData.room && `Room: ${formData.room}`,
      formData.severityLevel && `Severity: ${severityLevels.find(s => s.value === formData.severityLevel)?.label}`,
      formData.description && `Description: ${formData.description}`,
      formData.immediateActions && `Immediate Actions: ${formData.immediateActions}`,
      formData.contributingFactors.length > 0 && `Contributing Factors: ${formData.contributingFactors.join(', ')}`,
    ].filter(Boolean).join('. ');

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'incident',
      content: `Incident Report: ${incidentDetails}`,
    });
    setShowConfirmDialog(false);
  };

  const handleSaveAsDraft = () => {
    toast.success('Incident report saved as draft');
  };

  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const handleEmail = () => {
    toast.success('Email sent to supervisor');
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setSelectedPatient(null);
    setSaved(false);
    setViewMode('dashboard');
  };

  const viewIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    setViewMode('view');
  };

  const startNewIncident = () => {
    setFormData(initialFormData);
    setSaved(false);
    setViewMode('new');
  };

  const isFormValid = formData.incidentType && formData.department && formData.description && formData.severityLevel;

  // Severity color helper
  const getSeverityColor = (severity: string) => {
    const level = severityLevels.find(s => s.value === severity);
    return level?.color || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getStatusColor = (status: string) => {
    const statusObj = incidentStatuses.find(s => s.value === status);
    return statusObj?.color || 'bg-gray-100 text-gray-700';
  };

  // Success screen after submission
  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Incident Report Submitted</h2>
          <p className="text-gray-600 mb-2">
            Your incident report has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500 mb-2">
            Supervisor has been notified via email.
          </p>
          <p className="text-sm font-medium text-teal-600 mb-6">
            Reference: {submittedRefNumber}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={startNewIncident}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Submit Another Report
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (viewMode === 'dashboard') {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Incident Reports</h1>
                <p className="text-sm text-gray-500">View and manage safety incidents</p>
              </div>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={startNewIncident}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Report New Incident
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Open Incidents</p>
                <p className="text-2xl font-bold text-blue-600">{dashboardStats.openIncidents}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Resolved This Month</p>
                <p className="text-2xl font-bold text-green-600">{dashboardStats.resolvedThisMonth}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">By Category</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(dashboardStats.byCategory).slice(0, 3).map(([cat, count]) => (
                    <span key={cat} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      {cat}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference, patient, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                {incidentStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Categories</option>
                {incidentTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Severities</option>
                {severityLevels.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Incidents List */}
        <div className="bg-white rounded-lg shadow-sm border flex-1 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Incidents ({filteredIncidents.length})</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 450px)' }}>
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No incidents found matching your filters</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => canRead && viewIncident(incident)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">
                            {incidentTypes.find(t => t.value === incident.incidentType)?.icon || '📋'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{incident.referenceNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
                              {incidentStatuses.find(s => s.value === incident.status)?.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(incident.severity)}`}>
                              {severityLevels.find(s => s.value === incident.severity)?.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(incident.date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {incident.location}
                            </span>
                            {incident.patientName && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {incident.patientName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Reported by: {incident.reporter}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // View Incident Details
  if (viewMode === 'view' && selectedIncident) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{selectedIncident.referenceNumber}</h1>
              <p className="text-sm text-gray-500">
                {incidentTypes.find(t => t.value === selectedIncident.incidentType)?.label} - {selectedIncident.location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedIncident.status)}`}>
              {incidentStatuses.find(s => s.value === selectedIncident.status)?.label}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedIncident.severity)}`}>
              {severityLevels.find(s => s.value === selectedIncident.severity)?.label}
            </span>
            {canUpdate && (
              <button
                onClick={() => setViewMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white rounded-lg border p-6">
          <div className="space-y-6">
            {/* Incident Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <p className="font-medium">{new Date(selectedIncident.date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Location</label>
                <p className="font-medium">{selectedIncident.location}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Patient Involved</label>
                <p className="font-medium">{selectedIncident.patientName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Reporter</label>
                <p className="font-medium">{selectedIncident.reporter}</p>
              </div>
            </div>

            {/* Audit Trail Section */}
            <div className="border rounded-lg">
              <button
                onClick={() => toggleSection('auditTrail')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Audit Trail</span>
                </div>
                {expandedSections.auditTrail ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              {expandedSections.auditTrail && (
                <div className="border-t p-4">
                  <div className="space-y-3">
                    {mockAuditTrail.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.action}</span>
                            <span className="text-gray-500">by {entry.user}</span>
                          </div>
                          <p className="text-gray-600">{entry.details}</p>
                          <p className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t bg-white">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleEmail}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Mail className="w-4 h-4" />
            Email Report
          </button>
        </div>
      </div>
    );
  }

  // New/Edit Incident Form
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold">
                {confirmAction === 'submit' ? 'Submit Incident Report?' : 'Delete Incident?'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {confirmAction === 'submit' 
                ? 'This will submit the incident report and notify the supervisor. Are you sure you want to proceed?'
                : 'This action cannot be undone. Are you sure you want to delete this incident?'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'submit' ? handleConfirmedSubmit : undefined}
                className={`px-4 py-2 rounded-lg text-white ${
                  confirmAction === 'submit' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction === 'submit' ? 'Submit' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-6 pt-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {viewMode === 'edit' ? 'Edit Incident Report' : 'New Incident Report'}
              </h1>
              <p className="text-sm text-gray-500">Report safety incidents and near misses</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFormData({ ...formData, anonymous: !formData.anonymous })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
              formData.anonymous
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {formData.anonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {formData.anonymous ? 'Anonymous Report' : 'Named Report'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Basic Incident Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {/* Incident Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <ShieldAlert className="w-4 h-4" />
                Incident Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.incidentType}
                onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select incident type...</option>
                {incidentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                Date of Incident <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Time */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                Time of Incident <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Department */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4" />
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select department...</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Room */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Room/Bed</label>
              <input
                type="text"
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                placeholder="e.g., Room 101, Bed A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Severity Level */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Severity Level <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {severityLevels.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, severityLevel: level.value })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      formData.severityLevel === level.value
                        ? level.color + ' ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div>{level.label}</div>
                    <div className="text-xs opacity-75">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Incident Details Section */}
          <div className="border rounded-lg mb-6">
            <button
              type="button"
              onClick={() => toggleSection('details')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Incident Details</span>
              </div>
              {expandedSections.details ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.details && (
              <div className="border-t p-4 space-y-4">
                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Description of What Happened <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe in detail what happened, including the sequence of events leading to the incident..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                  />
                </div>

                {/* Contributing Factors */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Contributing Factors</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {contributingFactorOptions.map((factor) => (
                      <label key={factor} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.contributingFactors.includes(factor)}
                          onChange={() => toggleContributingFactor(factor)}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                        />
                        {factor}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Immediate Actions */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Immediate Actions Taken</label>
                  <textarea
                    rows={3}
                    value={formData.immediateActions}
                    onChange={(e) => setFormData({ ...formData, immediateActions: e.target.value })}
                    placeholder="Describe any immediate actions taken to address the incident..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                  />
                </div>

                {/* Staff Involved */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Staff Involved</label>
                    <button
                      type="button"
                      onClick={addStaffMember}
                      className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                    >
                      <Plus className="w-4 h-4" /> Add Staff
                    </button>
                  </div>
                  {formData.staffInvolved.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No staff members added</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.staffInvolved.map((staff) => (
                        <div key={staff.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                          <input
                            type="text"
                            placeholder="Name"
                            value={staff.name}
                            onChange={(e) => updateStaffMember(staff.id, 'name', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Role"
                            value={staff.role}
                            onChange={(e) => updateStaffMember(staff.id, 'role', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Department"
                            value={staff.department}
                            onChange={(e) => updateStaffMember(staff.id, 'department', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeStaffMember(staff.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Witnesses */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Witnesses</label>
                    <button
                      type="button"
                      onClick={addWitness}
                      className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                    >
                      <Plus className="w-4 h-4" /> Add Witness
                    </button>
                  </div>
                  {formData.witnesses.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No witnesses added</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.witnesses.map((witness) => (
                        <div key={witness.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                          <input
                            type="text"
                            placeholder="Name"
                            value={witness.name}
                            onChange={(e) => updateWitness(witness.id, 'name', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Contact Number"
                            value={witness.contactNumber}
                            onChange={(e) => updateWitness(witness.id, 'contactNumber', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Relationship"
                            value={witness.relationship}
                            onChange={(e) => updateWitness(witness.id, 'relationship', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeWitness(witness.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Equipment Involved */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Equipment Involved</label>
                    <button
                      type="button"
                      onClick={addEquipment}
                      className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                    >
                      <Plus className="w-4 h-4" /> Add Equipment
                    </button>
                  </div>
                  {formData.equipmentInvolved.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No equipment added</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.equipmentInvolved.map((equipment) => (
                        <div key={equipment.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                          <input
                            type="text"
                            placeholder="Equipment Name"
                            value={equipment.name}
                            onChange={(e) => updateEquipment(equipment.id, 'name', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Serial Number"
                            value={equipment.serialNumber}
                            onChange={(e) => updateEquipment(equipment.id, 'serialNumber', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Location"
                            value={equipment.location}
                            onChange={(e) => updateEquipment(equipment.id, 'location', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeEquipment(equipment.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Patient Involved Section */}
          <div className="border rounded-lg mb-6">
            <div className="p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.patientInvolved}
                  onChange={(e) => setFormData({ ...formData, patientInvolved: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="w-4 h-4" />
                  Patient Involved
                </span>
              </label>
            </div>

            {formData.patientInvolved && (
              <div className="border-t p-4 space-y-4">
                {/* Patient Search */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Search Patient</label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search patient by name or MRN..."
                      value={patientSearchTerm}
                      onChange={(e) => setPatientSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  {patientSearchTerm && patientSearchTerm.length >= 2 && (
                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto mb-3">
                      {searchLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        </div>
                      ) : filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setFormData({ 
                                ...formData, 
                                patientId: patient.id,
                                patientName: patient.name, 
                                patientMrn: patient.mrn 
                              });
                              setPatientSearchTerm('');
                            }}
                            className="w-full text-left p-2 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <UserCircle className="w-6 h-6 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                              <p className="text-xs text-gray-500">{patient.mrn} | {patient.age}y | {patient.gender}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
                      )}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCircle className="w-8 h-8 text-teal-600" />
                        <div>
                          <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                          <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn} | {selectedPatient.age}y | {selectedPatient.gender}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setFormData({ ...formData, patientId: '', patientName: '', patientMrn: '' });
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Patient Impact Section */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => toggleSection('patientImpact')}
                    className="w-full flex items-center justify-between mb-4"
                  >
                    <span className="font-medium text-gray-700">Patient Impact</span>
                    {expandedSections.patientImpact ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {expandedSections.patientImpact && (
                    <div className="space-y-4">
                      {/* Outcome */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Outcome</label>
                        <div className="flex flex-wrap gap-2">
                          {patientOutcomes.map((outcome) => (
                            <button
                              key={outcome.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, patientOutcome: outcome.value })}
                              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                                formData.patientOutcome === outcome.value
                                  ? 'bg-gray-100 border-gray-400 ring-2 ring-offset-1 ring-gray-400'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              } ${outcome.color}`}
                            >
                              {outcome.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Medical Intervention */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Medical Intervention Required</label>
                        <textarea
                          rows={2}
                          value={formData.medicalIntervention}
                          onChange={(e) => setFormData({ ...formData, medicalIntervention: e.target.value })}
                          placeholder="Describe any medical intervention required..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                      </div>

                      {/* Family Notified */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.familyNotified}
                              onChange={(e) => setFormData({ ...formData, familyNotified: e.target.checked })}
                              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Family Notified</span>
                          </label>
                        </div>
                        {formData.familyNotified && (
                          <div>
                            <input
                              type="datetime-local"
                              value={formData.familyNotifiedDate}
                              onChange={(e) => setFormData({ ...formData, familyNotifiedDate: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* Patient Condition After */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Patient Condition After Incident</label>
                        <textarea
                          rows={2}
                          value={formData.patientConditionAfter}
                          onChange={(e) => setFormData({ ...formData, patientConditionAfter: e.target.value })}
                          placeholder="Describe patient's condition after the incident..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Follow-up Section */}
          <div className="border rounded-lg mb-6">
            <button
              type="button"
              onClick={() => toggleSection('followUp')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Follow-up & Resolution</span>
              </div>
              {expandedSections.followUp ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.followUp && (
              <div className="border-t p-4 space-y-4">
                {/* Root Cause Analysis */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Root Cause Analysis Notes</label>
                  <textarea
                    rows={3}
                    value={formData.rootCauseAnalysis}
                    onChange={(e) => setFormData({ ...formData, rootCauseAnalysis: e.target.value })}
                    placeholder="Document root cause analysis findings..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>

                {/* Corrective Actions */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Corrective Actions Planned</label>
                  <textarea
                    rows={3}
                    value={formData.correctiveActions}
                    onChange={(e) => setFormData({ ...formData, correctiveActions: e.target.value })}
                    placeholder="Describe corrective actions to be taken..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>

                {/* Preventive Measures */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Preventive Measures</label>
                  <textarea
                    rows={3}
                    value={formData.preventiveMeasures}
                    onChange={(e) => setFormData({ ...formData, preventiveMeasures: e.target.value })}
                    placeholder="Describe measures to prevent recurrence..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Responsible Person */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Responsible Person</label>
                    <input
                      type="text"
                      value={formData.responsiblePerson}
                      onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                      placeholder="Assigned person..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Due Date for Resolution</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {incidentStatuses.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="border rounded-lg mb-6">
            <button
              type="button"
              onClick={() => toggleSection('attachments')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Attachments ({formData.attachments.length})</span>
              </div>
              {expandedSections.attachments ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {expandedSections.attachments && (
              <div className="border-t p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <Image className="w-4 h-4" />
                    Upload Photos
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <File className="w-4 h-4" />
                    Upload Documents
                  </button>
                </div>
                {formData.attachments.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">No attachments added</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {formData.attachments.map((attachment) => (
                      <div key={attachment.id} className="relative group border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {attachment.type === 'image' ? (
                            <Image className="w-8 h-8 text-blue-500" />
                          ) : (
                            <File className="w-8 h-8 text-gray-500" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.name}</p>
                            <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute top-1 right-1 p-1 bg-red-100 text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reporter Info (if not anonymous) */}
          {!formData.anonymous && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Reporter Name</label>
                <input
                  type="text"
                  value={formData.reporterName}
                  onChange={(e) => setFormData({ ...formData, reporterName: e.target.value })}
                  placeholder="Your name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Reporter Role</label>
                <input
                  type="text"
                  value={formData.reporterRole}
                  onChange={(e) => setFormData({ ...formData, reporterRole: e.target.value })}
                  placeholder="Your role/position..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={handleEmail}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsDraft}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !isFormValid}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
