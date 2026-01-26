import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Search,
  Filter,
  Clock,
  UserCircle,
  Stethoscope,
  CheckCircle,
  XCircle,
  Calendar,
  Plus,
  Eye,
  Edit,
  Phone,
} from 'lucide-react';

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

// Mock appointments
const mockAppointments: Appointment[] = [
  { id: '1', patientName: 'Sarah Nakimera', patientMrn: 'MRN-2024-0001', patientPhone: '+256 700 123 456', doctor: 'Dr. Sarah Nambi', department: 'General OPD', date: '2025-01-25', time: '09:00', status: 'confirmed', reason: 'Follow-up checkup' },
  { id: '2', patientName: 'James Okello', patientMrn: 'MRN-2024-0002', patientPhone: '+256 755 987 654', doctor: 'Dr. Francis Olweny', department: 'Cardiology', date: '2025-01-25', time: '10:00', status: 'scheduled', reason: 'Heart palpitations' },
  { id: '3', patientName: 'Grace Atim', patientMrn: 'MRN-2024-0003', patientPhone: '+256 780 456 789', doctor: 'Dr. Mary Apio', department: 'Pediatrics', date: '2025-01-25', time: '11:00', status: 'scheduled', reason: 'Child vaccination' },
  { id: '4', patientName: 'Peter Ochen', patientMrn: 'MRN-2024-0004', patientPhone: '+256 701 234 567', doctor: 'Dr. David Otim', department: 'Orthopedics', date: '2025-01-25', time: '14:00', status: 'confirmed', reason: 'Knee pain' },
  { id: '5', patientName: 'Mary Apio', patientMrn: 'MRN-2024-0005', patientPhone: '+256 772 111 222', doctor: 'Dr. Rose Akello', department: 'Gynecology', date: '2025-01-26', time: '09:00', status: 'scheduled', reason: 'Prenatal checkup' },
  { id: '6', patientName: 'David Otim', patientMrn: 'MRN-2025-0001', patientPhone: '+256 703 555 666', doctor: 'Dr. Sarah Nambi', department: 'General OPD', date: '2025-01-24', time: '15:00', status: 'completed', reason: 'Fever and headache' },
  { id: '7', patientName: 'John Okot', patientMrn: 'MRN-2024-0008', patientPhone: '+256 704 777 888', doctor: 'Dr. James Okello', department: 'General OPD', date: '2025-01-24', time: '16:00', status: 'no-show', reason: 'General checkup' },
];

export default function ViewAppointmentsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  const filteredAppointments = mockAppointments.filter((apt) => {
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
    total: mockAppointments.filter(a => a.date === dateFilter).length,
    confirmed: mockAppointments.filter(a => a.date === dateFilter && a.status === 'confirmed').length,
    scheduled: mockAppointments.filter(a => a.date === dateFilter && a.status === 'scheduled').length,
    completed: mockAppointments.filter(a => a.date === dateFilter && a.status === 'completed').length,
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
          {filteredAppointments.length === 0 ? (
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
