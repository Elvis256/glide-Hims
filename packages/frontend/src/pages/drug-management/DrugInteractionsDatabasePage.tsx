import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  drugManagementService,
  type DrugInteractionWithNames,
  type DrugClassification,
} from '../../services/drug-management';
import { getApiErrorMessage } from '../../services/api';
import { confirmDialog } from '../../components/ConfirmDialog';
import {
  GitBranch,
  Search,
  Plus,
  Edit2,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Pill,
  X,
  Trash2,
} from 'lucide-react';

// Severity values as stored by the backend (lowercase). The picker + badges all
// key off these exact strings.
const SEVERITIES = ['minor', 'moderate', 'major', 'contraindicated'] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_LABEL: Record<Severity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  contraindicated: 'Contraindicated',
};

interface FormState {
  id?: string;
  drugAId: string;
  drugAName: string;
  drugBId: string;
  drugBName: string;
  severity: Severity;
  description: string;
  clinicalEffects: string;
  mechanism: string;
  management: string;
  reference: string;
}

const EMPTY_FORM: FormState = {
  drugAId: '',
  drugAName: '',
  drugBId: '',
  drugBName: '',
  severity: 'moderate',
  description: '',
  clinicalEffects: '',
  mechanism: '',
  management: '',
  reference: '',
};

/** Type-ahead picker over the drug classification catalogue. Selecting a drug
 *  captures both its id (what the backend stores) and its name (for display). */
function DrugPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: string;
  onSelect: (drug: { id: string; name: string }) => void;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ['drug-search', term],
    queryFn: async () => {
      const res = await drugManagementService.classifications.search(term.trim());
      return res.data as DrugClassification[];
    },
    enabled: open && term.trim().length >= 2,
  });

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={open ? term : value}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setTerm('');
          setOpen(true);
        }}
        placeholder="Type at least 2 letters to search…"
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
      />
      {open && term.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {!isFetching && (results?.length ?? 0) === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No drugs found. Add the drug under Drug Classifications first.
            </div>
          )}
          {results?.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                onSelect({ id: d.id, name: d.genericName || d.brandName || 'Unknown drug' });
                setOpen(false);
                setTerm('');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <Pill className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{d.genericName || d.brandName}</span>
              {d.brandName && d.genericName && (
                <span className="text-gray-400">({d.brandName})</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DrugInteractionsDatabasePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | Severity>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const {
    data: interactions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['drug-interactions'],
    queryFn: async () => {
      const res = await drugManagementService.interactions.list();
      return res.data as DrugInteractionWithNames[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const payload = {
        drugAId: data.drugAId,
        drugBId: data.drugBId,
        severity: data.severity,
        description: data.description.trim(),
        clinicalEffects: data.clinicalEffects.trim() || undefined,
        mechanism: data.mechanism.trim() || undefined,
        management: data.management.trim() || undefined,
        reference: data.reference.trim() || undefined,
      };
      if (data.id) {
        // Update cannot change the drug pair — only the clinical detail.
        await drugManagementService.interactions.update(data.id, {
          severity: payload.severity,
          description: payload.description,
          clinicalEffects: payload.clinicalEffects,
          mechanism: payload.mechanism,
          management: payload.management,
          reference: payload.reference,
        });
      } else {
        await drugManagementService.interactions.create(payload);
      }
    },
    onSuccess: (_r, data) => {
      queryClient.invalidateQueries({ queryKey: ['drug-interactions'] });
      toast.success(data.id ? 'Interaction updated' : 'Interaction added');
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save interaction')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => drugManagementService.interactions.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-interactions'] });
      toast.success('Interaction deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete interaction')),
  });

  const items = interactions ?? [];
  const q = searchTerm.toLowerCase();
  const filtered = items.filter((i) => {
    const matchesSearch =
      !q ||
      i.drugAName?.toLowerCase().includes(q) ||
      i.drugBName?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q);
    const matchesSeverity =
      selectedSeverity === 'all' || (i.severity || '').toLowerCase() === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const countBy = (s: Severity) =>
    items.filter((i) => (i.severity || '').toLowerCase() === s).length;

  const severityBadge = (severity: string) => {
    switch ((severity || '').toLowerCase()) {
      case 'minor':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'major':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'contraindicated':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const severityIcon = (severity: string) => {
    switch ((severity || '').toLowerCase()) {
      case 'minor':
        return <Info className="w-4 h-4" />;
      case 'moderate':
      case 'major':
        return <AlertTriangle className="w-4 h-4" />;
      case 'contraindicated':
        return <AlertOctagon className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (i: DrugInteractionWithNames) => {
    setForm({
      id: i.id,
      drugAId: i.drugAId,
      drugAName: i.drugAName,
      drugBId: i.drugBId,
      drugBName: i.drugBName,
      severity: (SEVERITIES.includes(i.severity as Severity) ? i.severity : 'moderate') as Severity,
      description: i.description || '',
      clinicalEffects: i.clinicalEffects || '',
      mechanism: i.mechanism || '',
      management: i.management || '',
      reference: i.reference || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (i: DrugInteractionWithNames) => {
    const ok = await confirmDialog({
      title: 'Delete interaction',
      message: `Remove the interaction between ${i.drugAName} and ${i.drugBName}? This stops it from warning clinicians.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(i.id);
  };

  const canSave =
    !!form.drugAId &&
    !!form.drugBId &&
    form.drugAId !== form.drugBId &&
    form.description.trim().length > 0;

  const submit = () => {
    if (!form.id) {
      if (!form.drugAId || !form.drugBId) {
        toast.error('Select both drugs from the search list');
        return;
      }
      if (form.drugAId === form.drugBId) {
        toast.error('The two drugs must be different');
        return;
      }
    }
    if (!form.description.trim()) {
      toast.error('A description is required');
      return;
    }
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drug Interactions Database</h1>
          <p className="text-gray-600">
            Manage drug-drug interaction records used for clinical decision support
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Interaction
        </button>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {getApiErrorMessage(error, 'Could not load drug interactions')}
        </div>
      )}

      {/* Stats — static class strings so Tailwind's JIT keeps them */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(
          [
            ['contraindicated', 'Contraindicated', 'bg-red-100', 'text-red-600', <AlertOctagon key="c" className="w-5 h-5 text-red-600" />],
            ['major', 'Major', 'bg-orange-100', 'text-orange-600', <AlertTriangle key="m" className="w-5 h-5 text-orange-600" />],
            ['moderate', 'Moderate', 'bg-yellow-100', 'text-yellow-600', <AlertTriangle key="mo" className="w-5 h-5 text-yellow-600" />],
            ['minor', 'Minor', 'bg-blue-100', 'text-blue-600', <Info key="mi" className="w-5 h-5 text-blue-600" />],
          ] as [Severity, string, string, string, React.ReactNode][]
        ).map(([sev, label, iconBg, textColor, icon]) => (
          <div key={sev} className="bg-white p-4 rounded-xl border shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${iconBg} rounded-lg`}>{icon}</div>
              <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className={`text-xl font-bold ${textColor}`}>{countBy(sev)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drugs or descriptions…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', ...SEVERITIES] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-3 py-1 rounded-full text-sm capitalize ${
                  selectedSeverity === sev
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.map((interaction) => (
          <div
            key={interaction.id}
            className={`bg-white rounded-xl border-l-4 shadow-sm overflow-hidden ${
              (interaction.severity || '').toLowerCase() === 'contraindicated'
                ? 'border-l-red-500'
                : (interaction.severity || '').toLowerCase() === 'major'
                  ? 'border-l-orange-500'
                  : (interaction.severity || '').toLowerCase() === 'moderate'
                    ? 'border-l-yellow-500'
                    : 'border-l-blue-500'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Pill className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">{interaction.drugAName}</span>
                  </div>
                  <GitBranch className="w-5 h-5 text-gray-400 rotate-90" />
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Pill className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">{interaction.drugBName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${severityBadge(interaction.severity)}`}
                  >
                    {severityIcon(interaction.severity)}
                    {SEVERITY_LABEL[(interaction.severity || '').toLowerCase() as Severity] ??
                      interaction.severity}
                  </span>
                  <button
                    onClick={() => openEdit(interaction)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(interaction)}
                    disabled={deleteMutation.isPending}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-sm text-gray-600">{interaction.description}</p>
                </div>
                {(interaction.clinicalEffects || interaction.management) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {interaction.clinicalEffects && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Clinical Effect</p>
                        <p className="text-sm text-gray-600">{interaction.clinicalEffects}</p>
                      </div>
                    )}
                    {interaction.management && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Management</p>
                        <p className="text-sm text-gray-600">{interaction.management}</p>
                      </div>
                    )}
                  </div>
                )}
                {interaction.mechanism && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Mechanism</p>
                    <p className="text-sm text-gray-600">{interaction.mechanism}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {interaction.reference && <span>Reference: {interaction.reference}</span>}
                  {interaction.reference && <span>•</span>}
                  <span>Added: {new Date(interaction.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
            <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {items.length === 0
                ? 'No drug interactions recorded yet. Add one, or sync from the drug database.'
                : 'No interactions match your filters'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {form.id ? 'Edit Interaction' : 'Add Interaction'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setForm(EMPTY_FORM);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {form.id ? (
                // The drug pair is the interaction's identity — show it read-only
                // when editing so we never silently repoint a record.
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drug 1</label>
                    <div className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">
                      {form.drugAName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drug 2</label>
                    <div className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">
                      {form.drugBName}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DrugPicker
                    label="Drug 1"
                    value={form.drugAName}
                    onSelect={(d) => setForm((f) => ({ ...f, drugAId: d.id, drugAName: d.name }))}
                  />
                  <DrugPicker
                    label="Drug 2"
                    value={form.drugBName}
                    onSelect={(d) => setForm((f) => ({ ...f, drugBId: d.id, drugBName: d.name }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    placeholder="e.g. BNF, Lexicomp"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the interaction"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinical Effect
                </label>
                <textarea
                  rows={2}
                  value={form.clinicalEffects}
                  onChange={(e) => setForm((f) => ({ ...f, clinicalEffects: e.target.value }))}
                  placeholder="What happens clinically"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mechanism</label>
                <textarea
                  rows={2}
                  value={form.mechanism}
                  onChange={(e) => setForm((f) => ({ ...f, mechanism: e.target.value }))}
                  placeholder="Why the interaction occurs"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Management</label>
                <textarea
                  rows={2}
                  value={form.management}
                  onChange={(e) => setForm((f) => ({ ...f, management: e.target.value }))}
                  placeholder="How to manage this interaction"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowModal(false);
                  setForm(EMPTY_FORM);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saveMutation.isPending || !canSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Save Changes' : 'Add Interaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
