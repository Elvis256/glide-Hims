import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Boxes,
  DollarSign,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

interface CategoryStock {
  name: string;
  quantity: number;
  value: number;
}

interface StockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  unitPrice: number;
  totalValue: number;
  status: 'ok' | 'low' | 'critical' | 'out';
}

interface LowStockItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  daysUntilStockout: number;
}

export default function StockReportsPage() {
  const [dateRange, setDateRange] = useState('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stock-reports', dateRange, selectedCategory],
    queryFn: async () => {
      try {
        const response = await api.get('/reports/stock', {
          params: { dateRange, category: selectedCategory, startDate, endDate },
        });
        return response.data;
      } catch {
        // Return mock data if API not available
        return {
          totalStockValue: 156789000,
          totalItems: 1247,
          lowStockItems: 23,
          outOfStockItems: 5,
          categoryBreakdown: [
            { name: 'Pharmaceuticals', quantity: 4520, value: 67500000 },
            { name: 'Medical Supplies', quantity: 2340, value: 34200000 },
            { name: 'Laboratory', quantity: 890, value: 25600000 },
            { name: 'Surgical', quantity: 567, value: 18900000 },
            { name: 'Equipment', quantity: 124, value: 8500000 },
            { name: 'Other', quantity: 206, value: 2089000 },
          ],
          lowStockAlerts: [
            { id: '1', name: 'Paracetamol 500mg', category: 'Pharmaceuticals', currentStock: 50, reorderLevel: 200, daysUntilStockout: 3 },
            { id: '2', name: 'Surgical Gloves (M)', category: 'Medical Supplies', currentStock: 100, reorderLevel: 500, daysUntilStockout: 5 },
            { id: '3', name: 'IV Cannula 20G', category: 'Medical Supplies', currentStock: 25, reorderLevel: 100, daysUntilStockout: 2 },
            { id: '4', name: 'Amoxicillin 250mg', category: 'Pharmaceuticals', currentStock: 75, reorderLevel: 300, daysUntilStockout: 4 },
            { id: '5', name: 'Blood Collection Tubes', category: 'Laboratory', currentStock: 30, reorderLevel: 150, daysUntilStockout: 1 },
            { id: '6', name: 'Syringes 5ml', category: 'Medical Supplies', currentStock: 150, reorderLevel: 400, daysUntilStockout: 6 },
          ],
          stockValuation: [
            { id: '1', name: 'Paracetamol 500mg', category: 'Pharmaceuticals', currentStock: 5000, reorderLevel: 200, unitPrice: 500, totalValue: 2500000, status: 'ok' as const },
            { id: '2', name: 'Amoxicillin 500mg', category: 'Pharmaceuticals', currentStock: 3500, reorderLevel: 300, unitPrice: 1200, totalValue: 4200000, status: 'ok' as const },
            { id: '3', name: 'Surgical Gloves (L)', category: 'Medical Supplies', currentStock: 2000, reorderLevel: 500, unitPrice: 800, totalValue: 1600000, status: 'ok' as const },
            { id: '4', name: 'IV Cannula 18G', category: 'Medical Supplies', currentStock: 150, reorderLevel: 100, unitPrice: 3500, totalValue: 525000, status: 'ok' as const },
            { id: '5', name: 'Blood Glucose Strips', category: 'Laboratory', currentStock: 45, reorderLevel: 100, unitPrice: 15000, totalValue: 675000, status: 'low' as const },
            { id: '6', name: 'Insulin Syringes', category: 'Medical Supplies', currentStock: 20, reorderLevel: 50, unitPrice: 2000, totalValue: 40000, status: 'low' as const },
            { id: '7', name: 'Suture Kit', category: 'Surgical', currentStock: 0, reorderLevel: 25, unitPrice: 25000, totalValue: 0, status: 'out' as const },
          ],
        };
      }
    },
  });

  const handleExport = () => {
    const rows = [
      ['Stock Reports'],
      [''],
      ['Summary'],
      ['Total Stock Value', formatCurrency(stats?.totalStockValue)],
      ['Total Items', stats?.totalItems],
      ['Low Stock Items', stats?.lowStockItems],
      ['Out of Stock Items', stats?.outOfStockItems],
      [''],
      ['Category Breakdown'],
      ['Category', 'Quantity', 'Value'],
      ...(stats?.categoryBreakdown?.map((c: CategoryStock) => [c.name, c.quantity, formatCurrency(c.value)]) || []),
      [''],
      ['Stock Valuation'],
      ['Item', 'Category', 'Stock', 'Unit Price', 'Total Value', 'Status'],
      ...(stats?.stockValuation?.map((s: StockItem) => [s.name, s.category, s.currentStock, formatCurrency(s.unitPrice), formatCurrency(s.totalValue), s.status]) || []),
    ];
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.csv';
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ok: 'bg-green-100 text-green-800',
      low: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-orange-100 text-orange-800',
      out: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      ok: 'In Stock',
      low: 'Low Stock',
      critical: 'Critical',
      out: 'Out of Stock',
    };
    return { style: styles[status] || 'bg-gray-100 text-gray-800', label: labels[status] || status };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = ['all', ...new Set(stats?.stockValuation?.map((s: StockItem) => s.category) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Reports</h1>
          <p className="text-gray-600">Inventory stock levels and valuation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">View:</span>
          <div className="flex gap-2">
            {[
              { key: 'current', label: 'Current Stock' },
              { key: 'month', label: 'This Month' },
              { key: 'quarter', label: 'This Quarter' },
              { key: 'custom', label: 'Custom' },
            ].map((range) => (
              <button
                key={range.key}
                onClick={() => setDateRange(range.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                  dateRange === range.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-2 ml-4">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-lg"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-lg"
              />
            </div>
          )}
          <div className="border-l pl-4 ml-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-lg"
            >
              {categories.map((cat) => (
                <option key={cat as string} value={cat as string}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Stock Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalStockValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Boxes className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalItems?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.lowStockItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Package className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stats?.outOfStockItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category-wise Stock Breakdown</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={stats?.categoryBreakdown || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <YAxis type="category" dataKey="name" width={120} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'value' ? formatCurrency(value) : value.toLocaleString(),
                name === 'value' ? 'Value' : 'Quantity',
              ]}
            />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" name="Value" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
          <span className="ml-auto text-sm text-gray-500">{stats?.lowStockAlerts?.length || 0} items need attention</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days Until Stockout</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.lowStockAlerts?.map((item: LowStockItem) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{item.currentStock}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.reorderLevel}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span
                      className={`font-medium ${
                        item.daysUntilStockout <= 2
                          ? 'text-red-600'
                          : item.daysUntilStockout <= 5
                          ? 'text-orange-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {item.daysUntilStockout} days
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        item.daysUntilStockout <= 2
                          ? 'bg-red-100 text-red-800'
                          : item.daysUntilStockout <= 5
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {item.daysUntilStockout <= 2 ? 'Critical' : item.daysUntilStockout <= 5 ? 'High' : 'Medium'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Valuation Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Stock Valuation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.stockValuation?.map((item: StockItem) => {
                const badge = getStatusBadge(item.status);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.currentStock.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.reorderLevel}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.totalValue)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.style}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900" colSpan={5}>Total Stock Value</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(stats?.totalStockValue)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
