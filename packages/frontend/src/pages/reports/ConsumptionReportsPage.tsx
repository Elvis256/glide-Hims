import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Download,
  Printer,
  Calendar,
  Package,
  Building,
  BarChart3,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

interface ConsumptionTrend {
  date: string;
  quantity: number;
  value: number;
}

interface TopConsumedItem {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  totalValue: number;
  avgDailyConsumption: number;
  trend: 'up' | 'down' | 'stable';
}

interface DepartmentConsumption {
  department: string;
  quantity: number;
  value: number;
  percentage: number;
  color: string;
}

export default function ConsumptionReportsPage() {
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['consumption-reports', dateRange, selectedDepartment, selectedCategory],
    queryFn: async () => {
      try {
        // Try to fetch consumption data if endpoint exists
        const response = await api.get('/inventory/consumption', {
          params: { period: dateRange, department: selectedDepartment, category: selectedCategory },
        });
        return response.data;
      } catch (error) {
        throw error;
      }
    },
  });

  const handleExport = () => {
    const rows = [
      ['Consumption Reports'],
      [''],
      ['Summary'],
      ['Total Items Consumed', stats?.totalConsumption],
      ['Total Value', formatCurrency(stats?.totalValue)],
      ['Avg Daily Consumption', stats?.avgDailyConsumption],
      ['Avg Daily Value', formatCurrency(stats?.avgDailyValue)],
      [''],
      ['Top Consumed Items'],
      ['Item', 'Category', 'Total Quantity', 'Total Value', 'Avg Daily', 'Trend'],
      ...(stats?.topConsumedItems?.map((item: TopConsumedItem) => [
        item.name,
        item.category,
        item.totalQuantity,
        formatCurrency(item.totalValue),
        item.avgDailyConsumption,
        item.trend,
      ]) || []),
      [''],
      ['Department Consumption'],
      ['Department', 'Quantity', 'Value', 'Percentage'],
      ...(stats?.departmentConsumption?.map((d: DepartmentConsumption) => [
        d.department,
        d.quantity,
        formatCurrency(d.value),
        `${d.percentage}%`,
      ]) || []),
    ];
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consumption-report.csv';
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <span className="text-green-600">↑</span>;
      case 'down':
        return <span className="text-red-600">↓</span>;
      default:
        return <span className="text-gray-600">→</span>;
    }
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'bg-green-100 text-green-800';
      case 'down':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const departments = ['all', ...new Set(stats?.departmentConsumption?.map((d: DepartmentConsumption) => d.department) || [])];
  const categories = ['all', ...new Set(stats?.topConsumedItems?.map((i: TopConsumedItem) => i.category) || [])];

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
          <h1 className="text-2xl font-bold text-gray-900">Consumption Reports</h1>
          <p className="text-gray-600">Usage patterns and consumption trends</p>
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
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'quarter', label: 'This Quarter' },
              { key: 'year', label: 'This Year' },
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
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-lg"
            >
              {departments.map((dept) => (
                <option key={dept as string} value={dept as string}>
                  {dept === 'all' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
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
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items Consumed</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalConsumption?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Daily Consumption</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.avgDailyConsumption?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Daily Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.avgDailyValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Consumption Trends Line Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumption Trends</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={dateRange === 'year' ? stats?.monthlyTrend : stats?.consumptionTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => value.toLocaleString()} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'value' ? formatCurrency(value) : value.toLocaleString(),
                name === 'value' ? 'Value' : 'Quantity',
              ]}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="quantity" stroke="#3B82F6" strokeWidth={2} name="Quantity" dot={{ fill: '#3B82F6' }} />
            <Line yAxisId="right" type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} name="Value" dot={{ fill: '#10B981' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Department Consumption */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department-wise Consumption</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.departmentConsumption || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ department, percentage }) => `${department}: ${percentage}%`}
              >
                {stats?.departmentConsumption?.map((entry: DepartmentConsumption, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.departmentConsumption || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
              <YAxis type="category" dataKey="department" width={100} />
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stats?.departmentConsumption?.map((entry: DepartmentConsumption, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Consumed Items Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Top Consumed Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Daily</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.topConsumedItems?.map((item: TopConsumedItem, index: number) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{item.totalQuantity.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.totalValue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{item.avgDailyConsumption}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getTrendBadge(item.trend)}`}>
                      {getTrendIcon(item.trend)}
                      {item.trend === 'up' ? 'Increasing' : item.trend === 'down' ? 'Decreasing' : 'Stable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Summary Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <Building className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900">Department Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.departmentConsumption?.map((dept: DepartmentConsumption) => (
                <tr key={dept.department} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }}></div>
                      <span className="text-sm font-medium text-gray-900">{dept.department}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{dept.quantity.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(dept.value)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${dept.percentage}%`, backgroundColor: dept.color }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12">{dept.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900">Total</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{stats?.totalConsumption?.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(stats?.totalValue)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
