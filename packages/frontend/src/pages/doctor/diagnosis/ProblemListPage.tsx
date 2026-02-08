import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Search,
  X,
  Save,
  Loader2,
  Activity,
  Heart,
  AlertTriangle,
  FileText,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';
import { problemsService } from '../../../services/problems';
import type { Problem, ProblemStatus, ProblemStats, CreateProblemDto } from '../../../services/problems';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';

type FilterType = 'All' | 'active' | 'chronic' | 'resolved';

interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
}

interface DiagnosisOption {
  id: string;
  icd10Code: string;
  name: string;
  isChronic?: boolean;
}

// Common diagnoses for quick pick
const commonDiagnoses: DiagnosisOption[] = [
  { id: 'I10', icd10Code: 'I10', name: 'Essential Hypertension', isChronic: true },
  { id: 'E11.9', icd10Code: 'E11.9', name: 'Type 2 Diabetes Mellitus', isChronic: true },
  { id: 'E78.5', icd10Code: 'E78.5', name: 'Hyperlipidemia', isChronic: true },
  { id: 'J45', icd10Code: 'J45', name: 'Asthma', isChronic: true },
  { id: 'J06.9', icd10Code: 'J06.9', name: 'Acute Upper Respiratory Infection' },
  { id: 'K21.0', icd10Code: 'K21.0', name: 'GERD' },
  { id: 'M54.5', icd10Code: 'M54.5', name: 'Low Back Pain' },
  { id: 'N39.0', icd10Code: 'N39.0', name: 'Urinary Tract Infection' },
  { id: 'J18.9', icd10Code: 'J18.9', name: 'Pneumonia' },
  { id: 'B54', icd10Code: 'B54', name: 'Malaria (Unspecified)' },
];

export default function ProblemListPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
  
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [diagnosisSearch, setDiagnosisSearch] = useState('');

  // Fetch patient from URL params
  const { data: urlPatientData } = useQuery({
    queryKey: ['patient', urlPatientId],
    queryFn: () => patientsService.getById(urlPatientId!),
    enabled: !!urlPatientId && !selectedPatient,
  });

  // Set patient from URL params
  useEffect(() => {
    if (urlPatientData && !selectedPatient) {
      setSelectedPatient({
        id: urlPatientData.id,
        name: urlPatientData.fullName,
        dob: urlPatientData.dateOfBirth,
        mrn: urlPatientData.mrn,
      });
    }
  }, [urlPatientData, selectedPatient]);
  
  const [formData, setFormData] = useState({
    diagnosisId: '',
    customDiagnosis: '',
    customIcdCode: '',
    onsetDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'active' as ProblemStatus,
    severity: undefined as 'mild' | 'moderate' | 'severe' | 'critical' | undefined,
    notes: '',
  });

  // Fetch patients from API
  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', patientSearchQuery],
    queryFn: () => patientsService.search({ search: patientSearchQuery, limit: 10 }),
    enabled: patientSearchQuery.length >= 2,
  });

  // Transform API patients
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      dob: p.dateOfBirth,
      mrn: p.mrn,
    }));
  }, [patientsData]);

  // Fetch patient problems
  const { data: problems = [], isLoading: isLoadingProblems, refetch: refetchProblems } = useQuery({
    queryKey: ['patient-problems', selectedPatient?.id],
    queryFn: () => problemsService.getByPatient(selectedPatient!.id),
    enabled: !!selectedPatient,
  });

  // Fetch problem stats
  const { data: stats } = useQuery({
    queryKey: ['patient-problem-stats', selectedPatient?.id],
    queryFn: () => problemsService.getPatientStats(selectedPatient!.id),
    enabled: !!selectedPatient,
  });

  // Search diagnoses from backend
  const { data: diagnosisResults = [] } = useQuery({
    queryKey: ['diagnosis-search', diagnosisSearch],
    queryFn: async () => {
      if (diagnosisSearch.length < 2) return [];
      const response = await api.get('/diagnoses', { params: { search: diagnosisSearch, limit: 15 } });
      return response.data?.data || response.data || [];
    },
    enabled: diagnosisSearch.length >= 2,
  });

  // Create problem
  const createMutation = useMutation({
    mutationFn: (data: CreateProblemDto) => problemsService.create(facilityId, data),
    onSuccess: () => {
      toast.success('Problem added successfully');
      queryClient.invalidateQueries({ queryKey: ['patient-problems'] });
      queryClient.invalidateQueries({ queryKey: ['patient-problem-stats'] });
      closeModal();
    },
    onError: () => toast.error('Failed to add problem'),
  });

  // Update problem
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProblemDto> }) => 
      problemsService.update(id, data),
    onSuccess: () => {
      toast.success('Problem updated');
      queryClient.invalidateQueries({ queryKey: ['patient-problems'] });
      queryClient.invalidateQueries({ queryKey: ['patient-problem-stats'] });
      closeModal();
    },
    onError: () => toast.error('Failed to update problem'),
  });

  // Mark resolved
  const resolveMutation = useMutation({
    mutationFn: (id: string) => problemsService.markResolved(id),
    onSuccess: () => {
      toast.success('Problem marked as resolved');
      queryClient.invalidateQueries({ queryKey: ['patient-problems'] });
      queryClient.invalidateQueries({ queryKey: ['patient-problem-stats'] });
    },
    onError: () => toast.error('Failed to resolve problem'),
  });

  // Delete problem
  const deleteMutation = useMutation({
    mutationFn: (id: string) => problemsService.delete(id),
    onSuccess: () => {
      toast.success('Problem deleted');
      queryClient.invalidateQueries({ queryKey: ['patient-problems'] });
      queryClient.invalidateQueries({ queryKey: ['patient-problem-stats'] });
    },
    onError: () => toast.error('Failed to delete problem'),
  });

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesFilter = filter === 'All' || problem.status === filter;
      const matchesSearch =
        !searchQuery ||
        problem.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.icdCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [problems, filter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      All: stats?.total || problems.length,
      active: stats?.active || problems.filter((p) => p.status === 'active').length,
      chronic: stats?.chronic || problems.filter((p) => p.status === 'chronic').length,
      resolved: stats?.resolved || problems.filter((p) => p.status === 'resolved').length,
    };
  }, [problems, stats]);

  const openAddModal = () => {
    setEditingProblem(null);
    setFormData({
      diagnosisId: '',
      customDiagnosis: '',
      customIcdCode: '',
      onsetDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'active',
      severity: undefined,
      notes: '',
    });
    setDiagnosisSearch('');
    setShowAddModal(true);
  };

  const openEditModal = (problem: Problem) => {
    setEditingProblem(problem);
    setFormData({
      diagnosisId: problem.diagnosisId || '',
      customDiagnosis: problem.diagnosis,
      customIcdCode: problem.icdCode,
      onsetDate: problem.onsetDate?.split('T')[0] || format(new Date(), 'yyyy-MM-dd'),
      status: problem.status,
      severity: problem.severity,
      notes: problem.notes || '',
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingProblem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.diagnosisId && !formData.customDiagnosis) {
      toast.error('Please select or enter a diagnosis');
      return;
    }

    const data: CreateProblemDto = {
      patientId: selectedPatient!.id,
      diagnosisId: formData.diagnosisId || undefined,
      customDiagnosis: !formData.diagnosisId ? formData.customDiagnosis : undefined,
      customIcdCode: !formData.diagnosisId ? formData.customIcdCode : undefined,
      status: formData.status,
      severity: formData.severity,
      onsetDate: formData.onsetDate,
      notes: formData.notes || undefined,
    };

    if (editingProblem) {
      updateMutation.mutate({ id: editingProblem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const selectDiagnosis = (diag: DiagnosisOption) => {
    setFormData({
      ...formData,
      diagnosisId: diag.id,
      customDiagnosis: diag.name,
      customIcdCode: diag.icd10Code,
      status: diag.isChronic ? 'chronic' : 'active',
    });
    setDiagnosisSearch('');
  };

  const getStatusIcon = (status: ProblemStatus) => {
    switch (status) {
      case 'active':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'chronic':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusStyle = (status: ProblemStatus) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-700';
      case 'chronic':
        return 'bg-amber-100 text-amber-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSeverityStyle = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'severe':
        return 'bg-orange-500 text-white';
      case 'moderate':
        return 'bg-yellow-400 text-yellow-900';
      case 'mild':
        return 'bg-green-100 text-green-700';
      default:
        return '';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        {!selectedPatient ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg">
                <FileText className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Problem List</h1>
                <p className="text-sm text-gray-500">Track patient diagnoses and conditions</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                placeholder="Search patients by name or MRN..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
              {isLoadingPatients && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {patients.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-rose-50 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{patient.name}</div>
                      <div className="text-sm text-gray-500">
                        DOB: {formatDate(patient.dob)} | MRN: {patient.mrn}
                      </div>
                    </div>
                    <Heart className="w-5 h-5 text-rose-300" />
                  </button>
                ))}
              </div>
            )}
            {patientSearchQuery.length >= 2 && !isLoadingPatients && patients.length === 0 && (
              <p className="text-sm text-gray-500">No patients found</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-full">
                <Heart className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h2>
                <p className="text-sm text-gray-600">
                  DOB: {formatDate(selectedPatient.dob)} | MRN: {selectedPatient.mrn}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchProblems()}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearchQuery('');
                }}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                Change Patient
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              >
                <Plus className="w-4 h-4" />
                Add Problem
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedPatient && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {([
              { key: 'All', label: 'All Problems', color: 'gray', icon: Activity },
              { key: 'active', label: 'Active', color: 'red', icon: AlertCircle },
              { key: 'chronic', label: 'Chronic', color: 'amber', icon: Clock },
              { key: 'resolved', label: 'Resolved', color: 'green', icon: CheckCircle },
            ] as const).map(({ key, label, color, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                  filter === key ? `ring-2 ring-${color}-500 border-${color}-200` : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className={`text-2xl font-bold text-${color}-600`}>{statusCounts[key]}</p>
                  </div>
                  <Icon className={`w-8 h-8 text-${color}-400`} />
                </div>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search problems by diagnosis or ICD code..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Problem List */}
          <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
            {isLoadingProblems ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
              </div>
            ) : filteredProblems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <p>No problems found</p>
                {problems.length === 0 && (
                  <button
                    onClick={openAddModal}
                    className="mt-4 text-rose-600 hover:underline"
                  >
                    Add first problem
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4">Problem / ICD Code</div>
                  <div className="col-span-2">Onset Date</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Last Updated</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* Table Body */}
                <div className="flex-1 overflow-y-auto">
                  {filteredProblems.map((problem) => (
                    <div
                      key={problem.id}
                      className={`grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 items-center ${
                        problem.status === 'active' ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <div className="col-span-4">
                        <div className="flex items-start gap-2">
                          {problem.severity && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getSeverityStyle(problem.severity)}`}>
                              {problem.severity}
                            </span>
                          )}
                          <div>
                            <div className="font-medium text-gray-800">{problem.diagnosis}</div>
                            <div className="text-sm font-mono text-rose-600">{problem.icdCode}</div>
                            {problem.notes && (
                              <div className="text-xs text-gray-500 mt-1 line-clamp-1">{problem.notes}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(problem.onsetDate)}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(problem.status)}`}
                        >
                          {getStatusIcon(problem.status)}
                          {problem.status}
                        </span>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        {formatDate(problem.updatedAt)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        {problem.status !== 'resolved' && (
                          <button
                            onClick={() => resolveMutation.mutate(problem.id)}
                            disabled={resolveMutation.isPending}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Mark Resolved"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(problem)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this problem?')) {
                              deleteMutation.mutate(problem.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Problem Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingProblem ? 'Edit Problem' : 'Add New Problem'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Quick Pick */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Pick Common Diagnoses</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {commonDiagnoses.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => selectDiagnosis(d)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        formData.customIcdCode === d.icd10Code
                          ? 'bg-rose-100 border-rose-300 text-rose-700'
                          : 'bg-gray-50 border-gray-200 hover:bg-rose-50 hover:border-rose-200'
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagnosis Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search ICD-10 Diagnosis</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={diagnosisSearch}
                    onChange={(e) => setDiagnosisSearch(e.target.value)}
                    placeholder="Search diagnoses..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                {diagnosisResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {diagnosisResults.map((d: any) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => selectDiagnosis({
                          id: d.id,
                          icd10Code: d.icd10Code,
                          name: d.name,
                          isChronic: d.isChronic,
                        })}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm flex justify-between"
                      >
                        <span>{d.name}</span>
                        <span className="text-rose-600 font-mono">{d.icd10Code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected/Custom Diagnosis */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                  <input
                    type="text"
                    value={formData.customDiagnosis}
                    onChange={(e) => setFormData({ ...formData, customDiagnosis: e.target.value, diagnosisId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Enter or select diagnosis"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Code</label>
                  <input
                    type="text"
                    value={formData.customIcdCode}
                    onChange={(e) => setFormData({ ...formData, customIcdCode: e.target.value, diagnosisId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                    placeholder="e.g., I10"
                  />
                </div>
              </div>

              {/* Status & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date *</label>
                  <input
                    type="date"
                    value={formData.onsetDate}
                    onChange={(e) => setFormData({ ...formData, onsetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ProblemStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="chronic">Chronic</option>
                    <option value="resolved">Resolved</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity (Optional)</label>
                <div className="flex gap-2">
                  {(['mild', 'moderate', 'severe', 'critical'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, severity: formData.severity === s ? undefined : s })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        formData.severity === s
                          ? getSeverityStyle(s) + ' border-transparent'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none h-20"
                  placeholder="Additional clinical notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingProblem ? 'Update Problem' : 'Add Problem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
