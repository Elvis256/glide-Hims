import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Search,
  Filter,
  AlertTriangle,
  Box,
  Stethoscope,
  Droplets,
  Shirt,
  FileText,
  TrendingDown,
  TrendingUp,
  MoreVertical,
  Plus,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { storesService, type InventoryItem } from '../../services';

const mockInventory: InventoryItem[] = [
  { id: '1', name: 'Surgical Gloves (Medium)', category: 'Medical Supplies', sku: 'MS-001', currentStock: 250, minStock: 100, maxStock: 500, unit: 'Pairs', location: 'Store A', lastUpdated: '2025-01-23' },
  { id: '2', name: 'IV Cannula 22G', category: 'Medical Supplies', sku: 'MS-002', currentStock: 45, minStock: 50, maxStock: 200, unit: 'Pieces', location: 'Store A', lastUpdated: '2025-01-22' },
  { id: '3', name: 'Patient Monitor', category: 'Equipment', sku: 'EQ-001', currentStock: 8, minStock: 5, maxStock: 15, unit: 'Units', location: 'Store B', lastUpdated: '2025-01-21' },
  { id: '4', name: 'Oxygen Mask Adult', category: 'Consumables', sku: 'CO-001', currentStock: 180, minStock: 100, maxStock: 300, unit: 'Pieces', location: 'Store A', lastUpdated: '2025-01-23' },
  { id: '5', name: 'Bed Sheet White', category: 'Linen', sku: 'LN-001', currentStock: 120, minStock: 80, maxStock: 200, unit: 'Pieces', location: 'Store C', lastUpdated: '2025-01-20' },
  { id: '6', name: 'A4 Paper Ream', category: 'Stationery', sku: 'ST-001', currentStock: 30, minStock: 50, maxStock: 150, unit: 'Reams', location: 'Store D', lastUpdated: '2025-01-22' },
  { id: '7', name: 'Suture Kit Nylon', category: 'Medical Supplies', sku: 'MS-003', currentStock: 200, minStock: 100, maxStock: 400, unit: 'Kits', location: 'Store A', lastUpdated: '2025-01-23' },
  { id: '8', name: 'Wheelchair Standard', category: 'Equipment', sku: 'EQ-002', currentStock: 12, minStock: 8, maxStock: 20, unit: 'Units', location: 'Store B', lastUpdated: '2025-01-19' },
  { id: '9', name: 'Cotton Wool 500g', category: 'Consumables', sku: 'CO-002', currentStock: 25, minStock: 40, maxStock: 100, unit: 'Rolls', location: 'Store A', lastUpdated: '2025-01-21' },
  { id: '10', name: 'Patient Gown', category: 'Linen', sku: 'LN-002', currentStock: 60, minStock: 50, maxStock: 150, unit: 'Pieces', location: 'Store C', lastUpdated: '2025-01-22' },
];

const categories = [
  { name: 'Medical Supplies', icon: Stethoscope, color: 'bg-blue-500', count: 156 },
  { name: 'Equipment', icon: Box, color: 'bg-purple-500', count: 45 },
  { name: 'Consumables', icon: Droplets, color: 'bg-green-500', count: 89 },
  { name: 'Linen', icon: Shirt, color: 'bg-orange-500', count: 34 },
  { name: 'Stationery', icon: FileText, color: 'bg-gray-500', count: 28 },
];

export default function MainInventoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStock, setShowLowStock] = useState(false);

  // Fetch inventory from API
  const { data: apiInventory, isLoading, refetch } = useQuery({
    queryKey: ['inventory', selectedCategory !== 'all' ? selectedCategory : undefined, showLowStock],
    queryFn: () => storesService.inventory.list({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      lowStock: showLowStock || undefined,
      search: searchTerm || undefined,
    }),
    staleTime: 30000,
  });

  const inventory: InventoryItem[] = apiInventory?.data || mockInventory;

  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesLowStock = !showLowStock || item.currentStock < item.minStock;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [searchTerm, selectedCategory, showLowStock, inventory]);

  const lowStockCount = inventory.filter((item) => item.currentStock < item.minStock).length;

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.maxStock) * 100;
    if (item.currentStock < item.minStock) return { color: 'bg-red-500', text: 'Low Stock', icon: TrendingDown };
    if (percentage > 80) return { color: 'bg-green-500', text: 'Adequate', icon: TrendingUp };
    return { color: 'bg-yellow-500', text: 'Normal', icon: null };
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Inventory</h1>
          <p className="text-gray-600">Manage stock levels across all categories</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-3 mb-4">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(selectedCategory === cat.name ? 'all' : cat.name)}
            className={`p-3 rounded-lg border transition-all ${
              selectedCategory === cat.name ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${cat.color} bg-opacity-10`}>
                <cat.icon className={`w-5 h-5 ${cat.color.replace('bg-', 'text-')}`} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                <p className="text-xs text-gray-500">{cat.count} items</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="flex-shrink-0 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-800 font-medium">
              {lowStockCount} items are below minimum stock levels
            </span>
          </div>
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`px-3 py-1 text-sm rounded-lg ${
              showLowStock ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {showLowStock ? 'Show All' : 'View Low Stock'}
          </button>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Inventory Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item Details</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock Level</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Min/Max</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Package className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {item.currentStock} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {item.minStock} / {item.maxStock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.location}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        status.color === 'bg-red-500' ? 'bg-red-100 text-red-700' :
                        status.color === 'bg-green-500' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {status.icon && <status.icon className="w-3 h-3" />}
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredItems.length} of {inventory.length} items
        </div>
      </div>
    </div>
  );
}
