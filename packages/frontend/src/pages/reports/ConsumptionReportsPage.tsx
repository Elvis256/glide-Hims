import { useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
  ChevronDown,
  FileJson,
  FileText,
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
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { num, toCsv, downloadBlob } from './_reportUtils';

/* Shapes below mirror InventoryService.getConsumptionReport(). */

/** Daily series: `consumptionTrend` carries a quantity per day under `value`. */
interface ConsumptionTrend {
  date: string;
  value: number;
}

/** Monthly series: the only one that reports both quantity and money. */
interface MonthlyTrend {
  month: string;
  quantity: number;
  value: number;
}

interface TopConsumedItem {
  name: string;
  category: string;
  totalQuantity: number;
  totalValue: number;
  avgDailyConsumption: number;
  trend: string;
}

/** Grouped by issuing store name; the report returns quantity only. */
interface DepartmentConsumption {
  name: string;
  value: number;
}

/** Chart tints — the report carries no colour, so assign one per slice. */
const DEPT_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0', '#a4de6c'];
const deptColor = (index: number) => DEPT_COLORS[index % DEPT_COLORS.length];

interface ConsumptionReport {
  totalConsumption: number;
  totalValue: number;
  avgDailyConsumption: number;
  avgDailyValue: number;
  topConsumedItems: TopConsumedItem[];
  departmentConsumption: DepartmentConsumption[];
  monthlyTrend: MonthlyTrend[];
  consumptionTrend: ConsumptionTrend[];
}

export default function ConsumptionReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
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

  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['consumption-reports', dateRange, startDate, endDate, selectedDepartment, selectedCategory, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const params: Record<string, string> = {
        period: dateRange,
        department: selectedDepartment,
        category: selectedCategory,
      };
      if (dateRange === 'custom' && startDate && endDate) {
        params.startDate = new Date(startDate).toISOString();
        params.endDate = new Date(endDate + 'T23:59:59').toISOString();
      }
      const response = await api.get('/inventory/consumption', { params });
      const data = response.data ?? {};
      const report: ConsumptionReport = {
        totalConsumption: num(data.totalConsumption),
        totalValue: num(data.totalValue),
        avgDailyConsumption: num(data.avgDailyConsumption),
        avgDailyValue: num(data.avgDailyValue),
        topConsumedItems: (data.topConsumedItems ?? []).map((it: TopConsumedItem) => ({
          ...it,
          totalQuantity: num(it.totalQuantity),
          totalValue: num(it.totalValue),
          avgDailyConsumption: num(it.avgDailyConsumption),
        })),
        departmentConsumption: (data.departmentConsumption ?? []).map((d: DepartmentConsumption) => ({
          ...d,
          value: num(d.value),
        })),
        consumptionTrend: (data.consumptionTrend ?? []).map((t: ConsumptionTrend) => ({
          ...t,
          value: num(t.value),
        })),
        monthlyTrend: (data.monthlyTrend ?? []).map((t: MonthlyTrend) => ({
          ...t,
          quantity: num(t.quantity),
          value: num(t.value),
        })),
      };
      return report;
    },
  });

  /**
   * One series for the trend chart. Only the monthly series carries money —
   * consumptionTrend's `value` is a daily QUANTITY, so it must not be plotted
   * on the currency axis.
   */
  const showMoneySeries = dateRange === 'year';
  const trendSeries = useMemo(() => {
    if (showMoneySeries) {
      return (stats?.monthlyTrend ?? []).map((t) => ({
        label: t.month,
        quantity: t.quantity,
        value: t.value,
      }));
    }
    return (stats?.consumptionTrend ?? []).map((t) => ({
      label: t.date,
      quantity: t.value,
    }));
  }, [showMoneySeries, stats?.monthlyTrend, stats?.consumptionTrend]);

  /** Share of total consumed quantity — the report does not return a
   *  precomputed percentage, so derive it from the values we do get. */
  const departmentTotal = (stats?.departmentConsumption ?? []).reduce((s, d) => s + d.value, 0);
  const departmentShare = (d: DepartmentConsumption) =>
    departmentTotal > 0 ? (d.value / departmentTotal) * 100 : 0;

  // Calculate trend from monthlyTrend data instead of using backend's hardcoded value
  const computedTrend = useMemo(() => {
    const trend = stats?.monthlyTrend;
    if (!trend || trend.length < 2) return null;
    const last = trend[trend.length - 1]?.quantity ?? 0;
    const prev = trend[trend.length - 2]?.quantity ?? 0;
    if (prev === 0) return 'stable';
    if (last > prev * 1.1) return 'up';
    if (last < prev * 0.9) return 'down';
    return 'stable';
  }, [stats?.monthlyTrend]);

  const periodLabel = useMemo(() => {
    if (dateRange === 'custom' && startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`;
    }
    return ({ week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom Range' } as Record<string, string>)[dateRange] ?? dateRange;
  }, [dateRange, startDate, endDate]);

  const buildCsv = (): string => {
    const rows: Array<Array<unknown>> = [];
    rows.push(['Consumption Report']);
    rows.push(['Facility', inst?.name ?? '']);
    rows.push(['Period', periodLabel]);
    rows.push(['Generated', new Date().toLocaleString()]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Items Consumed', stats?.totalConsumption ?? 0]);
    rows.push(['Total Value', stats?.totalValue ?? 0]);
    rows.push(['Avg Daily Consumption', stats?.avgDailyConsumption ?? 0]);
    rows.push(['Avg Daily Value', stats?.avgDailyValue ?? 0]);
    rows.push([]);
    rows.push(['Top Consumed Items']);
    rows.push(['Item', 'Category', 'Total Quantity', 'Total Value', 'Avg Daily', 'Trend']);
    (stats?.topConsumedItems ?? []).forEach((item: TopConsumedItem) =>
      rows.push([item.name, item.category, item.totalQuantity, item.totalValue, item.avgDailyConsumption, item.trend]),
    );
    rows.push([]);
    rows.push(['Department Consumption']);
    rows.push(['Department', 'Quantity', 'Percentage']);
    (stats?.departmentConsumption ?? []).forEach((d: DepartmentConsumption) =>
      rows.push([d.name, d.value, `${departmentShare(d).toFixed(1)}%`]),
    );
    return toCsv(rows);
  };

  const handleExportCsv = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`consumption-report-${stamp}.csv`, 'text/csv;charset=utf-8', '\ufeff' + buildCsv());
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      report: 'Consumption Report',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(`consumption-report-${stamp}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const fmt = (v: number) => formatCurrency(v);

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Consumption Report</h2>
      <p style="font-size:11px;color:#64748b;margin:0 0 12px;">Period: ${periodLabel}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Metric</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Value</th>
        </tr></thead>
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Total Items Consumed</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${(stats.totalConsumption ?? 0).toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Total Value</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.totalValue ?? 0)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Avg Daily Consumption</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${(stats.avgDailyConsumption ?? 0).toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Avg Daily Value</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${fmt(stats.avgDailyValue ?? 0)}</td></tr>
        </tbody>
      </table>`;

    const top = (stats.topConsumedItems ?? []) as TopConsumedItem[];
    const topTable = top.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Top Consumed Items</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Item</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Category</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Quantity</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Value</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Avg Daily</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Trend</th>
        </tr></thead>
        <tbody>
          ${top.map((it) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:5px;">${it.name}</td><td style="border:1px solid #e2e8f0;padding:5px;">${it.category}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${it.totalQuantity.toLocaleString()}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${fmt(it.totalValue)}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${it.avgDailyConsumption.toLocaleString()}</td><td style="border:1px solid #e2e8f0;padding:5px;">${it.trend}</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    const dept = (stats.departmentConsumption ?? []) as DepartmentConsumption[];
    const deptTable = dept.length ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Department Consumption</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">Department</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">Quantity</th>
          <th style="border:1px solid #e2e8f0;padding:5px;text-align:right;">% of Total</th>
        </tr></thead>
        <tbody>
          ${dept.map((d) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:5px;">${d.name}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${d.value.toLocaleString()}</td><td style="border:1px solid #e2e8f0;padding:5px;text-align:right;">${departmentShare(d).toFixed(1)}%</td></tr>`,
          ).join('')}
        </tbody>
      </table>` : '';

    printService.printDocument(header + summaryTable + topTable + deptTable + footer, {
      title: 'Consumption Report',
    });
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
        <div className="h-80 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const departments = ['all', ...new Set(stats?.departmentConsumption?.map((d: DepartmentConsumption) => d.name) || [])];
  const categories = ['all', ...new Set(stats?.topConsumedItems?.map((i: TopConsumedItem) => i.category) || [])];

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
          <h1 className="text-2xl font-bold text-gray-900">Consumption Reports</h1>
          <p className="text-gray-600">Usage patterns and consumption trends</p>
        </div>
        <div className="flex gap-2 items-center">
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
              <ChevronDown className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button onClick={handleExportCsv} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export as CSV
                </button>
                <button onClick={handleExportJson} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileJson className="h-4 w-4" /> Export as JSON
                </button>
              </div>
            )}
          </div>
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
          <LineChart data={trendSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => value.toLocaleString()} />
            {showMoneySeries && (
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value, { compact: true, showSymbol: false })} />
            )}
            <Tooltip
              formatter={(value: number, name: string) => [
                name === 'Value' ? formatCurrency(value) : value.toLocaleString(),
                name,
              ]}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="quantity" stroke="#3B82F6" strokeWidth={2} name="Quantity" dot={{ fill: '#3B82F6' }} />
            {showMoneySeries && (
              <Line yAxisId="right" type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} name="Value" dot={{ fill: '#10B981' }} />
            )}
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
                // recharts spreads the datum into the label props but types
                // only `payload`, so read the row from there.
                label={({ payload }) => {
                  const row = payload as DepartmentConsumption;
                  return `${row.name}: ${departmentShare(row).toFixed(1)}%`;
                }}
              >
                {stats?.departmentConsumption?.map((entry: DepartmentConsumption, index: number) => (
                  <Cell key={`cell-${entry.name}`} fill={deptColor(index)} />
                ))}
              </Pie>
              {/* value is consumed quantity, not money */}
              <Tooltip formatter={(value: number | undefined) => (value ?? 0).toLocaleString()} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.departmentConsumption || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => Number(value).toLocaleString()} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip formatter={(value: number | undefined) => (value ?? 0).toLocaleString()} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {stats?.departmentConsumption?.map((entry: DepartmentConsumption, index: number) => (
                  <Cell key={`cell-${entry.name}`} fill={deptColor(index)} />
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
              {stats?.topConsumedItems?.map((item: TopConsumedItem, index: number) => {
                const itemTrend = computedTrend || item.trend;
                return (
                <tr key={item.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{(item.totalQuantity ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(item.totalValue ?? 0)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{(item.avgDailyConsumption ?? 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getTrendBadge(itemTrend)}`}>
                      {getTrendIcon(itemTrend)}
                      {itemTrend === 'up' ? 'Increasing' : itemTrend === 'down' ? 'Decreasing' : 'Stable'}
                    </span>
                  </td>
                </tr>
                );
              })}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.departmentConsumption?.map((dept: DepartmentConsumption, index: number) => (
                <tr key={dept.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: deptColor(index) }}></div>
                      <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">{dept.value.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${departmentShare(dept)}%`, backgroundColor: deptColor(index) }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12">{departmentShare(dept).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-semibold">
                <td className="px-6 py-4 text-sm text-gray-900">Total</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">{departmentTotal.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
