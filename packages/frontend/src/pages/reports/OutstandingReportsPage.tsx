import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Download,
  Printer,
  Calendar,
  DollarSign,
  Users,
  Clock,
  Building,
  FileText,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  FileJson,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { num, toCsv, downloadBlob } from './_reportUtils';

interface AgingBucket {
  range: string;
  amount: number;
  count: number;
  color: string;
}

interface Debtor {
  id: string;
  name: string;
  totalOwed: number;
  invoiceCount: number;
  oldestInvoice: string;
  daysPastDue: number;
}

type RangeKey = 'all' | 'month' | 'quarter' | 'year' | 'custom';

export default function OutstandingReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState<RangeKey>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  const periodLabel = useMemo(() => {
    if (dateRange === 'custom') return `${startDate || '—'} → ${endDate || '—'}`;
    return ({ all: 'All Time', month: 'This Month', quarter: 'This Quarter', year: 'This Year' } as const)[dateRange];
  }, [dateRange, startDate, endDate]);

  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['outstanding-reports', dateRange, startDate, endDate, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      try {
        // Fetch financial analytics for outstanding data
        const [financialRes, dashboardRes] = await Promise.all([
          api.get('/analytics/financial', {
            params: {
              period: dateRange === 'all' ? 'year' : dateRange,
              ...(dateRange === 'custom' && startDate ? { startDate } : {}),
              ...(dateRange === 'custom' && endDate ? { endDate } : {}),
            },
          }),
          api.get('/analytics/dashboard'),
        ]);
        
        const financial = financialRes.data;
        const dashboard = dashboardRes.data;
        
        // Transform outstandingByAge to aging buckets
        const outstandingByAge = financial.outstandingByAge || [];
        const agingColors: Record<string, string> = {
          '0-30': '#10B981',
          '31-60': '#F59E0B',
          '61-90': '#F97316',
          '90+': '#EF4444',
        };
        
        const agingBuckets = outstandingByAge.map((o: { age_bucket: string; outstanding: number; count: number }) => {
          // Normalize age bucket format
          let range = o.age_bucket || '0-30';
          if (range.includes('current') || range.includes('0-30') || parseInt(range) <= 30) {
            range = '0-30 days';
          } else if (range.includes('31-60') || (parseInt(range) > 30 && parseInt(range) <= 60)) {
            range = '31-60 days';
          } else if (range.includes('61-90') || (parseInt(range) > 60 && parseInt(range) <= 90)) {
            range = '61-90 days';
          } else {
            range = '90+ days';
          }
          
          return {
            range,
            amount: num(o.outstanding),
            count: num(o.count),
            color: agingColors[range.replace(' days', '')] || '#EF4444',
          };
        });
        
        // Calculate totals
        const totalOutstanding = agingBuckets.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) || num(dashboard.outstanding);
        const totalInvoices = agingBuckets.reduce((sum: number, b: { count: number }) => sum + b.count, 0);
        
        // Calculate weighted avg days overdue from buckets
        const bucketMidpoints: Record<string, number> = { '0-30 days': 15, '31-60 days': 45, '61-90 days': 75, '90+ days': 120 };
        const weightedDays = agingBuckets.reduce((sum: number, b: { range: string; amount: number }) => 
          sum + b.amount * (bucketMidpoints[b.range] || 45), 0);
        const avgDaysOverdue = totalOutstanding > 0 ? Math.round(weightedDays / totalOutstanding) : 0;
        
        const totalRevenue = num(dashboard.revenue?.thisMonth);
        const totalCollections = num(dashboard.collections?.thisMonth);
        const collectionRate = totalRevenue > 0 ? (totalCollections / totalRevenue * 100) : (totalOutstanding === 0 ? 100 : 0);
        
        // Default empty buckets when no outstanding
        const displayBuckets = agingBuckets.length > 0 ? agingBuckets : [
          { range: '0-30 days', amount: 0, count: 0, color: '#10B981' },
          { range: '31-60 days', amount: 0, count: 0, color: '#F59E0B' },
          { range: '61-90 days', amount: 0, count: 0, color: '#F97316' },
          { range: '90+ days', amount: 0, count: 0, color: '#EF4444' },
        ];

        return {
          totalOutstanding,
          totalInvoices,
          averageDaysOverdue: avgDaysOverdue,
          collectionRate: parseFloat(collectionRate.toFixed(1)),
          agingBuckets: displayBuckets,
          topDebtors: [],
          insuranceClaims: [],
        };
      } catch (error) {
        throw error;
      }
    },
});

  const buildCsv = (): string => {
    const rows: Array<Array<unknown>> = [];
    rows.push(['Outstanding Report']);
    rows.push(['Facility', inst?.name ?? '']);
    rows.push(['Period', periodLabel]);
    rows.push(['Generated', new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Outstanding', stats?.totalOutstanding ?? 0]);
    rows.push(['Unpaid Invoices', stats?.totalInvoices ?? 0]);
    rows.push(['Avg Days Overdue', stats?.averageDaysOverdue ?? 0]);
    rows.push(['Collection Rate (%)', stats?.collectionRate ?? 0]);
    rows.push([]);
    rows.push(['Aging Analysis']);
    rows.push(['Range', 'Amount', 'Invoices', 'Share %']);
    const total = stats?.totalOutstanding || 1;
    (stats?.agingBuckets ?? []).forEach((b: AgingBucket) =>
      rows.push([b.range, b.amount, b.count, ((b.amount / total) * 100).toFixed(1)]),
    );
    if ((stats?.topDebtors?.length ?? 0) > 0) {
      rows.push([]);
      rows.push(['Top Debtors']);
      rows.push(['Name', 'Total Owed', 'Invoice Count', 'Days Past Due']);
      (stats?.topDebtors ?? []).forEach((d: Debtor) =>
        rows.push([d.name, d.totalOwed, d.invoiceCount, d.daysPastDue]),
      );
    }
    return toCsv(rows);
  };

  const handleExportCsv = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`outstanding-report-${dateRange}-${stamp}.csv`, 'text/csv;charset=utf-8', '\ufeff' + buildCsv());
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      report: 'Outstanding Report',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(`outstanding-report-${dateRange}-${stamp}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const fmt = (v: number) => formatCurrency(v);
    const total = stats.totalOutstanding || 1;
    const pctStr = (n: number) => ((n / total) * 100).toFixed(1) + '%';

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Outstanding Report — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Outstanding</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.totalOutstanding)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Unpaid Invoices</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.totalInvoices}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Avg Days Overdue</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.averageDaysOverdue} days</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Collection Rate</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.collectionRate}%</td></tr>
        </tbody>
      </table>`;

    const ageTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Aging Analysis</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Range</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Amount</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Invoices</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Share</th>
        </tr></thead>
        <tbody>
          ${(stats.agingBuckets ?? []).map((b: AgingBucket) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${b.range}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(b.amount)}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${b.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pctStr(b.amount)}</td></tr>`,
          ).join('')}
          <tr style="background:#f8fafc;font-weight:600;">
            <td style="border:1px solid #e2e8f0;padding:6px;">Total</td>
            <td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.totalOutstanding)}</td>
            <td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.totalInvoices}</td>
            <td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">100%</td>
          </tr>
        </tbody>
      </table>`;

    printService.printDocument(header + summaryTable + ageTable + footer, {
      title: `Outstanding Report — ${periodLabel}`,
    });
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-gray-100 rounded-lg" />
          <div className="h-72 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-48 bg-gray-100 rounded-lg" />
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
          <h1 className="text-2xl font-bold text-gray-900">Outstanding Reports</h1>
          <p className="text-gray-600">Unpaid invoices and aging analysis</p>
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

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All Time' },
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unpaid Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Days Overdue</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.averageDaysOverdue} days</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Collection Rate</p>
              <p className="text-2xl font-bold text-green-600">{stats?.collectionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging Analysis Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.agingBuckets || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {stats?.agingBuckets?.map((entry: AgingBucket, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.agingBuckets || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="amount"
                label={({ range, percent }: any) => `${range}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {stats?.agingBuckets?.map((entry: AgingBucket, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Aging Analysis Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">Aging Analysis Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age Range</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoice Count</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.agingBuckets?.map((bucket: AgingBucket) => {
                const totalAmount = stats?.totalOutstanding || 1;
                const percentage = ((bucket.amount / totalAmount) * 100).toFixed(1);
                return (
                  <tr key={bucket.range} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bucket.color }}></div>
                        <span className="text-sm font-medium text-gray-900">{bucket.range}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(bucket.amount)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{bucket.count}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${percentage}%`, backgroundColor: bucket.color }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900">Total</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(stats?.totalOutstanding)}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{stats?.totalInvoices}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Debtors — Coming Soon */}
      <div className="bg-white rounded-lg shadow p-6 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-500">Top Debtors</h3>
        </div>
        <p className="text-sm text-gray-400">Top debtor breakdown by outstanding amount — Coming soon</p>
      </div>

      {/* Insurance Claims — Coming Soon */}
      <div className="bg-white rounded-lg shadow p-6 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Building className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-500">Insurance Claims Pending</h3>
        </div>
        <p className="text-sm text-gray-400">Insurance claims tracking and status — Coming soon</p>
      </div>
    </div>
  );
}
