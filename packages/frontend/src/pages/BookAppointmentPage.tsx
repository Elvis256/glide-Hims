import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Search,
  UserCircle,
  Clock,
  Stethoscope,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { patientsService, type Patient } from '../services/patients';
import { facilitiesService, type Department } from '../services/facilities';
import { usersService, type User } from '../services/users';

// Default time slots for doctors (could be extended to fetch from API in the future)
const DEFAULT_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

export default function BookAppointmentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch patients when search term changes (min 2 chars)
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.trim().length >= 2,
  });
  const patients = patientsData?.data || [];

  // Fetch all departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
  });

  // Fetch users (doctors/providers) - filter active users who can be doctors
  const { data: usersData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['users-doctors'],
    queryFn: () => usersService.list({ status: 'active', limit: 100 }),
  });
  const allDoctors = usersData?.data || [];

  // For now, show all active users as potential doctors (in production, filter by role)
  const availableDoctors = allDoctors;
  const selectedDoctorData = availableDoctors.find((d: User) => d.id === selectedDoctor);

  const handleBook = () => {
    // In production, call API
    setShowSuccess(true);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedPatient(null);
    setSelectedDept('');
    setSelectedDoctor('');
    setSelectedDate('');
    setSelectedTime('');
    setReason('');
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
          <p className="text-gray-500 mb-4">
            Appointment confirmed for {selectedPatient?.fullName}
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">{new Date(selectedDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Time</p>
                <p className="font-medium">{selectedTime}</p>
              </div>
              <div>
                <p className="text-gray-500">Doctor</p>
                <p className="font-medium">{selectedDoctorData?.fullName}</p>
              </div>
              <div>
                <p className="text-gray-500">Department</p>
                <p className="font-medium">{departments.find((d: Department) => d.id === selectedDept)?.name}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary flex-1">
              Book Another
            </button>
            <button onClick={() => navigate('/appointments')} className="btn-primary flex-1">
              View Appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Book Appointment</h1>
            <p className="text-gray-500 text-sm">Schedule a patient appointment</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {s}
            </div>
            <span className={`text-sm hidden sm:block ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
              {s === 1 ? 'Patient' : s === 2 ? 'Department' : s === 3 ? 'Date/Time' : 'Confirm'}
            </span>
            {s < 4 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {step === 1 && (
          <div className="card p-4 h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Patient</h2>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.phone}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-3 flex-shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or MRN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-9 py-2"
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {patientsLoading && searchTerm.length >= 2 ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : patients.length === 0 && searchTerm.length >= 2 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No patients found</p>
                  ) : (
                    patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }}
                        className="w-full flex items-center gap-3 p-3 rounded hover:bg-gray-50 text-left"
                      >
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserCircle className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.fullName}</p>
                          <p className="text-sm text-gray-500">{patient.mrn} {patient.phone && `• ${patient.phone}`}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            {selectedPatient && (
              <button onClick={() => setStep(2)} className="btn-primary mt-4 flex-shrink-0">
                Continue
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="card p-4 h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Department & Doctor</h2>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
              {/* Departments */}
              <div className="flex flex-col min-h-0">
                <p className="text-xs text-gray-500 mb-2 flex-shrink-0">Department</p>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {departmentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : departments.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No departments found</p>
                  ) : (
                    departments.filter((dept: Department) => dept.isActive).map((dept: Department) => (
                      <button
                        key={dept.id}
                        onClick={() => { setSelectedDept(dept.id); setSelectedDoctor(''); }}
                        className={`w-full p-3 rounded border text-left ${
                          selectedDept === dept.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {dept.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Doctors */}
              <div className="flex flex-col min-h-0">
                <p className="text-xs text-gray-500 mb-2 flex-shrink-0">Doctor</p>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {doctorsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : !selectedDept ? (
                    <p className="text-gray-400 text-sm text-center py-8">Select a department first</p>
                  ) : availableDoctors.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">No doctors available</p>
                  ) : (
                    availableDoctors.map((doctor: User) => (
                      <button
                        key={doctor.id}
                        onClick={() => setSelectedDoctor(doctor.id)}
                        className={`w-full p-3 rounded border text-left ${
                          selectedDoctor === doctor.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />
                          <span>{doctor.fullName}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{DEFAULT_SLOTS.length} slots available</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4 flex-shrink-0">
              <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedDoctor}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card p-4 h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Date & Time</h2>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
              {/* Date */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Date</p>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input py-2"
                />
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Reason for Visit</p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Brief description..."
                    className="input py-2 h-24 resize-none"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="flex flex-col min-h-0">
                <p className="text-xs text-gray-500 mb-2 flex-shrink-0">Available Time Slots</p>
                {!selectedDate ? (
                  <p className="text-gray-400 text-sm text-center py-8">Select a date first</p>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-2">
                      {DEFAULT_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`p-2 rounded border text-center ${
                            selectedTime === slot
                              ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Clock className="w-4 h-4 mx-auto mb-1" />
                          <span className="text-sm">{slot}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4 flex-shrink-0">
              <button onClick={() => setStep(2)} className="btn-secondary">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={!selectedDate || !selectedTime}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card p-4 h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Confirm Appointment</h2>
            <div className="flex-1 overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient?.fullName}</p>
                    <p className="text-sm text-gray-500">{selectedPatient?.mrn}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="font-medium">{departments.find((d: Department) => d.id === selectedDept)?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Doctor</p>
                    <p className="font-medium">{selectedDoctorData?.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium">{new Date(selectedDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Time</p>
                    <p className="font-medium">{selectedTime}</p>
                  </div>
                  {reason && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Reason</p>
                      <p className="text-sm">{reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4 flex-shrink-0">
              <button onClick={() => setStep(3)} className="btn-secondary">Back</button>
              <button onClick={handleBook} className="btn-primary flex-1">
                Confirm Booking
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
