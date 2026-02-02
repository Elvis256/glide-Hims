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
  Building2,
} from 'lucide-react';
import { useFacilityId } from '../../lib/facility';
import api from '../../services/api';

interface AssetCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  usefulLifeYears: number;
  depreciationRate: number;
  depreciationMethod: string;
  glAccountCode?: string;
  isActive: boolean;
  assetCount?: number;
}

// Default categories that come with the system
const defaultCategories: Omit<AssetCategory, 'id'>[] = [
  { code: 'medical_equipment', name: 'Medical Equipment', usefulLifeYears: 10, depreciationRate: 10, depreciationMethod: 'straight_line', isActive: true },
  { code: 'laboratory_equipment', name: 'Laboratory Equipment', usefulLifeYears: 8, depreciationRate: 12.5, depreciationMethod: 'straight_line', isActive: true },
  { code: 'imaging_equipment', name: 'Imaging Equipment', usefulLifeYears: 10, depreciationRate: 10, depreciationMethod: 'straight_line', isActive: true },
  { code: 'surgical_equipment', name: 'Surgical Equipment', usefulLifeYears: 7, depreciationRate: 14.3, depreciationMethod: 'straight_line', isActive: true },
  { code: 'furniture', name: 'Furniture', usefulLifeYears: 10, depreciationRate: 10, depreciationMethod: 'straight_line', isActive: true },
  { code: 'it_equipment', name: 'IT Equipment', usefulLifeYears: 4, depreciationRate: 25, depreciationMethod: 'straight_line', isActive: true },
  { code: 'vehicles', name: 'Vehicles', usefulLifeYears: 5, depreciationRate: 20, depreciationMethod: 'declining_balance', isActive: true },
  { code: 'buildings', name: 'Buildings', usefulLifeYears: 40, depreciationRate: 2.5, depreciationMethod: 'straight_line', isActive: true },
  { code: 'land', name: 'Land', usefulLifeYears: 0, depreciationRate: 0, depreciationMethod: 'straight_line', isActive: true, description: 'Land does not depreciate' },
  { code: 'office_equipment', name: 'Office Equipment', usefulLifeYears: 5, depreciationRate: 20, depreciationMethod: 'straight_line', isActive: true },
  { code: 'electrical_equipment', name: 'Electrical Equipment', usefulLifeYears: 10, depreciationRate: 10, depreciationMethod: 'straight_line', isActive: true },
  { code: 'hvac', name: 'HVAC Systems', usefulLifeYears: 15, depreciationRate: 6.67, depreciationMethod: 'straight_line', isActive: true },
  { code: 'other', name: 'Other', usefulLifeYears: 5, depreciationRate: 20, depreciationMethod: 'straight_line', isActive: true },
];

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'double_declining', label: 'Double Declining Balance' },
  { value: 'sum_of_years', label: 'Sum of Years Digits' },
];

export default function AssetCategoriesPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    usefulLifeYears: 5,
    depreciationRate: 20,
    depreciationMethod: 'straight_line',
    glAccountCode: '',
    isActive: true,
  });

  // Get categories from API or use defaults
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['asset-categories', facilityId],
    queryFn: async () => {
      try {
        const { data } = await api.get('/asset-categories', { params: { facilityId } });
        return data.length > 0 ? data : defaultCategories.map((c, i) => ({ ...c, id: `default-${i}` }));
      } catch {
        // Return default categories if API fails
        return defaultCategories.map((c, i) => ({ ...c, id: `default-${i}` }));
      }
    },
    enabled: !!facilityId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingCategory) {
        return api.put(`/asset-categories/${editingCategory.id}`, { ...data, facilityId });
      }
      return api.post('/asset-categories', { ...data, facilityId });
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Category updated' : 'Category created');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      closeModal();
    },
    onError: () => toast.error('Failed to save category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/asset-categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
    },
    onError: () => toast.error('Cannot delete category with assets'),
  });

  const openModal = (category?: AssetCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        code: category.code,
        name: category.name,
        description: category.description || '',
        usefulLifeYears: category.usefulLifeYears,
        depreciationRate: category.depreciationRate,
        depreciationMethod: category.depreciationMethod,
        glAccountCode: category.glAccountCode || '',
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        usefulLifeYears: 5,
        depreciationRate: 20,
        depreciationMethod: 'straight_line',
        glAccountCode: '',
        isActive: true,
      });
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
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Useful Life</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dep. Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map((category: AssetCategory) => (
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
                  <td className="px-4 py-3 text-sm text-right">
                    {category.usefulLifeYears > 0 ? `${category.usefulLifeYears} years` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{category.depreciationRate}%</td>
                  <td className="px-4 py-3 text-sm capitalize">
                    {category.depreciationMethod.replace(/_/g, ' ')}
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
                      {!category.id.startsWith('default-') && (
                        <button
                          onClick={() => {
                            if (confirm('Delete this category?')) {
                              deleteMutation.mutate(category.id);
                            }
                          }}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
                        depreciationRate: years > 0 ? Math.round(100 / years * 100) / 100 : 0
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
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
                    {depreciationMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GL Account Code</label>
                  <input
                    type="text"
                    value={formData.glAccountCode}
                    onChange={(e) => setFormData({ ...formData, glAccountCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 1510"
                  />
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
