import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Pill,
  AlertTriangle,
  Clock,
  BarChart3,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  Target,
} from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface SalesData {
  period: string;
  revenue: number;
  prescriptions: number;
}

interface TopMedication {
  name: string;
  quantity: number;
  revenue: number;
  trend: 'up' | 'down' | 'stable';
}

interface CategoryRevenue {
  category: string;
  revenue: number;
  percentage: number;
  color: string;
}

const mockSalesData: SalesData[] = [];

const mockTopMedications: TopMedication[] = [];

const mockCategoryRevenue: CategoryRevenue[] = [];

export default function PharmacyAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const dashboardStats = useMemo(() => ({
    totalRevenue: 0,
    revenueChange: 0,
    prescriptionsFilled: 0,
    prescriptionsChange: 0,
    avgDispenseTime: 0,
    timeChange: 0,
    stockValue: 0,
    expiredCost: 0,
  }), []);

  const maxRevenue = Math.max(...mockSalesData.map((d) => d.revenue));

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Analytics</h1>
          <p className="text-gray-600">Sales performance and inventory insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${dashboardStats.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboardStats.revenueChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(dashboardStats.revenueChange)}%
            </div>
          </div>
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">KES {dashboardStats.totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Pill className="w-5 h-5 text-blue-600" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${dashboardStats.prescriptionsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboardStats.prescriptionsChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(dashboardStats.prescriptionsChange)}%
            </div>
          </div>
          <p className="text-sm text-gray-600">Prescriptions Filled</p>
          <p className="text-2xl font-bold text-gray-900">{dashboardStats.prescriptionsFilled}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${dashboardStats.timeChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboardStats.timeChange <= 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              {Math.abs(dashboardStats.timeChange)}%
            </div>
          </div>
          <p className="text-sm text-gray-600">Avg Dispense Time</p>
          <p className="text-2xl font-bold text-gray-900">{dashboardStats.avgDispenseTime} min</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Expired Stock Cost</p>
          <p className="text-2xl font-bold text-red-600">KES {dashboardStats.expiredCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Sales Chart */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Sales Overview</h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Prescriptions</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 p-4">
            {mockSalesData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <BarChart3 className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No sales data available</p>
                <p className="text-sm">Sales data will appear here when available</p>
              </div>
            ) : (
              <div className="h-full flex items-end gap-4">
                {mockSalesData.map((data, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end gap-1 h-48">
                      <div
                        className="flex-1 bg-blue-500 rounded-t-md transition-all hover:bg-blue-600"
                        style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                        title={`Revenue: KES ${data.revenue.toLocaleString()}`}
                      />
                      <div
                        className="flex-1 bg-green-500 rounded-t-md transition-all hover:bg-green-600"
                        style={{ height: `${(data.prescriptions / 168) * 100}%` }}
                        title={`Prescriptions: ${data.prescriptions}`}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{data.period}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Revenue by Category</h3>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {mockCategoryRevenue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <PieChart className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-sm font-medium">No category data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mockCategoryRevenue.map((cat, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                      <span className="text-sm text-gray-600">{cat.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${cat.color}`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">KES {cat.revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Top Selling Medications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Top Selling Medications</h3>
            </div>
          </div>
          <div className="p-4">
            {mockTopMedications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Pill className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-sm font-medium">No medication data</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                    <th className="pb-3">Medication</th>
                    <th className="pb-3 text-right">Qty Sold</th>
                    <th className="pb-3 text-right">Revenue</th>
                    <th className="pb-3 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockTopMedications.map((med, index) => (
                    <tr key={index}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{med.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-700">{med.quantity}</td>
                      <td className="py-2 text-right font-medium text-gray-900">KES {med.revenue.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        {med.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-green-600 ml-auto" />}
                        {med.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-600 ml-auto" />}
                        {med.trend === 'stable' && <Activity className="w-4 h-4 text-gray-400 ml-auto" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Efficiency Metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Dispensing Efficiency</h3>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Avg Wait Time</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">0 min</p>
              <p className="text-xs text-gray-500 mt-1">No data available</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">Patients/Hour</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-xs text-gray-500 mt-1">No data available</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Stock Turnover</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">0x</p>
              <p className="text-xs text-gray-500 mt-1">No data available</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-gray-600">Stock Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">KES 0</p>
              <p className="text-xs text-gray-500 mt-1">No data available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
