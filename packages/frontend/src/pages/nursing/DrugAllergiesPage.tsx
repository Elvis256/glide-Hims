import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
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
  ShieldOff,
  ShieldCheck,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../services/patients';
import {
  allergiesService,
  type PatientAllergy,
  type AllergyCategory,
  type AllergyCriticality,
  type AllergySeverity,
  type AllergySource,
  type AllergyType,
  type AllergyVerification,
  type CreateAllergyDto,
} from '../../services/allergies';
import { asList } from '../../utils/unwrapResponse';

interface PatientLite {
  id: string;
  mrn: string;
  name: string;
  age: number;
}

const mapPatient = (p: ApiPatient): PatientLite => ({
  id: p.id,
  mrn: p.mrn,
  name: p.fullName,
  age: Math.floor(
    (new Date().getTime() - new Date(p.dateOfBirth).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000),
  ),
});

// UI severity (includes life-threatening) -> backend severity + criticality
type UISeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening';

const severityColors: Record<UISeverity, { bg: string; text: string }> = {
  mild: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  moderate: { bg: 'bg-orange-100', text: 'text-orange-700' },
  severe: { bg: 'bg-red-100', text: 'text-red-700' },
  'life-threatening': { bg: 'bg-red-200', text: 'text-red-800' },
};

const categoryToUiType: Record<AllergyCategory, string> = {
  medication: 'drug',
  food: 'food',
  environment: 'environmental',
  biologic: 'biologic',
  other: 'other',
};

// Display severity for an allergy: bump 'severe' + criticality 'high' to "life-threatening"
function displaySeverity(a: PatientAllergy): UISeverity {
  if (a.severity === 'severe' && a.criticality === 'high') return 'life-threatening';
  return (a.severity as UISeverity) || 'moderate';
}

interface NewAllergyForm {
  allergen: string;
  category: AllergyCategory;
  type: AllergyType;
  reaction: string;
  severity: UISeverity;
  source: AllergySource;
  verification: AllergyVerification;
  notes: string;
}

const blankForm: NewAllergyForm = {
  allergen: '',
  category: 'medication',
  type: 'allergy',
  reaction: '',
  severity: 'moderate',
  source: 'patient-reported',
  verification: 'unconfirmed',
  notes: '',
};

export default function DrugAllergiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newAllergy, setNewAllergy] = useState<NewAllergyForm>(blankForm);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search patients
  const { data: patientsData, isLoading: searchLoading } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () => patientsService.search({ search: debouncedSearch, limit: 20 }),
    enabled: debouncedSearch.length >= 2,
  });

  const patients: PatientLite[] = useMemo(
    () => asList(patientsData).map(mapPatient) || [],
    [patientsData],
  );

  // Fetch real allergies for the selected patient
  const allergiesQueryKey = ['patient-allergies', selectedPatient?.id];
  const { data: allergiesData, isLoading: allergiesLoading } = useQuery({
    queryKey: allergiesQueryKey,
    queryFn: () => allergiesService.list(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
  });

  const allergies: PatientAllergy[] = useMemo(() => allergiesData || [], [allergiesData]);
  const visibleAllergies = useMemo(
    () => (showInactive ? allergies : allergies.filter((a) => a.status === 'active')),
    [allergies, showInactive],
  );
  const activeCount = allergies.filter((a) => a.status === 'active').length;

  // ---- Mutations ----
  const addAllergyMutation = useMutation({
    mutationFn: async (form: NewAllergyForm) => {
      // life-threatening => severe + criticality high
      const lifeThreat = form.severity === 'life-threatening';
      const dto: CreateAllergyDto = {
        allergen: form.allergen.trim(),
        type: form.type,
        category: form.category,
        severity: lifeThreat ? 'severe' : form.severity,
        criticality: lifeThreat ? 'high' : 'low',
        reaction: form.reaction.trim() || undefined,
        verification: form.verification,
        source: form.source,
        notes: form.notes.trim() || undefined,
      };
      return allergiesService.create(selectedPatient!.id, dto);
    },
    onSuccess: () => {
      toast.success('Allergy recorded');
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
      // Refresh patient cache too — legacy code may still consume patient.allergies
      queryClient.invalidateQueries({ queryKey: ['patients', selectedPatient?.id] });
      setShowAddForm(false);
      setNewAllergy(blankForm);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to record allergy';
      toast.error(typeof msg === 'string' ? msg : 'Failed to record allergy');
    },
  });

  const inactivateMutation = useMutation({
    mutationFn: async (id: string) => allergiesService.inactivate(selectedPatient!.id, id),
    onSuccess: () => {
      toast.success('Allergy inactivated');
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to inactivate');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) =>
      allergiesService.update(selectedPatient!.id, id, { status: 'active' }),
    onSuccess: () => {
      toast.success('Allergy reactivated');
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reactivate');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => allergiesService.remove(selectedPatient!.id, id),
    onSuccess: () => {
      toast.success('Allergy removed');
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove');
    },
  });

  const handleAddAllergy = () => {
    if (!newAllergy.allergen.trim()) {
      toast.error('Allergen is required');
      return;
    }
    addAllergyMutation.mutate(newAllergy);
  };

  const handleDelete = (a: PatientAllergy) => {
    if (a.status === 'active') {
      if (confirm(`Mark "${a.allergen}" as inactive? (preferred over delete)`)) {
        inactivateMutation.mutate(a.id);
      }
    } else {
      if (confirm(`Permanently delete "${a.allergen}"? This cannot be undone.`)) {
        removeMutation.mutate(a.id);
      }
    }
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
              <h1 className="text-xl font-bold text-gray-900">Allergies & Intolerances</h1>
              <p className="text-sm text-gray-500">
                FHIR AllergyIntolerance — checked at prescribe & dispense
              </p>
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
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <p className="text-sm text-gray-500 text-center py-4">Searching...</p>
              ) : patients.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No patients found.</p>
              ) : (
                patients.map((patient) => (
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
                ))
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient</p>
            )}
          </div>
        </div>

        {/* Allergies List */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedPatient.name}'s Allergies
                  </h2>
                  <p className="text-sm text-gray-500">
                    {activeCount} active · {allergies.length} total
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                      className="rounded"
                    />
                    Show inactive
                  </label>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Allergy
                  </button>
                </div>
              </div>

              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Add New Allergy / Intolerance</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Allergen *
                      </label>
                      <input
                        type="text"
                        value={newAllergy.allergen}
                        onChange={(e) =>
                          setNewAllergy({ ...newAllergy, allergen: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., Penicillin"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Category
                      </label>
                      <select
                        value={newAllergy.category}
                        onChange={(e) =>
                          setNewAllergy({
                            ...newAllergy,
                            category: e.target.value as AllergyCategory,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="medication">Medication</option>
                        <option value="food">Food</option>
                        <option value="environment">Environmental</option>
                        <option value="biologic">Biologic</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Type
                      </label>
                      <select
                        value={newAllergy.type}
                        onChange={(e) =>
                          setNewAllergy({ ...newAllergy, type: e.target.value as AllergyType })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="allergy">Allergy</option>
                        <option value="intolerance">Intolerance</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Severity
                      </label>
                      <select
                        value={newAllergy.severity}
                        onChange={(e) =>
                          setNewAllergy({
                            ...newAllergy,
                            severity: e.target.value as UISeverity,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="life-threatening">Life-Threatening</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Reaction
                      </label>
                      <input
                        type="text"
                        value={newAllergy.reaction}
                        onChange={(e) =>
                          setNewAllergy({ ...newAllergy, reaction: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., Anaphylaxis, rash, swelling..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Source
                      </label>
                      <select
                        value={newAllergy.source}
                        onChange={(e) =>
                          setNewAllergy({
                            ...newAllergy,
                            source: e.target.value as AllergySource,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="patient-reported">Patient-reported</option>
                        <option value="family-reported">Family-reported</option>
                        <option value="observed">Observed</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Verification
                      </label>
                      <select
                        value={newAllergy.verification}
                        onChange={(e) =>
                          setNewAllergy({
                            ...newAllergy,
                            verification: e.target.value as AllergyVerification,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="unconfirmed">Unconfirmed</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="refuted">Refuted</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Notes
                      </label>
                      <textarea
                        value={newAllergy.notes}
                        onChange={(e) =>
                          setNewAllergy({ ...newAllergy, notes: e.target.value })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Optional clinical notes..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setNewAllergy(blankForm);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddAllergy}
                      disabled={addAllergyMutation.isPending || !newAllergy.allergen.trim()}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      {addAllergyMutation.isPending ? (
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
                {allergiesLoading ? (
                  <p className="text-center text-sm text-gray-500 py-8">Loading allergies...</p>
                ) : visibleAllergies.length > 0 ? (
                  <div className="space-y-3">
                    {visibleAllergies.map((allergy) => {
                      const sev = displaySeverity(allergy);
                      const sevColor = severityColors[sev];
                      const inactive = allergy.status !== 'active';
                      return (
                        <div
                          key={allergy.id}
                          className={`p-4 rounded-lg border ${
                            inactive
                              ? 'border-gray-200 bg-gray-50 opacity-70'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                                <Pill className="w-5 h-5 text-red-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-medium text-gray-900">
                                    {allergy.allergen}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded ${sevColor.bg} ${sevColor.text}`}
                                  >
                                    {sev}
                                  </span>
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                                    {categoryToUiType[allergy.category] || allergy.category}
                                  </span>
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700">
                                    {allergy.type}
                                  </span>
                                  {allergy.verification === 'confirmed' && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-50 text-green-700">
                                      confirmed
                                    </span>
                                  )}
                                  {inactive && (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700">
                                      {allergy.status}
                                    </span>
                                  )}
                                </div>
                                {allergy.reaction && (
                                  <p className="text-sm text-gray-600">{allergy.reaction}</p>
                                )}
                                {allergy.notes && (
                                  <p className="text-xs text-gray-500 italic mt-1">
                                    {allergy.notes}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  Recorded{' '}
                                  {new Date(allergy.recordedAt).toLocaleDateString()} ·{' '}
                                  source: {allergy.source}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {inactive ? (
                                <button
                                  title="Reactivate"
                                  onClick={() => reactivateMutation.mutate(allergy.id)}
                                  disabled={reactivateMutation.isPending}
                                  className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg disabled:opacity-50"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  title="Inactivate"
                                  onClick={() => inactivateMutation.mutate(allergy.id)}
                                  disabled={inactivateMutation.isPending}
                                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50"
                                >
                                  <ShieldOff className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                title={inactive ? 'Delete permanently' : 'Inactivate'}
                                onClick={() => handleDelete(allergy)}
                                disabled={removeMutation.isPending || inactivateMutation.isPending}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
