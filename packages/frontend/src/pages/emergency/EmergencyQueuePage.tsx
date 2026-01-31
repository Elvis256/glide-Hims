import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  User,
  PlayCircle,
  ArrowRightCircle,
  Activity,
  Users,
  Timer,
  RefreshCw,
  Stethoscope,
  Bed,
  Loader2,
} from 'lucide-react';
import { emergencyService, TriageLevel, TriageStatus } from '../../services';
import { useFacilityId } from '../../lib/facility';

const triageLevelConfig: Record<number, { label: string; color: string; textColor: string; bgLight: string; border: string }> = {
  1: { label: 'Resus', color: 'bg-red-600', textColor: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-500' },
  2: { label: 'Emergent', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', border: 'border-orange-500' },
  3: { label: 'Urgent', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', border: 'border-yellow-500' },
  4: { label: 'Less Urgent', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-500' },
  5: { label: 'Non-Urgent', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', border: 'border-blue-500' },
};

function formatElapsedTime(arrivalTime: string): string {
  const diff = Date.now() - new Date(arrivalTime).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function EmergencyQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Auto-refresh timer for elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dashboard for stats
  const { data: dashboard } = useQuery({
    queryKey: ['emergency-dashboard', facilityId],
    queryFn: async () => {
      const response = await emergencyService.getDashboard(facilityId);
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Fetch all active cases (triaged + in_treatment)
  const { data: casesData, isLoading, refetch } = useQuery({
    queryKey: ['emergency-queue-cases', facilityId],
    queryFn: async () => {
      const response = await emergencyService.getCases({ 
        facilityId,
        limit: 100,
      });
      // Filter to show triaged and in_treatment cases
      const activeCases = (response.data.data || []).filter(
        c => c.status === TriageStatus.TRIAGED || c.status === TriageStatus.IN_TREATMENT
      );
      return activeCases;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Start treatment mutation
  const startTreatmentMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await emergencyService.startTreatment(caseId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-queue-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
    },
  });

  const cases = casesData || [];

  const stats = {
    totalInED: cases.length,
    criticalCount: cases.filter(c => c.triageLevel <= 2).length,
    avgWaitMinutes: dashboard?.avgWaitTimes?.treatmentMinutes || 0,
    waitingCount: cases.filter(c => c.status === TriageStatus.TRIAGED).length,
  };

  // Sort by triage level (critical first), then by time
  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      if (a.triageLevel !== b.triageLevel) return a.triageLevel - b.triageLevel;
      return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
    });
  }, [cases]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Queue</h1>
            <p className="text-sm text-gray-500">Real-time patient management</p>
          </div>
        </div>
        <button 
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalInED}</p>
              <p className="text-sm text-gray-500">Total in ED</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.criticalCount}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.waitingCount}</p>
              <p className="text-sm text-gray-500">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Timer className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgWaitMinutes}m</p>
              <p className="text-sm text-gray-500">Avg Wait Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Legend */}
      <div className="flex gap-4 mb-4">
        {Object.entries(triageLevelConfig).map(([level, config]) => (
          <div key={level} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            <span className="text-sm text-gray-600">L{level} - {config.label}</span>
          </div>
        ))}
      </div>

      {/* Queue Table */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chief Complaint</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wait Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bay</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : sortedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <Users className="w-12 h-12 mb-3" />
                      <p className="font-medium">No patients in queue</p>
                      <p className="text-sm">All cases have been discharged or admitted</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCases.map((c) => {
                const config = triageLevelConfig[c.triageLevel] || triageLevelConfig[4];
                const patient = c.encounter?.patient;
                const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown';
                const isWaiting = c.status === TriageStatus.TRIAGED;
                const isInTreatment = c.status === TriageStatus.IN_TREATMENT;
                
                return (
                  <tr 
                    key={c.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedPatient === c.id ? 'bg-blue-50' : ''} ${config.bgLight}`}
                    onClick={() => setSelectedPatient(c.id)}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} text-white`}>
                        L{c.triageLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{patientName}</p>
                          <p className="text-xs text-gray-500">{c.caseNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700 max-w-xs truncate">{c.chiefComplaint}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className={`w-4 h-4 ${c.triageLevel <= 2 ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${c.triageLevel <= 2 ? 'text-red-600' : 'text-gray-700'}`}>
                          {formatElapsedTime(c.arrivalTime)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.attendingDoctor ? (
                        <div className="flex items-center gap-1">
                          <Stethoscope className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-700">
                            {c.attendingDoctor.firstName} {c.attendingDoctor.lastName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400">—</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        isWaiting ? 'bg-yellow-100 text-yellow-700' :
                        isInTreatment ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {isWaiting ? 'Waiting' : isInTreatment ? 'In Treatment' : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isWaiting && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startTreatmentMutation.mutate(c.id); }}
                            disabled={startTreatmentMutation.isPending}
                            className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50"
                            title="Start Treatment"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        {isInTreatment && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/emergency?caseId=${c.id}`); }}
                            className="p-1.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200"
                            title="Manage Case"
                          >
                            <ArrowRightCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
