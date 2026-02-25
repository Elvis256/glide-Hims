import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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
  X,
  Pill,
} from 'lucide-react';
import { storesService, type InventoryItem, type CreateItemDto } from '../../services';

const defaultInventory: InventoryItem[] = [];

export default function MainInventoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<CreateItemDto>({
    name: '', category: 'Medical Supplies', sku: '', minStock: 10, maxStock: 100, unit: 'pcs', location: 'Main Store',
  });

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

  const createMutation = useMutation({
    mutationFn: (data: CreateItemDto) => storesService.inventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowAddModal(false);
      setNewItem({ name: '', category: 'Medical Supplies', sku: '', minStock: 10, maxStock: 100, unit: 'pcs', location: 'Main Store' });
      toast.success('Item added successfully');
    },
    onError: () => toast.error('Failed to add item'),
  });

  const inventory: InventoryItem[] = apiInventory?.data || defaultInventory;

  // Compute category counts dynamically
  const categoryIcons: Record<string, { icon: typeof Stethoscope; color: string }> = {
    'Medical Supplies': { icon: Stethoscope, color: 'bg-blue-500' },
    'Equipment': { icon: Box, color: 'bg-purple-500' },
    'Consumables': { icon: Droplets, color: 'bg-green-500' },
    'Linen': { icon: Shirt, color: 'bg-orange-500' },
    'Stationery': { icon: FileText, color: 'bg-gray-500' },
  };
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    inventory.forEach((item) => { counts[item.category] = (counts[item.category] || 0) + 1; });
    return Object.keys(categoryIcons).map((name) => ({
      name,
      icon: categoryIcons[name].icon,
      color: categoryIcons[name].color,
      count: counts[name] || 0,
    }));
  }, [inventory]);

  const handleExport = useCallback(() => {
    const rows = [
      ['Name', 'SKU', 'Category', 'Current Stock', 'Unit', 'Min Stock', 'Max Stock', 'Location', 'Status'],
      ...inventory.map((item) => [
        item.name, item.sku, item.category, String(item.currentStock), item.unit,
        String(item.minStock), String(item.maxStock), item.location || '',
        item.currentStock < item.minStock ? 'Low Stock' : 'OK',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Inventory exported');
  }, [inventory]);

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
          <Link to="/pharmacy/stock" className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            <Pill className="w-4 h-4" />
            Pharmacy Stock
          </Link>
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
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
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 ${showLowStock ? 'border-red-500 bg-red-50 text-red-700' : ''}`}
        >
          <Filter className="w-4 h-4" />
          {showLowStock ? 'Low Stock' : 'Filter'}
        </button>
      </div>

      {/* Inventory Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {filteredItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Inventory Items</p>
                <p className="text-sm">Add items to your inventory to get started</p>
              </div>
            </div>
          ) : (
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
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setShowItemMenu(showItemMenu === item.id ? null : item.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      {showItemMenu === item.id && (
                        <div className="absolute right-4 top-10 w-36 bg-white border rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => { toast.info(`View details for ${item.name}`); setShowItemMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(item.sku); toast.success('SKU copied'); setShowItemMenu(null); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                          >
                            Copy SKU
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredItems.length} of {inventory.length} items
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Surgical Gloves (Medium)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. GLV-MED-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="pcs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({ ...newItem, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={newItem.maxStock}
                    onChange={(e) => setNewItem({ ...newItem, maxStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newItem.location}
                  onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Main Store, Shelf A3"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => createMutation.mutate(newItem)}
                disabled={!newItem.name || !newItem.sku || createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
