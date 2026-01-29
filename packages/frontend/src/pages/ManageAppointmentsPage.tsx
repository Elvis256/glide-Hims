import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  XCircle,
  Search,
  Calendar,
  UserCircle,
  Stethoscope,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { followUpsService } from '../services';
import type { FollowUp } from '../services';

const availableSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];

export default function ManageAppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('id');
  
  const [appointments, setAppointments] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<FollowUp | null>(null);
  const [action, setAction] = useState<'reschedule' | 'cancel' | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await followUpsService.findAll();
        setAppointments(data);
        if (appointmentId) {
          const found = data.find(a => a.id === appointmentId);
          if (found) setSelectedAppointment(found);
        }
      } catch (err) {
        setError('Failed to load appointments');
        console.error('Error fetching appointments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [appointmentId]);

  const filteredAppointments = appointments.filter(
    (apt) =>
      apt.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReschedule = async () => {
    if (!selectedAppointment) return;
    try {
      setActionLoading(true);
      await followUpsService.reschedule(selectedAppointment.id, {
        newDate,
        newTime: newTime || undefined,
        reason: 'Rescheduled by staff',
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedAppointment(null);
        setAction(null);
        setNewDate('');
        setNewTime('');
        // Refresh appointments
        followUpsService.findAll().then(setAppointments);
      }, 2000);
    } catch (err) {
      console.error('Error rescheduling appointment:', err);
      setError('Failed to reschedule appointment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedAppointment) return;
    try {
      setActionLoading(true);
      await followUpsService.cancel(selectedAppointment.id, {
        cancellationReason: cancelReason,
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedAppointment(null);
        setAction(null);
        setCancelReason('');
        // Refresh appointments
        followUpsService.findAll().then(setAppointments);
      }, 2000);
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError('Failed to cancel appointment');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Manage Appointments</h1>
            <p className="text-gray-500 text-sm">Reschedule or cancel appointments</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* Left: Search & Select */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Appointment</h2>
          
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-500">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span>{error}</span>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">No appointments found</p>
              </div>
            ) : (
              filteredAppointments.map((apt) => (
              <button
                key={apt.id}
                onClick={() => { setSelectedAppointment(apt); setAction(null); }}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  selectedAppointment?.id === apt.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{apt.patient?.fullName || 'Unknown Patient'}</p>
                      <p className="text-xs text-gray-500">{apt.patient?.mrn || 'No MRN'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(apt.scheduledDate).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">{apt.scheduledTime || '--:--'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <Stethoscope className="w-3 h-3" />
                  <span>{apt.provider?.fullName || 'No provider'}</span>
                  <span>•</span>
                  <span>{apt.department?.name || 'No department'}</span>
                </div>
              </button>
            ))
            )}
          </div>
        </div>

        {/* Right: Action Panel */}
        <div className="card p-4 flex flex-col min-h-0">
          {!selectedAppointment ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an appointment to manage</p>
              </div>
            </div>
          ) : showSuccess ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {action === 'reschedule' ? 'Rescheduled!' : 'Cancelled!'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {action === 'reschedule'
                    ? 'Appointment has been rescheduled successfully'
                    : 'Appointment has been cancelled'}
                </p>
              </div>
            </div>
          ) : !action ? (
            <>
              {/* Appointment Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedAppointment.patient?.fullName || 'Unknown Patient'}</p>
                    <p className="text-sm text-gray-500">{selectedAppointment.patient?.mrn || 'No MRN'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium">{new Date(selectedAppointment.scheduledDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Time</p>
                    <p className="font-medium">{selectedAppointment.scheduledTime || '--:--'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Doctor</p>
                    <p className="font-medium">{selectedAppointment.provider?.fullName || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Department</p>
                    <p className="font-medium">{selectedAppointment.department?.name || 'Not assigned'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Reason</p>
                    <p className="font-medium">{selectedAppointment.reason || 'No reason provided'}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <h3 className="text-sm font-semibold mb-3 flex-shrink-0">Choose Action</h3>
              <div className="flex-1 flex flex-col gap-3">
                <button
                  onClick={() => setAction('reschedule')}
                  className="flex items-center gap-3 p-4 border-2 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-left"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Reschedule</p>
                    <p className="text-sm text-gray-500">Change date or time</p>
                  </div>
                </button>
                <button
                  onClick={() => setAction('cancel')}
                  className="flex items-center gap-3 p-4 border-2 rounded-lg hover:border-red-500 hover:bg-red-50 text-left"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Cancel</p>
                    <p className="text-sm text-gray-500">Cancel this appointment</p>
                  </div>
                </button>
              </div>
            </>
          ) : action === 'reschedule' ? (
            <>
              <h3 className="text-sm font-semibold mb-3 flex-shrink-0">Reschedule Appointment</h3>
              <div className="flex-1 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="input py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">New Time</label>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setNewTime(slot)}
                        className={`p-2 rounded border text-sm ${
                          newTime === slot
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-shrink-0">
                <button onClick={() => setAction(null)} className="btn-secondary" disabled={actionLoading}>
                  Back
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newDate || !newTime || actionLoading}
                  className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Reschedule
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold mb-3 flex-shrink-0">Cancel Appointment</h3>
              <div className="flex-1 overflow-y-auto">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    This action cannot be undone. The patient will be notified of the cancellation.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason for Cancellation
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="input py-2 h-24 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4 flex-shrink-0">
                <button onClick={() => setAction(null)} className="btn-secondary" disabled={actionLoading}>
                  Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason || actionLoading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
