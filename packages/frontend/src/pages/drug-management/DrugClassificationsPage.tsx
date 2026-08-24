import React, { useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  drugManagementService,
  DrugSchedule,
  TherapeuticClass,
  type DrugClassification,
  type CreateDrugClassificationDto,
} from '../../services/drug-management';
import { storesService, type Drug } from '../../services/stores';
import { getApiErrorMessage } from '../../services/api';
import { confirmDialog } from '../../components/ConfirmDialog';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Shield,
  Check,
  X,
  Lock,
  Trash2,
} from 'lucide-react';

// The real drug_classifications columns (drug-classification.entity.ts). A
// classification is metadata attached to an inventory item, so creating one
// requires picking an existing item (itemId); brand/generic names are optional
// display overrides.
const schedules: Array<'All' | DrugSchedule> = ['All', ...Object.values(DrugSchedule)];
const therapeuticClasses: Array<'All' | TherapeuticClass> = ['All', ...Object.values(TherapeuticClass)];

const humanise = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const drugLabel = (d: DrugClassification) => d.brandName || d.genericName || '—';

interface FormState {
  id?: string;
  itemId: string;
  itemName: string; // display only
  brandName: string;
  genericName: string;
  schedule: DrugSchedule;
  therapeuticClass: TherapeuticClass | '';
  maxDailyDose: string;
  doseUnit: string;
  isControlled: boolean;
  isNarcotic: boolean;
  highAlert: boolean;
  isOnFormulary: boolean;
  contraindications: string;
  warnings: string;
}

const EMPTY_FORM: FormState = {
  itemId: '',
  itemName: '',
  brandName: '',
  genericName: '',
  schedule: DrugSchedule.POM,
  therapeuticClass: '',
  maxDailyDose: '',
  doseUnit: '',
  isControlled: false,
  isNarcotic: false,
  highAlert: false,
  isOnFormulary: false,
  contraindications: '',
  warnings: '',
};

/** Type-ahead over inventory drug items — used only when creating a new
 *  classification, which must attach to an existing item. */
function ItemPicker({ value, onSelect }: { value: string; onSelect: (d: Drug) => void }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ['item-search', term],
    queryFn: () => storesService.items.search(term.trim(), true, 25),
    enabled: open && term.trim().length >= 2,
  });

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Item *</label>
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
        placeholder="Search the drug catalogue…"
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
            <div className="px-3 py-2 text-sm text-gray-500">No drug items found.</div>
          )}
          {results?.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                onSelect(d);
                setOpen(false);
                setTerm('');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
            >
              <Pill className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{d.name}</span>
              {d.strength && <span className="text-gray-400">{d.strength}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DrugClassificationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [showControlledOnly, setShowControlledOnly] = useState(false);
  const [showHighAlertOnly, setShowHighAlertOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const showModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showModal,
    onClose: () => setShowModal(false),
  });

  const { data: classifications, isLoading, isError, error } = useQuery({
    queryKey: ['drug-classifications'],
    queryFn: async () => (await drugManagementService.classifications.list()).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const maxDaily = data.maxDailyDose.trim() ? Number(data.maxDailyDose) : undefined;
      if (maxDaily !== undefined && !Number.isFinite(maxDaily)) {
        throw new Error('Max daily dose must be a number');
      }
      const common = {
        schedule: data.schedule,
        therapeuticClass: data.therapeuticClass || undefined,
        genericName: data.genericName.trim() || undefined,
        brandName: data.brandName.trim() || undefined,
        maxDailyDose: maxDaily,
        doseUnit: data.doseUnit.trim() || undefined,
        isControlled: data.isControlled,
        isNarcotic: data.isNarcotic,
        highAlert: data.highAlert,
        isOnFormulary: data.isOnFormulary,
        contraindications: data.contraindications.trim() || undefined,
        warnings: data.warnings.trim() || undefined,
      };
      if (data.id) {
        await drugManagementService.classifications.update(data.id, common);
      } else {
        await drugManagementService.classifications.create({
          itemId: data.itemId,
          ...common,
        } as CreateDrugClassificationDto);
      }
    },
    onSuccess: (_r, data) => {
      queryClient.invalidateQueries({ queryKey: ['drug-classifications'] });
      toast.success(data.id ? 'Classification updated' : 'Classification added');
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save classification')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => drugManagementService.classifications.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-classifications'] });
      toast.success('Classification deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete classification')),
  });

  const items = classifications || [];

  const filteredDrugs = items.filter((drug) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (drug.brandName || '').toLowerCase().includes(term) ||
      (drug.genericName || '').toLowerCase().includes(term);
    const matchesSchedule = selectedSchedule === 'All' || drug.schedule === selectedSchedule;
    const matchesClass = selectedClass === 'All' || drug.therapeuticClass === selectedClass;
    const matchesControlled = !showControlledOnly || drug.isControlled;
    const matchesHighAlert = !showHighAlertOnly || drug.highAlert;
    return matchesSearch && matchesSchedule && matchesClass && matchesControlled && matchesHighAlert;
  });

  const getScheduleColor = (schedule: string) => {
    switch (schedule) {
      case DrugSchedule.OTC: return 'bg-green-100 text-green-700';
      case DrugSchedule.POM: return 'bg-blue-100 text-blue-700';
      case DrugSchedule.SCHEDULE_I: return 'bg-red-200 text-red-800';
      case DrugSchedule.SCHEDULE_II: return 'bg-red-100 text-red-700';
      case DrugSchedule.SCHEDULE_III: return 'bg-orange-100 text-orange-700';
      case DrugSchedule.SCHEDULE_IV: return 'bg-yellow-100 text-yellow-700';
      case DrugSchedule.SCHEDULE_V: return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const controlledCount = items.filter((d) => d.isControlled).length;
  const narcoticCount = items.filter((d) => d.isNarcotic).length;
  const highAlertCount = items.filter((d) => d.highAlert).length;
  const formularyCount = items.filter((d) => d.isOnFormulary).length;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (drug: DrugClassification) => {
    setForm({
      id: drug.id,
      itemId: drug.itemId,
      itemName: drug.brandName || drug.genericName || '',
      brandName: drug.brandName || '',
      genericName: drug.genericName || '',
      schedule: drug.schedule || DrugSchedule.POM,
      therapeuticClass: drug.therapeuticClass || '',
      maxDailyDose: drug.maxDailyDose != null ? String(drug.maxDailyDose) : '',
      doseUnit: drug.doseUnit || '',
      isControlled: !!drug.isControlled,
      isNarcotic: !!drug.isNarcotic,
      highAlert: !!drug.highAlert,
      isOnFormulary: !!drug.isOnFormulary,
      contraindications: drug.contraindications || '',
      warnings: drug.warnings || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (drug: DrugClassification) => {
    const ok = await confirmDialog({
      title: 'Delete classification',
      message: `Remove the classification for ${drugLabel(drug)}? Safety flags (controlled, high-alert) will no longer apply to this drug.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(drug.id);
  };

  const submit = () => {
    if (!form.id && !form.itemId) {
      toast.error('Select an inventory item to classify');
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drug Classifications</h1>
          <p className="text-gray-600">Manage drug schedules, therapeutic classes, and safety flags</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Classification
        </button>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {getApiErrorMessage(error, 'Could not load drug classifications')}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Controlled</p>
              <p className="text-xl font-bold text-red-600">{controlledCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Narcotics</p>
              <p className="text-xl font-bold text-purple-600">{narcoticCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">High Alert</p>
              <p className="text-xl font-bold text-orange-600">{highAlertCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Formulary</p>
              <p className="text-xl font-bold text-green-600">{formularyCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drugs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Schedule: {selectedSchedule === 'All' ? 'All' : humanise(selectedSchedule)}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showScheduleDropdown && (
              <div className="absolute top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {schedules.map((schedule) => (
                  <button
                    key={schedule}
                    onClick={() => {
                      setSelectedSchedule(schedule);
                      setShowScheduleDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {schedule === 'All' ? 'All' : humanise(schedule)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowClassDropdown(!showClassDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Class: {selectedClass === 'All' ? 'All' : humanise(selectedClass)}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showClassDropdown && (
              <div className="absolute top-full mt-1 w-56 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {therapeuticClasses.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowClassDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {cls === 'All' ? 'All' : humanise(cls)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showControlledOnly}
              onChange={(e) => setShowControlledOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Controlled Only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showHighAlertOnly}
              onChange={(e) => setShowHighAlertOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">High Alert Only</span>
          </label>
        </div>
      </div>

      {/* Classifications Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Drug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Schedule</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Therapeutic Class</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Flags</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Max Daily</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Formulary</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDrugs.map((drug) => (
              <tr key={drug.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Pill className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{drugLabel(drug)}</p>
                      <p className="text-xs text-gray-500">{drug.brandName ? drug.genericName : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScheduleColor(drug.schedule)}`}>
                    {humanise(drug.schedule)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {drug.therapeuticClass ? humanise(drug.therapeuticClass) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {drug.isControlled && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs" title="Controlled">
                        <Lock className="w-3 h-3 inline" />
                      </span>
                    )}
                    {drug.isNarcotic && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs" title="Narcotic">
                        N
                      </span>
                    )}
                    {drug.highAlert && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs" title="High Alert">
                        <AlertTriangle className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {drug.maxDailyDose != null ? `${drug.maxDailyDose}${drug.doseUnit ? ` ${drug.doseUnit}` : ''}` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {drug.isOnFormulary ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(drug)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(drug)}
                      disabled={deleteMutation.isPending}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDrugs.length === 0 && (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {items.length === 0
                ? 'No drug classifications yet. Add one to flag controlled or high-alert drugs.'
                : 'No drug classifications match your filters'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          ref={showModalDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {form.id ? 'Edit Classification' : 'Add Classification'}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <div className="px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">
                    {form.itemName || '—'}
                  </div>
                </div>
              ) : (
                <ItemPicker
                  value={form.itemName}
                  onSelect={(d) =>
                    setForm((f) => ({
                      ...f,
                      itemId: d.id,
                      itemName: d.name,
                      genericName: f.genericName || d.genericName || '',
                      isControlled: f.isControlled || !!d.isControlled,
                    }))
                  }
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={form.brandName}
                  onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
                  placeholder="Brand name (optional)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                <input
                  type="text"
                  value={form.genericName}
                  onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))}
                  placeholder="e.g. Paracetamol"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <select
                    value={form.schedule}
                    onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value as DrugSchedule }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {schedules.filter((s) => s !== 'All').map((schedule) => (
                      <option key={schedule} value={schedule}>
                        {humanise(schedule)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Therapeutic Class</label>
                  <select
                    value={form.therapeuticClass}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, therapeuticClass: e.target.value as TherapeuticClass | '' }))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {therapeuticClasses.filter((c) => c !== 'All').map((cls) => (
                      <option key={cls} value={cls}>
                        {humanise(cls)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Daily Dose</label>
                  <input
                    type="number"
                    value={form.maxDailyDose}
                    onChange={(e) => setForm((f) => ({ ...f, maxDailyDose: e.target.value }))}
                    placeholder="Numeric"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dose Unit</label>
                  <input
                    type="text"
                    value={form.doseUnit}
                    onChange={(e) => setForm((f) => ({ ...f, doseUnit: e.target.value }))}
                    placeholder="e.g. mg"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isControlled}
                    onChange={(e) => setForm((f) => ({ ...f, isControlled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Controlled Substance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isNarcotic}
                    onChange={(e) => setForm((f) => ({ ...f, isNarcotic: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Narcotic</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.highAlert}
                    onChange={(e) => setForm((f) => ({ ...f, highAlert: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">High Alert Medication</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isOnFormulary}
                    onChange={(e) => setForm((f) => ({ ...f, isOnFormulary: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">On Formulary</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraindications</label>
                <textarea
                  rows={2}
                  value={form.contraindications}
                  onChange={(e) => setForm((f) => ({ ...f, contraindications: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warnings</label>
                <textarea
                  rows={2}
                  value={form.warnings}
                  onChange={(e) => setForm((f) => ({ ...f, warnings: e.target.value }))}
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
                disabled={saveMutation.isPending || (!form.id && !form.itemId)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Save Changes' : 'Add Classification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
