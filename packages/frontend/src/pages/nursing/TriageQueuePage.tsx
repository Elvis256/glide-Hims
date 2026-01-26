import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ListOrdered,
  Clock,
  UserCircle,
  AlertTriangle,
  ChevronRight,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';

interface TriagePatient {
  id: string;
  queueNumber: number;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  arrivalTime: string;
  priority: 'immediate' | 'urgent' | 'less-urgent' | 'non-urgent';
  status: 'waiting' | 'in-triage' | 'completed';
  waitTime: number;
}

// Map API priority (1-10) to UI priority
const mapPriority = (priority: number): TriagePatient['priority'] => {
  if (priority <= 1) return 'immediate';
  if (priority <= 3) return 'urgent';
  if (priority <= 5) return 'less-urgent';
  return 'non-urgent';
};

// Map API status to UI status
const mapStatus = (status: string): TriagePatient['status'] => {
  if (status === 'in_service') return 'in-triage';
  if (status === 'completed') return 'completed';
  return 'waiting';
};

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

// Calculate wait time in minutes
const calculateWaitTime = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / 60000);
};

// Transform API queue entry to UI format
const transformQueueEntry = (entry: QueueEntry & { patient?: { fullName: string; mrn: string; dateOfBirth?: string; gender?: string }; encounter?: { chiefComplaint?: string } }): TriagePatient => ({
  id: entry.id,
  queueNumber: parseInt(entry.ticketNumber?.replace(/\D/g, '') || '0') || 0,
  name: entry.patient?.fullName || 'Unknown Patient',
  mrn: entry.patient?.mrn || 'N/A',
  age: calculateAge(entry.patient?.dateOfBirth),
  gender: entry.patient?.gender || 'Unknown',
  chiefComplaint: entry.encounter?.chiefComplaint || entry.notes || 'No complaint recorded',
  arrivalTime: entry.createdAt,
  priority: mapPriority(entry.priority),
  status: mapStatus(entry.status),
  waitTime: calculateWaitTime(entry.createdAt),
});

const priorityColors: Record<string, { bg: string; text: string; label: string }> = {
  immediate: { bg: 'bg-red-100', text: 'text-red-700', label: 'Immediate' },
  urgent: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Urgent' },
  'less-urgent': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Less Urgent' },
  'non-urgent': { bg: 'bg-green-100', text: 'text-green-700', label: 'Non-Urgent' },
};

export default function TriageQueuePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<TriagePatient | null>(null);

  // Fetch queue from API - triage service point
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['triage-queue'],
    queryFn: () => queueService.getQueue({ servicePoint: 'triage', status: 'waiting' }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Also get consultation queue as fallback (patients might go directly to consultation)
  const { data: consultQueue } = useQuery({
    queryKey: ['consultation-queue'],
    queryFn: () => queueService.getQueue({ servicePoint: 'consultation' }),
    refetchInterval: 30000,
  });

  // Transform API data to UI format
  const allQueue: TriagePatient[] = [
    ...(queueData || []).map(transformQueueEntry),
    ...(consultQueue || []).filter(q => q.status === 'waiting').map(transformQueueEntry),
  ];

  const filteredQueue = allQueue.filter((patient) => {
    if (priorityFilter !== 'all' && patient.priority !== priorityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        patient.name.toLowerCase().includes(term) ||
        patient.mrn.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const waitingCount = allQueue.filter((p) => p.status === 'waiting').length;
  const inTriageCount = allQueue.filter((p) => p.status === 'in-triage').length;

  const handleStartTriage = (patient: TriagePatient) => {
    navigate('/nursing/assessment', { state: { patient } });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Triage Queue</h1>
              <p className="text-sm text-gray-500">Patients waiting for triage assessment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">In Queue</p>
          <p className="text-2xl font-bold text-gray-900">{waitingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">In Triage</p>
          <p className="text-2xl font-bold text-teal-600">{inTriageCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-sm text-red-600">Immediate</p>
          <p className="text-2xl font-bold text-red-700">
            {allQueue.filter((p) => p.priority === 'immediate').length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
          <p className="text-sm text-orange-600">Urgent</p>
          <p className="text-2xl font-bold text-orange-700">
            {allQueue.filter((p) => p.priority === 'urgent').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Avg Wait</p>
          <p className="text-2xl font-bold text-gray-900">
            {allQueue.length > 0 ? Math.round(allQueue.reduce((a, b) => a + b.waitTime, 0) / allQueue.length) : 0}m
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Priorities</option>
            <option value="immediate">Immediate</option>
            <option value="urgent">Urgent</option>
            <option value="less-urgent">Less Urgent</option>
            <option value="non-urgent">Non-Urgent</option>
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <ListOrdered className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No patients in queue</p>
                </div>
              </div>
            ) : filteredQueue.map((patient) => {
              const priority = priorityColors[patient.priority];
              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedPatient?.id === patient.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                      {patient.queueNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{patient.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${priority.bg} ${priority.text}`}>
                          {priority.label}
                        </span>
                        {patient.status === 'in-triage' && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-teal-100 text-teal-700">
                            In Triage
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                      <p className="text-sm text-gray-600 mt-1 truncate">{patient.chiefComplaint}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-gray-500 text-sm">
                        <Clock className="w-4 h-4" />
                        {patient.waitTime}m
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Patient Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Patient Details</h2>
              <div className="flex-1 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Age</p>
                    <p className="font-medium text-gray-900">{selectedPatient.age} years</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Gender</p>
                    <p className="font-medium text-gray-900">{selectedPatient.gender}</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Queue Number</p>
                  <p className="font-bold text-2xl text-teal-600">#{selectedPatient.queueNumber}</p>
                </div>

                <div className={`p-3 rounded-lg ${priorityColors[selectedPatient.priority].bg}`}>
                  <p className="text-xs text-gray-600">Priority Level</p>
                  <div className="flex items-center gap-2 mt-1">
                    <AlertTriangle className={`w-5 h-5 ${priorityColors[selectedPatient.priority].text}`} />
                    <p className={`font-medium ${priorityColors[selectedPatient.priority].text}`}>
                      {priorityColors[selectedPatient.priority].label}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Chief Complaint</p>
                  <p className="text-gray-900 mt-1">{selectedPatient.chiefComplaint}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Wait Time</p>
                  <p className="font-medium text-gray-900">{selectedPatient.waitTime} minutes</p>
                </div>
              </div>

              <button
                onClick={() => handleStartTriage(selectedPatient)}
                className="w-full mt-4 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
              >
                {selectedPatient.status === 'in-triage' ? 'Continue Triage' : 'Start Triage'}
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ListOrdered className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
