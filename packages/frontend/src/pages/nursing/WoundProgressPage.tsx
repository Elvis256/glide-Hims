import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingDown,
  Search,
  UserCircle,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface Wound {
  id: string;
  location: string;
  type: string;
  startDate: string;
  status: 'healing' | 'stable' | 'worsening' | 'healed';
}

interface ProgressEntry {
  date: string;
  length: number;
  width: number;
  depth: number;
  area: number;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
];

const mockWounds: Record<string, Wound[]> = {
  '1': [
    { id: 'w1', location: 'Left Lower Leg', type: 'Venous Ulcer', startDate: '2024-01-01', status: 'healing' },
    { id: 'w2', location: 'Right Foot', type: 'Diabetic Ulcer', startDate: '2024-01-05', status: 'stable' },
  ],
  '2': [
    { id: 'w3', location: 'Sacrum', type: 'Pressure Ulcer', startDate: '2024-01-10', status: 'worsening' },
  ],
  '3': [
    { id: 'w4', location: 'Left Hand', type: 'Surgical Wound', startDate: '2024-01-08', status: 'healed' },
  ],
};

const mockProgress: Record<string, ProgressEntry[]> = {
  'w1': [
    { date: '2024-01-01', length: 5.0, width: 3.5, depth: 0.8, area: 17.5 },
    { date: '2024-01-05', length: 4.5, width: 3.2, depth: 0.6, area: 14.4 },
    { date: '2024-01-10', length: 4.0, width: 2.8, depth: 0.5, area: 11.2 },
    { date: '2024-01-15', length: 3.5, width: 2.5, depth: 0.3, area: 8.75 },
  ],
  'w2': [
    { date: '2024-01-05', length: 2.0, width: 1.5, depth: 0.3, area: 3.0 },
    { date: '2024-01-10', length: 2.0, width: 1.5, depth: 0.3, area: 3.0 },
    { date: '2024-01-15', length: 1.8, width: 1.5, depth: 0.3, area: 2.7 },
  ],
  'w3': [
    { date: '2024-01-10', length: 3.0, width: 2.5, depth: 0.5, area: 7.5 },
    { date: '2024-01-15', length: 3.5, width: 2.8, depth: 0.6, area: 9.8 },
  ],
  'w4': [
    { date: '2024-01-08', length: 4.0, width: 0.5, depth: 0.2, area: 2.0 },
    { date: '2024-01-12', length: 3.0, width: 0.3, depth: 0.1, area: 0.9 },
    { date: '2024-01-15', length: 0, width: 0, depth: 0, area: 0 },
  ],
};

const statusConfig = {
  healing: { label: 'Healing', color: 'bg-green-100 text-green-700', icon: TrendingDown },
  stable: { label: 'Stable', color: 'bg-blue-100 text-blue-700', icon: Minus },
  worsening: { label: 'Worsening', color: 'bg-red-100 text-red-700', icon: ArrowUpRight },
  healed: { label: 'Healed', color: 'bg-teal-100 text-teal-700', icon: CheckCircle },
};

export default function WoundProgressPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const patientWounds = selectedPatient ? mockWounds[selectedPatient.id] || [] : [];
  const progressData = selectedWound ? mockProgress[selectedWound.id] || [] : [];

  const calculateReduction = () => {
    if (progressData.length < 2) return null;
    const first = progressData[0].area;
    const last = progressData[progressData.length - 1].area;
    if (first === 0) return 100;
    return Math.round(((first - last) / first) * 100);
  };

  const reduction = calculateReduction();
  const maxArea = Math.max(...progressData.map((p) => p.area), 1);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wound Progress</h1>
            <p className="text-sm text-gray-500">Track wound healing over time</p>
          </div>
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
            {(searchTerm ? filteredPatients : mockPatients).map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setSelectedWound(null);
                  setSearchTerm('');
                }}
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
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Wound Selection */}
          {selectedPatient && patientWounds.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-medium text-gray-900 text-sm mb-2">Select Wound</h3>
              <div className="space-y-2">
                {patientWounds.map((wound) => {
                  const status = statusConfig[wound.status];
                  const StatusIcon = status.icon;
                  return (
                    <button
                      key={wound.id}
                      onClick={() => setSelectedWound(wound)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedWound?.id === wound.id
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900">{wound.location}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{wound.type}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Progress Display */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedWound ? (
            <div className="flex-1 overflow-y-auto">
              {/* Wound Info & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Wound Location</p>
                  <p className="font-semibold text-gray-900">{selectedWound.location}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Wound Type</p>
                  <p className="font-semibold text-gray-900">{selectedWound.type}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Started</p>
                  <p className="font-semibold text-gray-900">{selectedWound.startDate}</p>
                </div>
                <div className={`p-4 rounded-lg ${reduction !== null && reduction > 0 ? 'bg-green-50' : reduction !== null && reduction < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 mb-1">Size Reduction</p>
                  <div className="flex items-center gap-2">
                    {reduction !== null ? (
                      <>
                        {reduction > 0 ? (
                          <ArrowDownRight className="w-5 h-5 text-green-600" />
                        ) : reduction < 0 ? (
                          <ArrowUpRight className="w-5 h-5 text-red-600" />
                        ) : (
                          <Minus className="w-5 h-5 text-gray-600" />
                        )}
                        <span className={`font-semibold ${reduction > 0 ? 'text-green-700' : reduction < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                          {Math.abs(reduction)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Healing Status */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Healing Status</h3>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${statusConfig[selectedWound.status].color}`}>
                  {(() => {
                    const StatusIcon = statusConfig[selectedWound.status].icon;
                    return <StatusIcon className="w-5 h-5" />;
                  })()}
                  <span className="font-medium">{statusConfig[selectedWound.status].label}</span>
                </div>
              </div>

              {/* Simple Chart */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Wound Area Over Time (cm²)</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-end justify-between h-40 gap-2">
                    {progressData.map((entry, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-teal-500 rounded-t transition-all"
                          style={{ height: `${(entry.area / maxArea) * 100}%`, minHeight: entry.area > 0 ? '4px' : '0' }}
                        />
                        <div className="text-xs text-gray-600 mt-2 font-medium">{entry.area}</div>
                        <div className="text-xs text-gray-400">{entry.date.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Measurement Timeline */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Measurement History</h3>
                <div className="space-y-3">
                  {progressData.slice().reverse().map((entry, index) => (
                    <div key={index} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{entry.date}</span>
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">L:</span>{' '}
                          <span className="font-medium">{entry.length} cm</span>
                        </div>
                        <div>
                          <span className="text-gray-500">W:</span>{' '}
                          <span className="font-medium">{entry.width} cm</span>
                        </div>
                        <div>
                          <span className="text-gray-500">D:</span>{' '}
                          <span className="font-medium">{entry.depth} cm</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Area:</span>{' '}
                          <span className="font-medium">{entry.area} cm²</span>
                        </div>
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                          Latest
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : selectedPatient ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a wound to view progress</p>
                {patientWounds.length === 0 && (
                  <p className="text-sm mt-1">No wounds documented for this patient</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingDown className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view wound progress</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
