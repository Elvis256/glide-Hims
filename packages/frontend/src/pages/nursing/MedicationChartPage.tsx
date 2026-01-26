import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Pill,
  CheckCircle,
  Clock,
  XCircle,
  Download,
} from 'lucide-react';

interface MedicationEntry {
  id: string;
  time: string;
  medication: string;
  dose: string;
  route: string;
  status: 'given' | 'held' | 'refused' | 'missed' | 'pending';
  administeredBy?: string;
  notes?: string;
}

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  ward: string;
  bed: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, ward: 'Ward C', bed: 'C-08' },
];

const mockMedChart: MedicationEntry[] = [
  { id: '1', time: '06:00', medication: 'Paracetamol 500mg', dose: '1 tablet', route: 'Oral', status: 'given', administeredBy: 'Nurse Mary' },
  { id: '2', time: '06:00', medication: 'Amoxicillin 500mg', dose: '1 capsule', route: 'Oral', status: 'given', administeredBy: 'Nurse Mary' },
  { id: '3', time: '08:00', medication: 'Metformin 500mg', dose: '1 tablet', route: 'Oral', status: 'given', administeredBy: 'Nurse Jane' },
  { id: '4', time: '12:00', medication: 'Paracetamol 500mg', dose: '1 tablet', route: 'Oral', status: 'pending' },
  { id: '5', time: '12:00', medication: 'Amoxicillin 500mg', dose: '1 capsule', route: 'Oral', status: 'pending' },
  { id: '6', time: '14:00', medication: 'Insulin Glargine', dose: '20 units', route: 'SC', status: 'pending' },
  { id: '7', time: '18:00', medication: 'Paracetamol 500mg', dose: '1 tablet', route: 'Oral', status: 'pending' },
  { id: '8', time: '18:00', medication: 'Amoxicillin 500mg', dose: '1 capsule', route: 'Oral', status: 'pending' },
  { id: '9', time: '22:00', medication: 'Metformin 500mg', dose: '1 tablet', route: 'Oral', status: 'pending' },
];

const timeSlots = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

export default function MedicationChartPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(mockPatients[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return mockPatients;
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const getMedsForTime = (time: string) => {
    return mockMedChart.filter((m) => m.time === time);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'given':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'held':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'refused':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'missed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'given':
        return 'bg-green-50 border-green-200';
      case 'held':
        return 'bg-yellow-50 border-yellow-200';
      case 'refused':
      case 'missed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Medication Chart</h1>
              <p className="text-sm text-gray-500">View patient medication administration record</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedPatient?.id === patient.id
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                    <p className="text-xs text-gray-500">{patient.mrn}</p>
                    <p className="text-xs text-teal-600">{patient.ward} - {patient.bed}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Medication Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPatient.ward} - Bed {selectedPatient.bed}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-gray-600">Given</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-gray-600">Held</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-gray-600">Refused</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Pending</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-4">
                  {timeSlots.map((time) => {
                    const meds = getMedsForTime(time);
                    if (meds.length === 0) return null;
                    
                    return (
                      <div key={time}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700">{time}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {meds.map((med) => (
                            <div
                              key={med.id}
                              className={`p-3 rounded-lg border ${getStatusBg(med.status)}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Pill className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 truncate">{med.medication}</span>
                                    {getStatusIcon(med.status)}
                                  </div>
                                  <p className="text-xs text-gray-500">{med.dose} • {med.route}</p>
                                  {med.administeredBy && (
                                    <p className="text-xs text-gray-400 mt-1">By: {med.administeredBy}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view medication chart</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
