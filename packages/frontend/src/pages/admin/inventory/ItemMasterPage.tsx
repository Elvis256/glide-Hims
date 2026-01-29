import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  AlertTriangle,
  Filter,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { storesService, type InventoryItem } from '../../../services';

const categories = ['All Categories', 'Medical Supplies', 'Equipment', 'Consumables', 'Linen', 'Stationery'];

export default function ItemMasterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-items', categoryFilter, searchTerm],
    queryFn: () => storesService.inventory.list({
      category: categoryFilter !== 'All Categories' ? categoryFilter : undefined,
      search: searchTerm || undefined,
    }),
  });

  const items: InventoryItem[] = data?.data ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((item: InventoryItem) => {
      const matchesStatus = statusFilter === 'all' || statusFilter === 'active';
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && item.currentStock <= item.minStock) ||
        (stockFilter === 'ok' && item.currentStock > item.minStock);
      return matchesStatus && matchesStock;
    });
  }, [items, statusFilter, stockFilter]);

  const getStockStatus = (current: number, minStock: number) => {
    if (current === 0) return { color: 'text-red-600 bg-red-50', label: 'Out of Stock' };
    if (current <= minStock) return { color: 'text-amber-600 bg-amber-50', label: 'Low Stock' };
    return { color: 'text-green-600 bg-green-50', label: 'In Stock' };
  };

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
            <p className="text-sm text-gray-500">Master catalog of non-pharmaceutical items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
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
            placeholder="Search by item code or description..."
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
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Stock Levels</option>
          <option value="low">Low/Out of Stock</option>
          <option value="ok">Adequate Stock</option>
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
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{items.length}</div>
          <div className="text-sm text-gray-500">Total Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {items.length}
          </div>
          <div className="text-sm text-gray-500">Active Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">
            {items.filter((i: InventoryItem) => i.currentStock <= i.minStock && i.currentStock > 0).length}
          </div>
          <div className="text-sm text-gray-500">Low Stock Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {items.filter((i: InventoryItem) => i.currentStock === 0).length}
          </div>
          <div className="text-sm text-gray-500">Out of Stock</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Levels</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No inventory items found</p>
                    <p className="text-sm text-gray-400">Add items to get started with inventory management</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: InventoryItem) => {
                  const stockStatus = getStockStatus(item.currentStock, item.minStock);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-gray-900">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{item.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-gray-900">Min: {item.minStock}</div>
                          <div className="text-gray-500">Max: {item.maxStock}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.currentStock}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                          {item.currentStock <= item.minStock && item.currentStock > 0 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{item.location}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 text-gray-400 hover:text-purple-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
