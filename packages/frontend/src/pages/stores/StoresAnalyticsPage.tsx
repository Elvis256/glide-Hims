import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  RotateCw,
  Clock,
  Target,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Percent,
} from 'lucide-react';

interface InventoryMetric {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ElementType;
  color: string;
}

interface DepartmentUsage {
  department: string;
  issued: number;
  value: number;
  percentOfTotal: number;
  trend: 'up' | 'down' | 'stable';
}

interface TurnoverItem {
  name: string;
  sku: string;
  turnoverRate: number;
  avgDaysInStock: number;
  status: 'fast' | 'normal' | 'slow' | 'dead';
}

interface EfficiencyMetric {
  metric: string;
  current: number;
  target: number;
  unit: string;
  status: 'good' | 'warning' | 'poor';
}

const departmentUsage: DepartmentUsage[] = [];

const turnoverItems: TurnoverItem[] = [];

const efficiencyMetrics: EfficiencyMetric[] = [];

export default function StoresAnalyticsPage() {
  const [periodFilter, setPeriodFilter] = useState('Jan 2025');
  const [activeSection, setActiveSection] = useState<'overview' | 'turnover' | 'efficiency'>('overview');

  const metrics: InventoryMetric[] = [
    { label: 'Inventory Turnover', value: '0x', subValue: 'Annual', trend: 'stable', trendValue: '0', icon: RotateCw, color: 'blue' },
    { label: 'Carrying Cost', value: 'KES 0', subValue: 'Monthly', trend: 'stable', trendValue: '0%', icon: DollarSign, color: 'green' },
    { label: 'Stock Accuracy', value: '0%', subValue: 'Last Count', trend: 'stable', trendValue: '0%', icon: Target, color: 'purple' },
    { label: 'Dead Stock', value: 'KES 0', subValue: '0 items', trend: 'stable', trendValue: '0%', icon: Package, color: 'orange' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fast': return 'bg-green-100 text-green-700';
      case 'normal': return 'bg-blue-100 text-blue-700';
      case 'slow': return 'bg-yellow-100 text-yellow-700';
      case 'dead': return 'bg-red-100 text-red-700';
      case 'good': return 'bg-green-100 text-green-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      case 'poor': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    } else if (trend === 'down') {
      return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

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
                <h3 className="font-semibold text-gray-900">Department-wise Usage</h3>
                <p className="text-sm text-gray-500">Consumption by department for {periodFilter}</p>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items Issued</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value (KES)</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">% of Total</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {departmentUsage.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="font-medium">No usage data available</p>
                          <p className="text-sm">Department usage data will appear here</p>
                        </td>
                      </tr>
                    ) : (
                      departmentUsage.map((dept) => (
                        <tr key={dept.department} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{dept.department}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{dept.issued.toLocaleString()}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{dept.value.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${dept.percentOfTotal}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{dept.percentOfTotal}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {getTrendIcon(dept.trend)}
                              <span className={`text-sm ${
                                dept.trend === 'up' ? 'text-green-600' : 
                                dept.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {dept.trend === 'up' ? 'Increasing' : dept.trend === 'down' ? 'Decreasing' : 'Stable'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'turnover' && (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Inventory Turnover Analysis</h3>
                <p className="text-sm text-gray-500">Item movement velocity and stock duration</p>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Turnover Rate</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Avg Days in Stock</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Velocity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {turnoverItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          <RotateCw className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p className="font-medium">No turnover data available</p>
                          <p className="text-sm">Inventory turnover data will appear here</p>
                        </td>
                      </tr>
                    ) : (
                      turnoverItems.map((item) => (
                        <tr key={item.sku} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{item.turnoverRate}x</span>
                            <span className="text-sm text-gray-500">/year</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.avgDaysInStock} days</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(item.status)}`}>
                              {item.status === 'fast' ? 'Fast Moving' :
                               item.status === 'normal' ? 'Normal' :
                               item.status === 'slow' ? 'Slow Moving' : 'Dead Stock'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'efficiency' && (
            <>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Procurement Efficiency Metrics</h3>
                <p className="text-sm text-gray-500">Key performance indicators vs targets</p>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {efficiencyMetrics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Target className="w-12 h-12 text-gray-300 mb-2" />
                    <p className="font-medium">No efficiency data available</p>
                    <p className="text-sm">Procurement efficiency metrics will appear here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {efficiencyMetrics.map((metric) => (
                      <div key={metric.metric} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{metric.metric}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(metric.status)}`}>
                            {metric.status === 'good' ? 'On Target' : metric.status === 'warning' ? 'Near Target' : 'Off Target'}
                          </span>
                        </div>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-2xl font-bold text-gray-900">{metric.current}</span>
                          <span className="text-gray-500">{metric.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                metric.status === 'good' ? 'bg-green-500' :
                                metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, (metric.current / metric.target) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">Target: {metric.target}{metric.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Medical Supplies</span>
                  <span className="font-medium">0%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Equipment</span>
                  <span className="font-medium">0%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Consumables</span>
                  <span className="font-medium">0%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
              </div>
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
                  0 items below reorder point
                </div>
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                  0 items expiring in 30 days
                </div>
                <div className="flex items-center gap-2 text-yellow-800">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                  0 pending stock adjustments
                </div>
              </div>
            </div>

            {/* Recent Performance */}
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">Performance Highlights</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-800">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  No performance data yet
                </div>
              </div>
            </div>

            {/* Cost Savings */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Cost Savings (MTD)</span>
              </div>
              <p className="text-3xl font-bold text-green-600">KES 0</p>
              <p className="text-sm text-gray-500 mt-1">Through optimized procurement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
