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
} from 'lucide-react';
import api from '../services/api';

// Hardcoded facility ID - should come from user context
const DEFAULT_FACILITY_ID = 'b94b30c8-f98e-4a70-825e-253224a1cb91';

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

interface EmergencyCase {
  id: string;
  caseNumber: string;
  triageLevel: number;
  status: string;
  arrivalMode: string;
  arrivalTime: string;
  triageTime: string | null;
  treatmentStartTime: string | null;
  chiefComplaint: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  oxygenSaturation: number | null;
  painScore: number | null;
  encounter?: {
    patient?: {
      id: string;
      mrn: string;
      fullName: string;
      gender: string;
      dateOfBirth: string;
    };
  };
}

export default function EmergencyPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);

  // Fetch emergency cases
  const { data: casesData, isLoading, refetch } = useQuery({
    queryKey: ['emergency-cases', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ facilityId: DEFAULT_FACILITY_ID });
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/emergency/cases?${params}`);
      return response.data;
    },
  });

  // Fetch dashboard
  const { data: dashboard } = useQuery({
    queryKey: ['emergency-dashboard'],
    queryFn: async () => {
      const response = await api.get(`/emergency/dashboard?facilityId=${DEFAULT_FACILITY_ID}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Start treatment mutation
  const startTreatmentMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await api.put(`/emergency/cases/${caseId}/start-treatment`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      setSelectedCase(null);
    },
  });

  const cases: EmergencyCase[] = casesData?.data || [];

  const filteredCases = cases.filter((c) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      c.caseNumber.toLowerCase().includes(search) ||
      c.encounter?.patient?.mrn?.toLowerCase().includes(search) ||
      c.encounter?.patient?.fullName?.toLowerCase().includes(search) ||
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
                        <span>{c.encounter?.patient?.fullName || 'Unknown'}</span>
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
                    <p className="font-medium">{selectedCase.encounter?.patient?.fullName || 'Unknown Patient'}</p>
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
                    <button className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Discharge
                    </button>
                    <button className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
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

      {/* Register Modal Placeholder */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Register Emergency Case</h2>
              <button onClick={() => setShowRegisterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-center py-8">
              Emergency registration form will be implemented here.
              <br />
              Search for patient → Enter chief complaint → Register
            </p>
            <button
              onClick={() => setShowRegisterModal(false)}
              className="w-full py-2 border rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Triage Modal Placeholder */}
      {showTriageModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Triage - {selectedCase.caseNumber}</h2>
              <button onClick={() => setShowTriageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-center py-8">
              Triage form will be implemented here.
              <br />
              Triage Level → Vitals → Assessment → Save
            </p>
            <button
              onClick={() => setShowTriageModal(false)}
              className="w-full py-2 border rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
