import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Search,
  Filter,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Building2,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  FileText,
  PieChart,
} from 'lucide-react';

interface ConsumptionRecord {
  id: string;
  department: string;
  itemName: string;
  itemSku: string;
  category: string;
  quantity: number;
  unit: string;
  value: number;
  period: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface DepartmentSummary {
  id: string;
  department: string;
  totalItems: number;
  totalValue: number;
  budget: number;
  variance: number;
  topItem: string;
  trend: 'up' | 'down' | 'stable';
}

interface TopConsumingItem {
  id: string;
  name: string;
  sku: string;
  totalQuantity: number;
  unit: string;
  totalValue: number;
  departments: string[];
}

const mockConsumptionRecords: ConsumptionRecord[] = [
  { id: '1', department: 'Emergency Department', itemName: 'Surgical Gloves (Medium)', itemSku: 'MS-001', category: 'Medical Supplies', quantity: 500, unit: 'Pairs', value: 25000, period: 'Jan 2025', trend: 'up', trendPercentage: 12 },
  { id: '2', department: 'Surgical Ward', itemName: 'IV Cannula 22G', itemSku: 'MS-002', category: 'Medical Supplies', quantity: 350, unit: 'Pieces', value: 28000, period: 'Jan 2025', trend: 'stable', trendPercentage: 2 },
  { id: '3', department: 'ICU', itemName: 'Oxygen Mask Adult', itemSku: 'CO-001', category: 'Consumables', quantity: 200, unit: 'Pieces', value: 18000, period: 'Jan 2025', trend: 'up', trendPercentage: 8 },
  { id: '4', department: 'Medical Ward', itemName: 'Sterile Gauze Pads', itemSku: 'CO-101', category: 'Consumables', quantity: 600, unit: 'Packs', value: 30000, period: 'Jan 2025', trend: 'down', trendPercentage: -5 },
  { id: '5', department: 'Laboratory', itemName: 'Syringes 10ml', itemSku: 'MS-004', category: 'Medical Supplies', quantity: 800, unit: 'Pieces', value: 12000, period: 'Jan 2025', trend: 'stable', trendPercentage: 1 },
  { id: '6', department: 'Pediatrics', itemName: 'Bandage Rolls', itemSku: 'MS-006', category: 'Medical Supplies', quantity: 150, unit: 'Rolls', value: 4500, period: 'Jan 2025', trend: 'down', trendPercentage: -10 },
];

const mockDepartmentSummary: DepartmentSummary[] = [
  { id: '1', department: 'Emergency Department', totalItems: 45, totalValue: 285000, budget: 300000, variance: 15000, topItem: 'Surgical Gloves', trend: 'up' },
  { id: '2', department: 'Surgical Ward', totalItems: 52, totalValue: 420000, budget: 400000, variance: -20000, topItem: 'Suture Kits', trend: 'up' },
  { id: '3', department: 'ICU', totalItems: 38, totalValue: 380000, budget: 450000, variance: 70000, topItem: 'Oxygen Supplies', trend: 'stable' },
  { id: '4', department: 'Medical Ward', totalItems: 60, totalValue: 195000, budget: 200000, variance: 5000, topItem: 'Gauze Pads', trend: 'down' },
  { id: '5', department: 'Laboratory', totalItems: 35, totalValue: 165000, budget: 180000, variance: 15000, topItem: 'Syringes', trend: 'stable' },
  { id: '6', department: 'Radiology', totalItems: 18, totalValue: 95000, budget: 100000, variance: 5000, topItem: 'Contrast Media', trend: 'down' },
];

const mockTopItems: TopConsumingItem[] = [
  { id: '1', name: 'Surgical Gloves (Medium)', sku: 'MS-001', totalQuantity: 2500, unit: 'Pairs', totalValue: 125000, departments: ['Emergency', 'Surgical', 'ICU'] },
  { id: '2', name: 'IV Cannula 22G', sku: 'MS-002', totalQuantity: 1800, unit: 'Pieces', totalValue: 144000, departments: ['All Departments'] },
  { id: '3', name: 'Syringes 10ml', sku: 'MS-004', totalQuantity: 3500, unit: 'Pieces', totalValue: 52500, departments: ['Laboratory', 'Medical Ward'] },
  { id: '4', name: 'Sterile Gauze Pads', sku: 'CO-101', totalQuantity: 2000, unit: 'Packs', totalValue: 100000, departments: ['Surgical', 'Emergency'] },
  { id: '5', name: 'Oxygen Mask Adult', sku: 'CO-001', totalQuantity: 800, unit: 'Pieces', totalValue: 72000, departments: ['ICU', 'Emergency'] },
];

export default function ConsumptionReportsPage() {
  const [activeTab, setActiveTab] = useState<'department' | 'items' | 'trends'>('department');
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('Jan 2025');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const filteredRecords = useMemo(() => {
    return mockConsumptionRecords.filter((record) => {
      const matchesSearch = 
        record.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = departmentFilter === 'all' || record.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [searchTerm, departmentFilter]);

  const stats = useMemo(() => ({
    totalValue: mockDepartmentSummary.reduce((sum, d) => sum + d.totalValue, 0),
    totalBudget: mockDepartmentSummary.reduce((sum, d) => sum + d.budget, 0),
    overBudget: mockDepartmentSummary.filter((d) => d.variance < 0).length,
    departments: mockDepartmentSummary.length,
  }), []);

  const getTrendIcon = (trend: string, percentage: number) => {
    if (trend === 'up') {
      return (
        <span className="flex items-center gap-1 text-red-600 text-sm">
          <ArrowUpRight className="w-4 h-4" />
          {Math.abs(percentage)}%
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="flex items-center gap-1 text-green-600 text-sm">
          <ArrowDownRight className="w-4 h-4" />
          {Math.abs(percentage)}%
        </span>
      );
    }
    return <span className="text-gray-500 text-sm">~{percentage}%</span>;
  };

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
              <p className="text-2xl font-bold text-gray-900">KES {(stats.totalValue / 1000000).toFixed(2)}M</p>
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
              <p className="text-2xl font-bold text-gray-900">KES {(stats.totalBudget / 1000000).toFixed(2)}M</p>
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
              <p className="text-2xl font-bold text-purple-600">{((stats.totalValue / stats.totalBudget) * 100).toFixed(0)}%</p>
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
        {activeTab === 'department' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items Consumed</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Budget</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Variance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Top Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Trend</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockDepartmentSummary.map((dept) => (
                  <tr key={dept.id} className={`hover:bg-gray-50 ${dept.variance < 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{dept.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dept.totalItems}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      KES {dept.totalValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      KES {dept.budget.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${dept.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dept.variance >= 0 ? '+' : ''}KES {dept.variance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dept.topItem}</td>
                    <td className="px-4 py-3">
                      {dept.trend === 'up' && (
                        <span className="flex items-center gap-1 text-red-600">
                          <TrendingUp className="w-4 h-4" />
                          Increasing
                        </span>
                      )}
                      {dept.trend === 'down' && (
                        <span className="flex items-center gap-1 text-green-600">
                          <TrendingDown className="w-4 h-4" />
                          Decreasing
                        </span>
                      )}
                      {dept.trend === 'stable' && (
                        <span className="text-gray-500">Stable</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Quantity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Consuming Departments</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockTopItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{item.totalQuantity.toLocaleString()}</span>
                      <span className="text-gray-500 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      KES {item.totalValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.departments.map((dept) => (
                          <span key={dept} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {dept}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Breakdown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{record.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{record.itemName}</p>
                        <p className="text-sm text-gray-500">SKU: {record.itemSku}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {record.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {record.quantity} {record.unit}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      KES {record.value.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {getTrendIcon(record.trend, record.trendPercentage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'department' && `${mockDepartmentSummary.length} departments analyzed`}
          {activeTab === 'items' && `Top ${mockTopItems.length} consuming items`}
          {activeTab === 'trends' && `${filteredRecords.length} consumption records`}
        </div>
      </div>
    </div>
  );
}
