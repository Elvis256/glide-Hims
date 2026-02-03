import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

// Static reference data for doctors (would come from API in production)
const doctors: Doctor[] = [
  { id: '1', name: 'Dr. Sarah Nambi', specialty: 'General Medicine' },
  { id: '2', name: 'Dr. James Okello', specialty: 'Cardiology' },
  { id: '3', name: 'Dr. Grace Nakato', specialty: 'Orthopedics' },
  { id: '4', name: 'Dr. Peter Mukasa', specialty: 'Surgery' },
  { id: '5', name: 'Dr. Mary Achieng', specialty: 'Internal Medicine' },
];

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

const availableTests = [
  'Complete Blood Count (CBC)',
  'Basic Metabolic Panel (BMP)',
  'Lipid Panel',
  'HbA1c',
  'Urinalysis',
  'Liver Function Tests',
  'Thyroid Panel',
  'ECG',
  'Chest X-ray',
  'Fasting Blood Sugar',
  'Renal Function Tests',
];

// Generate available slots for next 14 days
const generateAvailableSlots = (): AvailableSlot[] => {
  const slots: AvailableSlot[] = [];
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'];
  for (let i = 1; i <= 14; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
      times.forEach(time => {
        const doctorIdx = Math.floor(Math.random() * doctors.length);
        if (Math.random() > 0.3) { // 70% of slots available
          slots.push({
            date: date.toISOString().split('T')[0],
            time,
            doctor: doctors[doctorIdx].name,
          });
        }
      });
    }
  }
  return slots;
};

const availableSlots: AvailableSlot[] = generateAvailableSlots();

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
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<ReminderType>('both');

  // Fetch patients when search term changes (min 2 chars)
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.trim().length >= 2,
  });

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

  const handleSchedule = () => {
    toast.success('Follow-up scheduled successfully!');
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
              disabled={!selectedPatient || !followUpReason}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <CalendarPlus className="w-5 h-5" />
              Schedule Follow-Up
            </button>
          </div>
        </div>

        {/* Right Panel - Available Slots */}
        <div className="w-80 bg-white rounded-xl shadow-sm border p-6 overflow-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Next Available Slots
          </h2>
          {availableSlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No available slots</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => setPreferredDate(slot.date)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    preferredDate === slot.date
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
        </div>
      </div>
    </div>
  );
}
