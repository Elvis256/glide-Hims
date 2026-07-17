import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  drugManagementService,
  type DrugAllergyClass,
  type CreateAllergyClassDto,
} from '../../services/drug-management';
import { getApiErrorMessage } from '../../services/api';
import { confirmDialog } from '../../components/ConfirmDialog';
import {
  AlertCircle,
  Search,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Shield,
  X,
  Info,
} from 'lucide-react';

interface FormState {
  id?: string;
  className: string;
  description: string;
  relatedDrugs: string; // comma-separated in the form, split on save
  crossReactiveClasses: string;
}

const EMPTY_FORM: FormState = {
  className: '',
  description: '',
  relatedDrugs: '',
  crossReactiveClasses: '',
};

const toList = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function AllergyClassesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewing, setViewing] = useState<DrugAllergyClass | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const {
    data: allergyClasses,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['allergy-classes'],
    queryFn: async () => {
      const res = await drugManagementService.allergyClasses.list();
      return res.data as DrugAllergyClass[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const payload: CreateAllergyClassDto = {
        className: data.className.trim(),
        description: data.description.trim() || undefined,
        relatedDrugs: toList(data.relatedDrugs),
        crossReactiveClasses: toList(data.crossReactiveClasses),
      };
      if (data.id) {
        await drugManagementService.allergyClasses.update(data.id, payload);
      } else {
        await drugManagementService.allergyClasses.create(payload);
      }
    },
    onSuccess: (_r, data) => {
      queryClient.invalidateQueries({ queryKey: ['allergy-classes'] });
      toast.success(data.id ? 'Allergy class updated' : 'Allergy class added');
      setShowModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save allergy class')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => drugManagementService.allergyClasses.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergy-classes'] });
      toast.success('Allergy class deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete allergy class')),
  });

  const items = allergyClasses ?? [];
  const q = searchTerm.toLowerCase();
  const filtered = items.filter((cls) => {
    return (
      !q ||
      cls.className?.toLowerCase().includes(q) ||
      cls.description?.toLowerCase().includes(q) ||
      cls.relatedDrugs?.some((a) => a.toLowerCase().includes(q))
    );
  });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (cls: DrugAllergyClass) => {
    setForm({
      id: cls.id,
      className: cls.className,
      description: cls.description || '',
      relatedDrugs: (cls.relatedDrugs || []).join(', '),
      crossReactiveClasses: (cls.crossReactiveClasses || []).join(', '),
    });
    setViewing(null);
    setShowModal(true);
  };

  const handleDelete = async (cls: DrugAllergyClass) => {
    const ok = await confirmDialog({
      title: 'Delete allergy class',
      message: `Remove the "${cls.className}" allergy class? It will no longer be used for cross-reactivity checking.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate(cls.id);
  };

  const submit = () => {
    if (!form.className.trim()) {
      toast.error('Class name is required');
      return;
    }
    saveMutation.mutate(form);
  };

  const totalRelated = items.reduce((n, c) => n + (c.relatedDrugs?.length || 0), 0);
  const totalCross = items.reduce((n, c) => n + (c.crossReactiveClasses?.length || 0), 0);

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
          <h1 className="text-2xl font-bold text-gray-900">Allergy Classes</h1>
          <p className="text-gray-600">Manage drug allergy classes for cross-reactivity checking</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Allergy Class
        </button>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {getApiErrorMessage(error, 'Could not load allergy classes')}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Classes</p>
              <p className="text-xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Related Drugs Mapped</p>
              <p className="text-xl font-bold text-orange-600">{totalRelated}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cross-Reactive Links</p>
              <p className="text-xl font-bold text-blue-600">{totalCross}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by class name or related drug…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((cls) => (
          <div key={cls.id} className="bg-white rounded-xl border-l-4 border-l-purple-500 shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{cls.className}</h3>
                    {cls.description && <p className="text-sm text-gray-500">{cls.description}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Related Drugs</p>
                  <div className="flex flex-wrap gap-1">
                    {(cls.relatedDrugs || []).slice(0, 4).map((drug, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {drug}
                      </span>
                    ))}
                    {(cls.relatedDrugs || []).length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        +{(cls.relatedDrugs || []).length - 4} more
                      </span>
                    )}
                    {(cls.relatedDrugs || []).length === 0 && (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Cross-Reactive Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {(cls.crossReactiveClasses || []).slice(0, 3).map((c, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
                        {c}
                      </span>
                    ))}
                    {(cls.crossReactiveClasses || []).length === 0 && (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewing(cls)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="View details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(cls)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cls)}
                    disabled={deleteMutation.isPending}
                    className="p-1 hover:bg-gray-100 rounded text-red-500 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-gray-400">
                  Added {new Date(cls.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {items.length === 0 ? 'No allergy classes recorded yet. Add one to begin.' : 'No allergy classes match your search'}
          </p>
        </div>
      )}

      {/* View Detail Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{viewing.className}</h2>
              <button onClick={() => setViewing(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {viewing.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-gray-600">{viewing.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Related Drugs</p>
                <div className="flex flex-wrap gap-2">
                  {(viewing.relatedDrugs || []).map((drug, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {drug}
                    </span>
                  ))}
                  {(viewing.relatedDrugs || []).length === 0 && (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cross-Reactive Classes</p>
                <div className="flex flex-wrap gap-2">
                  {(viewing.crossReactiveClasses || []).map((c, idx) => (
                    <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                      {c}
                    </span>
                  ))}
                  {(viewing.crossReactiveClasses || []).length === 0 && (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setViewing(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => openEdit(viewing)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {form.id ? 'Edit Allergy Class' : 'Add Allergy Class'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  value={form.className}
                  onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  placeholder="e.g. Penicillins"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this allergy class"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Related Drugs
                </label>
                <textarea
                  rows={2}
                  value={form.relatedDrugs}
                  onChange={(e) => setForm((f) => ({ ...f, relatedDrugs: e.target.value }))}
                  placeholder="Comma-separated (e.g. Penicillin, Amoxicillin, Ampicillin)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Separate each drug with a comma.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cross-Reactive Classes
                </label>
                <textarea
                  rows={2}
                  value={form.crossReactiveClasses}
                  onChange={(e) => setForm((f) => ({ ...f, crossReactiveClasses: e.target.value }))}
                  placeholder="Comma-separated class names (e.g. Cephalosporins)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Classes a patient allergic to this one may also react to.
                </p>
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
                disabled={saveMutation.isPending || !form.className.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Save Changes' : 'Add Allergy Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
