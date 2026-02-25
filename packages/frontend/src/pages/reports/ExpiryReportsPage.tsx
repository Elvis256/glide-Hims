import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Download,
  Printer,
  Calendar,
  Clock,
  AlertCircle,
  AlertOctagon,
  Package,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

interface ExpiryItem {
  id: string;
  name: string;
  category: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  daysUntilExpiry: number;
  status: 'expired' | 'expiring_30' | 'expiring_60' | 'expiring_90';
}

interface ExpirySummary {
  range: string;
  count: number;
  value: number;
  color: string;
}

export default function ExpiryReportsPage() {
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['expiry-reports', dateRange, selectedCategory, statusFilter],
    queryFn: async () => {
      try {
        // Fetch inventory with expiry information
        const response = await api.get('/inventory', {
          params: { limit: 200, expiringWithin: 90 },
        });
        
        const inventory = response.data?.data || response.data || [];
        const today = new Date();
        
        // Track expiry statistics
        let expiredCount = 0;
        let expiredValue = 0;
        let expiring30Count = 0;
        let expiring30Value = 0;
        let expiring60Count = 0;
        let expiring60Value = 0;
        let expiring90Count = 0;
        let expiring90Value = 0;
        
        const expiryItems: ExpiryItem[] = [];
        
        inventory.forEach((item: {
          id: string;
          name: string;
          category?: string;
          batchNumber?: string;
          batch_number?: string;
          expiryDate?: string;
          expiry_date?: string;
          quantity?: number;
          currentStock?: number;
          unitPrice?: number;
          unit_price?: number;
          price?: number;
        }) => {
          const expiryDateStr = item.expiryDate || item.expiry_date;
          if (!expiryDateStr) return;
          
          const expiryDate = new Date(expiryDateStr);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const quantity = item.quantity || item.currentStock || 0;
          const unitPrice = item.unitPrice || item.unit_price || item.price || 0;
          const totalValue = quantity * unitPrice;
          
          // Determine status
          let status: 'expired' | 'expiring_30' | 'expiring_60' | 'expiring_90';
          if (daysUntilExpiry < 0) {
            status = 'expired';
            expiredCount++;
            expiredValue += totalValue;
          } else if (daysUntilExpiry <= 30) {
            status = 'expiring_30';
            expiring30Count++;
            expiring30Value += totalValue;
          } else if (daysUntilExpiry <= 60) {
            status = 'expiring_60';
            expiring60Count++;
            expiring60Value += totalValue;
          } else {
            status = 'expiring_90';
            expiring90Count++;
            expiring90Value += totalValue;
          }
          
          expiryItems.push({
            id: item.id,
            name: item.name || 'Unknown Item',
            category: item.category || 'Other',
            batchNumber: item.batchNumber || item.batch_number || '-',
            expiryDate: expiryDateStr,
            quantity,
            unitPrice,
            totalValue,
            daysUntilExpiry,
            status,
          });
        });
        
        // Sort by days until expiry (most urgent first)
        expiryItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
        
        const totalAtRisk = expiredValue + expiring30Value + expiring60Value + expiring90Value;
        
        return {
          expiredCount,
          expiredValue,
          expiring30Count,
          expiring30Value,
          expiring60Count,
          expiring60Value,
          expiring90Count,
          expiring90Value,
          totalAtRisk,
          summaryByRange: [
            { range: 'Expired', count: expiredCount, value: expiredValue, color: '#EF4444' },
            { range: '0-30 Days', count: expiring30Count, value: expiring30Value, color: '#F97316' },
            { range: '31-60 Days', count: expiring60Count, value: expiring60Value, color: '#EAB308' },
            { range: '61-90 Days', count: expiring90Count, value: expiring90Value, color: '#22C55E' },
          ],
          expiryItems,
        };
      } catch (error) {
        throw error;
      }
    },
  });

  const handleExport = () => {
    const rows = [
      ['Expiry Reports'],
      [''],
      ['Summary'],
      ['Status', 'Count', 'Value'],
      ['Expired', stats?.expiredCount, formatCurrency(stats?.expiredValue)],
      ['Expiring in 30 days', stats?.expiring30Count, formatCurrency(stats?.expiring30Value)],
      ['Expiring in 60 days', stats?.expiring60Count, formatCurrency(stats?.expiring60Value)],
      ['Expiring in 90 days', stats?.expiring90Count, formatCurrency(stats?.expiring90Value)],
      ['Total At Risk', '', formatCurrency(stats?.totalAtRisk)],
      [''],
      ['Expiry Items'],
      ['Item', 'Category', 'Batch', 'Expiry Date', 'Quantity', 'Unit Price', 'Total Value', 'Days Until Expiry', 'Status'],
      ...(stats?.expiryItems?.map((item: ExpiryItem) => [
        item.name,
        item.category,
        item.batchNumber,
        item.expiryDate,
        item.quantity,
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalValue),
        item.daysUntilExpiry,
        item.status,
      ]) || []),
    ];
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expiry-report.csv';
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Expired' };
      case 'expiring_30':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', label: 'Expiring in 30 days' };
      case 'expiring_60':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', label: 'Expiring in 60 days' };
      case 'expiring_90':
        return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Expiring in 90 days' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', label: status };
    }
  };

  const getRowClass = (status: string) => {
    switch (status) {
      case 'expired':
        return 'bg-red-50 hover:bg-red-100';
      case 'expiring_30':
        return 'bg-orange-50 hover:bg-orange-100';
      case 'expiring_60':
        return 'bg-yellow-50 hover:bg-yellow-100';
      default:
        return 'hover:bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = ['all', ...new Set(stats?.expiryItems?.map((s: ExpiryItem) => s.category) || [])];

  const filteredItems = stats?.expiryItems?.filter((item: ExpiryItem) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expiry Reports</h1>
          <p className="text-gray-600">Items nearing or past expiry date</p>
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
          <span className="text-sm font-medium text-gray-700">Period:</span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
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
          <div className="border-l pl-4 ml-2 flex gap-2">
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="expired">Expired</option>
              <option value="expiring_30">Expiring in 30 days</option>
              <option value="expiring_60">Expiring in 60 days</option>
              <option value="expiring_90">Expiring in 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertOctagon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-700">Expired</p>
              <p className="text-2xl font-bold text-red-900">{stats?.expiredCount}</p>
              <p className="text-sm text-red-600">{formatCurrency(stats?.expiredValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-orange-700">Expiring in 30 days</p>
              <p className="text-2xl font-bold text-orange-900">{stats?.expiring30Count}</p>
              <p className="text-sm text-orange-600">{formatCurrency(stats?.expiring30Value)}</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-yellow-700">Expiring in 60 days</p>
              <p className="text-2xl font-bold text-yellow-900">{stats?.expiring60Count}</p>
              <p className="text-sm text-yellow-600">{formatCurrency(stats?.expiring60Value)}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-700">Expiring in 90 days</p>
              <p className="text-2xl font-bold text-green-900">{stats?.expiring90Count}</p>
              <p className="text-sm text-green-600">{formatCurrency(stats?.expiring90Value)}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-700">Value at Risk</p>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats?.totalAtRisk)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Value at Risk Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Value at Risk by Expiry Range</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats?.summaryByRange || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => [
                name === 'value' ? formatCurrency(value ?? 0) : (value ?? 0),
                name === 'value' ? 'Value' : 'Count',
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {stats?.summaryByRange?.map((entry: ExpirySummary, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expiry Alerts Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">Expiry Alerts</h3>
          <span className="ml-auto text-sm text-gray-500">{filteredItems?.length || 0} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems?.map((item: ExpiryItem) => {
                const statusStyle = getStatusColor(item.status);
                return (
                  <tr key={item.id} className={getRowClass(item.status)}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{item.batchNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.expiryDate}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.quantity.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.totalValue)}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span
                        className={`font-medium ${
                          item.daysUntilExpiry < 0
                            ? 'text-red-600'
                            : item.daysUntilExpiry <= 30
                            ? 'text-orange-600'
                            : item.daysUntilExpiry <= 60
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {item.daysUntilExpiry < 0 ? `${Math.abs(item.daysUntilExpiry)} ago` : item.daysUntilExpiry}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900" colSpan={6}>Total Value at Risk</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(stats?.totalAtRisk)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Color Legend</h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-gray-600">Expired (needs disposal)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500"></div>
            <span className="text-sm text-gray-600">Expiring in 30 days (urgent)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500"></div>
            <span className="text-sm text-gray-600">Expiring in 60 days (attention needed)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm text-gray-600">Expiring in 90 days (monitor)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
