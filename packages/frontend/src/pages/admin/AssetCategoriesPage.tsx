import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FolderKanban,
  Plus,
  Edit2,
  Trash2,
  Search,
  Save,
  X,
  Loader2,
  Package,
} from 'lucide-react';
import api from '../../services/api';

// Asset class enum (matches backend AssetClass — lowercase string literals)
const assetClasses = [
  { value: 'medical', label: 'Medical' },
  { value: 'it', label: 'IT' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'utility', label: 'Utility' },
  { value: 'building', label: 'Building' },
  { value: 'other', label: 'Other' },
] as const;

interface AssetCategory {
  id: string;
  code: string;
  name: string;
  assetClass: string;
  description?: string;
  defaultUsefulLifeMonths?: number | null;
  defaultDepreciationRate?: number | string | null;
  defaultDepreciationMethod?: string | null;
  isActive: boolean;
}

interface SeedCategory {
  code: string;
  name: string;
  assetClass: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationRate: number;
  defaultDepreciationMethod: string;
  description?: string;
}

// Suggested seed categories (used by the "Seed defaults" empty-state button).
const seedCategories: SeedCategory[] = [
  { code: 'medical_equipment', name: 'Medical Equipment', assetClass: 'medical', defaultUsefulLifeMonths: 120, defaultDepreciationRate: 10, defaultDepreciationMethod: 'straight_line' },
  { code: 'laboratory_equipment', name: 'Laboratory Equipment', assetClass: 'medical', defaultUsefulLifeMonths: 96, defaultDepreciationRate: 12.5, defaultDepreciationMethod: 'straight_line' },
  { code: 'imaging_equipment', name: 'Imaging Equipment', assetClass: 'medical', defaultUsefulLifeMonths: 120, defaultDepreciationRate: 10, defaultDepreciationMethod: 'straight_line' },
  { code: 'surgical_equipment', name: 'Surgical Equipment', assetClass: 'medical', defaultUsefulLifeMonths: 84, defaultDepreciationRate: 14.3, defaultDepreciationMethod: 'straight_line' },
  { code: 'furniture', name: 'Furniture', assetClass: 'furniture', defaultUsefulLifeMonths: 120, defaultDepreciationRate: 10, defaultDepreciationMethod: 'straight_line' },
  { code: 'it_equipment', name: 'IT Equipment', assetClass: 'it', defaultUsefulLifeMonths: 48, defaultDepreciationRate: 25, defaultDepreciationMethod: 'straight_line' },
  { code: 'vehicles', name: 'Vehicles', assetClass: 'vehicle', defaultUsefulLifeMonths: 60, defaultDepreciationRate: 20, defaultDepreciationMethod: 'declining_balance' },
  { code: 'buildings', name: 'Buildings', assetClass: 'building', defaultUsefulLifeMonths: 480, defaultDepreciationRate: 2.5, defaultDepreciationMethod: 'straight_line' },
  { code: 'office_equipment', name: 'Office Equipment', assetClass: 'other', defaultUsefulLifeMonths: 60, defaultDepreciationRate: 20, defaultDepreciationMethod: 'straight_line' },
  { code: 'electrical_equipment', name: 'Electrical Equipment', assetClass: 'utility', defaultUsefulLifeMonths: 120, defaultDepreciationRate: 10, defaultDepreciationMethod: 'straight_line' },
  { code: 'hvac', name: 'HVAC Systems', assetClass: 'utility', defaultUsefulLifeMonths: 180, defaultDepreciationRate: 6.67, defaultDepreciationMethod: 'straight_line' },
];

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'double_declining', label: 'Double Declining Balance' },
  { value: 'sum_of_years', label: 'Sum of Years Digits' },
];

type FormState = {
  code: string;
  name: string;
  assetClass: string;
  description: string;
  usefulLifeYears: number;
  depreciationRate: number;
  depreciationMethod: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  code: '',
  name: '',
  assetClass: 'medical',
  description: '',
  usefulLifeYears: 5,
  depreciationRate: 20,
  depreciationMethod: 'straight_line',
  isActive: true,
};

function toBackendPayload(f: FormState) {
  return {
    code: f.code,
    name: f.name,
    assetClass: f.assetClass,
    description: f.description || undefined,
    defaultUsefulLifeMonths: f.usefulLifeYears > 0 ? Math.round(f.usefulLifeYears * 12) : undefined,
    defaultDepreciationRate: f.depreciationRate || undefined,
    defaultDepreciationMethod: f.depreciationMethod || undefined,
    isActive: f.isActive,
  };
}

export default function AssetCategoriesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm);

  const { data: categories = [], isLoading, error } = useQuery<AssetCategory[]>({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const { data } = await api.get('/assets/categories');
      return Array.isArray(data) ? data : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      const payload = toBackendPayload(data);
      if (editingCategory) {
        return api.put(`/assets/categories/${editingCategory.id}`, payload);
      }
      return api.post('/assets/categories', payload);
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Category updated' : 'Category created');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      closeModal();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save category');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!id) return Promise.reject(new Error('Missing category id'));
      return api.delete(`/assets/categories/${id}`);
    },
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Cannot delete category with assets');
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      const existingCodes = new Set(categories.map((c) => c.code));
      const toCreate = seedCategories.filter((c) => !existingCodes.has(c.code));
      for (const c of toCreate) {
        await api.post('/assets/categories', c);
      }
      return toCreate.length;
    },
    onSuccess: (count) => {
      toast.success(`Seeded ${count} default categor${count === 1 ? 'y' : 'ies'}`);
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to seed categories');
    },
  });

  const openModal = (category?: AssetCategory) => {
    if (category) {
      setEditingCategory(category);
      const months = category.defaultUsefulLifeMonths ?? 0;
      setFormData({
        code: category.code,
        name: category.name,
        assetClass: category.assetClass || 'medical',
        description: category.description || '',
        usefulLifeYears: months > 0 ? Math.round((months / 12) * 100) / 100 : 0,
        depreciationRate: category.defaultDepreciationRate != null ? Number(category.defaultDepreciationRate) : 0,
        depreciationMethod: category.defaultDepreciationMethod || 'straight_line',
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const filteredCategories = categories.filter((c: AssetCategory) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FolderKanban className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Categories</h1>
            <p className="text-sm text-gray-500">Manage asset classification and depreciation rules</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">How Asset Categories Work</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Each category has a default useful life and depreciation rate</li>
          <li>• When creating an asset, selecting a category pre-fills depreciation settings</li>
          <li>• Categories help with reporting and asset valuation</li>
          <li>• Link to GL accounts for automatic accounting entries</li>
        </ul>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-600">
            Failed to load categories. Please retry.
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-4">
            <Package className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">
              {categories.length === 0
                ? 'No asset categories defined yet.'
                : 'No categories match your search.'}
            </p>
            {categories.length === 0 && (
              <button
                onClick={() => seedDefaultsMutation.mutate()}
                disabled={seedDefaultsMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {seedDefaultsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Seed default categories
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Useful Life</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dep. Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map((category: AssetCategory) => {
                const months = category.defaultUsefulLifeMonths ?? 0;
                const years = months > 0 ? Math.round((months / 12) * 10) / 10 : 0;
                return (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{category.name}</p>
                          {category.description && (
                            <p className="text-xs text-gray-500">{category.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{category.code}</td>
                    <td className="px-4 py-3 text-sm capitalize">{category.assetClass || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {years > 0 ? `${years} years` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {category.defaultDepreciationRate != null ? `${Number(category.defaultDepreciationRate)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">
                      {(category.defaultDepreciationMethod || '').replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(category)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete category "${category.name}"?`)) {
                              deleteMutation.mutate(category.id);
                            }
                          }}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    placeholder="e.g., dental_equipment"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Dental Equipment"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Useful Life (Years) *</label>
                  <input
                    type="number"
                    value={formData.usefulLifeYears}
                    onChange={(e) => {
                      const years = Number(e.target.value);
                      setFormData({
                        ...formData,
                        usefulLifeYears: years,
                        depreciationRate: years > 0 ? Math.round((100 / years) * 100) / 100 : 0,
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Rate (%)</label>
                  <input
                    type="number"
                    value={formData.depreciationRate}
                    onChange={(e) => setFormData({ ...formData, depreciationRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                  <select
                    value={formData.depreciationMethod}
                    onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {depreciationMethods.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Class *</label>
                  <select
                    value={formData.assetClass}
                    onChange={(e) => setFormData({ ...formData, assetClass: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    {assetClasses.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active (available for new assets)</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
