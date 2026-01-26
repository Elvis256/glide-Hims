import { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Plus,
  User,
  Clock,
  Thermometer,
  Heart,
  Activity,
  Droplets,
  Wind,
  Pill,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Bed,
  Edit,
  TrendingUp,
} from 'lucide-react';

interface VitalSign {
  id: string;
  timestamp: string;
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  recordedBy: string;
}

interface NursingNote {
  id: string;
  timestamp: string;
  shift: 'Day' | 'Evening' | 'Night';
  nurse: string;
  category: 'Assessment' | 'Intervention' | 'Observation' | 'Education' | 'Communication';
  content: string;
}

interface MedicationAdmin {
  id: string;
  medication: string;
  dose: string;
  route: string;
  scheduledTime: string;
  administeredTime?: string;
  status: 'Pending' | 'Given' | 'Held' | 'Refused';
  administeredBy?: string;
  notes?: string;
}

interface CarePlan {
  id: string;
  problem: string;
  goal: string;
  interventions: string[];
  status: 'Active' | 'Resolved' | 'On Hold';
  startDate: string;
  progress: number;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  admissionDate: string;
  diagnosis: string;
  allergies: string[];
  vitalSigns: VitalSign[];
  nursingNotes: NursingNote[];
  medications: MedicationAdmin[];
  carePlans: CarePlan[];
}

const mockPatients: Patient[] = [
  {
    id: 'P001',
    name: 'John Mwangi',
    age: 45,
    gender: 'Male',
    ward: 'General Ward A',
    bed: 'A-102',
    admissionDate: '2024-01-12',
    diagnosis: 'Post-Appendectomy',
    allergies: ['Penicillin', 'Sulfa drugs'],
    vitalSigns: [
      { id: 'V001', timestamp: '2024-01-15 06:00', temperature: 36.8, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, pulse: 72, respiratoryRate: 16, oxygenSaturation: 98, recordedBy: 'Nurse Jane' },
      { id: 'V002', timestamp: '2024-01-15 10:00', temperature: 37.1, bloodPressureSystolic: 118, bloodPressureDiastolic: 78, pulse: 76, respiratoryRate: 18, oxygenSaturation: 97, recordedBy: 'Nurse Jane' },
      { id: 'V003', timestamp: '2024-01-15 14:00', temperature: 36.9, bloodPressureSystolic: 122, bloodPressureDiastolic: 82, pulse: 70, respiratoryRate: 16, oxygenSaturation: 98, recordedBy: 'Nurse Mary' },
      { id: 'V004', timestamp: '2024-01-15 18:00', temperature: 37.0, bloodPressureSystolic: 125, bloodPressureDiastolic: 85, pulse: 74, respiratoryRate: 17, oxygenSaturation: 99, recordedBy: 'Nurse Mary' },
      { id: 'V005', timestamp: '2024-01-15 22:00', temperature: 36.7, bloodPressureSystolic: 118, bloodPressureDiastolic: 76, pulse: 68, respiratoryRate: 14, oxygenSaturation: 98, recordedBy: 'Nurse Peter' },
    ],
    nursingNotes: [
      { id: 'N001', timestamp: '2024-01-15 07:00', shift: 'Day', nurse: 'Nurse Jane', category: 'Assessment', content: 'Patient alert and oriented. Incision site clean and dry. Minimal drainage noted. Pain level 3/10. Ambulated to bathroom with assistance.' },
      { id: 'N002', timestamp: '2024-01-15 12:00', shift: 'Day', nurse: 'Nurse Jane', category: 'Intervention', content: 'Dressing changed. Applied sterile dressing to surgical site. Patient tolerated procedure well. Given pain medication as ordered.' },
      { id: 'N003', timestamp: '2024-01-15 15:00', shift: 'Evening', nurse: 'Nurse Mary', category: 'Observation', content: 'Patient resting comfortably. Vital signs stable. IV fluids infusing as ordered. Encouraged oral fluid intake.' },
      { id: 'N004', timestamp: '2024-01-15 19:00', shift: 'Evening', nurse: 'Nurse Mary', category: 'Education', content: 'Educated patient on wound care and signs of infection. Patient verbalized understanding. Family member present during education.' },
    ],
    medications: [
      { id: 'M001', medication: 'Ceftriaxone 1g IV', dose: '1g', route: 'IV', scheduledTime: '08:00', administeredTime: '08:15', status: 'Given', administeredBy: 'Nurse Jane' },
      { id: 'M002', medication: 'Ceftriaxone 1g IV', dose: '1g', route: 'IV', scheduledTime: '20:00', status: 'Pending' },
      { id: 'M003', medication: 'Paracetamol 1g', dose: '1g', route: 'PO', scheduledTime: '06:00', administeredTime: '06:10', status: 'Given', administeredBy: 'Nurse Jane' },
      { id: 'M004', medication: 'Paracetamol 1g', dose: '1g', route: 'PO', scheduledTime: '12:00', administeredTime: '12:05', status: 'Given', administeredBy: 'Nurse Jane' },
      { id: 'M005', medication: 'Paracetamol 1g', dose: '1g', route: 'PO', scheduledTime: '18:00', status: 'Pending' },
      { id: 'M006', medication: 'Tramadol 50mg', dose: '50mg', route: 'PO', scheduledTime: 'PRN', administeredTime: '10:30', status: 'Given', administeredBy: 'Nurse Jane', notes: 'Given for pain 5/10' },
    ],
    carePlans: [
      {
        id: 'CP001',
        problem: 'Acute Pain related to surgical incision',
        goal: 'Patient will report pain level ≤3/10 within 24 hours',
        interventions: ['Administer analgesics as ordered', 'Position for comfort', 'Apply cold pack if needed', 'Teach relaxation techniques'],
        status: 'Active',
        startDate: '2024-01-13',
        progress: 75,
      },
      {
        id: 'CP002',
        problem: 'Risk for infection related to surgical wound',
        goal: 'Patient will remain free of signs/symptoms of infection',
        interventions: ['Monitor vital signs q4h', 'Assess incision site daily', 'Maintain sterile dressing', 'Administer antibiotics as ordered'],
        status: 'Active',
        startDate: '2024-01-13',
        progress: 100,
      },
      {
        id: 'CP003',
        problem: 'Impaired mobility related to surgery',
        goal: 'Patient will ambulate independently by discharge',
        interventions: ['Encourage early mobilization', 'Assist with ambulation TID', 'Physical therapy referral', 'Teach proper body mechanics'],
        status: 'Active',
        startDate: '2024-01-14',
        progress: 50,
      },
    ],
  },
  {
    id: 'P002',
    name: 'Mary Wanjiku',
    age: 32,
    gender: 'Female',
    ward: 'Maternity Ward',
    bed: 'MAT-01',
    admissionDate: '2024-01-14',
    diagnosis: 'Post C-section Day 1',
    allergies: [],
    vitalSigns: [
      { id: 'V006', timestamp: '2024-01-15 06:00', temperature: 37.2, bloodPressureSystolic: 115, bloodPressureDiastolic: 75, pulse: 80, respiratoryRate: 18, oxygenSaturation: 98, recordedBy: 'Nurse Anne' },
      { id: 'V007', timestamp: '2024-01-15 14:00', temperature: 37.0, bloodPressureSystolic: 112, bloodPressureDiastolic: 72, pulse: 78, respiratoryRate: 16, oxygenSaturation: 99, recordedBy: 'Nurse Anne' },
    ],
    nursingNotes: [
      { id: 'N005', timestamp: '2024-01-15 08:00', shift: 'Day', nurse: 'Nurse Anne', category: 'Assessment', content: 'Post-op day 1. Patient stable. Fundus firm at umbilicus. Lochia moderate. Breastfeeding initiated.' },
    ],
    medications: [
      { id: 'M007', medication: 'Oxytocin 10 IU IM', dose: '10 IU', route: 'IM', scheduledTime: '06:00', administeredTime: '06:05', status: 'Given', administeredBy: 'Nurse Anne' },
    ],
    carePlans: [
      {
        id: 'CP004',
        problem: 'Acute Pain related to C-section',
        goal: 'Pain controlled at ≤4/10',
        interventions: ['PCA pump management', 'Position changes', 'Breathing exercises'],
        status: 'Active',
        startDate: '2024-01-14',
        progress: 60,
      },
    ],
  },
];

export default function IPDNursingNotesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'vitals' | 'medications' | 'carePlan'>('notes');
  const [selectedShift, setSelectedShift] = useState<'All' | 'Day' | 'Evening' | 'Night'>('All');

  const filteredPatients = useMemo(() => {
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bed.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const filteredNotes = useMemo(() => {
    if (!selectedPatient) return [];
    if (selectedShift === 'All') return selectedPatient.nursingNotes;
    return selectedPatient.nursingNotes.filter((n) => n.shift === selectedShift);
  }, [selectedPatient, selectedShift]);

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      Assessment: 'bg-blue-100 text-blue-700',
      Intervention: 'bg-green-100 text-green-700',
      Observation: 'bg-purple-100 text-purple-700',
      Education: 'bg-yellow-100 text-yellow-700',
      Communication: 'bg-orange-100 text-orange-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getMedStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Pending: 'bg-yellow-100 text-yellow-700',
      Given: 'bg-green-100 text-green-700',
      Held: 'bg-orange-100 text-orange-700',
      Refused: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getCarePlanStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-green-100 text-green-700',
      Resolved: 'bg-blue-100 text-blue-700',
      'On Hold': 'bg-yellow-100 text-yellow-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IPD Nursing Notes</h1>
            <p className="text-sm text-gray-500">Patient care documentation and observations</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedPatient?.id === patient.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-500">{patient.age}y, {patient.gender}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Bed className="w-4 h-4" />
                    <span>{patient.bed} • {patient.ward}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{patient.diagnosis}</p>
                  {patient.allergies.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-600">{patient.allergies.join(', ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {selectedPatient ? (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center gap-2 p-4 border-b border-gray-200">
              {[
                { key: 'notes', label: 'Nursing Notes', icon: <FileText className="w-4 h-4" /> },
                { key: 'vitals', label: 'Vital Signs', icon: <Activity className="w-4 h-4" /> },
                { key: 'medications', label: 'Medications', icon: <Pill className="w-4 h-4" /> },
                { key: 'carePlan', label: 'Care Plan', icon: <ClipboardList className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-pink-100 text-pink-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <button className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium">
                <Plus className="w-4 h-4 inline mr-2" />
                Add Note
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'notes' && (
                <div>
                  {/* Shift Filter */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-gray-500">Filter by shift:</span>
                    {(['All', 'Day', 'Evening', 'Night'] as const).map((shift) => (
                      <button
                        key={shift}
                        onClick={() => setSelectedShift(shift)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedShift === shift
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {shift}
                      </button>
                    ))}
                  </div>

                  {/* Notes List */}
                  <div className="space-y-4">
                    {filteredNotes.map((note) => (
                      <div key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {note.timestamp}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(note.category)}`}>
                              {note.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                              {note.shift} Shift
                            </span>
                          </div>
                          <button className="p-1 text-gray-400 hover:text-pink-600 transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-gray-700 mb-2">{note.content}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-4 h-4" />
                          <span>{note.nurse}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'vitals' && (
                <div>
                  {/* Latest Vitals Summary */}
                  <div className="grid grid-cols-6 gap-4 mb-6">
                    {selectedPatient.vitalSigns.length > 0 && (() => {
                      const latest = selectedPatient.vitalSigns[selectedPatient.vitalSigns.length - 1];
                      return (
                        <>
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <Thermometer className="w-6 h-6 text-red-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{latest.temperature}°C</p>
                            <p className="text-sm text-gray-500">Temperature</p>
                          </div>
                          <div className="bg-pink-50 rounded-lg p-4 text-center">
                            <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{latest.bloodPressureSystolic}/{latest.bloodPressureDiastolic}</p>
                            <p className="text-sm text-gray-500">Blood Pressure</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-4 text-center">
                            <Activity className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{latest.pulse}</p>
                            <p className="text-sm text-gray-500">Pulse (bpm)</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <Wind className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{latest.respiratoryRate}</p>
                            <p className="text-sm text-gray-500">Resp Rate</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 text-center">
                            <Droplets className="w-6 h-6 text-green-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-gray-900">{latest.oxygenSaturation}%</p>
                            <p className="text-sm text-gray-500">SpO2</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 text-center flex flex-col items-center justify-center">
                            <button className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm">
                              <Plus className="w-4 h-4 inline mr-1" />
                              Record Vitals
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Vitals History Table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Time</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Temp (°C)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">BP (mmHg)</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Pulse</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">RR</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">SpO2</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPatient.vitalSigns.map((vital) => (
                          <tr key={vital.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{vital.timestamp}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{vital.temperature}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{vital.pulse}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{vital.respiratoryRate}</td>
                            <td className="px-4 py-3 text-sm text-center font-medium">{vital.oxygenSaturation}%</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{vital.recordedBy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'medications' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Medication Administration Record (MAR)</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                        <CheckCircle className="w-4 h-4" />
                        Given
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        <Clock className="w-4 h-4" />
                        Pending
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedPatient.medications.map((med) => (
                      <div key={med.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${med.status === 'Given' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                              <Pill className={`w-5 h-5 ${med.status === 'Given' ? 'text-green-600' : 'text-yellow-600'}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{med.medication}</p>
                              <p className="text-sm text-gray-500">{med.dose} • {med.route}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Scheduled: {med.scheduledTime}</p>
                              {med.administeredTime && (
                                <p className="text-sm text-green-600">Given: {med.administeredTime}</p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getMedStatusBadge(med.status)}`}>
                              {med.status}
                            </span>
                            {med.status === 'Pending' && (
                              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                                Administer
                              </button>
                            )}
                          </div>
                        </div>
                        {med.administeredBy && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                            <User className="w-4 h-4" />
                            <span>Administered by {med.administeredBy}</span>
                            {med.notes && <span className="text-gray-400">• {med.notes}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'carePlan' && (
                <div className="space-y-4">
                  {selectedPatient.carePlans.map((plan) => (
                    <div key={plan.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCarePlanStatusBadge(plan.status)}`}>
                              {plan.status}
                            </span>
                            <span className="text-sm text-gray-500">Started: {plan.startDate}</span>
                          </div>
                          <h4 className="font-semibold text-gray-900">{plan.problem}</h4>
                        </div>
                        <button className="p-1 text-gray-400 hover:text-pink-600 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-500 mb-1">Goal:</p>
                        <p className="text-gray-700">{plan.goal}</p>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-500 mb-2">Interventions:</p>
                        <ul className="space-y-1">
                          {plan.interventions.map((intervention, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              {intervention}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-500">Progress</span>
                          <span className="text-sm font-medium text-gray-700">{plan.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${plan.progress === 100 ? 'bg-green-500' : 'bg-pink-500'}`}
                            style={{ width: `${plan.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-pink-400 hover:text-pink-600 transition-colors">
                    <Plus className="w-5 h-5 inline mr-2" />
                    Add Care Plan Problem
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to view nursing documentation</p>
          </div>
        )}
      </div>
    </div>
  );
}
