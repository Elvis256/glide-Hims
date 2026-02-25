import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  Filter,
  Download,
  Upload,
  Loader2,
  X,
  Eye,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../services/api';

interface ItemRecord {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  category?: string;
  itemCategory?: { name: string };
  description?: string;
  unit: string;
  isDrug: boolean;
  reorderLevel: number;
  maxStockLevel?: number;
  unitCost: number;
  sellingPrice: number;
  status: string;
  manufacturer?: string;
  barcode?: string;
  createdAt: string;
}

export default function ItemMasterPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [drugFilter, setDrugFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [viewItem, setViewItem] = useState<ItemRecord | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-inventory-items', searchTerm, categoryFilter, drugFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (drugFilter === 'drug') params.isDrug = 'true';
      if (drugFilter === 'non-drug') params.isDrug = 'false';
      if (statusFilter !== 'all') params.status = statusFilter;
      params.limit = '100';
      const res = await api.get('/inventory/items', { params });
      return res.data;
    },
  });

  // Fetch categories for filter dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['item-categories-filter'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/categories');
      return res.data;
    },
  });

  const items: ItemRecord[] = data?.data ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesStatus;
    });
  }, [items, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.status === 'active').length,
    drugs: items.filter((i) => i.isDrug).length,
    nonDrugs: items.filter((i) => !i.isDrug).length,
  }), [items]);

  const handleExport = useCallback(() => {
    if (items.length === 0) {
      toast.error('No items to export');
      return;
    }
    const headers = ['Code', 'Name', 'Category', 'Unit', 'Is Drug', 'Reorder Level', 'Unit Cost', 'Selling Price', 'Status'];
    const rows = items.map((i) => [
      i.code, i.name, i.itemCategory?.name || i.category || '', i.unit,
      i.isDrug ? 'Yes' : 'No', i.reorderLevel, i.unitCost, i.sellingPrice, i.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `item-master-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} items`);
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-gray-500">
        <Package className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">Failed to load inventory items</p>
        <p className="text-sm">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Master</h1>
            <p className="text-sm text-gray-500">Master catalog of all inventory items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings/classifications"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Layers className="w-4 h-4" />
            Classifications
          </Link>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { setEditingItem(null); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Categories</option>
          {categories.map((cat: any) => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
        <select
          value={drugFilter}
          onChange={(e) => setDrugFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Types</option>
          <option value="drug">Drugs Only</option>
          <option value="non-drug">Non-Drugs Only</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-gray-500">Active Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.drugs}</div>
          <div className="text-sm text-gray-500">Drug Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">{stats.nonDrugs}</div>
          <div className="text-sm text-gray-500">Non-Drug Items</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sell Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No inventory items found</p>
                    <p className="text-sm text-gray-400 mb-4">Add items to get started with inventory management</p>
                    <button
                      onClick={() => { setEditingItem(null); setShowAddModal(true); }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      <Plus className="w-4 h-4 inline mr-1" /> Add First Item
                    </button>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{item.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.genericName && (
                        <div className="text-xs text-gray-500">{item.genericName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.itemCategory?.name || item.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isDrug ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isDrug ? '💊 Drug' : '📦 Supply'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-600">{Number(item.unitCost).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">{Number(item.sellingPrice).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewItem(item)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingItem(item); setShowAddModal(true); }}
                          className="p-1 text-gray-400 hover:text-purple-600"
                          title="Edit item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal - redirects to the /inventory page's modal */}
      {showAddModal && (
        <AddEditItemModal
          item={editingItem}
          onClose={() => { setShowAddModal(false); setEditingItem(null); }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ['all-inventory-items'] });
          }}
        />
      )}

      {/* View Detail Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Item Details</h2>
              <button onClick={() => setViewItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {[
                ['Code', viewItem.code],
                ['Name', viewItem.name],
                ['Generic Name', viewItem.genericName || '—'],
                ['Category', viewItem.itemCategory?.name || viewItem.category || '—'],
                ['Unit', viewItem.unit],
                ['Type', viewItem.isDrug ? '💊 Drug' : '📦 Non-Drug'],
                ['Reorder Level', viewItem.reorderLevel],
                ['Unit Cost', Number(viewItem.unitCost).toLocaleString()],
                ['Selling Price', Number(viewItem.sellingPrice).toLocaleString()],
                ['Manufacturer', viewItem.manufacturer || '—'],
                ['Barcode', viewItem.barcode || '—'],
                ['Status', viewItem.status],
                ['Created', new Date(viewItem.createdAt).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-900">{value}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setViewItem(null); setEditingItem(viewItem); setShowAddModal(true); }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Edit Item
                </button>
                <button
                  onClick={() => setViewItem(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Add/Edit Modal for item creation
function AddEditItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: ItemRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    code: item?.code || '',
    name: item?.name || '',
    category: item?.category || '',
    description: item?.description || '',
    unit: item?.unit || 'unit',
    isDrug: item?.isDrug || false,
    reorderLevel: item?.reorderLevel || 10,
    unitCost: item?.unitCost || 0,
    sellingPrice: item?.sellingPrice || 0,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (item) {
        return api.put(`/inventory/items/${item.id}`, data);
      }
      return api.post('/inventory/items', data);
    },
    onSuccess: () => {
      toast.success(item ? 'Item updated' : 'Item created');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save');
    },
  });

  const autoCode = () => {
    const prefix = formData.isDrug ? 'DRG' : 'ITM';
    const slug = formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    setFormData((p) => ({ ...p, code: `${prefix}-${slug}-${rand}` }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{item ? 'Edit Item' : 'New Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }}
          className="p-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  required
                  disabled={!!item}
                />
                {!item && (
                  <button type="button" onClick={autoCode} className="px-2 py-2 bg-gray-100 border rounded-lg hover:bg-gray-200 text-xs">Auto</button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              >
                {['unit', 'tablet', 'capsule', 'bottle', 'box', 'piece', 'ml', 'mg', 'vial', 'ampoule', 'tube', 'sachet'].map((u) => (
                  <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isDrug}
              onChange={(e) => setFormData({ ...formData, isDrug: e.target.checked })}
              className="rounded text-purple-600"
            />
            <span className="text-sm">💊 Is Drug</span>
          </label>
          <p className="text-xs text-gray-400">For full item details (brand, formulation, batch tracking, etc.) use the <Link to="/inventory" className="text-purple-600 underline">Inventory</Link> page.</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : item ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
