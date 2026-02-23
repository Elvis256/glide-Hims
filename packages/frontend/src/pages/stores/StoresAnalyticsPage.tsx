import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Package,
  DollarSign,
  RotateCw,
  Target,
  Download,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Building2,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';

interface InventoryMetric {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ElementType;
  color: string;
}

export default function StoresAnalyticsPage() {
  const facilityId = useFacilityId();
  const [periodFilter, setPeriodFilter] = useState('Jan 2025');
  const [activeSection, setActiveSection] = useState<'overview' | 'turnover' | 'efficiency'>('overview');

  const { data: inventoryData, isLoading, refetch } = useQuery({
    queryKey: ['inventory-analytics', facilityId],
    queryFn: () => storesService.inventory.list({ limit: 500 }),
    staleTime: 60000,
  });

  const { data: categorySummary = [] } = useQuery({
    queryKey: ['category-summary', facilityId],
    queryFn: () => storesService.getCategorySummary(),
    staleTime: 60000,
  });

  const stats = inventoryData?.stats;
  const items = inventoryData?.data || [];

  const totalValue = stats?.totalValue ?? items.reduce((sum, item) => sum + (item.currentStock * (item.unitCost || 0)), 0);
  const lowStockCount = stats?.lowStockCount ?? items.filter(i => i.currentStock < i.minStock).length;
  const expiringCount = stats?.expiringCount ?? 0;
  const deadStockItems = items.filter(i => i.currentStock === 0);
  const deadStockValue = deadStockItems.reduce((sum, i) => sum + ((i.unitCost || 0) * i.maxStock * 0.1), 0);

  const metrics: InventoryMetric[] = [
    { label: 'Total Items', value: String(items.length), subValue: 'In inventory', trend: 'stable', trendValue: '0', icon: RotateCw, color: 'blue' },
    { label: 'Total Value', value: formatCurrency(totalValue), subValue: 'Current stock', trend: 'stable', trendValue: '0%', icon: DollarSign, color: 'green' },
    { label: 'Low Stock', value: String(lowStockCount), subValue: 'Need reorder', trend: lowStockCount > 0 ? 'down' : 'stable', trendValue: `${lowStockCount}`, icon: Target, color: 'purple' },
    { label: 'Expiring Soon', value: String(expiringCount), subValue: 'Within 90 days', trend: expiringCount > 0 ? 'down' : 'stable', trendValue: `${expiringCount}`, icon: Package, color: 'orange' },
  ];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores Analytics</h1>
          <p className="text-gray-600">Inventory performance and efficiency metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="Jan 2025">January 2025</option>
            <option value="Dec 2024">December 2024</option>
            <option value="Q4 2024">Q4 2024</option>
            <option value="2024">Year 2024</option>
          </select>
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="p-4 bg-white border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg bg-${metric.color}-100`}>
                <metric.icon className={`w-5 h-5 text-${metric.color}-600`} />
              </div>
              {metric.trend && (
                <div className={`flex items-center gap-1 text-sm ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {metric.trendValue}
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-sm text-gray-500">{metric.label}</p>
            {metric.subValue && <p className="text-xs text-gray-400 mt-1">{metric.subValue}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Department Usage
        </button>
        <button
          onClick={() => setActiveSection('turnover')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'turnover' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <RotateCw className="w-4 h-4 inline mr-2" />
          Inventory Turnover
        </button>
        <button
          onClick={() => setActiveSection('efficiency')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'efficiency' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          Procurement Efficiency
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Main Content Area */}
        <div className="col-span-2 bg-white border rounded-lg overflow-hidden flex flex-col">
          {activeSection === 'overview' && (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Category Summary</h3>
                <p className="text-sm text-gray-500">Stock distribution by category</p>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Value</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">% of Portfolio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
                    ) : categorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="font-medium">No category data available</p>
                        </td>
                      </tr>
                    ) : (
                      categorySummary.map((cat) => {
                        const pct = totalValue > 0 ? ((cat.totalValue / totalValue) * 100).toFixed(1) : '0';
                        return (
                          <tr key={cat.category} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{cat.category}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{cat.count}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(cat.totalValue)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-sm text-gray-600">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'turnover' && (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Stock Level Analysis</h3>
                <p className="text-sm text-gray-500">Items with low stock or high value</p>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Current Stock</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Min Stock</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          <RotateCw className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="font-medium">No inventory data available</p>
                        </td>
                      </tr>
                    ) : (
                      items.slice(0, 20).map((item) => {
                        const status = item.currentStock === 0 ? 'dead' : item.currentStock < item.minStock ? 'slow' : 'normal';
                        const statusColors: Record<string, string> = { normal: 'bg-green-100 text-green-700', slow: 'bg-yellow-100 text-yellow-700', dead: 'bg-red-100 text-red-700' };
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{item.currentStock} {item.unit}</td>
                            <td className="px-4 py-3 text-gray-600">{item.minStock} {item.unit}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full capitalize ${statusColors[status]}`}>
                                {status === 'dead' ? 'Out of Stock' : status === 'slow' ? 'Low Stock' : 'Adequate'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'efficiency' && (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Inventory Summary</h3>
                <p className="text-sm text-gray-500">Key inventory health indicators</p>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Items', value: items.length, unit: 'items', target: items.length, status: 'good' as const },
                    { label: 'Low Stock Items', value: lowStockCount, unit: 'items', target: 0, status: lowStockCount === 0 ? 'good' as const : 'warning' as const },
                    { label: 'Expiring Soon', value: expiringCount, unit: 'items', target: 0, status: expiringCount === 0 ? 'good' as const : 'warning' as const },
                    { label: 'Out of Stock', value: deadStockItems.length, unit: 'items', target: 0, status: deadStockItems.length === 0 ? 'good' as const : 'poor' as const },
                  ].map((metric) => (
                    <div key={metric.label} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${metric.status === 'good' ? 'bg-green-100 text-green-700' : metric.status === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {metric.status === 'good' ? 'Good' : metric.status === 'warning' ? 'Needs Attention' : 'Critical'}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
                        <span className="text-gray-500">{metric.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Side Panel - Summary */}
        <div className="bg-white border rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Quick Insights</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Stock Value Distribution */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Stock Value Distribution</span>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
              ) : (
              <div className="space-y-2">
                {categorySummary.slice(0, 5).map(cat => {
                  const pct = totalValue > 0 ? Math.round((cat.totalValue / totalValue) * 100) : 0;
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{cat.category}</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {categorySummary.length === 0 && (
                  <p className="text-sm text-gray-500">No category data available</p>
                )}
              </div>
              )}
            </div>

            {/* Alerts */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">Attention Required</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                  {lowStockCount} items below reorder point
                </div>
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                  {expiringCount} items expiring in 90 days
                </div>
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                  {deadStockItems.length} out-of-stock items
                </div>
              </div>
            </div>

            {/* Cost Savings */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Total Stock Value</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
              <p className="text-sm text-gray-500 mt-1">{items.length} items tracked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
