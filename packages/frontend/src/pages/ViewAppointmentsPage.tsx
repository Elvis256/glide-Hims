import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays,
  Search,
  Clock,
  Stethoscope,
  Plus,
  Edit,
  Phone,
  Loader2,
  LogIn,
} from 'lucide-react';
import { appointmentsService, type Appointment, type AppointmentStatus } from '../services/appointments';

const STATUS_OPTIONS: { value: AppointmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-Show' },
];

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  checked_in: 'bg-teal-100 text-teal-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-yellow-100 text-yellow-700',
};

const statusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

export default function ViewAppointmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  // Fetch appointments from API (server-side filters; backend returns {data, meta})
  const { data: listResult, isLoading, error } = useQuery({
    queryKey: ['appointments', dateFilter, statusFilter, searchTerm],
    queryFn: () =>
      appointmentsService.list({
        date: dateFilter || undefined,
        status: statusFilter !== 'all' ? (statusFilter as AppointmentStatus) : undefined,
        search: searchTerm || undefined,
        limit: 100,
      }),
  });

  const appointments = listResult?.data || [];

  // Check-in creates the queue entry for the patient (backend integration)
  const checkInMutation = useMutation({
    mutationFn: (id: string) => appointmentsService.checkIn(id),
    onSuccess: () => {
      toast.success('Patient checked in and added to the queue');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to check in appointment');
    },
  });

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === 'scheduled').length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Appointments</h1>
            <p className="text-gray-500 text-sm">View and manage scheduled appointments</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/appointments/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Book New
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
          <p className="text-xs text-gray-500">Scheduled</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
          <p className="text-xs text-gray-500">Confirmed</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient, MRN, or doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 py-2 text-sm"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input py-2 text-sm w-40"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input py-2 text-sm w-36"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Appointments List */}
      <div className="flex-1 card min-h-0 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-7 gap-4 p-3 border-b bg-gray-50 text-xs font-medium text-gray-500 flex-shrink-0">
          <div>Time</div>
          <div className="col-span-2">Patient</div>
          <div>Doctor</div>
          <div>Department</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
                <p>Loading appointments...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
              <div className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Failed to load appointments</p>
              </div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No appointments found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map((apt: Appointment) => (
                <div key={apt.id} className="grid grid-cols-7 gap-4 p-3 items-center hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{(apt.startTime || '').slice(0, 5)}</span>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium text-gray-900">{apt.patient?.fullName || 'Unknown patient'}</p>
                    <p className="text-xs text-gray-500">{apt.patient?.mrn || apt.appointmentNumber}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{apt.doctor?.fullName || '—'}</span>
                  </div>
                  <div className="text-sm text-gray-600">{apt.department || '—'}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[apt.status] || 'bg-gray-100'}`}>
                      {statusLabel(apt.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                      <button
                        onClick={() => checkInMutation.mutate(apt.id)}
                        disabled={checkInMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded disabled:opacity-50"
                        title="Check in (adds to queue)"
                      >
                        <LogIn className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/appointments/manage?id=${apt.id}`)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Reschedule / Cancel"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {apt.patient?.phone && (
                      <a
                        href={`tel:${apt.patient.phone}`}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
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
