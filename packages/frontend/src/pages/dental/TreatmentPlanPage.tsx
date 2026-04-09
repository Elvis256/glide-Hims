import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

interface Procedure {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultFee: number;
}

interface PlanItem {
  id: string;
  toothNumber: number | null;
  surface: string[];
  procedureId: string;
  procedureName: string;
  procedureCode: string;
  priority: string;
  estimatedCost: number;
  status: string;
}

interface TreatmentPlan {
  id: string;
  planName: string;
  status: string;
  items: PlanItem[];
  totalCost: number;
  notes: string;
  createdAt: string;
}

interface NewItem {
  toothNumber: string;
  surface: string[];
  procedureId: string;
  priority: string;
  estimatedCost: number;
}

const ITEM_STATUS_OPTIONS = ['planned', 'scheduled', 'in_progress', 'completed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const SURFACES = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'];
const TEETH = Array.from({ length: 32 }, (_, i) => i + 1);

const STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  planned: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-600',
};

export default function TreatmentPlanPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [procedureSearch, setProcedureSearch] = useState('');

  // Patient search
  const { data: searchResults, isLoading: searching } = useQuery<Patient[]>({
    queryKey: ['patient-search', patientSearch, facilityId],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const res = await api.get('/patients/search', { params: { query: patientSearch } });
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
    enabled: patientSearch.length >= 2 && !selectedPatient,
  });

  // Treatment plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['treatment-plans', selectedPatient?.id, facilityId],
    queryFn: async () => {
      const res = await api.get(`/dental/treatment-plans/patient/${selectedPatient!.id}`);
      return res.data;
    },
    enabled: !!selectedPatient,
  });

  // Procedures catalog
  const { data: proceduresData } = useQuery({
    queryKey: ['dental-procedures', facilityId],
    queryFn: async () => {
      const res = await api.get('/dental/procedures');
      return res.data;
    },
  });

  const plans = asList<TreatmentPlan>(plansData);
  const procedures = asList<Procedure>(proceduresData);
  const filteredProcedures = procedures.filter(
    (p) =>
      p.name.toLowerCase().includes(procedureSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(procedureSearch.toLowerCase()),
  );

  // Create plan
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/dental/treatment-plans', {
        patientId: selectedPatient!.id,
        planName,
        notes: planNotes,
        items: newItems.map((item) => ({
          toothNumber: item.toothNumber ? Number(item.toothNumber) : null,
          surface: item.surface,
          procedureId: item.procedureId,
          priority: item.priority,
          estimatedCost: item.estimatedCost,
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Treatment plan created');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', selectedPatient?.id] });
      setShowCreate(false);
      setPlanName('');
      setPlanNotes('');
      setNewItems([]);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Update item status
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await api.patch(`/dental/treatment-plans/items/${itemId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Item status updated');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', selectedPatient?.id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Accept plan
  const acceptMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.patch(`/dental/treatment-plans/${planId}/accept`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Plan accepted');
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', selectedPatient?.id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const addItem = () => {
    setNewItems([...newItems, { toothNumber: '', surface: [], procedureId: '', priority: 'medium', estimatedCost: 0 }]);
  };

  const updateItem = (index: number, field: keyof NewItem, value: NewItem[keyof NewItem]) => {
    const updated = [...newItems];
    (updated[index] as Record<string, unknown>)[field] = value;
    // Auto-fill cost when procedure selected
    if (field === 'procedureId') {
      const proc = procedures.find((p) => p.id === value);
      if (proc) updated[index].estimatedCost = proc.defaultFee;
    }
    setNewItems(updated);
  };

  const removeItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const toggleSurface = (index: number, surface: string) => {
    const item = newItems[index];
    const surfaces = item.surface.includes(surface)
      ? item.surface.filter((s) => s !== surface)
      : [...item.surface, surface];
    updateItem(index, 'surface', surfaces);
  };

  const totalCost = newItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

  const getProgress = (plan: TreatmentPlan) => {
    if (!plan.items?.length) return 0;
    const completed = plan.items.filter((i) => i.status === 'completed').length;
    return Math.round((completed / plan.items.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Treatment Plans</h1>
        {selectedPatient && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Plan
          </button>
        )}
      </div>

      {/* Patient Selector */}
      <div className="relative max-w-md">
        {selectedPatient ? (
          <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2">
            <span className="font-medium">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </span>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setPatientSearch('');
                setShowCreate(false);
              }}
              className="ml-auto rounded p-1 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full rounded-lg border bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
            {searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setPatientSearch('');
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Plan Form */}
      {showCreate && selectedPatient && (
        <div className="rounded-xl border bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold">Create Treatment Plan</h3>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Plan Name</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g., Comprehensive Restoration"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Items Builder */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Plan Items</label>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                <Plus className="h-3 w-3" />
                Add Item
              </button>
            </div>

            {newItems.length === 0 && (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
                No items yet. Click &quot;Add Item&quot; to begin.
              </p>
            )}

            <div className="space-y-3">
              {newItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border bg-gray-50 p-3">
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    {/* Tooth */}
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-500">Tooth</label>
                      <select
                        value={item.toothNumber}
                        onChange={(e) => updateItem(idx, 'toothNumber', e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-xs"
                      >
                        <option value="">N/A</option>
                        {TEETH.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Procedure */}
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-500">Procedure</label>
                      <select
                        value={item.procedureId}
                        onChange={(e) => updateItem(idx, 'procedureId', e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-xs"
                      >
                        <option value="">Select...</option>
                        {filteredProcedures.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-500">Priority</label>
                      <select
                        value={item.priority}
                        onChange={(e) => updateItem(idx, 'priority', e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-xs"
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cost */}
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <label className="mb-0.5 block text-xs text-gray-500">Est. Cost</label>
                        <input
                          type="number"
                          value={item.estimatedCost}
                          onChange={(e) => updateItem(idx, 'estimatedCost', Number(e.target.value))}
                          className="w-full rounded border px-2 py-1.5 text-xs"
                        />
                      </div>
                      <button onClick={() => removeItem(idx)} className="mb-0.5 rounded p-1 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Surfaces */}
                  <div className="flex gap-2">
                    {SURFACES.map((s) => (
                      <label key={s} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={item.surface.includes(s)}
                          onChange={() => toggleSurface(idx, s)}
                          className="h-3 w-3 rounded border-gray-300"
                        />
                        <span className="capitalize">{s.substring(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {newItems.length > 0 && (
            <div className="mb-4 text-right text-sm font-semibold">
              Total: {formatCurrency(totalCost)}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !planName || newItems.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Plan
            </button>
          </div>
        </div>
      )}

      {/* Existing Plans */}
      {selectedPatient && (
        <div className="space-y-3">
          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border bg-white py-12 text-center text-gray-500">
              <p>No treatment plans found for this patient</p>
            </div>
          ) : (
            plans.map((plan) => {
              const isExpanded = expandedPlan === plan.id;
              const progress = getProgress(plan);
              return (
                <div key={plan.id} className="rounded-xl border bg-white">
                  {/* Plan Header */}
                  <button
                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{plan.planName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(plan.createdAt).toLocaleDateString()} · {plan.items?.length ?? 0} items
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[plan.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {plan.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold">{formatCurrency(plan.totalCost)}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t px-6 py-4">
                      {/* Progress */}
                      <div className="mb-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs text-gray-500">
                              <th className="pb-2 pr-4">Tooth</th>
                              <th className="pb-2 pr-4">Procedure</th>
                              <th className="pb-2 pr-4">Priority</th>
                              <th className="pb-2 pr-4">Cost</th>
                              <th className="pb-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(plan.items ?? []).map((item) => (
                              <tr key={item.id}>
                                <td className="py-2 pr-4">{item.toothNumber ?? '-'}</td>
                                <td className="py-2 pr-4">
                                  <span className="font-medium">{item.procedureCode}</span>
                                  <span className="ml-1 text-gray-500">- {item.procedureName}</span>
                                </td>
                                <td className="py-2 pr-4 capitalize">{item.priority}</td>
                                <td className="py-2 pr-4">{formatCurrency(item.estimatedCost)}</td>
                                <td className="py-2">
                                  <select
                                    value={item.status}
                                    onChange={(e) =>
                                      updateItemMutation.mutate({ itemId: item.id, status: e.target.value })
                                    }
                                    className="rounded border px-2 py-1 text-xs"
                                  >
                                    {ITEM_STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {plan.status === 'proposed' && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => acceptMutation.mutate(plan.id)}
                            disabled={acceptMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {acceptMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Accept Plan
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {!selectedPatient && (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
          <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium">Select a Patient</p>
          <p className="text-sm">Search for a patient to view or create treatment plans</p>
        </div>
      )}
    </div>
  );
}
