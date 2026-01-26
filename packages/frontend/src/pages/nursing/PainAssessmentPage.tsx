import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Search,
  UserCircle,
  Save,
  CheckCircle,
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

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
];

const painFaces = [
  { score: 0, emoji: '😊', label: 'No Pain' },
  { score: 2, emoji: '🙂', label: 'Mild' },
  { score: 4, emoji: '😐', label: 'Moderate' },
  { score: 6, emoji: '😟', label: 'Moderate-Severe' },
  { score: 8, emoji: '😢', label: 'Severe' },
  { score: 10, emoji: '😭', label: 'Worst Pain' },
];

export default function PainAssessmentPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [assessment, setAssessment] = useState({
    painScore: '',
    painLocation: '',
    painType: '',
    painDuration: '',
    painRadiation: '',
    aggravatingFactors: '',
    relievingFactors: '',
    associatedSymptoms: '',
    impactOnFunction: '',
    currentTreatment: '',
    notes: '',
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

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setAssessment({
      painScore: '',
      painLocation: '',
      painType: '',
      painDuration: '',
      painRadiation: '',
      aggravatingFactors: '',
      relievingFactors: '',
      associatedSymptoms: '',
      impactOnFunction: '',
      currentTreatment: '',
      notes: '',
    });
    setSaved(false);
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Pain Assessment Recorded</h2>
          <p className="text-gray-600 mb-6">
            Assessment for {selectedPatient?.name} has been saved
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              New Assessment
            </button>
            <button
              onClick={() => navigate('/nursing/triage')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <Activity className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pain Assessment</h1>
            <p className="text-sm text-gray-500">Comprehensive pain evaluation</p>
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
        </div>

        {/* Assessment Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto">
              {/* Pain Scale */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Pain Scale (0-10)</h3>
                <div className="grid grid-cols-6 gap-2">
                  {painFaces.map((face) => (
                    <button
                      key={face.score}
                      onClick={() => setAssessment({ ...assessment, painScore: face.score.toString() })}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        assessment.painScore === face.score.toString()
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-3xl mb-1">{face.emoji}</div>
                      <p className="text-xs font-medium text-gray-900">{face.score}</p>
                      <p className="text-xs text-gray-500">{face.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Pain Location</label>
                  <input
                    type="text"
                    value={assessment.painLocation}
                    onChange={(e) => setAssessment({ ...assessment, painLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="e.g., Lower back, Right knee"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Pain Type</label>
                  <select
                    value={assessment.painType}
                    onChange={(e) => setAssessment({ ...assessment, painType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select type...</option>
                    <option value="sharp">Sharp</option>
                    <option value="dull">Dull/Aching</option>
                    <option value="burning">Burning</option>
                    <option value="throbbing">Throbbing</option>
                    <option value="stabbing">Stabbing</option>
                    <option value="cramping">Cramping</option>
                    <option value="shooting">Shooting</option>
                    <option value="tingling">Tingling/Numbness</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Duration</label>
                  <select
                    value={assessment.painDuration}
                    onChange={(e) => setAssessment({ ...assessment, painDuration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select duration...</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="constant">Constant</option>
                    <option value="intermittent">Intermittent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Radiation</label>
                  <input
                    type="text"
                    value={assessment.painRadiation}
                    onChange={(e) => setAssessment({ ...assessment, painRadiation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Does pain spread to other areas?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Aggravating Factors</label>
                  <input
                    type="text"
                    value={assessment.aggravatingFactors}
                    onChange={(e) => setAssessment({ ...assessment, aggravatingFactors: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="What makes it worse?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Relieving Factors</label>
                  <input
                    type="text"
                    value={assessment.relievingFactors}
                    onChange={(e) => setAssessment({ ...assessment, relievingFactors: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="What makes it better?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Associated Symptoms</label>
                  <input
                    type="text"
                    value={assessment.associatedSymptoms}
                    onChange={(e) => setAssessment({ ...assessment, associatedSymptoms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Nausea, dizziness, etc."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Impact on Function</label>
                  <select
                    value={assessment.impactOnFunction}
                    onChange={(e) => setAssessment({ ...assessment, impactOnFunction: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select impact...</option>
                    <option value="none">No impact</option>
                    <option value="mild">Mild - can do most activities</option>
                    <option value="moderate">Moderate - limits activities</option>
                    <option value="severe">Severe - very limited activities</option>
                    <option value="total">Total - cannot function</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Current Treatment</label>
                  <input
                    type="text"
                    value={assessment.currentTreatment}
                    onChange={(e) => setAssessment({ ...assessment, currentTreatment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Current pain medications or treatments..."
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea
                    rows={2}
                    value={assessment.notes}
                    onChange={(e) => setAssessment({ ...assessment, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Additional observations..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !assessment.painScore}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Assessment
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to begin pain assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
