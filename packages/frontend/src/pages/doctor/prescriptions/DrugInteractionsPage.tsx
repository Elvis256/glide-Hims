import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  Shield,
  ChevronDown,
  User,
  Pill,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  ArrowRight,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';

interface Patient {
  id: string;
  name: string;
}

interface CurrentMedication {
  id: string;
  name: string;
  strength: string;
  startDate: string;
}

interface Drug {
  id: string;
  name: string;
  category: string;
}

interface Interaction {
  id: string;
  drug1: string;
  drug2: string;
  severity: 'Severe' | 'Moderate' | 'Minor';
  effect: string;
  recommendation: string;
  alternatives: string[];
}

const mockCurrentMedications: Record<string, CurrentMedication[]> = {
  '1': [
    { id: '1', name: 'Lisinopril', strength: '10mg', startDate: '2024-01-15' },
    { id: '2', name: 'Metformin', strength: '500mg', startDate: '2024-02-01' },
    { id: '3', name: 'Aspirin', strength: '81mg', startDate: '2024-01-15' },
  ],
  '2': [
    { id: '4', name: 'Omeprazole', strength: '20mg', startDate: '2024-03-10' },
    { id: '5', name: 'Sertraline', strength: '50mg', startDate: '2024-02-20' },
  ],
  '3': [
    { id: '6', name: 'Warfarin', strength: '5mg', startDate: '2024-01-05' },
    { id: '7', name: 'Atorvastatin', strength: '20mg', startDate: '2024-01-05' },
  ],
};

const mockDrugs: Drug[] = [
  { id: '1', name: 'Ibuprofen', category: 'NSAID' },
  { id: '2', name: 'Naproxen', category: 'NSAID' },
  { id: '3', name: 'Amiodarone', category: 'Antiarrhythmic' },
  { id: '4', name: 'Fluconazole', category: 'Antifungal' },
  { id: '5', name: 'Clarithromycin', category: 'Antibiotic' },
  { id: '6', name: 'Clopidogrel', category: 'Antiplatelet' },
  { id: '7', name: 'Tramadol', category: 'Opioid' },
  { id: '8', name: 'Potassium Chloride', category: 'Electrolyte' },
];

const mockInteractions: Interaction[] = [
  {
    id: '1',
    drug1: 'Lisinopril',
    drug2: 'Potassium Chloride',
    severity: 'Severe',
    effect: 'Risk of hyperkalemia (elevated potassium levels) which can cause cardiac arrhythmias',
    recommendation: 'Monitor potassium levels closely. Consider alternative potassium-sparing approach.',
    alternatives: ['Calcium Carbonate', 'Magnesium Oxide'],
  },
  {
    id: '2',
    drug1: 'Aspirin',
    drug2: 'Ibuprofen',
    severity: 'Moderate',
    effect: 'NSAIDs may reduce the cardioprotective effect of low-dose aspirin',
    recommendation: 'If both are needed, take aspirin at least 30 minutes before ibuprofen',
    alternatives: ['Acetaminophen', 'Celecoxib'],
  },
  {
    id: '3',
    drug1: 'Warfarin',
    drug2: 'Ibuprofen',
    severity: 'Severe',
    effect: 'Increased risk of bleeding. NSAIDs can enhance the anticoagulant effect of warfarin',
    recommendation: 'Avoid combination. Use acetaminophen for pain relief instead.',
    alternatives: ['Acetaminophen'],
  },
  {
    id: '4',
    drug1: 'Sertraline',
    drug2: 'Tramadol',
    severity: 'Severe',
    effect: 'Risk of serotonin syndrome - a potentially life-threatening condition',
    recommendation: 'Avoid combination. Consider alternative pain management.',
    alternatives: ['Acetaminophen', 'Low-dose opioids (not tramadol)'],
  },
  {
    id: '5',
    drug1: 'Omeprazole',
    drug2: 'Clopidogrel',
    severity: 'Moderate',
    effect: 'Omeprazole may reduce the antiplatelet effect of clopidogrel',
    recommendation: 'Consider using pantoprazole or H2 blocker instead of omeprazole',
    alternatives: ['Pantoprazole', 'Famotidine'],
  },
  {
    id: '6',
    drug1: 'Metformin',
    drug2: 'Fluconazole',
    severity: 'Minor',
    effect: 'Minor increase in metformin plasma levels',
    recommendation: 'Monitor blood glucose. Usually clinically insignificant.',
    alternatives: [],
  },
];

const severityConfig = {
  Severe: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle, badge: 'bg-red-100 text-red-700' },
  Moderate: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: AlertCircle, badge: 'bg-yellow-100 text-yellow-700' },
  Minor: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info, badge: 'bg-blue-100 text-blue-700' },
};

export default function DrugInteractionsPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  const [showDrugResults, setShowDrugResults] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [checkedInteractions, setCheckedInteractions] = useState<Interaction[]>([]);
  const [showProceedWarning, setShowProceedWarning] = useState(false);

  // Fetch patients from API
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'drug-interactions', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 20 }),
    staleTime: 30000,
  });

  // Transform API patients to local interface
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
    }));
  }, [patientsData]);

  const currentMedications = selectedPatient 
    ? mockCurrentMedications[selectedPatient.id] || []
    : [];

  const filteredDrugs = useMemo(() => {
    if (!drugSearch.trim()) return [];
    return mockDrugs.filter(d => 
      d.name.toLowerCase().includes(drugSearch.toLowerCase())
    );
  }, [drugSearch]);

  const checkInteractions = (drug: Drug) => {
    setSelectedDrug(drug);
    setDrugSearch(drug.name);
    setShowDrugResults(false);

    const interactions = mockInteractions.filter(interaction => {
      const drugNames = currentMedications.map(m => m.name);
      return (
        (drugNames.includes(interaction.drug1) && interaction.drug2 === drug.name) ||
        (drugNames.includes(interaction.drug2) && interaction.drug1 === drug.name)
      );
    });

    setCheckedInteractions(interactions);
  };

  const clearCheck = () => {
    setSelectedDrug(null);
    setDrugSearch('');
    setCheckedInteractions([]);
  };

  const hasSevereInteraction = checkedInteractions.some(i => i.severity === 'Severe');

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Shield className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Drug Interactions Checker</h1>
              <p className="text-sm text-gray-500">Check for potential drug interactions before prescribing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Patient Selector */}
          <div className="bg-white rounded-lg border p-4 mb-4 max-w-2xl">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <button
                onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 border rounded-lg bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className={selectedPatient ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedPatient ? selectedPatient.name : 'Choose a patient...'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {patientDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search patients..."
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {patientsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    ) : patients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        {patientSearch ? 'No patients found' : 'Start typing to search...'}
                      </div>
                    ) : (
                      patients.map(patient => (
                        <button
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientDropdownOpen(false);
                            setPatientSearch('');
                            clearCheck();
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-50"
                        >
                          {patient.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedPatient && (
            <>
              {/* Drug Search */}
              <div className="bg-white rounded-lg border p-4 mb-4 max-w-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Drug to Check Interactions</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={drugSearch}
                    onChange={(e) => {
                      setDrugSearch(e.target.value);
                      setShowDrugResults(true);
                      setSelectedDrug(null);
                      setCheckedInteractions([]);
                    }}
                    onFocus={() => setShowDrugResults(true)}
                    placeholder="Search for a drug to check..."
                    className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {drugSearch && (
                    <button
                      onClick={clearCheck}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showDrugResults && filteredDrugs.length > 0 && (
                  <div className="absolute z-10 w-full max-w-[calc(100%-3rem)] mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredDrugs.map(drug => (
                      <button
                        key={drug.id}
                        onClick={() => checkInteractions(drug)}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="font-medium">{drug.name}</span>
                        <span className="text-sm text-gray-500">{drug.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Interaction Results */}
              {selectedDrug && (
                <div className="max-w-2xl">
                  {checkedInteractions.length === 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <div className="font-medium text-green-800">No Interactions Found</div>
                        <div className="text-sm text-green-600">
                          {selectedDrug.name} appears safe to use with current medications
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">
                          Found {checkedInteractions.length} Interaction{checkedInteractions.length !== 1 ? 's' : ''}
                        </h3>
                      </div>

                      {checkedInteractions.map(interaction => {
                        const config = severityConfig[interaction.severity];
                        const Icon = config.icon;

                        return (
                          <div key={interaction.id} className={`${config.bg} ${config.border} border rounded-lg p-4`}>
                            <div className="flex items-start gap-3">
                              <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.badge}`}>
                                    {interaction.severity}
                                  </span>
                                </div>
                                <div className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                                  {interaction.drug1}
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                  {interaction.drug2}
                                </div>
                                <div className="text-sm text-gray-700 mb-2">
                                  <strong>Effect:</strong> {interaction.effect}
                                </div>
                                <div className="text-sm text-gray-700 mb-2">
                                  <strong>Recommendation:</strong> {interaction.recommendation}
                                </div>
                                {interaction.alternatives.length > 0 && (
                                  <div className="mt-3 p-3 bg-white/50 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                      <Lightbulb className="w-4 h-4" />
                                      Alternative Suggestions
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {interaction.alternatives.map((alt, idx) => (
                                        <span key={idx} className="px-2 py-1 bg-white text-sm rounded border">
                                          {alt}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={clearCheck}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setShowProceedWarning(true)}
                          className={`px-4 py-2 rounded-lg ${
                            hasSevereInteraction 
                              ? 'bg-red-600 hover:bg-red-700 text-white' 
                              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          }`}
                        >
                          Proceed Anyway
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar - Current Medications */}
        <div className="w-80 bg-white border-l p-4 overflow-y-auto">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Pill className="w-4 h-4" />
            Current Medications
          </h3>
          {!selectedPatient ? (
            <p className="text-sm text-gray-500">Select a patient to view medications</p>
          ) : currentMedications.length === 0 ? (
            <p className="text-sm text-gray-500">No current medications on file</p>
          ) : (
            <div className="space-y-2">
              {currentMedications.map(med => (
                <div key={med.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{med.name} {med.strength}</div>
                  <div className="text-sm text-gray-500">Since: {med.startDate}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proceed Warning Modal */}
      {showProceedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md m-4">
            <div className="p-4 border-b flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h2 className="text-lg font-semibold">Confirm Proceeding</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-700 mb-4">
                You are about to proceed despite drug interaction warnings. This may pose risks to the patient.
              </p>
              {hasSevereInteraction && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                  <strong>Warning:</strong> Severe interactions detected. Please ensure you have considered all alternatives.
                </div>
              )}
              <p className="text-sm text-gray-500">
                By proceeding, you confirm that you have reviewed the interactions and accept responsibility for this prescribing decision.
              </p>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowProceedWarning(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowProceedWarning(false);
                  clearCheck();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}