import { usePermissions } from '../../../components/PermissionGate';
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
  Globe,
  Download,
  AlertCircle,
  Wifi,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../../services/patients';
import { problemsService } from '../../../services/problems';
import { diagnosesService } from '../../../services/diagnoses';
import type { CreateProblemDto } from '../../../services/problems';
import type { WHOSearchResult } from '../../../services/diagnoses';
import { useFacilityId } from '../../../lib/facility';

interface ICD10Code {
  id: string;
  code: string;
  description: string;
  category: string;
  isChronic?: boolean;
  isNotifiable?: boolean;
  version?: 'ICD-10' | 'ICD-11' | 'local';
}

interface SelectedDiagnosis {
  id: string;
  diagnosisId: string;
  code: string;
  description: string;
  category: string;
  type: 'Primary' | 'Secondary';
  isChronic?: boolean;
  version?: string;
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
}

type SearchSource = 'local' | 'who' | 'both';

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
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<SelectedDiagnosis[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchSource, setSearchSource] = useState<SearchSource>('both');
  const [icdVersion, setIcdVersion] = useState<'icd10' | 'icd11' | 'both'>('both');

  // Check WHO API status
  const { data: whoStatus } = useQuery({
    queryKey: ['who-status'],
    queryFn: () => diagnosesService.getWHOStatus(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

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

  // Search LOCAL diagnoses
  const { data: localDiagnoses = [], isLoading: isLoadingLocal } = useQuery({
    queryKey: ['diagnoses-local', searchQuery, categoryFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const response = await diagnosesService.search(params);
      return response.data || [];
    },
    enabled: searchSource !== 'who',
  });

  // Search WHO API (real-time)
  const { data: whoResults, isLoading: isLoadingWHO, refetch: refetchWHO } = useQuery({
    queryKey: ['diagnoses-who', searchQuery, icdVersion],
    queryFn: () => diagnosesService.searchWHO(searchQuery, icdVersion),
    enabled: searchQuery.length >= 2 && searchSource !== 'local' && !!whoStatus?.configured,
    staleTime: 60000, // Cache WHO results for 1 minute
  });

  // Seed local diagnoses
  const seedMutation = useMutation({
    mutationFn: () => diagnosesService.seed(),
    onSuccess: () => {
      toast.success('Common diagnoses seeded successfully');
      queryClient.invalidateQueries({ queryKey: ['diagnoses-local'] });
    },
    onError: () => toast.error('Failed to seed diagnoses'),
  });

  // Import from WHO to local
  const importMutation = useMutation({
    mutationFn: (result: WHOSearchResult) => diagnosesService.bulkImportFromWHO([{
      code: result.code,
      title: result.title,
      chapter: result.chapter,
    }]),
    onSuccess: (data) => {
      if (data.imported > 0) {
        toast.success(`Imported successfully`);
      } else {
        toast.info('Already exists in local database');
      }
      queryClient.invalidateQueries({ queryKey: ['diagnoses-local'] });
    },
    onError: () => toast.error('Failed to import diagnosis'),
  });

  // Bulk import from WHO
  const bulkImportMutation = useMutation({
    mutationFn: (codes: Array<{ code: string; title: string; chapter?: string }>) => 
      diagnosesService.bulkImportFromWHO(codes),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['diagnoses-local'] });
    },
    onError: () => toast.error('Failed to bulk import'),
  });

  // Save to patient problems
  const saveMutation = useMutation({
    mutationFn: async (diagnoses: SelectedDiagnosis[]) => {
      const promises = diagnoses.map((d, index) =>
        problemsService.create(facilityId, {
          patientId: selectedPatient!.id,
          diagnosisId: d.diagnosisId !== d.code ? d.diagnosisId : undefined,
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

  // Combine local and WHO results
  const combinedResults: ICD10Code[] = useMemo(() => {
    const results: ICD10Code[] = [];

    // Add local results
    if (searchSource !== 'who' && localDiagnoses.length > 0) {
      results.push(...localDiagnoses.map((d: any) => ({
        id: d.id,
        code: d.icd10Code,
        description: d.name,
        category: d.category || 'other',
        isChronic: d.isChronic,
        isNotifiable: d.isNotifiable,
        version: 'local' as const,
      })));
    }

    // Add WHO results (avoiding duplicates)
    if (searchSource !== 'local' && whoResults?.data) {
      const localCodes = new Set(results.map(r => r.code));
      whoResults.data.forEach((r) => {
        if (!localCodes.has(r.code)) {
          results.push({
            id: r.code,
            code: r.code,
            description: r.title,
            category: r.chapter?.toLowerCase() || 'other',
            version: r.version,
          });
        }
      });
    }

    return results;
  }, [localDiagnoses, whoResults, searchSource]);

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
      version: code.version,
    };
    setSelectedDiagnoses([...selectedDiagnoses, newDiagnosis]);
    toast.success(`Added: ${code.code}`);
  };

  const removeDiagnosis = (id: string) => {
    const updated = selectedDiagnoses.filter((d) => d.id !== id);
    if (updated.length > 0 && !updated.some((d) => d.type === 'Primary')) {
      updated[0].type = 'Primary';
    }
    setSelectedDiagnoses(updated);
  };

  const toggleType = (id: string) => {
    setSelectedDiagnoses(prev => prev.map((d) => {
      if (d.id === id) {
        return { ...d, type: d.type === 'Primary' ? 'Secondary' : 'Primary' };
      }
      return d;
    }));
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

  const getCategoryColor = (category: string) => categoryColors[category?.toLowerCase()] || categoryColors.other;
  const formatDate = (dateString?: string) => dateString ? format(new Date(dateString), 'MMM dd, yyyy') : '-';

  const isLoading = isLoadingLocal || isLoadingWHO;

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
              <h1 className="text-lg font-semibold text-gray-900">ICD-10/11 Diagnosis Coding</h1>
              <p className="text-sm text-gray-500">Search from local database or WHO API in real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* WHO Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
              whoStatus?.configured 
                ? 'bg-green-100 text-green-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {whoStatus?.configured ? (
                <>
                  <Wifi className="w-4 h-4" />
                  WHO API Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  WHO API Not Configured
                </>
              )}
            </div>
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Seed Local
            </button>
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
              {isLoadingPatients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
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
                    <Stethoscope className="w-5 h-5 text-blue-300" />
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
                <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedPatient(null); setPatientSearchQuery(''); setSelectedDiagnoses([]); }}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              Change Patient
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        {/* Search Panel */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Search ICD Codes
          </h2>

            {/* Search Source Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">Source:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['local', 'who', 'both'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => setSearchSource(src)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      searchSource === src ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'
                    }`}
                  >
                    {src === 'local' ? 'Local DB' : src === 'who' ? 'WHO API' : 'Both'}
                  </button>
                ))}
              </div>
              {searchSource !== 'local' && (
                <select
                  value={icdVersion}
                  onChange={(e) => setIcdVersion(e.target.value as any)}
                  className="ml-2 px-2 py-1 text-sm border rounded-lg"
                >
                  <option value="both">ICD-10 & 11</option>
                  <option value="icd10">ICD-10 only</option>
                  <option value="icd11">ICD-11 only</option>
                </select>
              )}
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchSource === 'who' ? 'Search WHO ICD API...' : 'Search diagnoses...'}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-600" />}
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-gray-600">
                {combinedResults.length} results
                {whoResults?.data?.length ? ` (${whoResults.data.length} from WHO)` : ''}
              </span>
              {whoResults?.data && whoResults.data.length > 0 && (
                <button
                  onClick={() => bulkImportMutation.mutate(whoResults.data.map(r => ({
                    code: r.code,
                    title: r.title,
                    chapter: r.chapter,
                  })))}
                  disabled={bulkImportMutation.isPending}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <Download className="w-4 h-4" />
                  Import all to local
                </button>
              )}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {combinedResults.length === 0 && !isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery.length < 2 ? 'Enter at least 2 characters to search' : 'No results found'}
                  </p>
                  {searchSource !== 'who' && localDiagnoses.length === 0 && (
                    <button
                      onClick={() => seedMutation.mutate()}
                      className="mt-3 text-blue-600 hover:underline text-sm"
                    >
                      Seed common diagnoses
                    </button>
                  )}
                </div>
              ) : (
                combinedResults.map((code) => {
                  const isSelected = selectedDiagnoses.some((d) => d.code === code.code);
                  return (
                    <div
                      key={`${code.version}-${code.code}`}
                      onClick={() => addDiagnosis(code)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-blue-600">{code.code}</span>
                            {code.version && code.version !== 'local' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                code.version === 'ICD-11' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {code.version}
                              </span>
                            )}
                            {code.version === 'local' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Local</span>
                            )}
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
                          {code.version !== 'local' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                importMutation.mutate({ code: code.code, title: code.description, version: code.version as any, chapter: code.category, score: 0 });
                              }}
                              className="p-1 text-blue-500 hover:bg-blue-100 rounded"
                              title="Save to local database"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })
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
                <p className="text-sm mt-1">Search and click to add</p>
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
                        diagnosis.type === 'Primary' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                      } ${draggedIndex === index ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-blue-600">{diagnosis.code}</span>
                              {diagnosis.version && diagnosis.version !== 'local' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                  {diagnosis.version}
                                </span>
                              )}
                            </div>
                            <button onClick={() => removeDiagnosis(diagnosis.id)} className="text-gray-400 hover:text-red-500 p-1">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{diagnosis.description}</p>
                          <div className="mt-2">
                            <button
                              onClick={() => toggleType(diagnosis.id)}
                              className={`text-xs px-3 py-1 rounded-full font-medium ${
                                diagnosis.type === 'Primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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

                <div className="mt-4 pt-4 border-t space-y-2">
                  <button
                    onClick={() => saveMutation.mutate(selectedDiagnoses)}
                    disabled={saveMutation.isPending || !selectedPatient}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {selectedPatient ? 'Save to Patient Record' : 'Select Patient to Save'}
                  </button>
                  <button onClick={() => setSelectedDiagnoses([])} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
    </div>
  );
}
