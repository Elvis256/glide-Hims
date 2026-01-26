import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bandage,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Calendar,
  User,
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
}

interface DressingEntry {
  id: string;
  date: string;
  time: string;
  woundId: string;
  woundLocation: string;
  dressingType: string;
  performedBy: string;
  observations: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
];

const mockWounds: Record<string, Wound[]> = {
  '1': [
    { id: 'w1', location: 'Left Lower Leg', type: 'Venous Ulcer' },
    { id: 'w2', location: 'Right Foot', type: 'Diabetic Ulcer' },
  ],
  '2': [
    { id: 'w3', location: 'Sacrum', type: 'Pressure Ulcer' },
  ],
  '3': [],
};

const mockDressingEntries: Record<string, DressingEntry[]> = {
  '1': [
    { id: 'd1', date: '2024-01-15', time: '08:30', woundId: 'w1', woundLocation: 'Left Lower Leg', dressingType: 'Foam Dressing', performedBy: 'Nurse Mary', observations: 'Wound appears clean, minimal exudate' },
    { id: 'd2', date: '2024-01-14', time: '09:00', woundId: 'w1', woundLocation: 'Left Lower Leg', dressingType: 'Foam Dressing', performedBy: 'Nurse John', observations: 'Slight improvement in granulation tissue' },
    { id: 'd3', date: '2024-01-13', time: '08:45', woundId: 'w2', woundLocation: 'Right Foot', dressingType: 'Alginate Dressing', performedBy: 'Nurse Mary', observations: 'Moderate exudate, wound debrided' },
  ],
  '2': [
    { id: 'd4', date: '2024-01-15', time: '10:00', woundId: 'w3', woundLocation: 'Sacrum', dressingType: 'Hydrocolloid', performedBy: 'Nurse Sarah', observations: 'Stage 2 pressure ulcer, repositioning q2h' },
  ],
  '3': [],
};

const dressingTypes = [
  'Gauze (Dry)',
  'Gauze (Wet-to-Dry)',
  'Foam Dressing',
  'Alginate Dressing',
  'Hydrocolloid',
  'Hydrogel',
  'Film Dressing',
  'Silver Dressing',
  'Collagen Dressing',
  'Honey Dressing',
  'Negative Pressure (VAC)',
  'Compression Bandage',
];

export default function DressingLogPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedWound, setSelectedWound] = useState<Wound | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newEntry, setNewEntry] = useState({
    dressingType: '',
    observations: '',
  });

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
  const dressingEntries = selectedPatient ? mockDressingEntries[selectedPatient.id] || [] : [];
  const filteredEntries = selectedWound
    ? dressingEntries.filter((e) => e.woundId === selectedWound.id)
    : dressingEntries;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setShowAddForm(false);
      setNewEntry({ dressingType: '', observations: '' });
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

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
          <Bandage className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dressing Log</h1>
            <p className="text-sm text-gray-500">Track wound dressing changes</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Entry saved</span>
          </div>
        )}
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
              <h3 className="font-medium text-gray-900 text-sm mb-2">Filter by Wound</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedWound(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedWound ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  All Wounds
                </button>
                {patientWounds.map((wound) => (
                  <button
                    key={wound.id}
                    onClick={() => setSelectedWound(wound)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedWound?.id === wound.id
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {wound.location} - {wound.type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dressing Log */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">
                    {filteredEntries.length} dressing change{filteredEntries.length !== 1 ? 's' : ''} recorded
                  </p>
                </div>
                {patientWounds.length > 0 && (
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </button>
                )}
              </div>

              {/* Add New Entry Form */}
              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">New Dressing Entry</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Wound</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        value={selectedWound?.id || ''}
                        onChange={(e) => {
                          const wound = patientWounds.find((w) => w.id === e.target.value);
                          setSelectedWound(wound || null);
                        }}
                      >
                        <option value="">Select wound...</option>
                        {patientWounds.map((wound) => (
                          <option key={wound.id} value={wound.id}>
                            {wound.location} - {wound.type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Dressing Type</label>
                      <select
                        value={newEntry.dressingType}
                        onChange={(e) => setNewEntry({ ...newEntry, dressingType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select dressing...</option>
                        {dressingTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Observations</label>
                      <textarea
                        rows={2}
                        value={newEntry.observations}
                        onChange={(e) => setNewEntry({ ...newEntry, observations: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                        placeholder="Wound appearance, exudate, skin condition..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !selectedWound || !newEntry.dressingType}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Entry
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Entries List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredEntries.length > 0 ? (
                  <div className="space-y-3">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {entry.date} at {entry.time}
                            </div>
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                              {entry.woundLocation}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <User className="w-4 h-4" />
                            {entry.performedBy}
                          </div>
                        </div>
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-900">{entry.dressingType}</span>
                        </div>
                        <p className="text-sm text-gray-600">{entry.observations}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Bandage className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No dressing entries recorded</p>
                      {patientWounds.length === 0 && (
                        <p className="text-sm mt-1">No wounds documented for this patient</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Bandage className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view dressing log</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
