import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Info,
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
  { id: '4', mrn: 'MRN-2024-0004', name: 'Peter Ochieng', age: 75, gender: 'Male', ward: 'Ward C', bed: 'C-03' },
];

interface RiskFactor {
  id: string;
  question: string;
  category: string;
  points: number;
}

const riskFactors: RiskFactor[] = [
  { id: 'age', question: 'Age 65 or older', category: 'History', points: 1 },
  { id: 'fallHistory', question: 'History of falls in past 3 months', category: 'History', points: 2 },
  { id: 'incontinence', question: 'Incontinence (urinary or fecal)', category: 'History', points: 1 },
  { id: 'visualImpairment', question: 'Visual impairment', category: 'Physical', points: 1 },
  { id: 'mobilityImpairment', question: 'Impaired mobility (uses walker, wheelchair, etc.)', category: 'Physical', points: 2 },
  { id: 'cognitiveImpairment', question: 'Cognitive impairment or confusion', category: 'Mental', points: 2 },
  { id: 'medications', question: 'Taking 4+ medications or high-risk medications', category: 'Medications', points: 1 },
  { id: 'sedatives', question: 'Taking sedatives, hypnotics, or anti-anxiety meds', category: 'Medications', points: 1 },
  { id: 'dizziness', question: 'Dizziness or vertigo', category: 'Symptoms', points: 1 },
  { id: 'weakness', question: 'Generalized weakness', category: 'Symptoms', points: 1 },
  { id: 'unsteadyGait', question: 'Unsteady gait or balance problems', category: 'Physical', points: 2 },
  { id: 'assistiveDevice', question: 'Uses assistive device (cane, walker)', category: 'Physical', points: 1 },
];

export default function FallRiskPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const totalScore = useMemo(() => {
    return riskFactors
      .filter((f) => selectedFactors.has(f.id))
      .reduce((sum, f) => sum + f.points, 0);
  }, [selectedFactors]);

  const riskLevel = useMemo(() => {
    if (totalScore >= 6) return { level: 'High', color: 'red', description: 'Implement fall prevention protocol' };
    if (totalScore >= 3) return { level: 'Moderate', color: 'yellow', description: 'Monitor closely, consider precautions' };
    return { level: 'Low', color: 'green', description: 'Standard precautions' };
  }, [totalScore]);

  const toggleFactor = (factorId: string) => {
    const newSet = new Set(selectedFactors);
    if (newSet.has(factorId)) {
      newSet.delete(factorId);
    } else {
      newSet.add(factorId);
    }
    setSelectedFactors(newSet);
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
    setSelectedFactors(new Set());
    setAdditionalNotes('');
    setSaved(false);
  };

  const groupedFactors = useMemo(() => {
    const groups: Record<string, RiskFactor[]> = {};
    riskFactors.forEach((f) => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, []);

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            riskLevel.color === 'red' ? 'bg-red-100' :
            riskLevel.color === 'yellow' ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            <CheckCircle className={`w-8 h-8 ${
              riskLevel.color === 'red' ? 'text-red-600' :
              riskLevel.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'
            }`} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Fall Risk Assessment Saved</h2>
          <p className="text-gray-600 mb-2">
            {selectedPatient?.name} - Risk Level: <strong className={
              riskLevel.color === 'red' ? 'text-red-600' :
              riskLevel.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'
            }>{riskLevel.level}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">Score: {totalScore} points</p>
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
              Go Back
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
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fall Risk Assessment</h1>
            <p className="text-sm text-gray-500">Evaluate patient fall risk factors</p>
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
                    <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Risk Score Summary */}
          {selectedPatient && (
            <div className={`mt-4 p-4 rounded-lg ${
              riskLevel.color === 'red' ? 'bg-red-50 border border-red-200' :
              riskLevel.color === 'yellow' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="text-center">
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className={`text-3xl font-bold ${
                  riskLevel.color === 'red' ? 'text-red-600' :
                  riskLevel.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {totalScore}
                </p>
                <p className={`text-sm font-medium mt-1 ${
                  riskLevel.color === 'red' ? 'text-red-700' :
                  riskLevel.color === 'yellow' ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {riskLevel.level} Risk
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Risk Factors */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Risk Factors</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Info className="w-4 h-4" />
                  Select all that apply
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-4">
                  {Object.entries(groupedFactors).map(([category, factors]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">{category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {factors.map((factor) => (
                          <button
                            key={factor.id}
                            onClick={() => toggleFactor(factor.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                              selectedFactors.has(factor.id)
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-sm text-gray-900">{factor.question}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              selectedFactors.has(factor.id)
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              +{factor.points}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Additional Notes</h3>
                    <textarea
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                      placeholder="Other observations or factors..."
                    />
                  </div>

                  {/* Recommendations based on risk level */}
                  <div className={`p-4 rounded-lg ${
                    riskLevel.color === 'red' ? 'bg-red-50 border border-red-200' :
                    riskLevel.color === 'yellow' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-green-50 border border-green-200'
                  }`}>
                    <h3 className={`font-medium mb-2 ${
                      riskLevel.color === 'red' ? 'text-red-800' :
                      riskLevel.color === 'yellow' ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                      Recommendations for {riskLevel.level} Risk
                    </h3>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {riskLevel.color === 'red' && (
                        <>
                          <li>• Place fall risk sign on door/bed</li>
                          <li>• Keep bed in lowest position with side rails up</li>
                          <li>• Ensure call bell within reach at all times</li>
                          <li>• Hourly rounding and toileting assistance</li>
                          <li>• Non-slip footwear required</li>
                          <li>• Consider 1:1 sitter if needed</li>
                        </>
                      )}
                      {riskLevel.color === 'yellow' && (
                        <>
                          <li>• Keep call bell within reach</li>
                          <li>• Assist with ambulation as needed</li>
                          <li>• Ensure adequate lighting</li>
                          <li>• Regular checks every 2 hours</li>
                        </>
                      )}
                      {riskLevel.color === 'green' && (
                        <>
                          <li>• Standard fall precautions</li>
                          <li>• Encourage use of call bell</li>
                          <li>• Keep environment clear of hazards</li>
                        </>
                      )}
                    </ul>
                  </div>
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
                  disabled={saving}
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to begin fall risk assessment</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
