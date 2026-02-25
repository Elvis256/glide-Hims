import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserCheck,
  UserX,
  Clock,
  Users,
  Coffee,
  Stethoscope,
  Phone,
  Mail,
  MapPin,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Building2,
  X,
  Timer,
  UserPlus,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { doctorDutyService, type DoctorWithDutyStatus, type DutyStatus } from '../services/doctor-duty';

const statusConfig: Record<DutyStatus, { label: string; color: string; bgColor: string; borderColor: string; icon: any }> = {
  on_duty: { label: 'On Duty', color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-l-green-500', icon: UserCheck },
  off_duty: { label: 'Off Duty', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-l-gray-300', icon: UserX },
  on_break: { label: 'On Break', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-l-yellow-500', icon: Coffee },
  in_consultation: { label: 'In Consultation', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-l-blue-500', icon: Stethoscope },
};

function formatTime(timeStr?: string): string {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function getDuration(checkInTime?: string): string {
  if (!checkInTime) return '';
  const now = new Date();
  const parts = checkInTime.split(':');
  if (parts.length < 2) return '';
  const checkIn = new Date();
  checkIn.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2] || '0', 10));
  const diffMs = now.getTime() - checkIn.getTime();
  if (diffMs < 0) return '';
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function DoctorsOnDutyPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [checkInModal, setCheckInModal] = useState<{ open: boolean; doctor?: DoctorWithDutyStatus }>({ open: false });
  const [checkOutModal, setCheckOutModal] = useState<{ open: boolean; doctor?: DoctorWithDutyStatus }>({ open: false });
  const [roomNumber, setRoomNumber] = useState('');
  const [maxPatients, setMaxPatients] = useState(20);
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [, setTick] = useState(0);

  // Update duration display every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: doctors, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['doctors-with-status'],
    queryFn: () => doctorDutyService.getDoctorsWithStatus(),
    refetchInterval: 30000,
  });

  const checkInMutation = useMutation({
    mutationFn: doctorDutyService.checkIn,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
      const doc = checkInModal.doctor;
      toast.success(`${doc?.fullName || 'Doctor'} checked in`);
      setCheckInModal({ open: false });
      setRoomNumber('');
      setMaxPatients(20);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to check in');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => doctorDutyService.checkOut(id, notes ? { notes } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
      const doc = checkOutModal.doctor;
      toast.success(`${doc?.fullName || 'Doctor'} checked out`);
      setCheckOutModal({ open: false });
      setCheckOutNotes('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to check out');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DutyStatus }) =>
      doctorDutyService.updateStatus(id, status),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
      const label = statusConfig[vars.status]?.label || vars.status;
      toast.success(`Status updated to ${label}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter((doc) => {
      const matchesSearch =
        doc.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.phone?.includes(searchTerm);
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [doctors, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    if (!doctors) return { total: 0, onDuty: 0, offDuty: 0, onBreak: 0, inConsultation: 0, totalQueue: 0 };
    return {
      total: doctors.length,
      onDuty: doctors.filter((d) => d.status === 'on_duty').length,
      offDuty: doctors.filter((d) => d.status === 'off_duty').length,
      onBreak: doctors.filter((d) => d.status === 'on_break').length,
      inConsultation: doctors.filter((d) => d.status === 'in_consultation').length,
      totalQueue: doctors.reduce((sum, d) => sum + (d.currentQueueCount || 0), 0),
    };
  }, [doctors]);

  const handleCheckIn = (doctor: DoctorWithDutyStatus) => {
    setRoomNumber('');
    setMaxPatients(20);
    setCheckInModal({ open: true, doctor });
  };

  const handleConfirmCheckIn = () => {
    if (checkInModal.doctor) {
      checkInMutation.mutate({
        doctorId: checkInModal.doctor.id,
        roomNumber: roomNumber || undefined,
      });
    }
  };

  const handleCheckOut = (doctor: DoctorWithDutyStatus) => {
    setCheckOutNotes('');
    setCheckOutModal({ open: true, doctor });
  };

  const handleConfirmCheckOut = () => {
    if (checkOutModal.doctor?.dutyId) {
      checkOutMutation.mutate({ id: checkOutModal.doctor.dutyId, notes: checkOutNotes || undefined });
    }
  };

  const handleStatusChange = (doctor: DoctorWithDutyStatus, newStatus: DutyStatus) => {
    if (doctor.dutyId) {
      updateStatusMutation.mutate({ id: doctor.dutyId, status: newStatus });
    }
  };

  const handleExport = () => {
    if (!doctors?.length) return toast.error('No doctors to export');
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Room', 'Check In', 'Check Out', 'Queue', 'Max Patients'];
    const rows = doctors.map((d) => [
      d.fullName, d.email || '', d.phone || '',
      statusConfig[d.status]?.label || d.status,
      d.roomNumber || '', formatTime(d.checkInTime), formatTime(d.checkOutTime),
      d.currentQueueCount, d.maxPatients,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `doctors-on-duty-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-red-600 mb-1">Failed to load doctors</p>
          <p className="text-sm text-gray-500 mb-3">{(error as any)?.response?.data?.message || 'Network error'}</p>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-1 inline" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctors On Duty</h1>
          <p className="text-gray-500 text-sm">
            Manage doctor availability for today
            {dataUpdatedAt > 0 && (
              <span className="ml-2 text-xs text-gray-400">
                • Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1 text-sm" title="Export CSV">
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => refetch()}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => setFilterStatus('on_duty')} className={`card p-4 bg-green-50 border-green-200 text-left transition hover:shadow-md ${filterStatus === 'on_duty' ? 'ring-2 ring-green-400' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.onDuty}</p>
              <p className="text-xs text-green-600">On Duty</p>
            </div>
          </div>
        </button>
        <button onClick={() => setFilterStatus('in_consultation')} className={`card p-4 bg-blue-50 border-blue-200 text-left transition hover:shadow-md ${filterStatus === 'in_consultation' ? 'ring-2 ring-blue-400' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.inConsultation}</p>
              <p className="text-xs text-blue-600">In Consultation</p>
            </div>
          </div>
        </button>
        <button onClick={() => setFilterStatus('on_break')} className={`card p-4 bg-yellow-50 border-yellow-200 text-left transition hover:shadow-md ${filterStatus === 'on_break' ? 'ring-2 ring-yellow-400' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.onBreak}</p>
              <p className="text-xs text-yellow-600">On Break</p>
            </div>
          </div>
        </button>
        <button onClick={() => setFilterStatus('off_duty')} className={`card p-4 bg-gray-50 border-gray-200 text-left transition hover:shadow-md ${filterStatus === 'off_duty' ? 'ring-2 ring-gray-400' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <UserX className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.offDuty}</p>
              <p className="text-xs text-gray-500">Off Duty</p>
            </div>
          </div>
        </button>
        <button onClick={() => setFilterStatus('all')} className={`card p-4 bg-purple-50 border-purple-200 text-left transition hover:shadow-md ${filterStatus === 'all' ? 'ring-2 ring-purple-400' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-700">{stats.total}</p>
              <p className="text-xs text-purple-600">Total Doctors</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-48"
          >
            <option value="all">All Status ({stats.total})</option>
            <option value="on_duty">On Duty ({stats.onDuty})</option>
            <option value="off_duty">Off Duty ({stats.offDuty})</option>
            <option value="on_break">On Break ({stats.onBreak})</option>
            <option value="in_consultation">In Consultation ({stats.inConsultation})</option>
          </select>
        </div>
      </div>

      {/* Doctor List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doctor) => {
            const status = statusConfig[doctor.status];
            const StatusIcon = status.icon;
            const isOnDuty = doctor.status !== 'off_duty';
            const queuePct = doctor.maxPatients > 0 ? Math.min(100, (doctor.currentQueueCount / doctor.maxPatients) * 100) : 0;
            const duration = getDuration(doctor.checkInTime);

            return (
              <div
                key={doctor.id}
                className={`card p-4 border-l-4 ${status.borderColor} transition hover:shadow-md`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status.bgColor}`}>
                      <StatusIcon className={`w-5 h-5 ${status.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{doctor.fullName}</h3>
                      <p className="text-xs text-gray-500">
                        {doctor.roles?.join(', ') || 'Doctor'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-1 mb-3 text-sm">
                  {doctor.phone && (
                    <a href={`tel:${doctor.phone}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
                      <Phone className="w-3 h-3" />
                      <span>{doctor.phone}</span>
                    </a>
                  )}
                  {doctor.email && (
                    <a href={`mailto:${doctor.email}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{doctor.email}</span>
                    </a>
                  )}
                  {doctor.roomNumber && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span>Room {doctor.roomNumber}</span>
                    </div>
                  )}
                </div>

                {/* Queue & Duration (if on duty) */}
                {isOnDuty && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{doctor.currentQueueCount}</span>
                        <span className="text-gray-500">/ {doctor.maxPatients} patients</span>
                      </div>
                      {duration && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Timer className="w-3 h-3" />
                          <span className="text-xs">{duration}</span>
                        </div>
                      )}
                    </div>
                    {/* Queue progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          queuePct >= 90 ? 'bg-red-500' : queuePct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${queuePct}%` }}
                      />
                    </div>
                    {doctor.checkInTime && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Checked in at {formatTime(doctor.checkInTime)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  {doctor.status === 'off_duty' ? (
                    <button
                      onClick={() => handleCheckIn(doctor)}
                      className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2"
                      disabled={checkInMutation.isPending}
                    >
                      <UserCheck className="w-4 h-4" />
                      Check In
                    </button>
                  ) : (
                    <>
                      <select
                        value={doctor.status}
                        onChange={(e) => handleStatusChange(doctor, e.target.value as DutyStatus)}
                        className="input py-1.5 text-sm flex-1"
                        disabled={updateStatusMutation.isPending}
                      >
                        <option value="on_duty">✅ On Duty</option>
                        <option value="on_break">☕ On Break</option>
                        <option value="in_consultation">🩺 In Consultation</option>
                      </select>
                      <button
                        onClick={() => handleCheckOut(doctor)}
                        className="btn-secondary py-2 px-3 text-sm flex items-center gap-1 text-red-600 hover:bg-red-50"
                        disabled={checkOutMutation.isPending}
                      >
                        <UserX className="w-4 h-4" />
                        Out
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filteredDoctors.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              {doctors?.length === 0 ? (
                <>
                  <p className="text-gray-600 font-medium">No doctors found in the system</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Assign the "Doctor" role to staff members in{' '}
                    <a href="/admin/users" className="text-blue-600 hover:underline">User Management</a>{' '}
                    to see them here
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 font-medium">No doctors match your filters</p>
                  <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); }} className="btn-secondary mt-3 text-sm">
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Check-in Modal */}
      {checkInModal.open && checkInModal.doctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCheckInModal({ open: false })}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Check In Doctor</h2>
                  <p className="text-sm text-gray-500">{checkInModal.doctor.fullName}</p>
                </div>
              </div>
              <button onClick={() => setCheckInModal({ open: false })} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room / Office Number
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g., Room 101, OPD-3"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Patients Today
                </label>
                <input
                  type="number"
                  value={maxPatients}
                  onChange={(e) => setMaxPatients(parseInt(e.target.value) || 20)}
                  min={1}
                  max={100}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">Maximum number of patients this doctor can see today</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCheckInModal({ open: false })}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckIn}
                disabled={checkInMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {checkInMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Check In
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {checkOutModal.open && checkOutModal.doctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCheckOutModal({ open: false })}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <UserX className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Check Out Doctor</h2>
                  <p className="text-sm text-gray-500">{checkOutModal.doctor.fullName}</p>
                </div>
              </div>
              <button onClick={() => setCheckOutModal({ open: false })} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              {checkOutModal.doctor.checkInTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Checked in</span>
                  <span className="font-medium">{formatTime(checkOutModal.doctor.checkInTime)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{getDuration(checkOutModal.doctor.checkInTime) || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Patients seen</span>
                <span className="font-medium">{checkOutModal.doctor.currentQueueCount} / {checkOutModal.doctor.maxPatients}</span>
              </div>
              {checkOutModal.doctor.roomNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Room</span>
                  <span className="font-medium">{checkOutModal.doctor.roomNumber}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={checkOutNotes}
                onChange={(e) => setCheckOutNotes(e.target.value)}
                placeholder="Any notes about the shift..."
                className="input min-h-[80px]"
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCheckOutModal({ open: false })}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCheckOut}
                disabled={checkOutMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                {checkOutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    Confirm Check Out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
