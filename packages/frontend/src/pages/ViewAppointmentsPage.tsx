import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Search,
  Clock,
  Stethoscope,
  Plus,
  Eye,
  Edit,
  Phone,
  Loader2,
} from 'lucide-react';
import api from '../services/api';

interface Appointment {
  id: string;
  patientName: string;
  patientMrn: string;
  patientPhone: string;
  doctor: string;
  department: string;
  date: string;
  time: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  reason: string;
}

interface AppointmentsResponse {
  data: Appointment[];
  total: number;
}

export default function ViewAppointmentsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  // Fetch appointments from API
  const { data: appointmentsData, isLoading, error } = useQuery({
    queryKey: ['appointments', dateFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const response = await api.get<AppointmentsResponse>('/appointments', { params });
      return response.data;
    },
  });

  const appointments = appointmentsData?.data || [];

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = !searchTerm || 
      apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patientMrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.doctor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    const matchesDate = !dateFilter || apt.date === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-green-100 text-green-700',
      completed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
      'no-show': 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </span>
    );
  };

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
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
          <p className="text-xs text-gray-500">Total Today</p>
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
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No-Show</option>
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
          ) : filteredAppointments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No appointments found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredAppointments.map((apt) => (
                <div key={apt.id} className="grid grid-cols-7 gap-4 p-3 items-center hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{apt.time}</span>
                  </div>
                  <div className="col-span-2">
                    <p className="font-medium text-gray-900">{apt.patientName}</p>
                    <p className="text-xs text-gray-500">{apt.patientMrn}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{apt.doctor}</span>
                  </div>
                  <div className="text-sm text-gray-600">{apt.department}</div>
                  <div>{getStatusBadge(apt.status)}</div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/appointments/manage?id=${apt.id}`)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <a
                      href={`tel:${apt.patientPhone}`}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
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
