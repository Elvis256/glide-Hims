import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Package,
  DollarSign,
  FileText,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';

export default function ConsumptionReportsPage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'department' | 'items' | 'trends'>('department');
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('Jan 2025');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['consumption-movements', facilityId],
    queryFn: () => storesService.movements.list(),
    staleTime: 60000,
  });

  const { data: inventoryResponse } = useQuery({
    queryKey: ['inventory-consumption', facilityId],
    queryFn: () => storesService.inventory.list({ limit: 100 }),
    staleTime: 60000,
  });

  const outMovements = useMemo(() => movements.filter(m => m.type === 'out'), [movements]);

  const topItems = useMemo(() => {
    const map = new Map<string, { itemId: string; count: number; qty: number }>();
    outMovements.forEach(m => {
      const existing = map.get(m.itemId) || { itemId: m.itemId, count: 0, qty: 0 };
      map.set(m.itemId, { ...existing, count: existing.count + 1, qty: existing.qty + Math.abs(m.quantity) });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [outMovements]);

  const totalConsumption = outMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  const inventoryItems = inventoryResponse?.data || [];

  const filteredRecords = useMemo(() => {
    return outMovements.filter((record) => {
      const matchesSearch = record.itemId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, departmentFilter]);

  const stats = useMemo(() => ({
    totalValue: 0,
    totalBudget: 0,
    overBudget: 0,
    departments: new Set(outMovements.map(m => m.reason?.split(' ')[2] || 'Unknown')).size,
  }), [outMovements]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consumption Reports</h1>
          <p className="text-gray-600">Analyze department consumption and cost trends</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="Jan 2025">January 2025</option>
            <option value="Dec 2024">December 2024</option>
            <option value="Nov 2024">November 2024</option>
            <option value="Q4 2024">Q4 2024</option>
            <option value="2024">Year 2024</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Consumption</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue, { compact: true })}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalBudget, { compact: true })}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Budget Utilization</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalBudget > 0 ? ((stats.totalValue / stats.totalBudget) * 100).toFixed(0) : 0}%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Over Budget</p>
              <p className="text-2xl font-bold text-red-700">{stats.overBudget} Depts</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('department')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'department' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          By Department
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Top Items
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'trends' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Trend Analysis
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items or departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Departments</option>
          <option value="Emergency Department">Emergency Department</option>
          <option value="Surgical Ward">Surgical Ward</option>
          <option value="ICU">ICU</option>
          <option value="Medical Ward">Medical Ward</option>
          <option value="Laboratory">Laboratory</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {isLoading && (
          <div className="flex-1 flex items-center justify-center h-full py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {!isLoading && activeTab === 'department' && (
          <div className="overflow-auto flex-1">
            <div className="flex-1 flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Department Breakdown</p>
                <p className="text-sm">Department-level consumption analytics require extended movement history</p>
              </div>
            </div>
          </div>
        )}

        {!isLoading && activeTab === 'items' && (
          <div className="overflow-auto flex-1">
            {topItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full text-gray-500">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No Consumption Data</p>
                  <p className="text-sm">Items issued from stores will appear here</p>
                </div>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rank</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item ID</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Issues</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Qty Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topItems.map((item, index) => (
                  <tr key={item.itemId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-600">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.itemId}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.count}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{item.qty.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {!isLoading && activeTab === 'trends' && (
          <div className="overflow-auto flex-1">
            {filteredRecords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full text-gray-500">
                <div className="text-center py-12">
                  <FileText className="w-16 h-16mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No Movement Records</p>
                  <p className="text-sm">Stock issue records will appear here</p>
                </div>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reference</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-blue-600 text-sm">{record.reference || record.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-900">{record.itemId}</td>
                    <td className="px-4 py-3 text-red-600">{Math.abs(record.quantity)}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{record.reason || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{new Date(record.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'department' && 'Department breakdown requires movement history data'}
          {activeTab === 'items' && `Top ${topItems.length} consuming items from ${outMovements.length} issue records`}
          {activeTab === 'trends' && `${filteredRecords.length} issue records | Total qty issued: ${totalConsumption}`}
        </div>
      </div>
    </div>
  );
}
