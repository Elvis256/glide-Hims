import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FlaskConical,
  AlertTriangle,
  Target,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';

type ConfidenceLevel = 'High' | 'Medium' | 'Low';

interface DifferentialDiagnosis {
  id: string;
  name: string;
  icdCode: string;
  confidence: ConfidenceLevel;
  ruleIn: boolean;
  ruleOut: boolean;
  supportingEvidence: string;
  testsToOrder: string[];
  isExpanded: boolean;
}

interface LocalPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  hpi: string;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const suggestedDiagnoses = [
  { name: 'Acute Myocardial Infarction', icdCode: 'I21.9' },
  { name: 'Unstable Angina', icdCode: 'I20.0' },
  { name: 'Pulmonary Embolism', icdCode: 'I26.99' },
  { name: 'Aortic Dissection', icdCode: 'I71.00' },
  { name: 'Pneumothorax', icdCode: 'J93.9' },
  { name: 'Costochondritis', icdCode: 'M94.0' },
  { name: 'GERD', icdCode: 'K21.0' },
  { name: 'Panic Attack', icdCode: 'F41.0' },
];

const availableTests = [
  'Troponin I/T',
  'ECG/EKG',
  'Chest X-Ray',
  'CT Angiography',
  'D-Dimer',
  'BNP/NT-proBNP',
  'CBC',
  'BMP',
  'Lipid Panel',
  'Echocardiogram',
  'Stress Test',
  'V/Q Scan',
];

export default function DifferentialDxPage() {
  const { hasPermission } = usePermissions();
  const [differentials, setDifferentials] = useState<DifferentialDiagnosis[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDiagnosis, setNewDiagnosis] = useState({
    name: '',
    icdCode: '',
    confidence: 'Medium' as ConfidenceLevel,
  });
  const [finalDiagnosis, setFinalDiagnosis] = useState<string | null>(null);

  // Fetch patients from API
  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', 'differential-dx'],
    queryFn: () => patientsService.search({ limit: 1 }),
  });

  // Transform API patient to local interface
  const currentPatient: LocalPatient | null = useMemo(() => {
    if (!patientsData?.data?.[0]) return null;
    const patient = patientsData.data[0];
    return {
      id: patient.id,
      name: patient.fullName,
      age: calculateAge(patient.dateOfBirth),
      gender: patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1),
      chiefComplaint: 'Pending clinical assessment',
      hpi: 'History of present illness to be documented during consultation.',
    };
  }, [patientsData]);

  const sortedDifferentials = useMemo(() => {
    const confidenceOrder = { High: 0, Medium: 1, Low: 2 };
    return [...differentials].sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);
  }, [differentials]);

  const addDifferential = (diagnosis?: { name: string; icdCode: string }) => {
    const toAdd = diagnosis || newDiagnosis;
    if (!toAdd.name) return;

    const newDiff: DifferentialDiagnosis = {
      id: crypto.randomUUID(),
      name: toAdd.name,
      icdCode: toAdd.icdCode || 'TBD',
      confidence: diagnosis ? 'Medium' : newDiagnosis.confidence,
      ruleIn: false,
      ruleOut: false,
      supportingEvidence: '',
      testsToOrder: [],
      isExpanded: true,
    };

    setDifferentials([...differentials, newDiff]);
    setNewDiagnosis({ name: '', icdCode: '', confidence: 'Medium' });
    setShowAddForm(false);
  };

  const updateDifferential = (id: string, updates: Partial<DifferentialDiagnosis>) => {
    setDifferentials(differentials.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const removeDifferential = (id: string) => {
    setDifferentials(differentials.filter((d) => d.id !== id));
    if (finalDiagnosis === id) setFinalDiagnosis(null);
  };

  const toggleTest = (diagnosisId: string, test: string) => {
    const diagnosis = differentials.find((d) => d.id === diagnosisId);
    if (!diagnosis) return;

    const tests = diagnosis.testsToOrder.includes(test)
      ? diagnosis.testsToOrder.filter((t) => t !== test)
      : [...diagnosis.testsToOrder, test];

    updateDifferential(diagnosisId, { testsToOrder: tests });
  };

  const getConfidenceColor = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'High':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Low':
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-green-500';
    }
  };

  if (isLoadingPatients) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!currentPatient) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">No patient data available</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{currentPatient.name}</h2>
            <p className="text-sm text-gray-600">
              {currentPatient.age} y/o {currentPatient.gender}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-xs font-medium text-red-600">Chief Complaint</p>
              <p className="text-sm font-semibold text-red-700">{currentPatient.chiefComplaint}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-1">History of Present Illness</p>
          <p className="text-sm text-gray-700">{currentPatient.hpi}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Suggested Diagnoses */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Suggested Differentials
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {suggestedDiagnoses.map((diagnosis) => (
              <button
                key={diagnosis.icdCode}
                onClick={() => addDifferential(diagnosis)}
                disabled={differentials.some((d) => d.icdCode === diagnosis.icdCode)}
                className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800">{diagnosis.name}</span>
                  <span className="text-xs font-mono text-blue-600">{diagnosis.icdCode}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Add Custom */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            {showAddForm ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newDiagnosis.name}
                  onChange={(e) => setNewDiagnosis({ ...newDiagnosis, name: e.target.value })}
                  placeholder="Diagnosis name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={newDiagnosis.icdCode}
                  onChange={(e) => setNewDiagnosis({ ...newDiagnosis, icdCode: e.target.value })}
                  placeholder="ICD-10 Code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={newDiagnosis.confidence}
                  onChange={(e) => setNewDiagnosis({ ...newDiagnosis, confidence: e.target.value as ConfidenceLevel })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="High">High Confidence</option>
                  <option value="Medium">Medium Confidence</option>
                  <option value="Low">Low Confidence</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => addDifferential()}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Diagnosis
              </button>
            )}
          </div>
        </div>

        {/* Differential List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Differential Diagnoses ({differentials.length})
          </h3>

          {differentials.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>Add diagnoses from the suggested list or create custom ones</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3">
              {sortedDifferentials.map((diagnosis) => (
                <div
                  key={diagnosis.id}
                  className={`border rounded-lg ${finalDiagnosis === diagnosis.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  {/* Header */}
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getConfidenceBadge(diagnosis.confidence)}`} />
                        <div>
                          <h4 className="font-semibold text-gray-800">{diagnosis.name}</h4>
                          <span className="text-xs font-mono text-blue-600">{diagnosis.icdCode}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={diagnosis.confidence}
                          onChange={(e) =>
                            updateDifferential(diagnosis.id, { confidence: e.target.value as ConfidenceLevel })
                          }
                          className={`text-xs px-2 py-1 rounded-lg border ${getConfidenceColor(diagnosis.confidence)}`}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                        <button
                          onClick={() => updateDifferential(diagnosis.id, { isExpanded: !diagnosis.isExpanded })}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {diagnosis.isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => removeDifferential(diagnosis.id)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Rule In/Out */}
                    <div className="flex items-center gap-4 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={diagnosis.ruleIn}
                          onChange={(e) =>
                            updateDifferential(diagnosis.id, { ruleIn: e.target.checked, ruleOut: false })
                          }
                          className="w-4 h-4 text-green-600 rounded"
                        />
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700">Rule In</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={diagnosis.ruleOut}
                          onChange={(e) =>
                            updateDifferential(diagnosis.id, { ruleOut: e.target.checked, ruleIn: false })
                          }
                          className="w-4 h-4 text-red-600 rounded"
                        />
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-700">Rule Out</span>
                      </label>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {diagnosis.isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                      {/* Supporting Evidence */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">
                          Supporting Evidence
                        </label>
                        <textarea
                          value={diagnosis.supportingEvidence}
                          onChange={(e) =>
                            updateDifferential(diagnosis.id, { supportingEvidence: e.target.value })
                          }
                          placeholder="Enter findings that support or refute this diagnosis..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-20"
                        />
                      </div>

                      {/* Tests to Order */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                          <FlaskConical className="w-4 h-4" />
                          Tests to Confirm/Exclude
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {availableTests.map((test) => (
                            <button
                              key={test}
                              onClick={() => toggleTest(diagnosis.id, test)}
                              className={`px-2 py-1 text-xs rounded-full border ${
                                diagnosis.testsToOrder.includes(test)
                                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-purple-300'
                              }`}
                            >
                              {test}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Set as Final */}
                      <button
                        onClick={() => setFinalDiagnosis(diagnosis.id)}
                        className={`w-full py-2 rounded-lg text-sm font-medium ${
                          finalDiagnosis === diagnosis.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                        }`}
                      >
                        {finalDiagnosis === diagnosis.id ? '✓ Final Diagnosis' : 'Set as Final Diagnosis'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {finalDiagnosis && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Confirm Final Diagnosis & Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
