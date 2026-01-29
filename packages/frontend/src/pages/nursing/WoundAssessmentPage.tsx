import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Stethoscope,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Upload,
  Camera,
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

const patients: Patient[] = [];

const woundLocations = [
  'Head/Scalp', 'Face', 'Neck', 'Chest', 'Abdomen', 'Upper Back', 'Lower Back',
  'Left Shoulder', 'Right Shoulder', 'Left Upper Arm', 'Right Upper Arm',
  'Left Elbow', 'Right Elbow', 'Left Forearm', 'Right Forearm',
  'Left Hand', 'Right Hand', 'Left Hip', 'Right Hip',
  'Left Thigh', 'Right Thigh', 'Left Knee', 'Right Knee',
  'Left Lower Leg', 'Right Lower Leg', 'Left Ankle', 'Right Ankle',
  'Left Foot', 'Right Foot', 'Sacrum/Coccyx', 'Buttocks',
];

const woundTypes = [
  { value: 'surgical', label: 'Surgical Wound' },
  { value: 'pressure', label: 'Pressure Ulcer' },
  { value: 'diabetic', label: 'Diabetic Ulcer' },
  { value: 'venous', label: 'Venous Ulcer' },
  { value: 'arterial', label: 'Arterial Ulcer' },
  { value: 'traumatic', label: 'Traumatic Wound' },
  { value: 'burn', label: 'Burn' },
  { value: 'laceration', label: 'Laceration' },
  { value: 'abrasion', label: 'Abrasion' },
  { value: 'other', label: 'Other' },
];

const woundBedAppearances = [
  { value: 'granulating', label: 'Granulating (Red)', color: 'bg-red-400' },
  { value: 'epithelializing', label: 'Epithelializing (Pink)', color: 'bg-pink-300' },
  { value: 'sloughing', label: 'Sloughing (Yellow)', color: 'bg-yellow-400' },
  { value: 'necrotic', label: 'Necrotic (Black)', color: 'bg-gray-800' },
  { value: 'mixed', label: 'Mixed', color: 'bg-gradient-to-r from-red-400 to-yellow-400' },
];

const exudateAmounts = ['None', 'Scant', 'Small', 'Moderate', 'Large', 'Copious'];
const exudateTypes = ['Serous', 'Serosanguinous', 'Sanguinous', 'Purulent', 'None'];
const skinConditions = ['Intact', 'Macerated', 'Erythematous', 'Indurated', 'Edematous', 'Dry/Scaly'];

export default function WoundAssessmentPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [assessment, setAssessment] = useState({
    woundLocation: '',
    woundType: '',
    length: '',
    width: '',
    depth: '',
    woundBed: '',
    exudateAmount: '',
    exudateType: '',
    surroundingSkin: [] as string[],
    painLevel: '',
    odor: '',
    tunneling: '',
    undermining: '',
    treatmentPlan: '',
    notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const handleSkinConditionToggle = (condition: string) => {
    setAssessment((prev) => ({
      ...prev,
      surroundingSkin: prev.surroundingSkin.includes(condition)
        ? prev.surroundingSkin.filter((c) => c !== condition)
        : [...prev.surroundingSkin, condition],
    }));
  };

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
      woundLocation: '',
      woundType: '',
      length: '',
      width: '',
      depth: '',
      woundBed: '',
      exudateAmount: '',
      exudateType: '',
      surroundingSkin: [],
      painLevel: '',
      odor: '',
      tunneling: '',
      undermining: '',
      treatmentPlan: '',
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Wound Assessment Saved</h2>
          <p className="text-gray-600 mb-6">
            Assessment for {selectedPatient?.name} has been recorded
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              New Assessment
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
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
          <Stethoscope className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Wound Assessment</h1>
            <p className="text-sm text-gray-500">Comprehensive wound evaluation</p>
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
            {(searchTerm ? filteredPatients : patients).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <UserCircle className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">{searchTerm ? 'No patients found' : 'No patients available'}</p>
              </div>
            ) : (searchTerm ? filteredPatients : patients).map((patient) => (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location & Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Wound Location *</label>
                  <select
                    value={assessment.woundLocation}
                    onChange={(e) => setAssessment({ ...assessment, woundLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select location...</option>
                    {woundLocations.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Wound Type *</label>
                  <select
                    value={assessment.woundType}
                    onChange={(e) => setAssessment({ ...assessment, woundType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select type...</option>
                    {woundTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Measurements */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Measurements (cm)</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Length</label>
                      <input
                        type="number"
                        step="0.1"
                        value={assessment.length}
                        onChange={(e) => setAssessment({ ...assessment, length: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Width</label>
                      <input
                        type="number"
                        step="0.1"
                        value={assessment.width}
                        onChange={(e) => setAssessment({ ...assessment, width: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Depth</label>
                      <input
                        type="number"
                        step="0.1"
                        value={assessment.depth}
                        onChange={(e) => setAssessment({ ...assessment, depth: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                </div>

                {/* Wound Bed Appearance */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Wound Bed Appearance</label>
                  <div className="flex flex-wrap gap-2">
                    {woundBedAppearances.map((appearance) => (
                      <button
                        key={appearance.value}
                        type="button"
                        onClick={() => setAssessment({ ...assessment, woundBed: appearance.value })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                          assessment.woundBed === appearance.value
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${appearance.color}`} />
                        <span className="text-sm">{appearance.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exudate */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Exudate Amount</label>
                  <select
                    value={assessment.exudateAmount}
                    onChange={(e) => setAssessment({ ...assessment, exudateAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select amount...</option>
                    {exudateAmounts.map((amt) => (
                      <option key={amt} value={amt}>{amt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Exudate Type</label>
                  <select
                    value={assessment.exudateType}
                    onChange={(e) => setAssessment({ ...assessment, exudateType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select type...</option>
                    {exudateTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Surrounding Skin */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Surrounding Skin Condition</label>
                  <div className="flex flex-wrap gap-2">
                    {skinConditions.map((condition) => (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => handleSkinConditionToggle(condition)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          assessment.surroundingSkin.includes(condition)
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pain Level */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Pain Level (0-10)</label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAssessment({ ...assessment, painLevel: num.toString() })}
                        className={`flex-1 py-2 text-sm font-medium rounded ${
                          assessment.painLevel === num.toString()
                            ? num <= 3
                              ? 'bg-green-500 text-white'
                              : num <= 6
                              ? 'bg-yellow-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Upload Placeholder */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Wound Photos</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload wound images</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Files
                    </button>
                    <p className="text-xs text-gray-400 mt-2">PNG, JPG up to 10MB</p>
                  </div>
                </div>

                {/* Treatment Plan */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Treatment Plan</label>
                  <textarea
                    rows={3}
                    value={assessment.treatmentPlan}
                    onChange={(e) => setAssessment({ ...assessment, treatmentPlan: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Describe dressing type, frequency, special instructions..."
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Notes</label>
                  <textarea
                    rows={2}
                    value={assessment.notes}
                    onChange={(e) => setAssessment({ ...assessment, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Any other observations..."
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
                  disabled={saving || !assessment.woundLocation || !assessment.woundType}
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
                <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to begin wound assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
