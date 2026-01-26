import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Phone,
  FileText,
  Clock,
  AlertTriangle,
  Filter,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../../services/queue';

interface WaitingPatient {
  id: string;
  ticketNumber: string;
  name: string;
  mrn: string;
  patientId: string;
  waitTime: number; // in minutes
  priority: 'high' | 'normal' | 'low';
  chiefComplaint: string;
  encounterId?: string;
}

// Map API priority (1-10) to UI priority
const mapPriority = (priority: number): WaitingPatient['priority'] => {
  if (priority <= 2) return 'high';
  if (priority <= 5) return 'normal';
  return 'low';
};

// Calculate wait time in minutes
const calculateWaitTime = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / 60000);
};

// Transform API queue entry to UI format
const transformQueueEntry = (entry: QueueEntry & { 
  patient?: { fullName: string; mrn: string; id: string }; 
  encounter?: { chiefComplaint?: string; id: string };
}): WaitingPatient => ({
  id: entry.id,
  ticketNumber: entry.ticketNumber,
  name: entry.patient?.fullName || 'Unknown Patient',
  mrn: entry.patient?.mrn || 'N/A',
  patientId: entry.patient?.id || entry.patientId,
  waitTime: calculateWaitTime(entry.createdAt),
  priority: mapPriority(entry.priority),
  chiefComplaint: entry.encounter?.chiefComplaint || entry.notes || 'No complaint recorded',
  encounterId: entry.encounter?.id,
});

const priorityConfig = {
  high: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'High' },
  normal: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Normal' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Low' },
};

type FilterType = 'all' | 'high' | 'normal';

export default function WaitingPatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');

  // Fetch consultation queue from API - both waiting and called patients
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['doctor-waiting-queue'],
    queryFn: async () => {
      // Get all queue entries for consultation today (waiting, called, in_service)
      const all = await queueService.getQueue({ servicePoint: 'consultation' });
      // Filter to show only active queue (waiting and called)
      return all.filter(entry => 
        entry.status === 'waiting' || entry.status === 'called' || entry.status === 'in_service'
      );
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Transform to UI format
  const patients: WaitingPatient[] = (queueData || []).map(transformQueueEntry);

  // Call next patient mutation
  const callNextMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
    },
  });

  const filteredPatients = useMemo(() => {
    if (filter === 'all') return patients;
    if (filter === 'high') return patients.filter((p) => p.priority === 'high');
    return patients.filter((p) => p.priority === 'normal');
  }, [patients, filter]);

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleCallPatient = (patient: WaitingPatient) => {
    callNextMutation.mutate(patient.id);
    // Navigate to consultation
    navigate(`/doctor/consultation/${patient.encounterId || patient.id}`, { 
      state: { patient } 
    });
  };

  const handleViewHistory = (patient: WaitingPatient) => {
    navigate(`/patients/${patient.patientId}/history`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Waiting Patients</h1>
            <p className="text-gray-500">{filteredPatients.length} patients in queue</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm border">
          <Filter className="w-4 h-4 text-gray-400 ml-2" />
          {(['all', 'high', 'normal'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : f === 'high' ? 'High Priority' : 'Normal'}
            </button>
          ))}
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b text-sm font-medium text-gray-500 rounded-t-xl">
            <div className="col-span-1">Token</div>
            <div className="col-span-2">Patient Name</div>
            <div className="col-span-2">MRN</div>
            <div className="col-span-2">Wait Time</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-2">Chief Complaint</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredPatients.map((patient) => {
              const priority = priorityConfig[patient.priority];
              return (
                <div
                  key={patient.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="col-span-1">
                    <span className="font-mono font-bold text-blue-600">
                      {patient.ticketNumber}
                    </span>
                  </div>
                  <div className="col-span-2 font-medium text-gray-900">
                    {patient.name}
                  </div>
                  <div className="col-span-2 text-gray-500 font-mono text-sm">
                    {patient.mrn}
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${patient.waitTime > 30 ? 'text-orange-500' : 'text-gray-400'}`} />
                    <span className={patient.waitTime > 30 ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                      {formatWaitTime(patient.waitTime)}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${priority.bg} ${priority.text}`}
                    >
                      {patient.priority === 'high' && <AlertTriangle className="w-3 h-3" />}
                      {priority.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-600 text-sm truncate">
                    {patient.chiefComplaint}
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => handleCallPatient(patient)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </button>
                    <button
                      onClick={() => handleViewHistory(patient)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      History
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPatients.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No patients in queue</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
