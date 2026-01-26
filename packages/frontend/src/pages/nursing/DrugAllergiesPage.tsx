import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  UserCircle,
  Pill,
  Plus,
  Trash2,
  Save,
  CheckCircle,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
}

interface Allergy {
  id: string;
  allergen: string;
  type: 'drug' | 'food' | 'environmental' | 'other';
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  recordedDate: string;
  recordedBy: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39 },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34 },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28 },
];

const mockAllergies: Allergy[] = [
  {
    id: '1',
    allergen: 'Penicillin',
    type: 'drug',
    reaction: 'Rash, hives, difficulty breathing',
    severity: 'severe',
    recordedDate: '2024-01-15',
    recordedBy: 'Dr. John Kamau',
  },
  {
    id: '2',
    allergen: 'Sulfa drugs',
    type: 'drug',
    reaction: 'Skin rash',
    severity: 'moderate',
    recordedDate: '2024-02-20',
    recordedBy: 'Nurse Mary',
  },
  {
    id: '3',
    allergen: 'Aspirin',
    type: 'drug',
    reaction: 'Stomach upset, mild rash',
    severity: 'mild',
    recordedDate: '2024-03-10',
    recordedBy: 'Dr. Jane Mwangi',
  },
];

const severityColors: Record<string, { bg: string; text: string }> = {
  mild: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  moderate: { bg: 'bg-orange-100', text: 'text-orange-700' },
  severe: { bg: 'bg-red-100', text: 'text-red-700' },
  'life-threatening': { bg: 'bg-red-200', text: 'text-red-800' },
};

export default function DrugAllergiesPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(mockPatients[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAllergy, setNewAllergy] = useState({
    allergen: '',
    type: 'drug' as const,
    reaction: '',
    severity: 'moderate' as const,
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return mockPatients;
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleAddAllergy = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setShowAddForm(false);
      setNewAllergy({
        allergen: '',
        type: 'drug',
        reaction: '',
        severity: 'moderate',
      });
    }, 1000);
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
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Drug Allergies</h1>
              <p className="text-sm text-gray-500">Manage patient drug allergy records</p>
            </div>
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
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Allergies List */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}'s Allergies</h2>
                  <p className="text-sm text-gray-500">{mockAllergies.length} recorded allergies</p>
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Allergy
                </button>
              </div>

              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Add New Allergy</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Allergen *</label>
                      <input
                        type="text"
                        value={newAllergy.allergen}
                        onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., Penicillin"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                      <select
                        value={newAllergy.type}
                        onChange={(e) => setNewAllergy({ ...newAllergy, type: e.target.value as 'drug' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="drug">Drug</option>
                        <option value="food">Food</option>
                        <option value="environmental">Environmental</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Reaction</label>
                      <input
                        type="text"
                        value={newAllergy.reaction}
                        onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Describe the reaction..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Severity</label>
                      <select
                        value={newAllergy.severity}
                        onChange={(e) => setNewAllergy({ ...newAllergy, severity: e.target.value as 'moderate' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="life-threatening">Life-Threatening</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddAllergy}
                      disabled={saving || !newAllergy.allergen}
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
                          Save Allergy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto min-h-0">
                {mockAllergies.length > 0 ? (
                  <div className="space-y-3">
                    {mockAllergies.map((allergy) => {
                      const severity = severityColors[allergy.severity];
                      return (
                        <div
                          key={allergy.id}
                          className="p-4 rounded-lg border border-gray-200 hover:border-gray-300"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                <Pill className="w-5 h-5 text-red-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900">{allergy.allergen}</span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${severity.bg} ${severity.text}`}>
                                    {allergy.severity}
                                  </span>
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                    {allergy.type}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{allergy.reaction}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Recorded on {allergy.recordedDate} by {allergy.recordedBy}
                                </p>
                              </div>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <CheckCircle className="w-12 h-12 text-green-300 mb-2" />
                    <p className="font-medium text-gray-700">No Known Drug Allergies (NKDA)</p>
                    <p className="text-sm">This patient has no recorded allergies</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view allergies</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
