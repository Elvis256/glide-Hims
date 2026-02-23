import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Download,
  Eye,
  FileText,
  BarChart3,
  MapPin,
  Loader2,
} from 'lucide-react';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';

export default function StockTakePage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'schedule' | 'count' | 'variance'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: inventoryResponse, isLoading } = useQuery({
    queryKey: ['inventory-stocktake', facilityId],
    queryFn: () => storesService.inventory.list({ limit: 200 }),
    staleTime: 60000,
  });

  const items = inventoryResponse?.data || [];
  const stats = inventoryResponse?.stats;

  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);
  const lowStockCount = stats?.lowStockCount ?? items.filter(i => i.currentStock < i.minStock).length;
  const totalValue = stats?.totalValue ?? items.reduce((sum, i) => sum + (i.currentStock * (i.unitCost || 0)), 0);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Take</h1>
          <p className="text-gray-600">Physical inventory count and reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export Count Sheet
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-700">{items.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-700">{lowStockCount}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Out of Stock</p>
              <p className="text-2xl font-bold text-orange-700">{items.filter(i => i.currentStock === 0).length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Stock Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Inventory List
        </button>
        <button
          onClick={() => setActiveTab('count')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'count' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          Count Sheets
        </button>
        <button
          onClick={() => setActiveTab('variance')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'variance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Variance Report
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'schedule' && (
          <div className="overflow-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Inventory Items</p>
                <p className="text-sm">Add items to inventory to start a stock take</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">System Qty</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Min Stock</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.map(item => (
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.currentStock < item.minStock ? 'bg-yellow-50' : item.currentStock === 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600">{item.sku}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3 h-3" />
                          {item.location || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.currentStock} {item.unit}</td>
                      <td className="px-4 py-3 text-gray-600">{item.minStock} {item.unit}</td>
                      <td className="px-4 py-3">
                        {item.currentStock === 0 ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Out of Stock</span>
                        ) : item.currentStock < item.minStock ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Low Stock</span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Adequate</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'count' && (
          <div className="flex-1 flex items-center justify-center text-gray-500 py-12">
            <div className="text-center">
              <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">Count Sheets</p>
              <p className="text-sm">Create a stock take session to generate count sheets</p>
              <p className="text-sm mt-2 text-gray-400">Total items to count: {items.length}</p>
            </div>
          </div>
        )}

        {activeTab === 'variance' && (
          <div className="flex-1 flex items-center justify-center text-gray-500 py-12">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">Variance Report</p>
              <p className="text-sm">Complete a stock take count to see variance analysis</p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-left">
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm font-medium text-yellow-700">Low Stock Items</p>
                  <p className="text-2xl font-bold text-yellow-800">{lowStockCount}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-700">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-800">{items.filter(i => i.currentStock === 0).length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'schedule' && `Showing ${filteredItems.length} of ${items.length} inventory items`}
          {activeTab === 'count' && 'Count sheets are generated per stock take session'}
          {activeTab === 'variance' && 'Variance analysis after stock take completion'}
        </div>
      </div>
    </div>
  );
}
