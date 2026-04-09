import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Glasses,
  Search,
  Plus,
  Edit,
  Package,
  Grid3X3,
  List,
  X,
  Minus,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Frame {
  id: string;
  brand: string;
  model: string;
  sku: string;
  color: string;
  size: string;
  material: string;
  frameType: string;
  gender: string;
  wholesalePrice: number;
  retailPrice: number;
  stock: number;
  reorderLevel: number;
  supplier: string;
  status: string;
  imageUrl?: string;
}

interface FrameFormData {
  brand: string;
  model: string;
  sku: string;
  color: string;
  size: string;
  material: string;
  frameType: string;
  gender: string;
  wholesalePrice: number;
  retailPrice: number;
  stock: number;
  reorderLevel: number;
  supplier: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATERIALS = ['acetate', 'metal', 'titanium', 'tr90', 'wood', 'horn'] as const;
const FRAME_TYPES = ['full_rim', 'semi_rimless', 'rimless', 'wrap'] as const;
const GENDERS = ['male', 'female', 'unisex', 'kids'] as const;

const MATERIAL_LABELS: Record<string, string> = {
  acetate: 'Acetate',
  metal: 'Metal',
  titanium: 'Titanium',
  tr90: 'TR-90',
  wood: 'Wood',
  horn: 'Horn',
};

const FRAME_TYPE_LABELS: Record<string, string> = {
  full_rim: 'Full Rim',
  semi_rimless: 'Semi-Rimless',
  rimless: 'Rimless',
  wrap: 'Wrap',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  unisex: 'Unisex',
  kids: 'Kids',
};

const EMPTY_FORM: FrameFormData = {
  brand: '',
  model: '',
  sku: '',
  color: '',
  size: '',
  material: 'acetate',
  frameType: 'full_rim',
  gender: 'unisex',
  wholesalePrice: 0,
  retailPrice: 0,
  stock: 0,
  reorderLevel: 5,
  supplier: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stockBadge(stock: number, reorderLevel: number) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" />
        Out of stock
      </span>
    );
  }
  if (stock < reorderLevel) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        {stock} — Low
      </span>
    );
  }
  if (stock === reorderLevel) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        {stock} — Reorder
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      {stock} In stock
    </span>
  );
}

// ---------------------------------------------------------------------------
// Frame Form Modal
// ---------------------------------------------------------------------------

function FrameFormModal({
  title,
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  title: string;
  initial: FrameFormData;
  onClose: () => void;
  onSave: (data: FrameFormData) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FrameFormData>(initial);

  const set = <K extends keyof FrameFormData>(key: K, value: FrameFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Brand / Model */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                className={inputClass}
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                className={inputClass}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Row 2: SKU / Color / Size */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                className={inputClass}
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                className={inputClass}
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size <span className="text-gray-400 text-xs">(52-18-140)</span>
              </label>
              <input
                className={inputClass}
                placeholder="52-18-140"
                value={form.size}
                onChange={(e) => set('size', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Row 3: Material / Frame Type / Gender */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
              <select
                className={inputClass}
                value={form.material}
                onChange={(e) => set('material', e.target.value)}
              >
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {MATERIAL_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frame Type</label>
              <select
                className={inputClass}
                value={form.frameType}
                onChange={(e) => set('frameType', e.target.value)}
              >
                {FRAME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FRAME_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wholesale Price
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.wholesalePrice}
                onChange={(e) => set('wholesalePrice', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retail Price
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.retailPrice}
                onChange={(e) => set('retailPrice', Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Row 5: Stock / Reorder / Supplier */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Stock
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.stock}
                onChange={(e) => set('stock', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Level
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.reorderLevel}
                onChange={(e) => set('reorderLevel', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                className={inputClass}
                value={form.supplier}
                onChange={(e) => set('supplier', e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving…' : 'Save Frame'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FrameInventoryPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFrame, setEditingFrame] = useState<Frame | null>(null);

  // Filters
  const [brandSearch, setBrandSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [frameTypeFilter, setFrameTypeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  // Build query params
  const buildParams = () => {
    const params = new URLSearchParams();
    if (brandSearch) params.set('brand', brandSearch);
    if (materialFilter !== 'all') params.set('material', materialFilter);
    if (frameTypeFilter !== 'all') params.set('frameType', frameTypeFilter);
    if (genderFilter !== 'all') params.set('gender', genderFilter);
    return params.toString();
  };

  // ---- Queries ----
  const {
    data: framesRaw,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['optical-frames', facilityId, brandSearch, materialFilter, frameTypeFilter, genderFilter],
    queryFn: async () => {
      const qs = buildParams();
      const res = await api.get(`/optical/frames${qs ? `?${qs}` : ''}`);
      return res.data;
    },
  });

  const frames = asList<Frame>(framesRaw);

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: (data: FrameFormData) => api.post('/optical/frames', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-frames'] });
      toast.success('Frame added successfully');
      setShowAddModal(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to add frame')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FrameFormData> }) =>
      api.patch(`/optical/frames/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-frames'] });
      toast.success('Frame updated successfully');
      setShowEditModal(false);
      setEditingFrame(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update frame')),
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.patch(`/optical/frames/${id}`, { stockAdjustment: delta }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-frames'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to adjust stock')),
  });

  // ---- Handlers ----
  const openEdit = (frame: Frame) => {
    setEditingFrame(frame);
    setShowEditModal(true);
  };

  const handleAdjustStock = (frame: Frame, delta: number) => {
    if (frame.stock + delta < 0) return;
    adjustStockMutation.mutate({ id: frame.id, delta });
  };

  const selectClass =
    'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm';

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Glasses className="w-7 h-7 text-blue-600" />
            Frame Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage eyewear frames, stock levels, and pricing
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Frame
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="w-4 h-4" />
            Filters
          </div>

          {/* Brand search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Search brand…"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Material</label>
            <select
              className={selectClass}
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
            >
              <option value="all">All Materials</option>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {/* Frame Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Frame Type</label>
            <select
              className={selectClass}
              value={frameTypeFilter}
              onChange={(e) => setFrameTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {FRAME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FRAME_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
            <select
              className={selectClass}
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">All</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Package className="w-8 h-8 animate-pulse mr-3" />
          Loading frames…
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-red-500 gap-2">
          <AlertTriangle className="w-5 h-5" />
          Failed to load frames. Please try again.
        </div>
      ) : frames.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Glasses className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No frames found</p>
          <p className="text-sm mt-1">Add your first frame or adjust filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ---- Grid View ---- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Image placeholder */}
              <div className="h-40 bg-gray-100 flex items-center justify-center">
                <Glasses className="w-16 h-16 text-gray-300" />
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{frame.brand}</p>
                    <p className="text-sm text-gray-500">{frame.model}</p>
                  </div>
                  <button
                    onClick={() => openEdit(frame)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                    title="Edit frame"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{frame.color}</span>
                  <span>·</span>
                  <span>{frame.size}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(frame.retailPrice)}
                  </span>
                  {stockBadge(frame.stock, frame.reorderLevel)}
                </div>

                {/* Quick stock adjust */}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <button
                    onClick={() => handleAdjustStock(frame, -1)}
                    disabled={frame.stock <= 0}
                    className="p-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Decrease stock"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{frame.stock}</span>
                  <button
                    onClick={() => handleAdjustStock(frame, 1)}
                    className="p-1 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
                    title="Increase stock"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- List / Table View ---- */
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Brand</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Model</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Color</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Gender</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Wholesale</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Retail</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Reorder</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {frames.map((frame) => (
                <tr key={frame.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{frame.brand}</td>
                  <td className="px-4 py-3 text-gray-700">{frame.model}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{frame.sku}</td>
                  <td className="px-4 py-3 text-gray-700">{frame.color}</td>
                  <td className="px-4 py-3 text-gray-700">{frame.size}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {MATERIAL_LABELS[frame.material] ?? frame.material}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {FRAME_TYPE_LABELS[frame.frameType] ?? frame.frameType}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {GENDER_LABELS[frame.gender] ?? frame.gender}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(frame.wholesalePrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(frame.retailPrice)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleAdjustStock(frame, -1)}
                        disabled={frame.stock <= 0}
                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Decrease stock"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-medium">{frame.stock}</span>
                      <button
                        onClick={() => handleAdjustStock(frame, 1)}
                        className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                        title="Increase stock"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{frame.reorderLevel}</td>
                  <td className="px-4 py-3 text-gray-700">{frame.supplier}</td>
                  <td className="px-4 py-3">
                    {stockBadge(frame.stock, frame.reorderLevel)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(frame)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit frame"
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

      {/* ---- Add Modal ---- */}
      {showAddModal && (
        <FrameFormModal
          title="Add New Frame"
          initial={EMPTY_FORM}
          onClose={() => setShowAddModal(false)}
          onSave={(data) => createMutation.mutate(data)}
          isSaving={createMutation.isPending}
        />
      )}

      {/* ---- Edit Modal ---- */}
      {showEditModal && editingFrame && (
        <FrameFormModal
          title="Edit Frame"
          initial={{
            brand: editingFrame.brand,
            model: editingFrame.model,
            sku: editingFrame.sku,
            color: editingFrame.color,
            size: editingFrame.size,
            material: editingFrame.material,
            frameType: editingFrame.frameType,
            gender: editingFrame.gender,
            wholesalePrice: editingFrame.wholesalePrice,
            retailPrice: editingFrame.retailPrice,
            stock: editingFrame.stock,
            reorderLevel: editingFrame.reorderLevel,
            supplier: editingFrame.supplier,
          }}
          onClose={() => {
            setShowEditModal(false);
            setEditingFrame(null);
          }}
          onSave={(data) => updateMutation.mutate({ id: editingFrame.id, data })}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
