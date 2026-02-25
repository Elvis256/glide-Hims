import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  CreditCard,
  ArrowLeft,
  Receipt,
  Clock,
  CheckCircle,
  AlertCircle,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

export default function RevenueReportsPage() {
  const [dateRange, setDateRange] = useState('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['revenue-statistics', dateRange],
    queryFn: async () => {
      const [financialRes, dashboardRes] = await Promise.all([
        api.get('/analytics/financial', { params: { period: dateRange } }),
        api.get('/analytics/dashboard'),
      ]);
      
      const financial = financialRes.data;
      const dashboard = dashboardRes.data;
      
      // Transform revenue trend with collections overlay
      const collectionsMap = new Map<string, number>();
      financial.collectionsTrend?.forEach((c: { period: string; collections: number }) => {
        const key = c.period;
        collectionsMap.set(key, (collectionsMap.get(key) || 0) + Number(c.collections || 0));
      });

      const revenueTrend = financial.revenueTrend?.map((t: { period: string; revenue: number; invoice_count: number }) => {
        const periodLabel = dateRange === 'year' 
          ? new Date(t.period).toLocaleDateString('en-US', { month: 'short' })
          : dateRange === 'month'
          ? new Date(t.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : dateRange === 'week'
          ? new Date(t.period).toLocaleDateString('en-US', { weekday: 'short' })
          : new Date(t.period).toLocaleDateString('en-US', { hour: 'numeric' });
        return {
          period: periodLabel,
          revenue: Number(t.revenue || 0),
          collections: collectionsMap.get(t.period) || 0,
          invoices: Number(t.invoice_count || 0),
        };
      }) || [];
      
      // Payment methods
      const PAYMENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];
      const paymentMethods = financial.paymentMethods?.map((p: { payment_method: string; total: number; count: number }, idx: number) => ({
        name: p.payment_method?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Other',
        value: Number(p.total || 0),
        count: Number(p.count || 0),
        color: PAYMENT_COLORS[idx % PAYMENT_COLORS.length],
      })) || [];
      
      // Department revenue
      const departmentRevenue = financial.revenueByDepartment?.map((d: { department: string; revenue: number; count: number }) => ({
        department: d.department || 'Unknown',
        revenue: Number(d.revenue || 0),
        count: Number(d.count || 0),
      })) || [];

      // Outstanding by age
      const outstandingByAge = financial.outstandingByAge?.map((a: { age_bucket: string; outstanding: number; count: number }) => ({
        bucket: a.age_bucket,
        amount: Number(a.outstanding || 0),
        count: Number(a.count || 0),
      })) || [];

      // Recent transactions
      const recentTransactions = financial.recentTransactions?.map((t: {
        id: string; invoice_number: string; total_amount: number; amount_paid: number;
        balance_due: number; status: string; created_at: string; patient_name: string; mrn: string;
      }) => ({
        id: t.id,
        invoiceNumber: t.invoice_number,
        totalAmount: Number(t.total_amount || 0),
        amountPaid: Number(t.amount_paid || 0),
        balanceDue: Number(t.balance_due || 0),
        status: t.status,
        createdAt: t.created_at,
        patientName: t.patient_name || 'Unknown',
        mrn: t.mrn || '',
      })) || [];
      
      const totalRevenue = revenueTrend.reduce((sum: number, t: { revenue: number }) => sum + t.revenue, 0) || dashboard.revenue?.thisMonth || 0;
      const totalCollections = Number(financial.collectionsTotal || 0);
      const previousPeriod = dashboard.revenue?.lastMonth || 0;
      const revenueGrowth = previousPeriod > 0 ? ((totalRevenue - previousPeriod) / previousPeriod * 100) : 0;
      const daysInPeriod = dateRange === 'year' ? 365 : dateRange === 'month' ? 30 : dateRange === 'week' ? 7 : 1;
      const averageDaily = totalRevenue / daysInPeriod;
      const collectionRate = totalRevenue > 0 ? (totalCollections / totalRevenue * 100) : 0;
      const totalOutstanding = outstandingByAge.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0);
      const totalInvoices = revenueTrend.reduce((sum: number, t: { invoices: number }) => sum + t.invoices, 0);
      
      return {
        totalRevenue,
        totalCollections,
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
        averageDaily,
        collectionRate: parseFloat(collectionRate.toFixed(1)),
        pendingPayments: dashboard.outstanding || 0,
        totalOutstanding,
        totalInvoices,
        paymentMethods,
        departmentRevenue,
        revenueTrend,
        outstandingByAge,
        recentTransactions,
      };
    },
  });

  const PAYMENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];
  const AGING_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

  const handleExport = () => {
    const csvContent = [
      'Revenue Statistics Report',
      `Period: ${dateRange}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'Summary',
      `Total Revenue,${stats?.totalRevenue}`,
      `Total Collections,${stats?.totalCollections}`,
      `Collection Rate,${stats?.collectionRate}%`,
      `Revenue Growth,${stats?.revenueGrowth}%`,
      `Average Daily,${stats?.averageDaily}`,
      `Outstanding Balance,${stats?.totalOutstanding}`,
      `Total Invoices,${stats?.totalInvoices}`,
      '',
      'Department Revenue',
      'Department,Revenue,Invoices',
      ...(stats?.departmentRevenue?.map((d: { department: string; revenue: number; count: number }) => 
        `${d.department},${d.revenue},${d.count}`
      ) || []),
      '',
      'Payment Methods',
      'Method,Amount,Transactions',
      ...(stats?.paymentMethods?.map((p: { name: string; value: number; count: number }) => 
        `${p.name},${p.value},${p.count}`
      ) || []),
      '',
      'Outstanding by Age',
      'Age Bucket,Amount,Count',
      ...(stats?.outstandingByAge?.map((a: { bucket: string; amount: number; count: number }) =>
        `${a.bucket},${a.amount},${a.count}`
      ) || []),
      '',
      'Recent Transactions',
      'Invoice,Patient,Amount,Paid,Balance,Status,Date',
      ...(stats?.recentTransactions?.map((t: { invoiceNumber: string; patientName: string; totalAmount: number; amountPaid: number; balanceDue: number; status: string; createdAt: string }) =>
        `${t.invoiceNumber},${t.patientName},${t.totalAmount},${t.amountPaid},${t.balanceDue},${t.status},${new Date(t.createdAt).toLocaleDateString()}`
      ) || []),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const growthPositive = (stats?.revenueGrowth || 0) >= 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Revenue Reports</h1>
          <p className="text-gray-600">Financial analytics and revenue trends</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
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

      {/* Summary Cards - 6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            {growthPositive ? (
              <span className="flex items-center text-xs font-medium text-green-600">
                <ArrowUpRight className="h-3 w-3" />
                {stats?.revenueGrowth}%
              </span>
            ) : (
              <span className="flex items-center text-xs font-medium text-red-600">
                <ArrowDownRight className="h-3 w-3" />
                {Math.abs(stats?.revenueGrowth || 0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(stats?.totalRevenue, { compact: true })}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Banknote className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600">{stats?.collectionRate}%</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Collections</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(stats?.totalCollections, { compact: true })}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Daily Average</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(stats?.averageDaily, { compact: true })}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Outstanding</p>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(stats?.totalOutstanding, { compact: true })}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Receipt className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Invoices</p>
          <p className="text-lg font-bold text-gray-900">{stats?.totalInvoices || 0}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg ${(stats?.collectionRate || 0) >= 80 ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {(stats?.collectionRate || 0) >= 80 
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-yellow-600" />
              }
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-1">Collection Rate</p>
          <p className={`text-lg font-bold ${(stats?.collectionRate || 0) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
            {stats?.collectionRate || 0}%
          </p>
        </div>
      </div>

      {/* Revenue vs Collections Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Revenue vs Collections</h3>
        <p className="text-sm text-gray-500 mb-4">Compare billed revenue against actual collections over time</p>
        {stats?.revenueTrend?.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.revenueTrend}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'revenue' ? 'Revenue' : 'Collections']}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
              <Area type="monotone" dataKey="collections" stroke="#3B82F6" strokeWidth={2} fill="url(#colorCollections)" name="Collections" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
            <TrendingUp className="h-12 w-12 mb-2" />
            <p className="text-sm">No revenue data for this period</p>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
          {stats?.paymentMethods?.length ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.paymentMethods.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {stats.paymentMethods.map((method: { name: string; value: number; count: number; color: string }) => {
                  const total = stats.paymentMethods.reduce((sum: number, m: { value: number }) => sum + m.value, 0) || 1;
                  const pct = ((method.value / total) * 100).toFixed(0);
                  return (
                    <div key={method.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }}></div>
                        <span className="text-sm text-gray-700">{method.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{method.count} txns</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(method.value, { compact: true })}</span>
                        <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
              <CreditCard className="h-12 w-12 mb-2" />
              <p className="text-sm">No payments recorded</p>
            </div>
          )}
        </div>

        {/* Revenue by Department */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Department</h3>
          {stats?.departmentRevenue?.length ? (
            <ResponsiveContainer width="100%" height={Math.max(250, stats.departmentRevenue.length * 50)}>
              <BarChart data={stats.departmentRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} tick={{ fontSize: 12 }} />
                <YAxis dataKey="department" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
              <Building2 className="h-12 w-12 mb-2" />
              <p className="text-sm">No department revenue data</p>
            </div>
          )}
        </div>
      </div>

      {/* Outstanding Aging + Department Table side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Aging */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Outstanding Aging</h3>
          <p className="text-sm text-gray-500 mb-4">Unpaid balances by age</p>
          {stats?.outstandingByAge?.length ? (
            <div className="space-y-4">
              {stats.outstandingByAge.map((age: { bucket: string; amount: number; count: number }, idx: number) => {
                const maxAmount = Math.max(...stats.outstandingByAge.map((a: { amount: number }) => a.amount));
                const widthPct = maxAmount > 0 ? (age.amount / maxAmount * 100) : 0;
                return (
                  <div key={age.bucket}>
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: AGING_COLORS[idx] }} />
                        <span className="text-sm font-medium text-gray-700">{age.bucket}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{age.count} invoices</span>
                        <span className="text-sm font-bold" style={{ color: AGING_COLORS[idx] }}>
                          {formatCurrency(age.amount, { compact: true })}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${widthPct}%`, backgroundColor: AGING_COLORS[idx] }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t flex justify-between">
                <span className="text-sm font-bold text-gray-900">Total Outstanding</span>
                <span className="text-sm font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
              <CheckCircle className="h-12 w-12 mb-2 text-green-300" />
              <p className="text-sm text-green-600 font-medium">No outstanding balances</p>
            </div>
          )}
        </div>

        {/* Department Revenue Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Department Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats?.departmentRevenue?.length ? stats.departmentRevenue.map((dept: { department: string; revenue: number; count: number }) => {
                  const total = stats.departmentRevenue.reduce((sum: number, d: { revenue: number }) => sum + d.revenue, 0) || 1;
                  const percentage = ((dept.revenue / total) * 100).toFixed(1);
                  return (
                    <tr key={dept.department} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {dept.department}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatCurrency(dept.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{dept.count}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-600 w-10 text-right">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No department data</td>
                  </tr>
                )}
              </tbody>
              {stats?.departmentRevenue?.length ? (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(stats.departmentRevenue.reduce((sum: number, d: { revenue: number }) => sum + d.revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {stats.departmentRevenue.reduce((sum: number, d: { count: number }) => sum + d.count, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">100%</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            <p className="text-sm text-gray-500">Latest invoices and payments</p>
          </div>
          <span className="text-sm text-gray-500">{stats?.recentTransactions?.length || 0} transactions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.recentTransactions?.length ? stats.recentTransactions.map((txn: {
                id: string; invoiceNumber: string; totalAmount: number; amountPaid: number;
                balanceDue: number; status: string; createdAt: string; patientName: string; mrn: string;
              }) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">{txn.invoiceNumber || txn.id.substring(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{txn.patientName}</div>
                    {txn.mrn && <div className="text-xs text-gray-500">{txn.mrn}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatCurrency(txn.totalAmount)}</td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right">{formatCurrency(txn.amountPaid)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={txn.balanceDue > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                      {formatCurrency(txn.balanceDue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      txn.status === 'paid' ? 'bg-green-100 text-green-800' :
                      txn.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                      txn.status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {txn.status?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    <Receipt className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No transactions for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}