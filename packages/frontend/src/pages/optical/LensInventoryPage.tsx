import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  Search,
  Plus,
  Edit,
  X,
  Package,
  Filter,
  ToggleLeft,
  ToggleRight,
  CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LensType = 'single_vision' | 'bifocal' | 'progressive' | 'occupational' | 'reading';
type Material = 'cr39' | 'polycarbonate' | 'trivex' | 'hi_index' | 'glass';
type Coating = 'anti_reflective' | 'blue_light' | 'photochromic' | 'scratch_resistant' | 'uv';

interface Lens {
  id: string;
  name: string;
  sku: string;
  lensType: LensType;
  material: Material;
  coatings: Coating[];
  refractiveIndex: number;
  wholesalePrice: number;
  retailPrice: number;
  stock: number;
  supplier: string;
  active: boolean;
  facilityId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LensFormData {
  name: string;
  sku: string;
  lensType: LensType;
  material: Material;
  coatings: Coating[];
  refractiveIndex: number;
  wholesalePrice: number;
  retailPrice: number;
  stock: number;
  supplier: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LENS_TYPE_OPTIONS: { value: LensType; label: string }[] = [
  { value: 'single_vision', label: 'Single Vision' },
  { value: 'bifocal', label: 'Bifocal' },
  { value: 'progressive', label: 'Progressive' },
  { value: 'occupational', label: 'Occupational' },
  { value: 'reading', label: 'Reading' },
];

const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: 'cr39', label: 'CR-39' },
  { value: 'polycarbonate', label: 'Polycarbonate' },
  { value: 'trivex', label: 'Trivex' },
  { value: 'hi_index', label: 'High Index' },
  { value: 'glass', label: 'Glass' },
];

const COATING_OPTIONS: { value: Coating; label: string }[] = [
  { value: 'anti_reflective', label: 'Anti-Reflective' },
  { value: 'blue_light', label: 'Blue Light' },
  { value: 'photochromic', label: 'Photochromic' },
  { value: 'scratch_resistant', label: 'Scratch Resistant' },
  { value: 'uv', label: 'UV Protection' },
];

const COATING_BADGE_STYLES: Record<Coating, { bg: string; text: string }> = {
  anti_reflective: { bg: 'bg-blue-100', text: 'text-blue-800' },
  blue_light: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  photochromic: { bg: 'bg-purple-100', text: 'text-purple-800' },
  scratch_resistant: { bg: 'bg-green-100', text: 'text-green-800' },
  uv: { bg: 'bg-amber-100', text: 'text-amber-800' },
};

const LENS_TYPE_TABS: { value: LensType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...LENS_TYPE_OPTIONS,
];

const EMPTY_FORM: LensFormData = {
  name: '',
  sku: '',
  lensType: 'single_vision',
  material: 'cr39',
  coatings: [],
  refractiveIndex: 1.5,
  wholesalePrice: 0,
  retailPrice: 0,
  stock: 0,
  supplier: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lensTypeLabel(type: LensType): string {
  return LENS_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function materialLabel(mat: Material): string {
  return MATERIAL_OPTIONS.find((o) => o.value === mat)?.label ?? mat;
}

function coatingLabel(c: Coating): string {
  return COATING_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LensInventoryPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  // UI state
  const [activeTab, setActiveTab] = useState<LensType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLens, setEditingLens] = useState<Lens | null>(null);
  const [formData, setFormData] = useState<LensFormData>(EMPTY_FORM);

  // ---- Queries & Mutations ------------------------------------------------

  const queryParams = new URLSearchParams({ facilityId });
  if (activeTab !== 'all') queryParams.set('lensType', activeTab);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['optical-lenses', facilityId, activeTab],
    queryFn: () => api.get(`/optical/lenses?${queryParams.toString()}`).then((r) => r.data),
  });

  const lenses = asList<Lens>(rawData);

  const filteredLenses = search
    ? lenses.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.sku.toLowerCase().includes(search.toLowerCase()) ||
          l.supplier.toLowerCase().includes(search.toLowerCase()),
      )
    : lenses;

  const createMutation = useMutation({
    mutationFn: (data: LensFormData) =>
      api.post('/optical/lenses', { ...data, facilityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-lenses'] });
      toast.success('Lens product created successfully');
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create lens product')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lens> }) =>
      api.patch(`/optical/lenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-lenses'] });
      toast.success('Lens product updated successfully');
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update lens product')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/optical/lenses/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-lenses'] });
      toast.success('Lens status updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update lens status')),
  });

  // ---- Modal helpers ------------------------------------------------------

  function openAddModal() {
    setFormData(EMPTY_FORM);
    setEditingLens(null);
    setShowAddModal(true);
  }

  function openEditModal(lens: Lens) {
    setFormData({
      name: lens.name,
      sku: lens.sku,
      lensType: lens.lensType,
      material: lens.material,
      coatings: [...lens.coatings],
      refractiveIndex: lens.refractiveIndex,
      wholesalePrice: lens.wholesalePrice,
      retailPrice: lens.retailPrice,
      stock: lens.stock,
      supplier: lens.supplier,
    });
    setEditingLens(lens);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingLens(null);
    setFormData(EMPTY_FORM);
  }

  function handleSave() {
    if (!formData.name.trim() || !formData.sku.trim()) {
      toast.error('Name and SKU are required');
      return;
    }
    if (editingLens) {
      updateMutation.mutate({ id: editingLens.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function toggleCoating(coating: Coating) {
    setFormData((prev) => ({
      ...prev,
      coatings: prev.coatings.includes(coating)
        ? prev.coatings.filter((c) => c !== coating)
        : [...prev.coatings, coating],
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ---- Render -------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Eye className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lens Catalog</h1>
            <p className="text-sm text-gray-500">Manage lens products</p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Lens
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <nav className="flex border-b border-gray-200">
          {LENS_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search lenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <CircleDot className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500">Loading lenses…</span>
          </div>
        ) : filteredLenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="w-10 h-10 mb-2" />
            <p className="font-medium">No lenses found</p>
            <p className="text-sm">
              {search ? 'Try adjusting your search' : 'Add your first lens product to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Lens Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Refractive Index
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Coatings
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Wholesale
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Retail
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Active
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLenses.map((lens) => (
                  <tr key={lens.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{lens.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{lens.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lensTypeLabel(lens.lensType)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{materialLabel(lens.material)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lens.refractiveIndex.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lens.coatings.map((c) => {
                          const style = COATING_BADGE_STYLES[c];
                          return (
                            <span
                              key={c}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
                            >
                              {coatingLabel(c)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {formatCurrency(lens.wholesalePrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {formatCurrency(lens.retailPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span
                        className={`font-medium ${
                          lens.stock <= 0
                            ? 'text-red-600'
                            : lens.stock <= 10
                              ? 'text-amber-600'
                              : 'text-gray-900'
                        }`}
                      >
                        {lens.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lens.supplier}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: lens.id, active: !lens.active })
                        }
                        className="text-gray-500 hover:text-blue-600 transition-colors"
                        title={lens.active ? 'Deactivate' : 'Activate'}
                      >
                        {lens.active ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEditModal(lens)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit lens"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
              <div className="flex items-center gap-2">
                {editingLens ? (
                  <Edit className="w-5 h-5 text-blue-600" />
                ) : (
                  <Plus className="w-5 h-5 text-blue-600" />
                )}
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingLens ? 'Edit Lens Product' : 'Add Lens Product'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Name & SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Essilor Crizal"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="e.g. LNS-SV-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Lens Type & Material */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lens Type</label>
                  <select
                    value={formData.lensType}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, lensType: e.target.value as LensType }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {LENS_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                  <select
                    value={formData.material}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, material: e.target.value as Material }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {MATERIAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Refractive Index */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refractive Index
                </label>
                <input
                  type="number"
                  step={0.01}
                  min={1.0}
                  max={2.0}
                  value={formData.refractiveIndex}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, refractiveIndex: parseFloat(e.target.value) || 1.5 }))
                  }
                  placeholder="e.g. 1.50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-400">Common values: 1.50, 1.56, 1.61, 1.67, 1.74</p>
              </div>

              {/* Coatings Multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coatings</label>
                <div className="flex flex-wrap gap-3">
                  {COATING_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.coatings.includes(opt.value)}
                        onChange={() => toggleCoating(opt.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wholesale Price
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.wholesalePrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        wholesalePrice: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retail Price
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.retailPrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        retailPrice: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Stock & Supplier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, stock: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData((p) => ({ ...p, supplier: e.target.value }))}
                    placeholder="e.g. Essilor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <CircleDot className="w-4 h-4 animate-spin" />
                ) : (
                  <Package className="w-4 h-4" />
                )}
                {editingLens ? 'Update Lens' : 'Save Lens'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
