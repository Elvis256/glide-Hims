import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  TrendingDown,
  ArrowDownToLine,
  RefreshCw,
  X,
  Edit,
} from 'lucide-react';
import api from '../services/api';
import { useFacilityId } from '../lib/facility';
import type { Item, StockBalance } from '../types';

const tabs = [
  { id: 'stock', label: 'Stock Levels' },
  { id: 'items', label: 'Item Master' },
  { id: 'movements', label: 'Stock Movements' },
];

export default function InventoryPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Fetch stock balances
  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-balances', facilityId, searchTerm, lowStockOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ facilityId });
      if (searchTerm) params.append('search', searchTerm);
      if (lowStockOnly) params.append('lowStock', 'true');
      const response = await api.get(`/inventory/stock?${params}`);
      return response.data;
    },
    enabled: activeTab === 'stock',
  });

  // Fetch items
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await api.get(`/inventory/items?${params}`);
      return response.data;
    },
    enabled: activeTab === 'items',
  });

  // Fetch low stock items
  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock', facilityId],
    queryFn: async () => {
      const response = await api.get(`/inventory/low-stock/${facilityId}`);
      return response.data;
    },
  });

  // Fetch expiring items
  const { data: expiringData } = useQuery({
    queryKey: ['expiring', facilityId],
    queryFn: async () => {
      const response = await api.get(`/inventory/expiring/${facilityId}?days=90`);
      return response.data;
    },
  });

  // Fetch movements
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams({ facilityId });
      const response = await api.get(`/inventory/movements?${params}`);
      return response.data;
    },
    enabled: activeTab === 'movements',
  });

  const stockBalances: StockBalance[] = stockData?.data || [];
  const items: Item[] = itemsData?.data || [];
  const lowStockItems = lowStockData || [];
  const expiringItems = expiringData || [];
  const movements = movementsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600">Manage stock and items</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReceiveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Receive Stock
          </button>
          <button
            onClick={() => {
              setSelectedItem(null);
              setShowItemModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stockBalances.length}</p>
              <p className="text-sm text-gray-600">Items in Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{lowStockItems.length}</p>
              <p className="text-sm text-yellow-700">Low Stock Items</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-900">{expiringItems.length}</p>
              <p className="text-sm text-red-700">Expiring Soon (90 days)</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowDownToLine className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{movements.length}</p>
              <p className="text-sm text-green-700">Recent Movements</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {activeTab === 'stock' && (
          <label className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Low Stock Only</span>
          </label>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'stock' && (
          <StockTable stocks={stockBalances} isLoading={stockLoading} />
        )}
        {activeTab === 'items' && (
          <ItemsTable
            items={items}
            isLoading={itemsLoading}
            onEdit={(item) => {
              setSelectedItem(item);
              setShowItemModal(true);
            }}
          />
        )}
        {activeTab === 'movements' && (
          <MovementsTable movements={movements} isLoading={movementsLoading} />
        )}
      </div>

      {/* Modals */}
      {showReceiveModal && (
        <ReceiveStockModal
          onClose={() => setShowReceiveModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['stock-balances'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            setShowReceiveModal(false);
          }}
          facilityId={facilityId}
        />
      )}

      {showItemModal && (
        <ItemModal
          item={selectedItem}
          onClose={() => setShowItemModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setShowItemModal(false);
          }}
        />
      )}
    </div>
  );
}

// Stock Table Component
function StockTable({ stocks, isLoading }: { stocks: StockBalance[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (stocks.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No stock found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Available</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Reserved</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Reorder Level</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {stocks.map((stock) => {
            const isLow = stock.availableQuantity <= stock.item.reorderLevel;
            return (
              <tr key={stock.id} className={isLow ? 'bg-yellow-50' : ''}>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{stock.item.name}</p>
                    <p className="text-sm text-gray-500">{stock.item.category || 'Uncategorized'}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{stock.item.code}</td>
                <td className="px-4 py-3 text-right font-medium">{stock.availableQuantity}</td>
                <td className="px-4 py-3 text-right text-gray-500">{stock.reservedQuantity}</td>
                <td className="px-4 py-3 text-right text-gray-500">{stock.totalQuantity}</td>
                <td className="px-4 py-3 text-right text-gray-500">{stock.item.reorderLevel}</td>
                <td className="px-4 py-3 text-center">
                  {isLow ? (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      Low Stock
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Items Table Component
function ItemsTable({
  items,
  isLoading,
  onEdit,
}: {
  items: Item[];
  isLoading: boolean;
  onEdit: (item: Item) => void;
}) {
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No items found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cost</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Price</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Type</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
              <td className="px-4 py-3 text-gray-600">{item.code}</td>
              <td className="px-4 py-3 text-gray-600">{item.category || '-'}</td>
              <td className="px-4 py-3 text-gray-600">{item.unit}</td>
              <td className="px-4 py-3 text-right text-gray-600">
                {item.unitCost.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">
                {item.sellingPrice.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center">
                {item.isDrug ? (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Drug</span>
                ) : (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Supply</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onEdit(item)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Movements Table Component
function MovementsTable({ movements, isLoading }: { movements: any[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (movements.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <RefreshCw className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No movements found</p>
      </div>
    );
  }

  const movementColors: Record<string, string> = {
    purchase: 'bg-green-100 text-green-800',
    sale: 'bg-red-100 text-red-800',
    adjustment: 'bg-yellow-100 text-yellow-800',
    transfer_in: 'bg-blue-100 text-blue-800',
    transfer_out: 'bg-purple-100 text-purple-800',
    return: 'bg-orange-100 text-orange-800',
    expired: 'bg-gray-100 text-gray-800',
    damaged: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
            <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Type</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Balance</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Batch</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {movements.map((mov) => (
            <tr key={mov.id}>
              <td className="px-4 py-3 text-gray-600">
                {new Date(mov.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{mov.item?.name || '-'}</td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-1 text-xs rounded-full ${movementColors[mov.movementType] || 'bg-gray-100'}`}>
                  {mov.movementType.replace('_', ' ')}
                </span>
              </td>
              <td className={`px-4 py-3 text-right font-medium ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {mov.quantity > 0 ? '+' : ''}{mov.quantity}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{mov.balanceAfter}</td>
              <td className="px-4 py-3 text-gray-600">{mov.batchNumber || '-'}</td>
              <td className="px-4 py-3 text-gray-500 text-sm max-w-xs truncate">{mov.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Receive Stock Modal
function ReceiveStockModal({
  onClose,
  onSuccess,
  facilityId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  facilityId: string;
}) {
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: 0,
    batchNumber: '',
    expiryDate: '',
    unitCost: 0,
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Search items
  const { data: itemsData } = useQuery({
    queryKey: ['items-search', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await api.get(`/inventory/items?${params}`);
      return response.data;
    },
    enabled: searchTerm.length > 1,
  });

  const items: Item[] = itemsData?.data || [];

  const receiveMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/inventory/stock/receive', {
        ...data,
        facilityId,
      });
    },
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    receiveMutation.mutate({
      itemId: formData.itemId,
      quantity: formData.quantity,
      batchNumber: formData.batchNumber || undefined,
      expiryDate: formData.expiryDate || undefined,
      unitCost: formData.unitCost || undefined,
      notes: formData.notes || undefined,
    });
  };

  const selectedItem = items.find((i) => i.id === formData.itemId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Receive Stock</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Item Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {items.length > 0 && !formData.itemId && (
              <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, itemId: item.id, unitCost: item.unitCost });
                      setSearchTerm(item.name);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.code}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedItem && (
              <div className="mt-1 p-2 bg-blue-50 rounded-lg text-sm">
                Selected: <strong>{selectedItem.name}</strong> ({selectedItem.code})
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Batch Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
            <input
              type="text"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.unitCost}
              onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.itemId || formData.quantity <= 0 || receiveMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {receiveMutation.isPending ? 'Receiving...' : 'Receive Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Item Modal
function ItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: Item | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    code: item?.code || '',
    name: item?.name || '',
    category: item?.category || '',
    categoryId: item?.categoryId || '',
    subcategoryId: item?.subcategoryId || '',
    brandId: item?.brandId || '',
    unitId: item?.unitId || '',
    formulationId: item?.formulationId || '',
    storageConditionId: item?.storageConditionId || '',
    description: item?.description || '',
    unit: item?.unit || 'unit',
    genericName: item?.genericName || '',
    strength: item?.strength || '',
    manufacturer: item?.manufacturer || '',
    isDrug: item?.isDrug || false,
    requiresPrescription: item?.requiresPrescription || false,
    isControlled: item?.isControlled || false,
    requiresBatchTracking: item?.requiresBatchTracking ?? true,
    requiresExpiryTracking: item?.requiresExpiryTracking ?? true,
    reorderLevel: item?.reorderLevel || 10,
    unitCost: item?.unitCost || 0,
    sellingPrice: item?.sellingPrice || 0,
  });

  // Fetch classifications
  const { data: categories = [] } = useQuery({
    queryKey: ['item-categories'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/categories');
      return res.data;
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['item-subcategories', formData.categoryId],
    queryFn: async () => {
      const params = formData.categoryId ? `?categoryId=${formData.categoryId}` : '';
      const res = await api.get(`/item-classifications/subcategories${params}`);
      return res.data;
    },
    enabled: !!formData.categoryId,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['item-brands'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/brands');
      return res.data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['item-units'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/units');
      return res.data;
    },
  });

  const { data: formulations = [] } = useQuery({
    queryKey: ['item-formulations'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/formulations');
      return res.data;
    },
  });

  const { data: storageConditions = [] } = useQuery({
    queryKey: ['storage-conditions'],
    queryFn: async () => {
      const res = await api.get('/item-classifications/storage-conditions');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (item) {
        return api.put(`/inventory/items/${item.id}`, data);
      }
      return api.post('/inventory/items', data);
    },
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{item ? 'Edit Item' : 'New Item'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!item}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category...</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={formData.subcategoryId}
                onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={!formData.categoryId}
              >
                <option value="">Select subcategory...</option>
                {subcategories.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select
                value={formData.brandId}
                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select brand...</option>
                {brands.map((brand: any) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
              <select
                value={formData.unitId}
                onChange={(e) => {
                  const selected = units.find((u: any) => u.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    unitId: e.target.value,
                    unit: selected?.abbreviation || formData.unit 
                  });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select unit...</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                ))}
              </select>
            </div>
          </div>

          {formData.isDrug && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formulation</label>
                <select
                  value={formData.formulationId}
                  onChange={(e) => setFormData({ ...formData, formulationId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select formulation...</option>
                  {formulations.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                <input
                  type="text"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {formData.isDrug && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                <input
                  type="text"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  placeholder="e.g., 500mg"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., Cipla"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage Condition</label>
              <select
                value={formData.storageConditionId}
                onChange={(e) => setFormData({ ...formData, storageConditionId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select storage...</option>
                {storageConditions.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legacy Unit (fallback)</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="unit">Unit</option>
                <option value="tablet">Tablet</option>
                <option value="capsule">Capsule</option>
                <option value="bottle">Bottle</option>
                <option value="box">Box</option>
                <option value="piece">Piece</option>
                <option value="ml">ml</option>
                <option value="mg">mg</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDrug}
                onChange={(e) => setFormData({ ...formData, isDrug: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Is Drug</span>
            </label>
            {formData.isDrug && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresPrescription}
                    onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Requires Prescription</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isControlled}
                    onChange={(e) => setFormData({ ...formData, isControlled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Controlled Substance</span>
                </label>
              </>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresBatchTracking}
                onChange={(e) => setFormData({ ...formData, requiresBatchTracking: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Track Batches</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresExpiryTracking}
                onChange={(e) => setFormData({ ...formData, requiresExpiryTracking: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Track Expiry</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : item ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
