import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';

export default function StockTakePage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'count' | 'variance'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});

  const { data: inventoryResponse, isLoading } = useQuery({
    queryKey: ['inventory-stocktake', facilityId],
    queryFn: () => storesService.inventory.list({ limit: 200 }),
    staleTime: 60000,
  });

  const items = inventoryResponse?.data || [];
  const stats = inventoryResponse?.stats;

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, categoryFilter]);

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [items]);
  const lowStockCount = stats?.lowStockCount ?? items.filter(i => i.currentStock < i.minStock).length;
  const totalValue = stats?.totalValue ?? items.reduce((sum, i) => sum + (i.currentStock * (i.unitCost || 0)), 0);

  const handleExportCSV = useCallback(() => {
    if (items.length === 0) {
      toast.error('No inventory data to export');
      return;
    }
    const headers = ['Item Code', 'Item Name', 'Category', 'Location', 'Unit', 'System Qty', 'Physical Count'];
    const rows = filteredItems.map(item => [
      item.sku,
      item.name,
      item.category || '',
      item.location || '',
      item.unit,
      item.currentStock,
      physicalCounts[item.id] ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-count-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Count sheet exported successfully');
  }, [items, filteredItems, physicalCounts]);

  const saveMutation = useMutation({
    mutationFn: async (counts: Record<string, number>) => {
      const adjustments = items
        .filter(item => counts[item.id] !== undefined && counts[item.id] !== item.currentStock)
        .map(item => ({
          itemId: item.id,
          variance: counts[item.id] - item.currentStock,
        }));
      if (adjustments.length === 0) throw new Error('No variances to save');
      return Promise.all(adjustments.map(adj =>
        storesService.movements.adjust(adj.itemId, {
          quantity: adj.variance,
          type: 'adjustment',
          reason: `Stock take adjustment (physical count reconciliation)`,
        })
      ));
    },
    onSuccess: (_, counts) => {
      const countedItems = Object.keys(counts).length;
      queryClient.invalidateQueries({ queryKey: ['inventory-stocktake'] });
      setPhysicalCounts({});
      toast.success(`Saved adjustments for ${countedItems} item(s)`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save counts'),
  });

  const handleSaveCounts = useCallback(() => {
    const countedItems = Object.keys(physicalCounts).length;
    if (countedItems === 0) {
      toast.error('No physical counts entered');
      return;
    }
    const variances = items.filter(item =>
      physicalCounts[item.id] !== undefined && physicalCounts[item.id] !== item.currentStock
    ).length;
    if (variances === 0) {
      toast.success('All counts match system quantities — no adjustments needed');
      return;
    }
    saveMutation.mutate(physicalCounts);
  }, [physicalCounts, items, saveMutation]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Take</h1>
          <p className="text-gray-600">Physical inventory count and reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
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
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 ${categoryFilter ? 'border-blue-500 bg-blue-50' : ''}`}
          >
            <Filter className="w-4 h-4" />
            {categoryFilter || 'Filter'}
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
              <button
                onClick={() => { setCategoryFilter(''); setShowFilterDropdown(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${!categoryFilter ? 'font-medium text-blue-600' : ''}`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${categoryFilter === cat ? 'font-medium text-blue-600' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
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
                    <React.Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50 ${item.currentStock < item.minStock ? 'bg-yellow-50' : item.currentStock === 0 ? 'bg-red-50' : ''}`}>
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
                        <button
                          onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="View"
                        >
                          {expandedItemId === item.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                        </button>
                      </td>
                    </tr>
                    {expandedItemId === item.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div><span className="text-gray-500">Category:</span> <span className="font-medium">{item.category || '—'}</span></div>
                            <div><span className="text-gray-500">Unit Cost:</span> <span className="font-medium">{item.unitCost ? formatCurrency(item.unitCost) : '—'}</span></div>
                            <div><span className="text-gray-500">Stock Value:</span> <span className="font-medium">{formatCurrency(item.currentStock * (item.unitCost || 0))}</span></div>
                            <div><span className="text-gray-500">Max Stock:</span> <span className="font-medium">{item.maxStock} {item.unit}</span></div>
                            <div><span className="text-gray-500">Batch No:</span> <span className="font-medium">{item.batchNumber || '—'}</span></div>
                            <div><span className="text-gray-500">Expiry:</span> <span className="font-medium">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}</span></div>
                            <div><span className="text-gray-500">Generic Name:</span> <span className="font-medium">{item.genericName || '—'}</span></div>
                            <div><span className="text-gray-500">Last Updated:</span> <span className="font-medium">{new Date(item.lastUpdated).toLocaleDateString()}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'count' && (
          <div className="overflow-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <ClipboardList className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Items to Count</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
                  <span className="text-sm text-blue-700">
                    Enter physical counts for each item. {Object.keys(physicalCounts).length} of {filteredItems.length} items counted.
                  </span>
                  <button
                    onClick={handleSaveCounts}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Counts'}
                  </button>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">System Qty</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Physical Count</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredItems.map(item => {
                      const counted = physicalCounts[item.id] !== undefined;
                      const variance = counted ? physicalCounts[item.id] - item.currentStock : null;
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50 ${counted && variance !== 0 ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-600">{item.sku}</td>
                          <td className="px-4 py-3 text-gray-600">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {item.location || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.currentStock} {item.unit}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              placeholder="Enter count"
                              value={physicalCounts[item.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPhysicalCounts(prev => {
                                  if (val === '') {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  }
                                  return { ...prev, [item.id]: Number(val) };
                                });
                              }}
                              className="w-28 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {!counted ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">Pending</span>
                            ) : variance === 0 ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 inline mr-1" />Match
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />Variance: {variance! > 0 ? '+' : ''}{variance}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {activeTab === 'variance' && (
          <div className="overflow-auto flex-1">
            {Object.keys(physicalCounts).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Counts Recorded</p>
                <p className="text-sm">Go to the Count Sheets tab and enter physical counts first</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <span className="text-sm text-gray-600">
                    Showing variance for {Object.keys(physicalCounts).length} counted item(s). Items with {'>'} 10% variance are highlighted.
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">System Qty</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Physical Count</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Variance</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">% Variance</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Value Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items
                      .filter(item => physicalCounts[item.id] !== undefined)
                      .map(item => {
                        const physical = physicalCounts[item.id];
                        const variance = physical - item.currentStock;
                        const pctVariance = item.currentStock > 0 ? (variance / item.currentStock) * 100 : physical > 0 ? 100 : 0;
                        const isLargeVariance = Math.abs(pctVariance) > 10;
                        const valueImpact = variance * (item.unitCost || 0);
                        return (
                          <tr key={item.id} className={isLargeVariance ? 'bg-red-50' : variance !== 0 ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{item.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-gray-600">{item.sku}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{item.currentStock} {item.unit}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{physical} {item.unit}</td>
                            <td className={`px-4 py-3 text-right font-medium ${variance > 0 ? 'text-green-700' : variance < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                              {variance > 0 ? '+' : ''}{variance} {item.unit}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${isLargeVariance ? 'text-red-700' : variance !== 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                              {pctVariance > 0 ? '+' : ''}{pctVariance.toFixed(1)}%
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${valueImpact > 0 ? 'text-green-700' : valueImpact < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                              {valueImpact !== 0 ? formatCurrency(Math.abs(valueImpact)) : '—'}
                              {valueImpact > 0 ? ' ▲' : valueImpact < 0 ? ' ▼' : ''}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'schedule' && `Showing ${filteredItems.length} of ${items.length} inventory items`}
          {activeTab === 'count' && `${Object.keys(physicalCounts).length} of ${filteredItems.length} items counted`}
          {activeTab === 'variance' && `${Object.keys(physicalCounts).length} items with variance data`}
        </div>
      </div>
    </div>
  );
}
