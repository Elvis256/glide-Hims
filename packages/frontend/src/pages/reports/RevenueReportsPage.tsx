import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  DollarSign,
  TrendingUp,
  Building2,
  CreditCard,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

export default function RevenueReportsPage() {
  const [dateRange, setDateRange] = useState('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['revenue-statistics', dateRange],
    queryFn: async () => {
      try {
        const response = await api.get('/revenue/statistics', { params: { range: dateRange } });
        return response.data;
      } catch {
        // Mock data fallback
        return {
          totalRevenue: 245780000,
          revenueGrowth: 12.5,
          averageDaily: 8192667,
          pendingPayments: 18450000,
          paymentMethods: [
            { name: 'Cash', value: 98312000, color: '#10B981' },
            { name: 'Insurance', value: 112468000, color: '#3B82F6' },
            { name: 'Mobile Money', value: 35000000, color: '#F59E0B' },
          ],
          departmentRevenue: [
            { department: 'Pharmacy', revenue: 78500000 },
            { department: 'Laboratory', revenue: 52340000 },
            { department: 'Consultation', revenue: 45670000 },
            { department: 'Imaging', revenue: 32450000 },
            { department: 'Surgery', revenue: 28900000 },
            { department: 'Emergency', revenue: 7920000 },
          ],
          revenueTrend: [
            { period: 'Week 1', revenue: 52450000, target: 55000000 },
            { period: 'Week 2', revenue: 58920000, target: 55000000 },
            { period: 'Week 3', revenue: 61340000, target: 55000000 },
            { period: 'Week 4', revenue: 73070000, target: 55000000 },
          ],
          dailyRevenue: [
            { day: 'Mon', revenue: 12450000 },
            { day: 'Tue', revenue: 11890000 },
            { day: 'Wed', revenue: 13200000 },
            { day: 'Thu', revenue: 10500000 },
            { day: 'Fri', revenue: 14300000 },
            { day: 'Sat', revenue: 8900000 },
            { day: 'Sun', revenue: 5200000 },
          ],
        };
      }
    },
  });

  const PAYMENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B'];

  const handleExport = () => {
    const csvContent = [
      'Revenue Statistics Report',
      '',
      `Total Revenue,${stats?.totalRevenue}`,
      `Revenue Growth,${stats?.revenueGrowth}%`,
      `Average Daily,${stats?.averageDaily}`,
      `Pending Payments,${stats?.pendingPayments}`,
      '',
      'Department Revenue',
      'Department,Revenue',
      ...(stats?.departmentRevenue?.map((d: { department: string; revenue: number }) => 
        `${d.department},${d.revenue}`
      ) || []),
      '',
      'Payment Methods',
      'Method,Amount',
      ...(stats?.paymentMethods?.map((p: { name: string; value: number }) => 
        `${p.name},${p.value}`
      ) || []),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'revenue-statistics.csv';
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Reports</h1>
          <p className="text-gray-600">Financial analytics and revenue trends</p>
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

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats?.totalRevenue, { compact: true })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Growth Rate</p>
              <p className="text-2xl font-bold text-green-600">+{stats?.revenueGrowth}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Daily Average</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats?.averageDaily, { compact: true })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats?.pendingPayments, { compact: true })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats?.paymentMethods || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {stats?.paymentMethods?.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {stats?.paymentMethods?.map((method: { name: string; value: number; color: string }) => (
              <div key={method.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }}></div>
                <span className="text-sm text-gray-600">{method.name}: {formatCurrency(method.value, { compact: true })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Department */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.departmentRevenue || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
              <YAxis dataKey="department" type="category" width={80} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend vs Target</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats?.revenueTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Actual Revenue" />
            <Line type="monotone" dataKey="target" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" name="Target" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Revenue */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats?.dailyRevenue || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department Revenue Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Department Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.departmentRevenue?.map((dept: { department: string; revenue: number }) => {
                const total = stats?.departmentRevenue?.reduce((sum: number, d: { revenue: number }) => sum + d.revenue, 0) || 1;
                const percentage = ((dept.revenue / total) * 100).toFixed(1);
                return (
                  <tr key={dept.department} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {dept.department}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(dept.revenue)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                  {formatCurrency(stats?.departmentRevenue?.reduce((sum: number, d: { revenue: number }) => sum + d.revenue, 0) || 0)}
                </td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}