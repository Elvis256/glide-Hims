import { useState, useMemo } from 'react';
import { Search, Plus, X, GripVertical, Star, Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService, type Patient as ApiPatient } from '../../../services/patients';

interface ICD10Code {
  code: string;
  description: string;
  category: string;
}

interface SelectedDiagnosis {
  id: string;
  code: string;
  description: string;
  category: string;
  type: 'Primary' | 'Secondary';
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
}

// Transform API patient to local interface
const transformPatient = (patient: ApiPatient): Patient => ({
  id: patient.id,
  name: patient.fullName,
  dob: patient.dateOfBirth,
  mrn: patient.mrn,
});

const mockICD10Codes: ICD10Code[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory' },
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine' },
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable', category: 'Neurological' },
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Digestive' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary' },
  { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Skin' },
];

const commonDiagnoses: ICD10Code[] = [
  { code: 'J06.9', description: 'Acute URI', category: 'Respiratory' },
  { code: 'I10', description: 'Hypertension', category: 'Cardiovascular' },
  { code: 'E11.9', description: 'Type 2 DM', category: 'Endocrine' },
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
  { code: 'N39.0', description: 'UTI', category: 'Genitourinary' },
  { code: 'K21.0', description: 'GERD', category: 'Digestive' },
];

export default function ICD10CodingPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<SelectedDiagnosis[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  // Fetch patients from API
  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', patientSearchQuery],
    queryFn: () => patientsService.search({ search: patientSearchQuery, limit: 50 }),
  });

  const patients = useMemo(() => 
    patientsData?.data.map(transformPatient) ?? [], 
    [patientsData]
  );

  const filteredCodes = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return mockICD10Codes.filter(
      (code) =>
        code.code.toLowerCase().includes(query) ||
        code.description.toLowerCase().includes(query) ||
        code.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const addDiagnosis = (code: ICD10Code) => {
    if (selectedDiagnoses.some((d) => d.code === code.code)) return;
    const newDiagnosis: SelectedDiagnosis = {
      id: crypto.randomUUID(),
      ...code,
      type: selectedDiagnoses.length === 0 ? 'Primary' : 'Secondary',
    };
    setSelectedDiagnoses([...selectedDiagnoses, newDiagnosis]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeDiagnosis = (id: string) => {
    const updated = selectedDiagnoses.filter((d) => d.id !== id);
    if (updated.length > 0 && !updated.some((d) => d.type === 'Primary')) {
      updated[0].type = 'Primary';
    }
    setSelectedDiagnoses(updated);
  };

  const toggleType = (id: string) => {
    setSelectedDiagnoses(
      selectedDiagnoses.map((d) => {
        if (d.id === id) {
          return { ...d, type: d.type === 'Primary' ? 'Secondary' : 'Primary' };
        }
        if (d.type === 'Primary' && selectedDiagnoses.find((dx) => dx.id === id)?.type === 'Secondary') {
          return { ...d, type: 'Secondary' };
        }
        return d;
      })
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newList = [...selectedDiagnoses];
    const [removed] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, removed);
    setSelectedDiagnoses(newList);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Respiratory: 'bg-blue-100 text-blue-700',
      Cardiovascular: 'bg-red-100 text-red-700',
      Endocrine: 'bg-purple-100 text-purple-700',
      Musculoskeletal: 'bg-orange-100 text-orange-700',
      Neurological: 'bg-indigo-100 text-indigo-700',
      'Mental Health': 'bg-teal-100 text-teal-700',
      Digestive: 'bg-yellow-100 text-yellow-700',
      Genitourinary: 'bg-pink-100 text-pink-700',
      Skin: 'bg-green-100 text-green-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Patient Selector */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:max-w-md">
            <input
              type="text"
              value={patientSearchQuery}
              onChange={(e) => setPatientSearchQuery(e.target.value)}
              placeholder="Search patients by name or MRN..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {isLoadingPatients && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          <select
            value={selectedPatient?.id || ''}
            onChange={(e) => setSelectedPatient(patients.find((p) => p.id === e.target.value) || null)}
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoadingPatients}
          >
            <option value="">Select a patient...</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} - {patient.mrn} (DOB: {patient.dob})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Search Panel */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">ICD-10 Code Search</h2>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by code, description, or category..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {showDropdown && filteredCodes.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredCodes.map((code) => (
                  <button
                    key={code.code}
                    onClick={() => addDiagnosis(code)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-semibold text-blue-600">{code.code}</span>
                        <span className="ml-2 text-gray-700">{code.description}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(code.category)}`}>
                        {code.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Common Diagnoses */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1">
              <Star className="w-4 h-4" /> Common Diagnoses
            </h3>
            <div className="flex flex-wrap gap-2">
              {commonDiagnoses.map((code) => (
                <button
                  key={code.code}
                  onClick={() => addDiagnosis(code)}
                  disabled={selectedDiagnoses.some((d) => d.code === code.code)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {code.code} - {code.description}
                </button>
              ))}
            </div>
          </div>

          {/* All ICD-10 Codes */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-600 mb-2">All Available Codes</h3>
            <div className="space-y-2">
              {mockICD10Codes.map((code) => (
                <div
                  key={code.code}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                  onClick={() => addDiagnosis(code)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-blue-600">{code.code}</span>
                      <p className="text-sm text-gray-700 mt-1">{code.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(code.category)}`}>
                        {code.category}
                      </span>
                      {selectedDiagnoses.some((d) => d.code === code.code) && (
                        <Check className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Diagnoses Panel */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Selected Diagnoses ({selectedDiagnoses.length})
          </h2>

          {selectedDiagnoses.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>No diagnoses selected. Search or click to add.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {selectedDiagnoses.map((diagnosis, index) => (
                <div
                  key={diagnosis.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 border rounded-lg ${
                    diagnosis.type === 'Primary'
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                  } ${draggedIndex === index ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <GripVertical className="w-5 h-5 text-gray-400 cursor-grab mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-blue-600">{diagnosis.code}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(diagnosis.category)}`}>
                            {diagnosis.category}
                          </span>
                        </div>
                        <button
                          onClick={() => removeDiagnosis(diagnosis.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{diagnosis.description}</p>
                      <div className="mt-2">
                        <button
                          onClick={() => toggleType(diagnosis.id)}
                          className={`text-xs px-3 py-1 rounded-full font-medium ${
                            diagnosis.type === 'Primary'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {diagnosis.type}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDiagnoses.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Save Diagnoses
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
