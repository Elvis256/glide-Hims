import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Encounter, Patient, EncounterStatus } from '../types';
import {
  Plus,
  Search,
  Loader2,
  Clock,
  UserCircle,
  Stethoscope,
  ArrowRight,
  X,
  ClipboardList,
} from 'lucide-react';

const statusColors: Record<EncounterStatus, string> = {
  registered: 'bg-blue-100 text-blue-700',
  triage: 'bg-yellow-100 text-yellow-700',
  waiting: 'bg-orange-100 text-orange-700',
  in_consultation: 'bg-purple-100 text-purple-700',
  pending_lab: 'bg-cyan-100 text-cyan-700',
  pending_pharmacy: 'bg-pink-100 text-pink-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  admitted: 'bg-indigo-100 text-indigo-700',
  discharged: 'bg-gray-100 text-gray-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<EncounterStatus, string> = {
  registered: 'Registered',
  triage: 'In Triage',
  waiting: 'Waiting',
  in_consultation: 'In Consultation',
  pending_lab: 'Pending Lab',
  pending_pharmacy: 'Pending Pharmacy',
  pending_payment: 'Pending Payment',
  admitted: 'Admitted',
  discharged: 'Discharged',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Hardcoded facility ID for now - in real app, this would come from user context
const DEFAULT_FACILITY_ID = '00000000-0000-0000-0000-000000000001';

export default function EncountersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showNewVisitModal, setShowNewVisitModal] = useState(false);

  // Fetch encounters
  const { data: encountersData, isLoading } = useQuery({
    queryKey: ['encounters', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const response = await api.get(`/encounters?${params}`);
      return response.data as { data: Encounter[]; total: number };
    },
  });

  // Fetch today's stats
  const { data: stats } = useQuery({
    queryKey: ['encounter-stats'],
    queryFn: async () => {
      const response = await api.get(`/encounters/stats/today?facilityId=${DEFAULT_FACILITY_ID}`);
      return response.data as { total: number; waiting: number; inConsultation: number; completed: number };
    },
  });

  const encounters = encountersData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visits / Encounters</h1>
          <p className="text-gray-500 mt-1">Manage patient visits and consultations</p>
        </div>
        <button
          onClick={() => setShowNewVisitModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Visit
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Today's Visits</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Waiting</p>
            <p className="text-2xl font-bold text-orange-600">{stats.waiting}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">In Consultation</p>
            <p className="text-2xl font-bold text-purple-600">{stats.inConsultation}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by visit number, patient name, or MRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">All Statuses</option>
            <option value="registered">Registered</option>
            <option value="waiting">Waiting</option>
            <option value="in_consultation">In Consultation</option>
            <option value="pending_pharmacy">Pending Pharmacy</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Encounters List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !encounters.length ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No encounters found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Queue</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Visit #</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Patient</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Time</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {encounters.map((encounter) => (
                  <tr key={encounter.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {encounter.queueNumber && (
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full">
                          {encounter.queueNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{encounter.visitNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{encounter.patient?.fullName}</p>
                          <p className="text-xs text-gray-500">{encounter.patient?.mrn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase text-xs font-medium text-gray-600">
                        {encounter.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[encounter.status]}`}>
                        {statusLabels[encounter.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(encounter.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/encounters/${encounter.id}`)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        <Stethoscope className="w-4 h-4" />
                        Open
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Visit Modal */}
      {showNewVisitModal && (
        <NewVisitModal
          onClose={() => setShowNewVisitModal(false)}
          onSuccess={(encounterId) => {
            queryClient.invalidateQueries({ queryKey: ['encounters'] });
            setShowNewVisitModal(false);
            navigate(`/encounters/${encounterId}`);
          }}
        />
      )}
    </div>
  );
}

interface NewVisitModalProps {
  onClose: () => void;
  onSuccess: (encounterId: string) => void;
}

function NewVisitModal({ onClose, onSuccess }: NewVisitModalProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [visitType, setVisitType] = useState<'opd' | 'emergency'>('opd');

  // Search patients
  const { data: patients, isLoading: searchingPatients } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const response = await api.get(`/patients?search=${patientSearch}`);
      return response.data as Patient[];
    },
    enabled: patientSearch.length >= 2,
  });

  // Create encounter mutation
  const createMutation = useMutation({
    mutationFn: async (data: { patientId: string; facilityId: string; type: string; chiefComplaint?: string }) => {
      const response = await api.post('/encounters', data);
      return response.data;
    },
    onSuccess: (data) => {
      onSuccess(data.id);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    createMutation.mutate({
      patientId: selectedPatient.id,
      facilityId: DEFAULT_FACILITY_ID,
      type: visitType,
      chiefComplaint: chiefComplaint || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Patient Visit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Patient *
            </label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                    <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, MRN, or phone..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="input pl-10"
                />
                {searchingPatients && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                )}

                {/* Search Results Dropdown */}
                {patients && patients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch('');
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium text-gray-900">{patient.fullName}</p>
                        <p className="text-sm text-gray-500">
                          MRN: {patient.mrn} • {patient.gender} • {new Date(patient.dateOfBirth).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visit Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visitType"
                  value="opd"
                  checked={visitType === 'opd'}
                  onChange={() => setVisitType('opd')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>OPD (Outpatient)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visitType"
                  value="emergency"
                  checked={visitType === 'emergency'}
                  onChange={() => setVisitType('emergency')}
                  className="w-4 h-4 text-blue-600"
                />
                <span>Emergency</span>
              </label>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chief Complaint
            </label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Brief description of presenting symptoms..."
              className="input"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedPatient || createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Start Visit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
