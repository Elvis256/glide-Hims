import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarPlus,
  User,
  Clock,
  Calendar,
  Stethoscope,
  FileText,
  Bell,
  TestTube,
  Search,
  Check,
  Loader2,
} from 'lucide-react';
import { patientsService, type Patient as APIPatient } from '../../../services/patients';
import { schedulesService } from '../../../services/schedules';
import { providersService } from '../../../services/providers';
import { followUpsService, type CreateFollowUpDto, type FollowUp, type FollowUpType } from '../../../services/follow-ups';
import { labService } from '../../../services/lab';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  currentEncounter: {
    diagnosis: string;
    procedure?: string;
    date: string;
  };
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

interface AvailableSlot {
  date: string;
  time: string;
  doctor: string;
  doctorId?: string;
}

// Transform API patient to local Patient interface
const transformPatient = (apiPatient: APIPatient): Patient => ({
  id: apiPatient.id,
  name: apiPatient.fullName,
  mrn: apiPatient.mrn,
  currentEncounter: {
    diagnosis: 'Pending diagnosis',
    date: new Date().toISOString().split('T')[0],
  },
});

// Static reference data for doctors (populated from API)
const emptyDoctors: Doctor[] = [];

const followUpReasons = [
  'Post-procedure check',
  'Medication review',
  'Lab results review',
  'Chronic disease management',
  'Wound check',
  'Progress evaluation',
  'Treatment adjustment',
  'Pre-operative assessment',
  'Vaccination follow-up',
  'Mental health review',
];

const followUpIntervals = [
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: '30', label: '1 month' },
  { value: '60', label: '2 months' },
  { value: '90', label: '3 months' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
];

// availableTests are loaded from lab catalog API — see query below

type TimeframeUnit = 'days' | 'weeks' | 'months';
type ReminderType = 'sms' | 'email' | 'both' | 'none';

export default function ScheduleFollowUpPage() {
  const { hasPermission } = usePermissions();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [followUpReason, setFollowUpReason] = useState('');
  const [timeframeValue, setTimeframeValue] = useState(2);
  const [timeframeUnit, setTimeframeUnit] = useState<TimeframeUnit>('weeks');
  const [preferredDate, setPreferredDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<ReminderType>('both');
  const [confirmedFollowUp, setConfirmedFollowUp] = useState<FollowUp | null>(null);

  // Fetch patients when search term changes (min 2 chars)
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.trim().length >= 2,
  });

  // Fetch providers (doctors) from API
  const { data: providersData } = useQuery({
    queryKey: ['providers'],
    queryFn: () => providersService.list({ status: 'active' }),
  });

  const doctors: Doctor[] = useMemo(() => {
    if (!providersData || !Array.isArray(providersData)) return emptyDoctors;
    return providersData.map((p) => ({
      id: p.id,
      name: p.fullName || `${p.firstName} ${p.lastName}`,
      specialty: p.specialty || p.providerType || '',
    }));
  }, [providersData]);

  // Fetch lab tests for follow-up test selection
  const { data: labTestsData } = useQuery({
    queryKey: ['lab-tests-active'],
    queryFn: () => labService.tests.list({ status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });
  const availableTests = useMemo(() => labTestsData?.map(t => t.name) ?? [], [labTestsData]);

  // Fetch schedules and derive available slots for next 14 days
  const { data: schedulesData, isLoading: slotsLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesService.getAll(),
  });

  const availableSlots = useMemo((): AvailableSlot[] => {
    if (!schedulesData?.data) return [];
    const slots: AvailableSlot[] = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];
      const daySchedules = schedulesData.data.filter((s) => s.isActive && s.dayOfWeek === dayOfWeek);
      daySchedules.forEach((schedule) => {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const duration = schedule.slotDuration || 30;
        for (let mins = startMinutes; mins + duration <= endMinutes; mins += duration) {
          const h = Math.floor(mins / 60).toString().padStart(2, '0');
          const m = (mins % 60).toString().padStart(2, '0');
          slots.push({
            date: dateStr,
            time: `${h}:${m}`,
            doctor: schedule.doctor
              ? `${schedule.doctor.firstName} ${schedule.doctor.lastName}`
              : 'Unknown Doctor',
            doctorId: schedule.doctorId,
          });
        }
      });
    }
    return slots;
  }, [schedulesData]);

  const filteredPatients = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map(transformPatient);
  }, [patientsData]);

  const calculatedDate = useMemo(() => {
    const date = new Date();
    switch (timeframeUnit) {
      case 'days':
        date.setDate(date.getDate() + timeframeValue);
        break;
      case 'weeks':
        date.setDate(date.getDate() + timeframeValue * 7);
        break;
      case 'months':
        date.setMonth(date.getMonth() + timeframeValue);
        break;
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [timeframeValue, timeframeUnit]);

  const toggleTest = (test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const reasonToType: Record<string, FollowUpType> = {
    'Post-procedure check': 'post_procedure',
    'Medication review': 'medication_review',
    'Lab results review': 'lab_review',
    'Chronic disease management': 'chronic_care',
    'Wound check': 'wound_care',
    'Progress evaluation': 'routine',
    'Treatment adjustment': 'routine',
    'Pre-operative assessment': 'other',
    'Vaccination follow-up': 'vaccination',
    'Mental health review': 'other',
  };

  const scheduleMutation = useMutation({
    mutationFn: (data: CreateFollowUpDto) => followUpsService.create(data),
    onSuccess: (followUp) => {
      setConfirmedFollowUp(followUp);
      toast.success('Follow-up scheduled successfully!');
    },
    onError: () => {
      toast.error('Failed to schedule follow-up. Please try again.');
    },
  });

  const handleSchedule = () => {
    if (!selectedPatient) return;
    const scheduledDate = preferredDate || (() => {
      const d = new Date();
      switch (timeframeUnit) {
        case 'days': d.setDate(d.getDate() + timeframeValue); break;
        case 'weeks': d.setDate(d.getDate() + timeframeValue * 7); break;
        case 'months': d.setMonth(d.getMonth() + timeframeValue); break;
      }
      return d.toISOString().split('T')[0];
    })();
    const instructions = [
      notes,
      selectedTests.length > 0 ? `Tests: ${selectedTests.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    scheduleMutation.mutate({
      patientId: selectedPatient.id,
      type: (reasonToType[followUpReason] || 'routine') as FollowUpType,
      scheduledDate,
      scheduledTime: selectedTime || undefined,
      reason: followUpReason || undefined,
      instructions: instructions || undefined,
      providerId: selectedDoctor?.id || undefined,
      smsReminder: reminderType === 'sms' || reminderType === 'both',
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarPlus className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Follow-Up</h1>
            <p className="text-gray-500">Create a new follow-up appointment</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left Panel - Form */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border p-6 overflow-auto">
          <div className="space-y-6">
            {/* Patient Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Select Patient
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or MRN..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onFocus={() => setShowPatientDropdown(true)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {showPatientDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                    {patientsLoading ? (
                      <div className="px-4 py-3 flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching patients...</span>
                      </div>
                    ) : patientSearch.trim().length < 2 ? (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        Type at least 2 characters to search...
                      </div>
                    ) : filteredPatients.length === 0 ? (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        No patients found
                      </div>
                    ) : (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientSearch(patient.name);
                            setShowPatientDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
                        >
                          <span className="font-medium">{patient.name}</span>
                          <span className="text-sm text-gray-500">{patient.mrn}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Current Encounter Info */}
              {selectedPatient && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-800">Current Encounter</p>
                  <p className="text-sm text-blue-700">Diagnosis: {selectedPatient.currentEncounter.diagnosis}</p>
                  {selectedPatient.currentEncounter.procedure && (
                    <p className="text-sm text-blue-700">Procedure: {selectedPatient.currentEncounter.procedure}</p>
                  )}
                  <p className="text-xs text-blue-600 mt-1">Date: {selectedPatient.currentEncounter.date}</p>
                </div>
              )}
            </div>

            {/* Follow-up Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Stethoscope className="w-4 h-4 inline mr-2" />
                Follow-up Reason
              </label>
              <select
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select reason...</option>
                {followUpReasons.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Timeframe
              </label>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">In</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={timeframeValue}
                    onChange={(e) => setTimeframeValue(parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={timeframeUnit}
                    onChange={(e) => setTimeframeUnit(e.target.value as TimeframeUnit)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Suggested date: {calculatedDate}</p>
            </div>

            {/* Preferred Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Preferred Date (Optional)
              </label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Doctor Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Assign to Doctor
              </label>
              {doctors.length === 0 ? (
                <div className="text-sm text-gray-500 italic py-2">No doctors available</div>
              ) : (
                <select
                  value={selectedDoctor?.id || ''}
                  onChange={(e) => setSelectedDoctor(doctors.find((d) => d.id === e.target.value) || null)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Notes for Follow-up
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes or instructions for the follow-up visit..."
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Tests to Perform */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TestTube className="w-4 h-4 inline mr-2" />
                Tests to Perform at Follow-up
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableTests.map((test) => (
                  <button
                    key={test}
                    onClick={() => toggleTest(test)}
                    className={`px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2 border transition-colors ${
                      selectedTests.includes(test)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {selectedTests.includes(test) ? (
                      <Check className="w-4 h-4 text-blue-600" />
                    ) : (
                      <div className="w-4 h-4 border rounded" />
                    )}
                    {test}
                  </button>
                ))}
              </div>
            </div>

            {/* Reminder Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Bell className="w-4 h-4 inline mr-2" />
                Appointment Reminder
              </label>
              <div className="flex gap-3">
                {(['sms', 'email', 'both', 'none'] as ReminderType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setReminderType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      reminderType === type
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Button */}
            <button
              onClick={handleSchedule}
              disabled={!selectedPatient || !followUpReason || scheduleMutation.isPending}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {scheduleMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CalendarPlus className="w-5 h-5" />
              )}
              {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Follow-Up'}
            </button>
          </div>
        </div>

        {/* Right Panel - Available Slots / Confirmation */}
        <div className="w-80 bg-white rounded-xl shadow-sm border p-6 overflow-auto">
          {confirmedFollowUp ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Check className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Booking Confirmed</h2>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Appointment #:</span>
                  <span className="font-medium">{confirmedFollowUp.appointmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Patient:</span>
                  <span className="font-medium">{confirmedFollowUp.patient?.fullName || selectedPatient?.name}</span>
                </div>
                {confirmedFollowUp.provider && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Doctor:</span>
                    <span className="font-medium">{confirmedFollowUp.provider.fullName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium">
                    {new Date(confirmedFollowUp.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {confirmedFollowUp.scheduledTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time:</span>
                    <span className="font-medium">{confirmedFollowUp.scheduledTime}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium capitalize">{confirmedFollowUp.status}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setConfirmedFollowUp(null);
                  setSelectedPatient(null);
                  setPatientSearch('');
                  setFollowUpReason('');
                  setPreferredDate('');
                  setSelectedTime('');
                  setSelectedDoctor(null);
                  setNotes('');
                  setSelectedTests([]);
                }}
                className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Schedule Another
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Next Available Slots
              </h2>
              {slotsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading slots...</span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No available slots</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setPreferredDate(slot.date);
                        setSelectedTime(slot.time);
                        if (slot.doctorId) {
                          const doc = doctors.find((d) => d.id === slot.doctorId);
                          if (doc) setSelectedDoctor(doc);
                        }
                      }}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        preferredDate === slot.date && selectedTime === slot.time
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-sm text-blue-600 font-medium">{slot.time}</span>
                      </div>
                      <p className="text-sm text-gray-500">{slot.doctor}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Summary */}
              {selectedPatient && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Appointment Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Patient:</span>
                      <span className="font-medium">{selectedPatient.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Doctor:</span>
                      <span className="font-medium">{selectedDoctor?.name || '-'}</span>
                    </div>
                    {selectedTime && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time:</span>
                        <span className="font-medium">{selectedTime}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Timeframe:</span>
                      <span className="font-medium">{timeframeValue} {timeframeUnit}</span>
                    </div>
                    {selectedTests.length > 0 && (
                      <div>
                        <span className="text-gray-500">Tests:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedTests.map((test) => (
                            <span key={test} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {test}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reminder:</span>
                      <span className="font-medium capitalize">{reminderType}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
