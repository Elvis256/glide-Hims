import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Siren,
  Search,
  Clock,
  AlertTriangle,
  Heart,
  Activity,
  User,
  RefreshCw,
  Plus,
  Stethoscope,
  ArrowRight,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import { emergencyService, patientsService, TriageLevel, ArrivalMode, TriageStatus } from '../services';
import type { EmergencyCase } from '../services';
import { useFacilityId } from '../lib/facility';

const triageLevelColors: Record<number, string> = {
  1: 'bg-red-600 text-white',       // Resuscitation
  2: 'bg-orange-500 text-white',    // Emergent
  3: 'bg-yellow-400 text-black',    // Urgent
  4: 'bg-green-500 text-white',     // Less Urgent
  5: 'bg-blue-500 text-white',      // Non-Urgent
};

const triageLevelNames: Record<number, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  triaged: 'bg-yellow-100 text-yellow-800',
  in_treatment: 'bg-blue-100 text-blue-800',
  discharged: 'bg-green-100 text-green-800',
  admitted: 'bg-purple-100 text-purple-800',
};

export default function EmergencyPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    patientSearch: '',
    patientId: '',
    patientName: '',
    chiefComplaint: '',
    arrivalMode: ArrivalMode.WALK_IN as ArrivalMode,
    presentingSymptoms: '',
  });

  // Triage form state
  const [triageForm, setTriageForm] = useState({
    triageLevel: TriageLevel.LESS_URGENT as TriageLevel,
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    oxygenSaturation: '',
    painScore: '',
    gcsScore: '',
    triageNotes: '',
  });

  // Discharge form state
  const [dischargeForm, setDischargeForm] = useState({
    primaryDiagnosis: '',
    dispositionNotes: '',
  });

  // Admit form state
  const [admitForm, setAdmitForm] = useState({
    wardId: '',
    primaryDiagnosis: '',
    admissionNotes: '',
  });

  // Patient search
  const { data: patientSearchResults } = useQuery({
    queryKey: ['patient-search', registerForm.patientSearch],
    queryFn: async () => {
      if (registerForm.patientSearch.length < 2) return [];
      const response = await patientsService.search({ search: registerForm.patientSearch, limit: 5 });
      return response.data || [];
    },
    enabled: registerForm.patientSearch.length >= 2,
  });

  // Fetch emergency cases
  const { data: casesData, isLoading, refetch } = useQuery({
    queryKey: ['emergency-cases', statusFilter, facilityId],
    queryFn: async () => {
      const response = await emergencyService.getCases({ 
        facilityId,
        status: (statusFilter || undefined) as TriageStatus | undefined,
      });
      return response.data;
    },
  });

  // Fetch dashboard
  const { data: dashboard } = useQuery({
    queryKey: ['emergency-dashboard', facilityId],
    queryFn: async () => {
      const response = await emergencyService.getDashboard(facilityId);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Register case mutation
  const registerCaseMutation = useMutation({
    mutationFn: async () => {
      const response = await emergencyService.registerCase({
        facilityId,
        patientId: registerForm.patientId,
        chiefComplaint: registerForm.chiefComplaint,
        arrivalMode: registerForm.arrivalMode,
        presentingSymptoms: registerForm.presentingSymptoms || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setShowRegisterModal(false);
      setRegisterForm({ patientSearch: '', patientId: '', patientName: '', chiefComplaint: '', arrivalMode: ArrivalMode.WALK_IN, presentingSymptoms: '' });
    },
  });

  // Triage mutation
  const triageMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await emergencyService.triageCase(caseId, {
        triageLevel: triageForm.triageLevel,
        bloodPressureSystolic: triageForm.bloodPressureSystolic ? parseInt(triageForm.bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: triageForm.bloodPressureDiastolic ? parseInt(triageForm.bloodPressureDiastolic) : undefined,
        heartRate: triageForm.heartRate ? parseInt(triageForm.heartRate) : undefined,
        respiratoryRate: triageForm.respiratoryRate ? parseInt(triageForm.respiratoryRate) : undefined,
        temperature: triageForm.temperature ? parseFloat(triageForm.temperature) : undefined,
        oxygenSaturation: triageForm.oxygenSaturation ? parseInt(triageForm.oxygenSaturation) : undefined,
        painScore: triageForm.painScore ? parseInt(triageForm.painScore) : undefined,
        gcsScore: triageForm.gcsScore ? parseInt(triageForm.gcsScore) : undefined,
        triageNotes: triageForm.triageNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setShowTriageModal(false);
      setSelectedCase(null);
      setTriageForm({ triageLevel: TriageLevel.LESS_URGENT, bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', respiratoryRate: '', temperature: '', oxygenSaturation: '', painScore: '', gcsScore: '', triageNotes: '' });
    },
  });

  // Start treatment mutation
  const startTreatmentMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await emergencyService.startTreatment(caseId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setSelectedCase(null);
    },
  });

  // Discharge mutation
  const dischargeMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await emergencyService.dischargeCase(caseId, {
        primaryDiagnosis: dischargeForm.primaryDiagnosis,
        dispositionNotes: dischargeForm.dispositionNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setShowDischargeModal(false);
      setSelectedCase(null);
      setDischargeForm({ primaryDiagnosis: '', dispositionNotes: '' });
    },
  });

  // Admit mutation
  const admitMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await emergencyService.admitCase(caseId, {
        wardId: admitForm.wardId,
        primaryDiagnosis: admitForm.primaryDiagnosis,
        admissionNotes: admitForm.admissionNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setShowAdmitModal(false);
      setSelectedCase(null);
      setAdmitForm({ wardId: '', primaryDiagnosis: '', admissionNotes: '' });
    },
  });

  const cases: EmergencyCase[] = casesData?.data || [];

  const filteredCases = cases.filter((c) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const patientName = `${c.encounter?.patient?.firstName || ''} ${c.encounter?.patient?.lastName || ''}`.toLowerCase();
    return (
      c.caseNumber.toLowerCase().includes(search) ||
      c.encounter?.patient?.mrn?.toLowerCase().includes(search) ||
      patientName.includes(search) ||
      c.chiefComplaint.toLowerCase().includes(search)
    );
  });

  // Sort by triage level (critical first), then by time
  const sortedCases = [...filteredCases].sort((a, b) => {
    if (a.triageLevel !== b.triageLevel) return a.triageLevel - b.triageLevel;
    return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Siren className="w-7 h-7 text-red-600" />
            Emergency Department
          </h1>
          <p className="text-gray-600">Triage and emergency case management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            New Emergency
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{dashboard?.criticalCases || 0}</p>
              <p className="text-sm text-gray-600">Critical Cases</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{dashboard?.byStatus?.pending || 0}</p>
              <p className="text-sm text-gray-600">Awaiting Triage</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{dashboard?.byStatus?.in_treatment || 0}</p>
              <p className="text-sm text-gray-600">In Treatment</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.byStatus?.discharged || 0}</p>
              <p className="text-sm text-gray-600">Discharged Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-gray-600" />
            <div>
              <p className="text-2xl font-bold text-gray-700">{dashboard?.todayTotal || 0}</p>
              <p className="text-sm text-gray-600">Total Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Average Wait Times */}
      {dashboard?.avgWaitTimes && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">Average Wait Times Today</h3>
          <div className="flex gap-8">
            <div>
              <span className="text-2xl font-bold text-blue-600">{dashboard.avgWaitTimes.triageMinutes}</span>
              <span className="text-sm text-gray-600 ml-1">min to triage</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-indigo-600">{dashboard.avgWaitTimes.treatmentMinutes}</span>
              <span className="text-sm text-gray-600 ml-1">min to treatment</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by case #, MRN, or patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending Triage</option>
          <option value="triaged">Triaged</option>
          <option value="in_treatment">In Treatment</option>
          <option value="discharged">Discharged</option>
          <option value="admitted">Admitted</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Emergency Cases</h2>
            <span className="text-sm text-gray-500">{sortedCases.length} cases</span>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : sortedCases.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Siren className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No emergency cases found</p>
              </div>
            ) : (
              sortedCases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedCase?.id === c.id ? 'bg-red-50 border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${triageLevelColors[c.triageLevel]}`}>
                          Level {c.triageLevel}
                        </span>
                        <span className="font-medium text-gray-900">{c.caseNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[c.status]}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{c.encounter?.patient ? `${c.encounter.patient.firstName} ${c.encounter.patient.lastName}` : 'Unknown'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{c.encounter?.patient?.mrn || 'N/A'}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 truncate">{c.chiefComplaint}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Arrived: {new Date(c.arrivalTime).toLocaleTimeString()}
                        {c.arrivalMode && ` • ${c.arrivalMode.replace('_', ' ')}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      {c.heartRate && (
                        <div className="flex items-center gap-1 text-sm">
                          <Heart className="w-3 h-3 text-red-500" />
                          <span>{c.heartRate}</span>
                        </div>
                      )}
                      {c.oxygenSaturation && (
                        <div className={`text-sm ${c.oxygenSaturation < 94 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          SpO2: {c.oxygenSaturation}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Case Details Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Case Details</h2>
          </div>
          {selectedCase ? (
            <div className="p-4 space-y-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${triageLevelColors[selectedCase.triageLevel]}`}>
                    <span className="text-lg font-bold">{selectedCase.triageLevel}</span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedCase.encounter?.patient ? `${selectedCase.encounter.patient.firstName} ${selectedCase.encounter.patient.lastName}` : 'Unknown Patient'}</p>
                    <p className="text-sm text-gray-500">
                      {selectedCase.caseNumber} • {selectedCase.encounter?.patient?.mrn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Chief Complaint</h3>
                <p className="text-gray-700 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                  {selectedCase.chiefComplaint}
                </p>
              </div>

              {/* Vitals */}
              {(selectedCase.heartRate || selectedCase.bloodPressureSystolic) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Triage Vitals</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedCase.bloodPressureSystolic && (
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <p className="text-lg font-bold">{selectedCase.bloodPressureSystolic}/{selectedCase.bloodPressureDiastolic}</p>
                        <p className="text-xs text-gray-500">BP mmHg</p>
                      </div>
                    )}
                    {selectedCase.heartRate && (
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <p className="text-lg font-bold">{selectedCase.heartRate}</p>
                        <p className="text-xs text-gray-500">HR bpm</p>
                      </div>
                    )}
                    {selectedCase.oxygenSaturation && (
                      <div className={`p-2 rounded text-center ${selectedCase.oxygenSaturation < 94 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <p className={`text-lg font-bold ${selectedCase.oxygenSaturation < 94 ? 'text-red-600' : ''}`}>
                          {selectedCase.oxygenSaturation}%
                        </p>
                        <p className="text-xs text-gray-500">SpO2</p>
                      </div>
                    )}
                    {selectedCase.painScore !== null && (
                      <div className="bg-gray-50 p-2 rounded text-center">
                        <p className="text-lg font-bold">{selectedCase.painScore}/10</p>
                        <p className="text-xs text-gray-500">Pain</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span className="text-gray-500">Arrived:</span>
                    <span>{new Date(selectedCase.arrivalTime).toLocaleString()}</span>
                  </div>
                  {selectedCase.triageTime && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                      <span className="text-gray-500">Triaged:</span>
                      <span>{new Date(selectedCase.triageTime).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedCase.treatmentStartTime && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-gray-500">Treatment Started:</span>
                      <span>{new Date(selectedCase.treatmentStartTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {selectedCase.status === 'pending' && (
                  <button
                    onClick={() => setShowTriageModal(true)}
                    className="flex-1 bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    Triage Patient
                  </button>
                )}
                {selectedCase.status === 'triaged' && (
                  <button
                    onClick={() => startTreatmentMutation.mutate(selectedCase.id)}
                    disabled={startTreatmentMutation.isPending}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Start Treatment
                  </button>
                )}
                {selectedCase.status === 'in_treatment' && (
                  <>
                    <button 
                      onClick={() => setShowDischargeModal(true)}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Discharge
                    </button>
                    <button 
                      onClick={() => setShowAdmitModal(true)}
                      className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Admit to IPD
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Siren className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Select a case to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Register Emergency Case</h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                {registerForm.patientId ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-600" />
                      <span className="font-medium">{registerForm.patientName}</span>
                    </div>
                    <button
                      onClick={() => setRegisterForm(prev => ({ ...prev, patientId: '', patientName: '', patientSearch: '' }))}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={registerForm.patientSearch}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, patientSearch: e.target.value }))}
                      placeholder="Search by name or MRN..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    />
                    {patientSearchResults && patientSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {patientSearchResults.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => setRegisterForm(prev => ({
                              ...prev,
                              patientId: p.id,
                              patientName: `${p.firstName} ${p.lastName}`,
                              patientSearch: '',
                            }))}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50"
                          >
                            <span className="font-medium">{p.firstName} {p.lastName}</span>
                            <span className="text-gray-500 text-sm ml-2">{p.mrn || 'No MRN'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
                <textarea
                  value={registerForm.chiefComplaint}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                  placeholder="Primary reason for emergency visit..."
                  className="w-full border rounded-lg px-3 py-2 h-20"
                />
              </div>

              {/* Arrival Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Mode</label>
                <select
                  value={registerForm.arrivalMode}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, arrivalMode: e.target.value as ArrivalMode }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="walk_in">Walk In</option>
                  <option value="ambulance">Ambulance</option>
                  <option value="private_vehicle">Private Vehicle</option>
                  <option value="police">Police</option>
                  <option value="referral">Referral</option>
                </select>
              </div>

              {/* Presenting Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presenting Symptoms</label>
                <textarea
                  value={registerForm.presentingSymptoms}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, presentingSymptoms: e.target.value }))}
                  placeholder="Additional symptoms..."
                  className="w-full border rounded-lg px-3 py-2 h-16"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => registerCaseMutation.mutate()}
                disabled={!registerForm.patientId || !registerForm.chiefComplaint || registerCaseMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {registerCaseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Register Case
              </button>
            </div>
            {registerCaseMutation.isError && (
              <p className="text-red-600 text-sm mt-2">Failed to register case. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {/* Triage Modal */}
      {showTriageModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Triage Assessment</h2>
                <p className="text-sm text-gray-500">{selectedCase.caseNumber} - {selectedCase.encounter?.patient ? `${selectedCase.encounter.patient.firstName} ${selectedCase.encounter.patient.lastName}` : 'Unknown'}</p>
              </div>
              <button onClick={() => setShowTriageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Triage Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Triage Level *</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { level: 1, label: 'Resuscitation', color: 'bg-red-600' },
                    { level: 2, label: 'Emergent', color: 'bg-orange-500' },
                    { level: 3, label: 'Urgent', color: 'bg-yellow-400' },
                    { level: 4, label: 'Less Urgent', color: 'bg-green-500' },
                    { level: 5, label: 'Non-Urgent', color: 'bg-blue-500' },
                  ].map((t) => (
                    <button
                      key={t.level}
                      onClick={() => setTriageForm(prev => ({ ...prev, triageLevel: t.level as TriageLevel }))}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${
                        triageForm.triageLevel === t.level
                          ? `${t.color} text-white border-gray-900`
                          : 'bg-gray-50 hover:bg-gray-100 border-transparent'
                      }`}
                    >
                      <span className="block text-lg font-bold">{t.level}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic</label>
                  <input
                    type="number"
                    value={triageForm.bloodPressureSystolic}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, bloodPressureSystolic: e.target.value }))}
                    placeholder="120"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic</label>
                  <input
                    type="number"
                    value={triageForm.bloodPressureDiastolic}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, bloodPressureDiastolic: e.target.value }))}
                    placeholder="80"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
                  <input
                    type="number"
                    value={triageForm.heartRate}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, heartRate: e.target.value }))}
                    placeholder="72"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resp Rate</label>
                  <input
                    type="number"
                    value={triageForm.respiratoryRate}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, respiratoryRate: e.target.value }))}
                    placeholder="16"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={triageForm.temperature}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, temperature: e.target.value }))}
                    placeholder="36.5"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={triageForm.oxygenSaturation}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, oxygenSaturation: e.target.value }))}
                    placeholder="98"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pain (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={triageForm.painScore}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, painScore: e.target.value }))}
                    placeholder="5"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GCS (3-15)</label>
                  <input
                    type="number"
                    min="3"
                    max="15"
                    value={triageForm.gcsScore}
                    onChange={(e) => setTriageForm(prev => ({ ...prev, gcsScore: e.target.value }))}
                    placeholder="15"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Triage Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Triage Notes</label>
                <textarea
                  value={triageForm.triageNotes}
                  onChange={(e) => setTriageForm(prev => ({ ...prev, triageNotes: e.target.value }))}
                  placeholder="Assessment notes..."
                  className="w-full border rounded-lg px-3 py-2 h-20"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTriageModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => triageMutation.mutate(selectedCase.id)}
                disabled={triageMutation.isPending}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {triageMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Complete Triage
              </button>
            </div>
            {triageMutation.isError && (
              <p className="text-red-600 text-sm mt-2">Failed to save triage. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {showDischargeModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Discharge Patient</h2>
                <p className="text-sm text-gray-500">{selectedCase.caseNumber}</p>
              </div>
              <button onClick={() => setShowDischargeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis *</label>
                <input
                  type="text"
                  value={dischargeForm.primaryDiagnosis}
                  onChange={(e) => setDischargeForm(prev => ({ ...prev, primaryDiagnosis: e.target.value }))}
                  placeholder="Final diagnosis..."
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disposition Notes</label>
                <textarea
                  value={dischargeForm.dispositionNotes}
                  onChange={(e) => setDischargeForm(prev => ({ ...prev, dispositionNotes: e.target.value }))}
                  placeholder="Discharge instructions, follow-up, etc..."
                  className="w-full border rounded-lg px-3 py-2 h-24"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => dischargeMutation.mutate(selectedCase.id)}
                disabled={!dischargeForm.primaryDiagnosis || dischargeMutation.isPending}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {dischargeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Discharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admit Modal */}
      {showAdmitModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Admit to IPD</h2>
                <p className="text-sm text-gray-500">{selectedCase.caseNumber}</p>
              </div>
              <button onClick={() => setShowAdmitModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward *</label>
                <select
                  value={admitForm.wardId}
                  onChange={(e) => setAdmitForm(prev => ({ ...prev, wardId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select ward...</option>
                  <option value="general-ward">General Ward</option>
                  <option value="icu">ICU</option>
                  <option value="surgical-ward">Surgical Ward</option>
                  <option value="pediatric-ward">Pediatric Ward</option>
                  <option value="maternity-ward">Maternity Ward</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis *</label>
                <input
                  type="text"
                  value={admitForm.primaryDiagnosis}
                  onChange={(e) => setAdmitForm(prev => ({ ...prev, primaryDiagnosis: e.target.value }))}
                  placeholder="Admission diagnosis..."
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Notes</label>
                <textarea
                  value={admitForm.admissionNotes}
                  onChange={(e) => setAdmitForm(prev => ({ ...prev, admissionNotes: e.target.value }))}
                  placeholder="Reason for admission, initial orders..."
                  className="w-full border rounded-lg px-3 py-2 h-24"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdmitModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => admitMutation.mutate(selectedCase.id)}
                disabled={!admitForm.wardId || !admitForm.primaryDiagnosis || admitMutation.isPending}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {admitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Admit Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
