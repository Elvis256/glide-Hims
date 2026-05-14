import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Wallet,
  TrendingUp,
  Users,
  CheckCircle,
  AlertCircle,
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
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';

export default function CollectionReportsPage() {
  const facilityId = useFacilityId();
  const [dateRange, setDateRange] = useState('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['collection-statistics', dateRange, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      try {
        // Fetch financial analytics and dashboard data
        const [financialRes, dashboardRes] = await Promise.all([
          api.get('/analytics/financial', { params: { period: dateRange } }),
          api.get('/analytics/dashboard'),
        ]);
        
        const financial = financialRes.data;
        const dashboard = dashboardRes.data;
        
        // Transform collections trend
        const collectionsByPeriod = financial.collectionsTrend?.reduce((acc: Record<string, { collected: number; billed: number }>, c: { period: string; collections: number }) => {
          const d = new Date(c.period);
          const dateLabel = dateRange === 'year'
            ? d.toLocaleDateString('en-US', { month: 'short' })
            : dateRange === 'week'
            ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
            : dateRange === 'today'
            ? d.toLocaleDateString('en-US', { hour: 'numeric' })
            : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (!acc[dateLabel]) {
            acc[dateLabel] = { collected: 0, billed: 0 };
          }
          acc[dateLabel].collected += c.collections || 0;
          return acc;
        }, {}) || {};
        
        const dailyCollections = Object.entries(collectionsByPeriod).map(([date, data]) => ({
          date,
          collected: (data as { collected: number; billed: number }).collected,
        }));
        
        // Transform payment methods
        const paymentMethods = financial.paymentMethods?.map((p: { payment_method: string; total: number; count: number }, idx: number) => {
          const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
          return {
            name: p.payment_method?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Other',
            value: p.total || 0,
            color: colors[idx % colors.length],
          };
        }) || [];
        
        // Calculate totals from real data
        const totalCollected = paymentMethods.reduce((sum: number, p: { value: number }) => sum + p.value, 0) || dashboard.collections?.thisMonth || 0;
        const outstandingBalance = dashboard.outstanding || 0;
        // Use totalRevenue as denominator to match RevenueReportsPage formula
        const totalRevenue = Number(dashboard.revenue?.thisMonth || 0);
        const totalBilled = totalRevenue > 0 ? totalRevenue : (totalCollected + outstandingBalance);
        const collectionRate = totalBilled > 0 ? (totalCollected / Math.max(totalBilled, 1) * 100) : (totalCollected > 0 ? 100 : 0);
        
        return {
          totalCollected,
          totalBilled,
          collectionRate: parseFloat(collectionRate.toFixed(1)),
          outstandingBalance,
          todayCollections: dashboard.revenue?.today || 0,
          paymentMethods,
          dailyCollections,
        };
      } catch (error) {
        throw error;
      }
    },
});

  const PAYMENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];

  const handleExport = () => {
    const csvContent = [
      'Collection Statistics Report',
      '',
      `Total Collected,${stats?.totalCollected}`,
      `Total Billed,${stats?.totalBilled}`,
      `Collection Rate,${stats?.collectionRate}%`,
      `Outstanding Balance,${stats?.outstandingBalance}`,
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
    a.download = 'collection-statistics.csv';
    a.click();
  };

  const handlePrint = () => {
    const el = document.getElementById('report-content');
    if (!el) return;
    printService.printDocument(el.innerHTML, { title: 'Collection Reports' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Collection Reports</h1>
          <p className="text-gray-600">Payment collections and cashier performance</p>
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
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats?.totalCollected, { compact: true })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Collection Rate</p>
              <p className="text-2xl font-bold text-green-600">{stats?.collectionRate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(stats?.outstandingBalance, { compact: true })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Collections</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats?.todayCollections, { compact: true })}</p>
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
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {stats?.paymentMethods?.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-4 flex-wrap">
            {stats?.paymentMethods?.map((method: { name: string; value: number; color: string }) => (
              <div key={method.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }}></div>
                <span className="text-xs text-gray-600">{method.name}: {formatCurrency(method.value, { compact: true })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Collection Rate Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Rate</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Overall Collection Rate</span>
                <span className="text-sm font-medium text-gray-900">{stats?.collectionRate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-green-500 h-3 rounded-full" style={{ width: `${Math.min(100, stats?.collectionRate || 0)}%` }}></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Total Collected</p>
                <p className="text-lg font-bold text-green-800">{formatCurrency(stats?.totalCollected || 0)}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">Outstanding</p>
                <p className="text-lg font-bold text-orange-800">{formatCurrency(stats?.outstandingBalance || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Collections Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Collections</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats?.dailyCollections || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
            <Legend />
            <Bar dataKey="collected" fill="#10B981" name="Collected" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Collection Rate Trend — Coming Soon */}
      <div className="bg-white rounded-lg shadow p-6 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-500">Collection Rate Trend</h3>
        </div>
        <p className="text-sm text-gray-400">Collection rate trend over time — Coming soon</p>
      </div>

      {/* Cashier-wise Collections — Coming Soon */}
      <div className="bg-white rounded-lg shadow p-6 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-500">Cashier-wise Collections</h3>
        </div>
        <p className="text-sm text-gray-400">Cashier-wise collection breakdown — Coming soon</p>
      </div>
    </div>
  );
}
