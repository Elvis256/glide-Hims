import { useEffect, useMemo, useRef, useState } from 'react';
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
  Legend,
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { asList } from '../../utils/unwrapResponse';
import { num, toCsv, downloadBlob } from './_reportUtils';

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
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [selectedCategory, setSelectedCategory] = useState('all');
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
    queryKey: ['stock-reports', selectedCategory, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      try {
        const response = await api.get('/stores/inventory', {
          params: { limit: 200 },
        });
        
        const inventory = asList(response.data);

        // Extract all categories before filtering (for the dropdown)
        const allCategories = [...new Set(inventory.map((item: { category?: string }) => item.category || 'Other'))] as string[];

        // Apply category filter
        const filteredInventory = selectedCategory === 'all'
          ? inventory
          : inventory.filter((item: { category?: string; itemCategory?: { name?: string } }) => {
              const cat = item.category || 'Other';
              return cat === selectedCategory || item.itemCategory?.name === selectedCategory;
            });
        
        // Calculate stock statistics
        let totalStockValue = 0;
        let lowStockItems = 0;
        let outOfStockItems = 0;
        const categoryMap: Record<string, { quantity: number; value: number }> = {};
        const lowStockAlerts: LowStockItem[] = [];
        const stockValuation: StockItem[] = [];
        
        filteredInventory.forEach((item: { 
          id: string;
          name: string;
          category?: string;
          itemCategory?: { name?: string };
          currentStock?: number;
          minStock?: number;
          unitCost?: number;
          sellingPrice?: number;
          avgDailyConsumption?: number;
        }) => {
          const currentStock = num(item.currentStock);
          const reorderLevel = num(item.minStock) || 10;
          // Use cost price for inventory valuation (GAAP/IFRS)
          const unitPrice = num(item.unitCost) || num(item.sellingPrice);
          const totalValue = currentStock * unitPrice;
          const category = item.category || 'Other';
          
          totalStockValue += totalValue;
          
          // Track categories
          if (!categoryMap[category]) {
            categoryMap[category] = { quantity: 0, value: 0 };
          }
          categoryMap[category].quantity += currentStock;
          categoryMap[category].value += totalValue;
          
          // Determine status
          let status: 'ok' | 'low' | 'critical' | 'out' = 'ok';
          if (currentStock === 0) {
            status = 'out';
            outOfStockItems++;
          } else if (currentStock < reorderLevel * 0.5) {
            status = 'critical';
            lowStockItems++;
          } else if (currentStock < reorderLevel) {
            status = 'low';
            lowStockItems++;
          }
          
          // Add to stock valuation list
          stockValuation.push({
            id: item.id,
            name: item.name || 'Unknown Item',
            category,
            currentStock,
            reorderLevel,
            unitPrice,
            totalValue,
            status,
          });
          
          // Add low stock alerts
          if (status !== 'ok') {
            // Estimated from reorder level. TODO: Use actual consumption data from /inventory/consumption
            const avgDailyUsage = num(item.avgDailyConsumption) || Math.max(1, Math.round(reorderLevel / 30));
            const daysUntilStockout = currentStock > 0 ? Math.ceil(currentStock / avgDailyUsage) : 0;
            lowStockAlerts.push({
              id: item.id,
              name: item.name || 'Unknown Item',
              category,
              currentStock,
              reorderLevel,
              daysUntilStockout,
            });
          }
        });
        
        // Transform category breakdown
        const categoryBreakdown: CategoryStock[] = Object.entries(categoryMap).map(([name, data]) => ({
          name,
          quantity: data.quantity,
          value: data.value,
        }));
        
        // Sort low stock alerts by urgency
        lowStockAlerts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
        
        // Sort stock valuation by value
        stockValuation.sort((a, b) => b.totalValue - a.totalValue);
        
        return {
          totalStockValue,
          totalItems: filteredInventory.length,
          lowStockItems,
          outOfStockItems,
          categoryBreakdown,
          lowStockAlerts: lowStockAlerts.slice(0, 10),
          stockValuation: stockValuation.slice(0, 20),
          allCategories,
        };
      } catch (error) {
        throw error;
      }
    },
});

  const generatedAt = useMemo(() => new Date(), [stats]);

  const buildCsv = (): string => {
    const rows: Array<Array<unknown>> = [];
    rows.push(['Stock Report']);
    rows.push(['Facility', inst?.name ?? '']);
    rows.push(['Category', selectedCategory === 'all' ? 'All Categories' : selectedCategory]);
    rows.push(['Generated', generatedAt.toLocaleString()]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Stock Value', stats?.totalStockValue ?? 0]);
    rows.push(['Total Items', stats?.totalItems ?? 0]);
    rows.push(['Low Stock Items', stats?.lowStockItems ?? 0]);
    rows.push(['Out of Stock Items', stats?.outOfStockItems ?? 0]);
    rows.push([]);
    rows.push(['Category Breakdown']);
    rows.push(['Category', 'Quantity', 'Value']);
    (stats?.categoryBreakdown ?? []).forEach((c: CategoryStock) =>
      rows.push([c.name, c.quantity, c.value]),
    );
    rows.push([]);
    rows.push(['Low Stock Alerts']);
    rows.push(['Item', 'Category', 'Current Stock', 'Reorder Level', 'Days Until Stockout']);
    (stats?.lowStockAlerts ?? []).forEach((a: LowStockItem) =>
      rows.push([a.name, a.category, a.currentStock, a.reorderLevel, a.daysUntilStockout]),
    );
    rows.push([]);
    rows.push(['Stock Valuation (Top 20)']);
    rows.push(['Item', 'Category', 'Stock', 'Reorder Level', 'Unit Price', 'Total Value', 'Status']);
    (stats?.stockValuation ?? []).forEach((s: StockItem) =>
      rows.push([s.name, s.category, s.currentStock, s.reorderLevel, s.unitPrice, s.totalValue, s.status]),
    );
    return toCsv(rows);
  };

  const handleExportCsv = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`stock-report-${stamp}.csv`, 'text/csv;charset=utf-8', '\ufeff' + buildCsv());
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      report: 'Stock Report',
      facility: inst?.name ?? null,
      category: selectedCategory === 'all' ? 'All Categories' : selectedCategory,
      generatedAt: generatedAt.toISOString(),
      ...stats,
    };
    downloadBlob(`stock-report-${stamp}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const fmt = (v: number) => formatCurrency(v);

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Stock Report — ${selectedCategory === 'all' ? 'All Categories' : selectedCategory}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Stock Value</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.totalStockValue)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Total Items</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.totalItems.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Low Stock Items</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.lowStockItems}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Out of Stock</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.outOfStockItems}</td></tr>
        </tbody>
      </table>`;

    const catRows = stats.categoryBreakdown ?? [];
    const catTable = catRows.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Category Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Category</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Quantity</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Value</th>
        </tr></thead>
        <tbody>
          ${catRows.map((c: CategoryStock) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${c.name}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${c.quantity.toLocaleString()}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(c.value)}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    const alertRows = stats.lowStockAlerts ?? [];
    const alertTable = alertRows.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Low Stock Alerts</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Item</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Category</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Stock</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Reorder</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Days Left</th>
        </tr></thead>
        <tbody>
          ${alertRows.map((a: LowStockItem) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:5px;">${a.name}</td><td style="border:1px solid #e2e8f0;padding:5px;">${a.category}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${a.currentStock}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${a.reorderLevel}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${a.daysUntilStockout}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    const valRows = stats.stockValuation ?? [];
    const valTable = valRows.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Stock Valuation (Top 20)</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Item</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Category</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Stock</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Unit Price</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Total Value</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Status</th>
        </tr></thead>
        <tbody>
          ${valRows.map((s: StockItem) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:5px;">${s.name}</td><td style="border:1px solid #e2e8f0;padding:5px;">${s.category}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${s.currentStock.toLocaleString()}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${fmt(s.unitPrice)}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${fmt(s.totalValue)}</td><td style="border:1px solid #e2e8f0;padding:5px;">${s.status}</td></tr>`,
          ).join('')}
          <tr style="background:#f8fafc;font-weight:600;">
            <td style="border:1px solid #e2e8f0;padding:5px;" colspan="4">Total Stock Value</td>
            <td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${fmt(stats.totalStockValue)}</td>
            <td style="border:1px solid #e2e8f0;padding:5px;"></td>
          </tr>
        </tbody>
      </table>` : '';

    printService.printDocument(header + summaryTable + catTable + alertTable + valTable + footer, {
      title: `Stock Report — ${selectedCategory === 'all' ? 'All Categories' : selectedCategory}`,
    });
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
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-100 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
        <div className="h-80 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const categories = ['all', ...(stats?.allCategories || [])];

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
          <h1 className="text-2xl font-bold text-gray-900">Stock Reports</h1>
          <p className="text-gray-600">Inventory stock levels and valuation</p>
        </div>
        <div className="flex gap-2">
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
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleExportCsv}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-gray-500" />
                  CSV (.csv)
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-gray-50"
                >
                  <FileJson className="h-4 w-4 text-gray-500" />
                  JSON (.json)
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
          <span className="text-sm font-medium text-gray-700">View:</span>
          <span className="px-3 py-1.5 text-sm rounded-lg font-medium bg-blue-100 text-blue-700">
            Current Stock
          </span>
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
          <span className="ml-auto text-xs text-gray-500">
            {stats?.totalItems ?? 0} items · {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
          </span>
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
              formatter={(value: number | undefined, name: string | undefined) => [
                name === 'value' ? formatCurrency(value ?? 0) : (value ?? 0).toLocaleString(),
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
