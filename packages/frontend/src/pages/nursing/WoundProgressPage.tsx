import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { patientsService, type Patient as ApiPatient } from '../../services/patients';
import { ipdService } from '../../services/ipd';

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

// Helper to convert API patient to local Patient format
const mapPatient = (p: ApiPatient): Patient => ({
  id: p.id,
  mrn: p.mrn,
  name: p.fullName,
  age: Math.floor((new Date().getTime() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
  gender: p.gender,
});

const statusConfig = {
  healing: { label: 'Healing', color: 'bg-green-100 text-green-700', icon: TrendingDown },
  stable: { label: 'Stable', color: 'bg-blue-100 text-blue-700', icon: Minus },
  worsening: { label: 'Worsening', color: 'bg-red-100 text-red-700', icon: ArrowUpRight },
  healed: { label: 'Healed', color: 'bg-teal-100 text-teal-700', icon: CheckCircle },
};

export default function WoundProgressPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  });

  // Search patients via API
  const { data: patientsData, isLoading: searchLoading } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () => patientsService.search({ search: debouncedSearch, limit: 20 }),
    enabled: debouncedSearch.length >= 2,
  });

  const patients: Patient[] = useMemo(() => {
    return patientsData?.data?.map(mapPatient) || [];
  }, [patientsData]);

  // Fetch nursing notes for wound data
  const { data: nursingNotes } = useQuery({
    queryKey: ['ipd', 'nursing-notes', selectedPatient?.id],
    queryFn: async () => {
      // Get admissions for patient first
      const admissions = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      if (admissions.data.length > 0) {
        return ipdService.nursingNotes.list(admissions.data[0].id);
      }
      return [];
    },
    enabled: !!selectedPatient?.id,
  });

  // Extract wounds from nursing notes (wound-related notes)
  const patientWounds: Wound[] = useMemo(() => {
    if (!nursingNotes) return [];
    return nursingNotes
      .filter(note => note.type === 'observation' && note.content.toLowerCase().includes('wound'))
      .map((note, idx) => ({
        id: note.id,
        location: `Wound ${idx + 1}`,
        type: 'Documented Wound',
        startDate: new Date(note.createdAt).toISOString().split('T')[0],
        status: 'stable' as const,
      }));
  }, [nursingNotes]);

  // Progress data from nursing notes
  const progressData: ProgressEntry[] = useMemo(() => {
    if (!selectedWound || !nursingNotes) return [];
    // Parse wound measurements from notes if available
    return [];
  }, [selectedWound, nursingNotes]);

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
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Searching...</p>
                </div>
              ) : patients.length > 0 ? (
              patients.map((patient) => (
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
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No patients found</p>
              </div>
            )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
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
