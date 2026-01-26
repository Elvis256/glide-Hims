import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  XCircle,
  Search,
  Calendar,
  Clock,
  UserCircle,
  Stethoscope,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

interface Appointment {
  id: string;
  patientName: string;
  patientMrn: string;
  doctor: string;
  department: string;
  date: string;
  time: string;
  status: string;
  reason: string;
}

// Mock data
const mockAppointments: Appointment[] = [
  { id: '1', patientName: 'Sarah Nakimera', patientMrn: 'MRN-2024-0001', doctor: 'Dr. Sarah Nambi', department: 'General OPD', date: '2025-01-25', time: '09:00', status: 'confirmed', reason: 'Follow-up checkup' },
  { id: '2', patientName: 'James Okello', patientMrn: 'MRN-2024-0002', doctor: 'Dr. Francis Olweny', department: 'Cardiology', date: '2025-01-25', time: '10:00', status: 'scheduled', reason: 'Heart palpitations' },
];

const availableSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'];

export default function ManageAppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('id');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(
    appointmentId ? mockAppointments.find(a => a.id === appointmentId) || null : null
  );
  const [action, setAction] = useState<'reschedule' | 'cancel' | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredAppointments = mockAppointments.filter(
    (apt) =>
      apt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.patientMrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReschedule = () => {
    // In production, call API
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedAppointment(null);
      setAction(null);
    }, 2000);
  };

  const handleCancel = () => {
    // In production, call API
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setSelectedAppointment(null);
      setAction(null);
    }, 2000);
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
            {filteredAppointments.map((apt) => (
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
                      <p className="font-medium text-gray-900">{apt.patientName}</p>
                      <p className="text-xs text-gray-500">{apt.patientMrn}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{new Date(apt.date).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">{apt.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <Stethoscope className="w-3 h-3" />
                  <span>{apt.doctor}</span>
                  <span>•</span>
                  <span>{apt.department}</span>
                </div>
              </button>
            ))}
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
                    <p className="font-medium text-gray-900">{selectedAppointment.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedAppointment.patientMrn}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium">{new Date(selectedAppointment.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Time</p>
                    <p className="font-medium">{selectedAppointment.time}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Doctor</p>
                    <p className="font-medium">{selectedAppointment.doctor}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Department</p>
                    <p className="font-medium">{selectedAppointment.department}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Reason</p>
                    <p className="font-medium">{selectedAppointment.reason}</p>
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
                <button onClick={() => setAction(null)} className="btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!newDate || !newTime}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
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
                <button onClick={() => setAction(null)} className="btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReason}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex-1 disabled:opacity-50"
                >
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
