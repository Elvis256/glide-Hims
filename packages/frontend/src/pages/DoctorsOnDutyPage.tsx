import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { doctorDutyService, type DoctorWithDutyStatus, type DutyStatus } from '../services/doctor-duty';

const statusConfig: Record<DutyStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  on_duty: { label: 'On Duty', color: 'text-green-700', bgColor: 'bg-green-100', icon: UserCheck },
  off_duty: { label: 'Off Duty', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: UserX },
  on_break: { label: 'On Break', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Coffee },
  in_consultation: { label: 'In Consultation', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Stethoscope },
};

export default function DoctorsOnDutyPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [checkInModal, setCheckInModal] = useState<{ open: boolean; doctor?: DoctorWithDutyStatus }>({ open: false });
  const [roomNumber, setRoomNumber] = useState('');

  // Fetch doctors with duty status
  const { data: doctors, isLoading, error, refetch } = useQuery({
    queryKey: ['doctors-with-status'],
    queryFn: () => doctorDutyService.getDoctorsWithStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: doctorDutyService.checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
      setCheckInModal({ open: false });
      setRoomNumber('');
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: (id: string) => doctorDutyService.checkOut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DutyStatus }) =>
      doctorDutyService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-with-status'] });
    },
  });

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    return doctors.filter((doc) => {
      const matchesSearch =
        doc.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [doctors, searchTerm, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    if (!doctors) return { onDuty: 0, offDuty: 0, onBreak: 0, inConsultation: 0 };
    return {
      onDuty: doctors.filter((d) => d.status === 'on_duty').length,
      offDuty: doctors.filter((d) => d.status === 'off_duty').length,
      onBreak: doctors.filter((d) => d.status === 'on_break').length,
      inConsultation: doctors.filter((d) => d.status === 'in_consultation').length,
    };
  }, [doctors]);

  const handleCheckIn = (doctor: DoctorWithDutyStatus) => {
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
    if (doctor.dutyId && confirm(`Check out ${doctor.fullName}?`)) {
      checkOutMutation.mutate(doctor.dutyId);
    }
  };

  const handleStatusChange = (doctor: DoctorWithDutyStatus, newStatus: DutyStatus) => {
    if (doctor.dutyId) {
      updateStatusMutation.mutate({ id: doctor.dutyId, status: newStatus });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-red-600">Failed to load doctors</p>
          <button onClick={() => refetch()} className="btn-secondary mt-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctors On Duty</h1>
          <p className="text-gray-500 text-sm">Manage doctor availability for today</p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.onDuty}</p>
              <p className="text-xs text-green-600">On Duty</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Stethoscope className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.inConsultation}</p>
              <p className="text-xs text-blue-600">In Consultation</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.onBreak}</p>
              <p className="text-xs text-yellow-600">On Break</p>
            </div>
          </div>
        </div>
        <div className="card p-4 bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <UserX className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.offDuty}</p>
              <p className="text-xs text-gray-500">Off Duty</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search doctors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-40"
          >
            <option value="all">All Status</option>
            <option value="on_duty">On Duty</option>
            <option value="off_duty">Off Duty</option>
            <option value="on_break">On Break</option>
            <option value="in_consultation">In Consultation</option>
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

            return (
              <div
                key={doctor.id}
                className={`card p-4 border-l-4 ${
                  isOnDuty ? 'border-l-green-500' : 'border-l-gray-300'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${status.bgColor}`}
                    >
                      <StatusIcon className={`w-5 h-5 ${status.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{doctor.fullName}</h3>
                      <p className="text-xs text-gray-500">
                        {doctor.roles?.join(', ') || 'Doctor'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-1 mb-3 text-sm">
                  {doctor.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-3 h-3" />
                      <span>{doctor.phone}</span>
                    </div>
                  )}
                  {doctor.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{doctor.email}</span>
                    </div>
                  )}
                  {doctor.roomNumber && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span>Room {doctor.roomNumber}</span>
                    </div>
                  )}
                </div>

                {/* Queue Info (if on duty) */}
                {isOnDuty && (
                  <div className="flex items-center gap-4 mb-3 p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{doctor.currentQueueCount}</span>
                      <span className="text-gray-500">/ {doctor.maxPatients}</span>
                    </div>
                    {doctor.checkInTime && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Since {doctor.checkInTime.slice(0, 5)}</span>
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
                      {checkInMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          Check In
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <select
                        value={doctor.status}
                        onChange={(e) => handleStatusChange(doctor, e.target.value as DutyStatus)}
                        className="input py-1.5 text-sm flex-1"
                        disabled={updateStatusMutation.isPending}
                      >
                        <option value="on_duty">On Duty</option>
                        <option value="on_break">On Break</option>
                        <option value="in_consultation">In Consultation</option>
                      </select>
                      <button
                        onClick={() => handleCheckOut(doctor)}
                        className="btn-secondary py-2 px-3 text-sm flex items-center gap-1"
                        disabled={checkOutMutation.isPending}
                      >
                        {checkOutMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserX className="w-4 h-4" />
                            Out
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filteredDoctors.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No doctors found</p>
            </div>
          )}
        </div>
      )}

      {/* Check-in Modal */}
      {checkInModal.open && checkInModal.doctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Check In Doctor</h2>
                <p className="text-sm text-gray-500">{checkInModal.doctor.fullName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Number (Optional)
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g., Room 101"
                  className="input"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setCheckInModal({ open: false });
                  setRoomNumber('');
                }}
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
    </div>
  );
}
