import { useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
  ChevronDown,
  FileJson,
  FileText,
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
import { printService } from '../../lib/print';
import { asList } from '../../utils/unwrapResponse';
import { useFacilityId } from '../../lib/facility';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { num, toCsv, downloadBlob } from './_reportUtils';

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
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const onClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showExportMenu]);

  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['expiry-reports', facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      try {
        // Fetch inventory with expiry information
        const response = await api.get(`/inventory/expiring/${facilityId}`, {
          params: { days: 90 },
        });
        
        const inventory = asList(response.data);
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
          // Backend may return camelCase or snake_case depending on query type
          const expiryDateStr = item.expiryDate || item.expiry_date;
          if (!expiryDateStr) return;
          
          const expiryDate = new Date(expiryDateStr);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const quantity = num(item.quantity) || num(item.currentStock);
          const unitPrice = num(item.unitPrice) || num(item.unit_price) || num(item.price);
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

  const buildCsv = (): string => {
    const rows: Array<Array<unknown>> = [];
    rows.push(['Expiry Report']);
    rows.push(['Facility', inst?.name ?? '']);
    rows.push(['Generated', new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Status', 'Count', 'Value']);
    rows.push(['Expired', stats?.expiredCount ?? 0, stats?.expiredValue ?? 0]);
    rows.push(['Expiring in 30 days', stats?.expiring30Count ?? 0, stats?.expiring30Value ?? 0]);
    rows.push(['Expiring in 60 days', stats?.expiring60Count ?? 0, stats?.expiring60Value ?? 0]);
    rows.push(['Expiring in 90 days', stats?.expiring90Count ?? 0, stats?.expiring90Value ?? 0]);
    rows.push(['Total At Risk', '', stats?.totalAtRisk ?? 0]);
    rows.push([]);
    rows.push(['Expiry Items']);
    rows.push(['Item', 'Category', 'Batch', 'Expiry Date', 'Quantity', 'Unit Price', 'Total Value', 'Days Until Expiry', 'Status']);
    (stats?.expiryItems ?? []).forEach((item: ExpiryItem) =>
      rows.push([item.name, item.category, item.batchNumber, item.expiryDate, item.quantity, item.unitPrice, item.totalValue, item.daysUntilExpiry, item.status]),
    );
    return toCsv(rows);
  };

  const handleExportCsv = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`expiry-report-${stamp}.csv`, 'text/csv;charset=utf-8', '\ufeff' + buildCsv());
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      report: 'Expiry Report',
      facility: inst?.name ?? null,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(`expiry-report-${stamp}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const fmt = (v: number) => formatCurrency(v);

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Expiry Report</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Status</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Count</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Value at Risk</th>
        </tr></thead>
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Expired</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.expiredCount}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.expiredValue)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Expiring in 30 days</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.expiring30Count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.expiring30Value)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Expiring in 60 days</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.expiring60Count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.expiring60Value)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Expiring in 90 days</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.expiring90Count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.expiring90Value)}</td></tr>
          <tr style="background:#f8fafc;font-weight:600;">
            <td style="border:1px solid #e2e8f0;padding:6px;">Total At Risk</td>
            <td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.expiredCount + stats.expiring30Count + stats.expiring60Count + stats.expiring90Count}</td>
            <td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.totalAtRisk)}</td>
          </tr>
        </tbody>
      </table>`;

    const items = stats.expiryItems ?? [];
    const itemsTable = items.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Expiry Items</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Item</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Category</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Batch</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Expiry Date</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Qty</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Value</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Days</th>
        </tr></thead>
        <tbody>
          ${items.map((it: ExpiryItem) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:5px;">${it.name}</td><td style="border:1px solid #e2e8f0;padding:5px;">${it.category}</td><td style="border:1px solid #e2e8f0;padding:5px;">${it.batchNumber}</td><td style="border:1px solid #e2e8f0;padding:5px;">${new Date(it.expiryDate).toLocaleDateString()}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${it.quantity}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${fmt(it.totalValue)}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${it.daysUntilExpiry}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    printService.printDocument(header + summaryTable + itemsTable + footer, {
      title: 'Expiry Report',
    });
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

  if (!facilityId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-gray-900">Select a facility</p>
          <p className="mt-2 text-sm text-gray-500">Pick a facility from the top bar to view this report.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-100 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
        <div className="h-80 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const categories = ['all', ...new Set(stats?.expiryItems?.map((s: ExpiryItem) => s.category) || [])];

  const filteredItems = stats?.expiryItems?.filter((item: ExpiryItem) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    // Filter by expiry horizon based on date range selection
    if (dateRange === 'month' && item.daysUntilExpiry > 30) return false;
    if (dateRange === 'quarter' && item.daysUntilExpiry > 90) return false;
    return true;
  });

  return (
    <div id="report-content" className="space-y-6">
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
        <div className="flex gap-2 items-center">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button onClick={handleExportCsv} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export as CSV
                </button>
                <button onClick={handleExportJson} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileJson className="h-4 w-4" /> Export as JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Expiry Horizon:</span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All Items' },
              { key: 'month', label: 'Within 30 Days' },
              { key: 'quarter', label: 'Within 90 Days' },
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
