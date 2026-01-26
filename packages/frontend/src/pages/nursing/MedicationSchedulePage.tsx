import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Pill,
  UserCircle,
  CheckCircle,
  AlertTriangle,
  Filter,
  ChevronRight,
} from 'lucide-react';

interface ScheduledMed {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  ward: string;
  bed: string;
  medication: string;
  dose: string;
  route: string;
  scheduledTime: string;
  status: 'pending' | 'given' | 'missed' | 'held';
  priority: 'routine' | 'urgent' | 'stat';
}

const mockSchedule: ScheduledMed[] = [
  {
    id: '1',
    patientId: '1',
    patientName: 'Sarah Nakimera',
    patientMrn: 'MRN-2024-0001',
    ward: 'Ward A',
    bed: 'A-12',
    medication: 'Paracetamol 500mg',
    dose: '1 tablet',
    route: 'Oral',
    scheduledTime: '2026-01-25T00:00:00Z',
    status: 'pending',
    priority: 'routine',
  },
  {
    id: '2',
    patientId: '1',
    patientName: 'Sarah Nakimera',
    patientMrn: 'MRN-2024-0001',
    ward: 'Ward A',
    bed: 'A-12',
    medication: 'Amoxicillin 500mg',
    dose: '1 capsule',
    route: 'Oral',
    scheduledTime: '2026-01-25T00:00:00Z',
    status: 'pending',
    priority: 'routine',
  },
  {
    id: '3',
    patientId: '2',
    patientName: 'James Okello',
    patientMrn: 'MRN-2024-0002',
    ward: 'Ward B',
    bed: 'B-05',
    medication: 'Insulin Glargine 20 units',
    dose: '20 units',
    route: 'Subcutaneous',
    scheduledTime: '2026-01-25T00:00:00Z',
    status: 'pending',
    priority: 'urgent',
  },
  {
    id: '4',
    patientId: '3',
    patientName: 'Peter Ochieng',
    patientMrn: 'MRN-2024-0004',
    ward: 'ICU',
    bed: 'ICU-2',
    medication: 'Morphine 5mg',
    dose: '5mg',
    route: 'IV',
    scheduledTime: '2026-01-25T00:30:00Z',
    status: 'pending',
    priority: 'stat',
  },
  {
    id: '5',
    patientId: '4',
    patientName: 'Grace Namukasa',
    patientMrn: 'MRN-2024-0003',
    ward: 'Ward C',
    bed: 'C-08',
    medication: 'Metformin 500mg',
    dose: '1 tablet',
    route: 'Oral',
    scheduledTime: '2026-01-24T23:00:00Z',
    status: 'given',
    priority: 'routine',
  },
  {
    id: '6',
    patientId: '5',
    patientName: 'Mary Achieng',
    patientMrn: 'MRN-2024-0005',
    ward: 'Ward A',
    bed: 'A-15',
    medication: 'Lisinopril 10mg',
    dose: '1 tablet',
    route: 'Oral',
    scheduledTime: '2026-01-24T22:00:00Z',
    status: 'missed',
    priority: 'routine',
  },
];

const timeSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'];

export default function MedicationSchedulePage() {
  const navigate = useNavigate();
  const [selectedTime, setSelectedTime] = useState('00:00');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'given' | 'missed'>('all');
  const [selectedMed, setSelectedMed] = useState<ScheduledMed | null>(null);

  const filteredMeds = mockSchedule.filter((med) => {
    if (statusFilter !== 'all' && med.status !== statusFilter) return false;
    return true;
  });

  const pendingCount = mockSchedule.filter((m) => m.status === 'pending').length;
  const givenCount = mockSchedule.filter((m) => m.status === 'given').length;
  const missedCount = mockSchedule.filter((m) => m.status === 'missed').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700">Pending</span>;
      case 'given':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">Given</span>;
      case 'missed':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">Missed</span>;
      case 'held':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">Held</span>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'stat':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">STAT</span>;
      case 'urgent':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">Urgent</span>;
      default:
        return null;
    }
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
            <Clock className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Medication Schedule</h1>
              <p className="text-sm text-gray-500">View and manage medication administration times</p>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Scheduled</p>
          <p className="text-2xl font-bold text-gray-900">{mockSchedule.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-sm text-yellow-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-sm text-green-600">Given</p>
          <p className="text-2xl font-bold text-green-700">{givenCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-sm text-red-600">Missed</p>
          <p className="text-2xl font-bold text-red-700">{missedCount}</p>
        </div>
      </div>

      {/* Time Slots */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {timeSlots.map((time) => (
          <button
            key={time}
            onClick={() => setSelectedTime(time)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedTime === time
                ? 'bg-teal-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-teal-300'
            }`}
          >
            {time}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['all', 'pending', 'given', 'missed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-teal-100 text-teal-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Medication List */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredMeds.map((med) => (
              <div
                key={med.id}
                onClick={() => setSelectedMed(med)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedMed?.id === med.id ? 'bg-teal-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Pill className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{med.medication}</span>
                      {getPriorityBadge(med.priority)}
                      {getStatusBadge(med.status)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {med.patientName} • {med.ward} - {med.bed}
                    </p>
                    <p className="text-xs text-gray-400">
                      {med.dose} • {med.route}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedMed ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Medication Details</h2>
              <div className="flex-1 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedMed.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedMed.patientMrn}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Ward</p>
                    <p className="font-medium text-gray-900">{selectedMed.ward}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Bed</p>
                    <p className="font-medium text-gray-900">{selectedMed.bed}</p>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <p className="text-xs text-purple-600">Medication</p>
                  <p className="font-medium text-gray-900">{selectedMed.medication}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Dose</p>
                    <p className="font-medium text-gray-900">{selectedMed.dose}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Route</p>
                    <p className="font-medium text-gray-900">{selectedMed.route}</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedMed.status)}</div>
                </div>

                {selectedMed.status === 'pending' && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm text-yellow-700">Medication due</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedMed.status === 'pending' && (
                <button
                  onClick={() => navigate('/nursing/meds/administer', { state: { medication: selectedMed } })}
                  className="w-full mt-4 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                >
                  Administer Medication
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a medication to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
