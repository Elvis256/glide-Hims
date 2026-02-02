import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  X,
  GripVertical,
  Star,
  Check,
  Loader2,
  Code,
  Save,
  RefreshCw,
  Database,
  Heart,
  Activity,
  Stethoscope,
  FileText,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../../services/patients';
import { problemsService } from '../../../services/problems';
import type { CreateProblemDto } from '../../../services/problems';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';

interface ICD10Code {
  id: string;
  code: string;
  description: string;
  category: string;
  isChronic?: boolean;
  isNotifiable?: boolean;
}

interface SelectedDiagnosis {
  id: string;
  diagnosisId: string;
  code: string;
  description: string;
  category: string;
  type: 'Primary' | 'Secondary';
  isChronic?: boolean;
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
}

// Common Uganda diagnoses for quick pick
const defaultCommonDiagnoses: ICD10Code[] = [
  { id: 'B54', code: 'B54', description: 'Malaria (Unspecified)', category: 'infectious', isChronic: false },
  { id: 'J06', code: 'J06', description: 'Acute Upper Respiratory Infection', category: 'respiratory', isChronic: false },
  { id: 'A09', code: 'A09', description: 'Infectious Gastroenteritis', category: 'infectious', isChronic: false },
  { id: 'N39', code: 'N39', description: 'Urinary Tract Infection', category: 'genitourinary', isChronic: false },
  { id: 'I10', code: 'I10', description: 'Essential Hypertension', category: 'circulatory', isChronic: true },
  { id: 'E11', code: 'E11', description: 'Type 2 Diabetes Mellitus', category: 'endocrine', isChronic: true },
  { id: 'J18', code: 'J18', description: 'Pneumonia', category: 'respiratory', isChronic: false },
  { id: 'K29', code: 'K29', description: 'Gastritis', category: 'digestive', isChronic: false },
  { id: 'M54', code: 'M54', description: 'Back Pain', category: 'musculoskeletal', isChronic: false },
  { id: 'R50', code: 'R50', description: 'Fever of Unknown Origin', category: 'symptoms', isChronic: false },
];

const categoryColors: Record<string, string> = {
  infectious: 'bg-red-100 text-red-700',
  respiratory: 'bg-blue-100 text-blue-700',
  circulatory: 'bg-pink-100 text-pink-700',
  endocrine: 'bg-purple-100 text-purple-700',
  musculoskeletal: 'bg-orange-100 text-orange-700',
  digestive: 'bg-yellow-100 text-yellow-700',
  genitourinary: 'bg-teal-100 text-teal-700',
  symptoms: 'bg-gray-100 text-gray-700',
  mental: 'bg-indigo-100 text-indigo-700',
  nervous: 'bg-cyan-100 text-cyan-700',
  skin: 'bg-green-100 text-green-700',
  injury: 'bg-rose-100 text-rose-700',
  pregnancy: 'bg-fuchsia-100 text-fuchsia-700',
  other: 'bg-slate-100 text-slate-700',
};

export default function ICD10CodingPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<SelectedDiagnosis[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch patients from API
  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', patientSearchQuery],
    queryFn: () => patientsService.search({ search: patientSearchQuery, limit: 20 }),
    enabled: patientSearchQuery.length >= 2,
  });

  const patients = useMemo(() =>
    patientsData?.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      dob: p.dateOfBirth,
      mrn: p.mrn,
    })) ?? [],
    [patientsData]
  );

  // Fetch ICD-10 codes from backend
  const { data: diagnosesData, isLoading: isLoadingDiagnoses, refetch: refetchDiagnoses } = useQuery({
    queryKey: ['diagnoses', searchQuery, categoryFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const response = await api.get('/diagnoses', { params });
      return response.data?.data || response.data || [];
    },
  });

  // Seed diagnoses mutation
  const seedMutation = useMutation({
    mutationFn: () => api.post('/diagnoses/seed'),
    onSuccess: () => {
      toast.success('Common diagnoses seeded successfully');
      refetchDiagnoses();
    },
    onError: () => toast.error('Failed to seed diagnoses'),
  });

  // Save diagnoses to patient problems
  const saveMutation = useMutation({
    mutationFn: async (diagnoses: SelectedDiagnosis[]) => {
      const promises = diagnoses.map((d, index) =>
        problemsService.create(facilityId, {
          patientId: selectedPatient!.id,
          diagnosisId: d.diagnosisId,
          customDiagnosis: d.description,
          customIcdCode: d.code,
          status: d.isChronic ? 'chronic' : 'active',
          onsetDate: format(new Date(), 'yyyy-MM-dd'),
          notes: d.type === 'Primary' ? 'Primary diagnosis' : `Secondary diagnosis #${index}`,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Diagnoses saved to patient record');
      setSelectedDiagnoses([]);
      queryClient.invalidateQueries({ queryKey: ['patient-problems'] });
    },
    onError: () => toast.error('Failed to save diagnoses'),
  });

  // Transform backend diagnoses to ICD10Code format
  const icd10Codes: ICD10Code[] = useMemo(() => {
    if (!diagnosesData) return [];
    return diagnosesData.map((d: any) => ({
      id: d.id,
      code: d.icd10Code,
      description: d.name || d.shortName,
      category: d.category || 'other',
      isChronic: d.isChronic,
      isNotifiable: d.isNotifiable,
    }));
  }, [diagnosesData]);

  // Use default common diagnoses if backend has none
  const commonDiagnoses = icd10Codes.length > 0
    ? icd10Codes.filter(c => ['B54', 'J06', 'A09', 'N39', 'I10', 'E11', 'J18', 'K29', 'M54', 'R50'].includes(c.code)).slice(0, 10)
    : defaultCommonDiagnoses;

  const filteredCodes = useMemo(() => {
    if (!searchQuery && categoryFilter === 'all') return icd10Codes.slice(0, 50);
    return icd10Codes;
  }, [icd10Codes, searchQuery, categoryFilter]);

  const addDiagnosis = (code: ICD10Code) => {
    if (selectedDiagnoses.some((d) => d.code === code.code)) {
      toast.info('Diagnosis already selected');
      return;
    }
    const newDiagnosis: SelectedDiagnosis = {
      id: crypto.randomUUID(),
      diagnosisId: code.id,
      code: code.code,
      description: code.description,
      category: code.category,
      type: selectedDiagnoses.length === 0 ? 'Primary' : 'Secondary',
      isChronic: code.isChronic,
    };
    setSelectedDiagnoses([...selectedDiagnoses, newDiagnosis]);
    setShowDropdown(false);
    toast.success(`Added: ${code.code} - ${code.description}`);
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

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newList = [...selectedDiagnoses];
    const [removed] = newList.splice(draggedIndex, 1);
    newList.splice(index, 0, removed);
    setSelectedDiagnoses(newList);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  const getCategoryColor = (category: string) => categoryColors[category] || categoryColors.other;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const categories = ['all', 'infectious', 'respiratory', 'circulatory', 'endocrine', 'digestive', 'musculoskeletal', 'genitourinary', 'symptoms', 'mental', 'nervous', 'skin', 'injury', 'pregnancy', 'other'];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Code className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">ICD-10 Diagnosis Coding</h1>
              <p className="text-sm text-gray-500">Search and assign diagnosis codes to patients</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchDiagnoses()}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {icd10Codes.length === 0 && (
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Seed Diagnoses
              </button>
            )}
          </div>
        </div>

        {/* Patient Selection */}
        {!selectedPatient ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Select Patient First</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                placeholder="Search patients by name or MRN..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {isLoadingPatients && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            {patients.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{patient.name}</div>
                      <div className="text-sm text-gray-500">MRN: {patient.mrn} | DOB: {formatDate(patient.dob)}</div>
                    </div>
                    <Heart className="w-5 h-5 text-blue-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Stethoscope className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h2>
                <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn} | DOB: {formatDate(selectedPatient.dob)}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setPatientSearchQuery('');
                setSelectedDiagnoses([]);
              }}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              Change Patient
            </button>
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          {/* Search Panel */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              ICD-10 Code Search
            </h2>

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
                placeholder="Search by code, description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-2 block">Filter by Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Common Diagnoses */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500" /> Common Diagnoses (Uganda)
              </h3>
              <div className="flex flex-wrap gap-2">
                {commonDiagnoses.map((code) => (
                  <button
                    key={code.code}
                    onClick={() => addDiagnosis(code)}
                    disabled={selectedDiagnoses.some((d) => d.code === code.code)}
                    className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1 transition-colors ${
                      selectedDiagnoses.some((d) => d.code === code.code)
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-700'
                    }`}
                  >
                    {selectedDiagnoses.some((d) => d.code === code.code) ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    <span className="font-mono">{code.code}</span> - {code.description.slice(0, 25)}
                  </button>
                ))}
              </div>
            </div>

            {/* All ICD-10 Codes */}
            <div className="flex-1 overflow-y-auto border-t pt-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                {isLoadingDiagnoses ? 'Loading...' : `Available Codes (${filteredCodes.length})`}
              </h3>
              {isLoadingDiagnoses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : filteredCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ICD-10 codes found</p>
                  <button
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                    className="mt-3 text-blue-600 hover:underline text-sm"
                  >
                    Click to seed common diagnoses
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCodes.map((code) => {
                    const isSelected = selectedDiagnoses.some((d) => d.code === code.code);
                    return (
                      <div
                        key={code.id || code.code}
                        onClick={() => addDiagnosis(code)}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-blue-600">{code.code}</span>
                              {code.isChronic && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Chronic</span>
                              )}
                              {code.isNotifiable && (
                                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Notifiable</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{code.description}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(code.category)}`}>
                              {code.category}
                            </span>
                            {isSelected && <Check className="w-5 h-5 text-green-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Selected Diagnoses Panel */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Selected Diagnoses ({selectedDiagnoses.length})
            </h2>

            {selectedDiagnoses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <FileText className="w-12 h-12 mb-4 opacity-30" />
                <p>No diagnoses selected</p>
                <p className="text-sm mt-1">Search or click to add diagnoses</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {selectedDiagnoses.map((diagnosis, index) => (
                    <div
                      key={diagnosis.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`p-4 border rounded-lg transition-all ${
                        diagnosis.type === 'Primary'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      } ${draggedIndex === index ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-blue-600">{diagnosis.code}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(diagnosis.category)}`}>
                                {diagnosis.category}
                              </span>
                              {diagnosis.isChronic && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Chronic</span>
                              )}
                            </div>
                            <button
                              onClick={() => removeDiagnosis(diagnosis.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{diagnosis.description}</p>
                          <div className="mt-2">
                            <button
                              onClick={() => toggleType(diagnosis.id)}
                              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
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

                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => saveMutation.mutate(selectedDiagnoses)}
                    disabled={saveMutation.isPending || selectedDiagnoses.length === 0}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Diagnoses to Patient Record
                  </button>
                  <button
                    onClick={() => setSelectedDiagnoses([])}
                    className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
