import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Wallet,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  FileJson,
  FileText,
  CreditCard,
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
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import {
  num,
  toCsv,
  downloadBlob,
  fmtDateISODay,
  periodLabelFor,
  titleCase,
  type DateRange,
} from './_reportUtils';

const PAYMENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

export default function CollectionReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [customFrom, setCustomFrom] = useState(fmtDateISODay(monthStart));
  const [customTo, setCustomTo] = useState(fmtDateISODay(today));
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

  const periodLabel = useMemo(
    () => periodLabelFor(dateRange, customFrom, customTo),
    [dateRange, customFrom, customTo],
  );

  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['collection-statistics', dateRange, customFrom, customTo, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateRange === 'custom') {
        params.startDate = customFrom;
        params.endDate = customTo;
      } else {
        params.period = dateRange;
      }
      const [financialRes, dashboardRes] = await Promise.all([
        api.get('/analytics/financial', { params }),
        api.get('/analytics/dashboard'),
      ]);
      const financial = financialRes.data;
      const dashboard = dashboardRes.data;

      // Trend (collections over time). Coerce numeric strings.
      const collectionsByPeriod = new Map<string, number>();
      (financial.collectionsTrend ?? []).forEach((c: { period: string; collections: number }) => {
        const d = new Date(c.period);
        const dateLabel = dateRange === 'year'
          ? d.toLocaleDateString('en-US', { month: 'short' })
          : dateRange === 'week'
          ? d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
          : dateRange === 'today'
          ? d.toLocaleDateString('en-US', { hour: 'numeric' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        collectionsByPeriod.set(dateLabel, (collectionsByPeriod.get(dateLabel) ?? 0) + num(c.collections));
      });
      const dailyCollections = Array.from(collectionsByPeriod.entries()).map(([date, collected]) => ({
        date,
        collected,
      }));

      const paymentMethods = (financial.paymentMethods ?? []).map(
        (p: { payment_method: string; total: number; count: number }, idx: number) => ({
          name: p.payment_method ? titleCase(p.payment_method) : 'Other',
          value: num(p.total),
          count: num(p.count),
          color: PAYMENT_COLORS[idx % PAYMENT_COLORS.length],
        }),
      );

      const totalCollected = paymentMethods.reduce((s: number, p: { value: number }) => s + p.value, 0)
        || num(financial.collectionsTotal)
        || num(dashboard.collections?.thisMonth);
      const outstandingBalance = num(dashboard.outstanding);
      const totalRevenue = num(dashboard.revenue?.thisMonth);
      const totalBilled = totalRevenue > 0 ? totalRevenue : (totalCollected + outstandingBalance);
      const collectionRate = totalBilled > 0
        ? (totalCollected / totalBilled) * 100
        : (totalCollected > 0 ? 100 : 0);
      const todayCollections = num(dashboard.revenue?.today);
      const txnCount = paymentMethods.reduce((s: number, p: { count: number }) => s + p.count, 0);

      return {
        totalCollected,
        totalBilled,
        collectionRate: parseFloat(collectionRate.toFixed(1)),
        outstandingBalance,
        todayCollections,
        txnCount,
        paymentMethods,
        dailyCollections,
      };
    },
  });

  const buildCsv = (): string => {
    const rows: Array<Array<unknown>> = [];
    rows.push(['Collection Report']);
    rows.push(['Facility', inst?.name ?? '']);
    rows.push(['Period', periodLabel]);
    rows.push(['Generated', new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Collected', stats?.totalCollected ?? 0]);
    rows.push(['Total Billed', stats?.totalBilled ?? 0]);
    rows.push(['Collection Rate (%)', stats?.collectionRate ?? 0]);
    rows.push(['Outstanding Balance', stats?.outstandingBalance ?? 0]);
    rows.push(["Today's Collections", stats?.todayCollections ?? 0]);
    rows.push(['Transactions', stats?.txnCount ?? 0]);
    rows.push([]);
    rows.push(['Payment Methods']);
    rows.push(['Method', 'Amount', 'Transactions']);
    (stats?.paymentMethods ?? []).forEach((p: { name: string; value: number; count: number }) =>
      rows.push([p.name, p.value, p.count]),
    );
    rows.push([]);
    rows.push(['Daily Collections']);
    rows.push(['Period', 'Collected']);
    (stats?.dailyCollections ?? []).forEach((d: { date: string; collected: number }) =>
      rows.push([d.date, d.collected]),
    );
    return toCsv(rows);
  };

  const handleExportCsv = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`collection-report-${dateRange}-${stamp}.csv`, 'text/csv;charset=utf-8', '\ufeff' + buildCsv());
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      report: 'Collection Report',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(`collection-report-${dateRange}-${stamp}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const fmt = (v: number) => formatCurrency(v);
    const pctStr = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—');

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Collection Report — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Collected</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.totalCollected)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Total Billed</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.totalBilled)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Collection Rate</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.collectionRate}%</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Outstanding Balance</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.outstandingBalance)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Today's Collections</td><td style="border:1px solid #e2e8f0;padding:6px;">${fmt(stats.todayCollections)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Transactions</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.txnCount}</td></tr>
        </tbody>
      </table>`;

    const payRows = stats.paymentMethods ?? [];
    const payTotal = payRows.reduce((s: number, p: { value: number }) => s + p.value, 0);
    const payTable = payRows.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Payment Methods</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Method</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Amount</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Transactions</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Share</th>
        </tr></thead>
        <tbody>
          ${payRows.map((p: { name: string; value: number; count: number }) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${p.name}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(p.value)}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${p.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pctStr(p.value, payTotal)}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    const dailyRows = stats.dailyCollections ?? [];
    const dailyTable = dailyRows.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Collections Over Time</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Period</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Collected</th>
        </tr></thead>
        <tbody>
          ${dailyRows.map((d: { date: string; collected: number }) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${d.date}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(d.collected)}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    printService.printDocument(header + summaryTable + payTable + dailyTable + footer, {
      title: `Collection Report — ${periodLabel}`,
    });
  };

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
        <div className="h-72 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  return (
    <div id="report-content" className="space-y-6">
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collection Reports</h1>
          <p className="text-gray-600">Payment collections and cashier performance</p>
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

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year', 'custom'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : 'Custom'}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-gray-500">{periodLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Wallet className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(stats?.totalCollected, { compact: true })}</p>
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
              <p className="text-2xl font-bold text-green-600 tabular-nums">{stats?.collectionRate ?? 0}%</p>
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
              <p className="text-xl font-bold text-orange-600 tabular-nums">{formatCurrency(stats?.outstandingBalance, { compact: true })}</p>
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
              <p className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(stats?.todayCollections, { compact: true })}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method Breakdown</h3>
          {stats?.paymentMethods?.length ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.paymentMethods.map((_: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {stats.paymentMethods.map((method: { name: string; value: number; count: number; color: string }) => {
                  const total = stats.paymentMethods.reduce((s: number, m: { value: number }) => s + m.value, 0) || 1;
                  const pctVal = ((method.value / total) * 100).toFixed(1);
                  return (
                    <div key={method.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }}></div>
                        <span className="text-sm text-gray-700">{method.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 tabular-nums">{method.count} txns</span>
                        <span className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(method.value, { compact: true })}</span>
                        <span className="text-xs text-gray-500 w-12 text-right tabular-nums">{pctVal}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
              <CreditCard className="h-12 w-12 mb-2" />
              <p className="text-sm">No payments recorded</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Rate</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Overall Collection Rate</span>
                <span className="text-sm font-medium text-gray-900 tabular-nums">{stats?.collectionRate ?? 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-green-500 h-3 rounded-full" style={{ width: `${Math.min(100, stats?.collectionRate ?? 0)}%` }}></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Total Collected</p>
                <p className="text-lg font-bold text-green-800 tabular-nums">{formatCurrency(stats?.totalCollected ?? 0)}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">Outstanding</p>
                <p className="text-lg font-bold text-orange-800 tabular-nums">{formatCurrency(stats?.outstandingBalance ?? 0)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">Total Billed</p>
                <p className="text-lg font-bold text-blue-800 tabular-nums">{formatCurrency(stats?.totalBilled ?? 0)}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-700">Transactions</p>
                <p className="text-lg font-bold text-purple-800 tabular-nums">{stats?.txnCount ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collections Over Time</h3>
        {stats?.dailyCollections?.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.dailyCollections}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
              <Legend />
              <Bar dataKey="collected" fill="#10B981" name="Collected" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
            <TrendingUp className="h-12 w-12 mb-2" />
            <p className="text-sm">No collections recorded for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
