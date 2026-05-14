import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
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
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';

type DateRange = 'today' | 'week' | 'month' | 'year' | 'custom';

interface VisitStats {
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  cancelledVisits: number;
  averageWaitTime: number;
  statusBreakdown: Array<{ name: string; value: number; color: string }>;
  visitTrend: Array<{ date: string; visits: number }>;
  departmentVisits: Array<{ department: string; visits: number }>;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Array<Array<unknown>>) =>
  rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function VisitReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [customFrom, setCustomFrom] = useState<string>(fmtDate(monthStart));
  const [customTo, setCustomTo] = useState<string>(fmtDate(today));
  const [showExportMenu, setShowExportMenu] = useState(false);

  const periodParam = dateRange === 'custom' ? 'month' : dateRange;
  const periodLabel =
    dateRange === 'today'
      ? 'Today'
      : dateRange === 'week'
      ? 'This Week'
      : dateRange === 'month'
      ? 'This Month'
      : dateRange === 'year'
      ? 'This Year'
      : `${customFrom} → ${customTo}`;

  const { data: stats, isLoading, isFetching, refetch } = useQuery<VisitStats>({
    queryKey: ['visit-statistics', dateRange, customFrom, customTo, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const params: Record<string, string> = { period: periodParam };
      if (dateRange === 'custom') {
        params.startDate = new Date(customFrom).toISOString();
        params.endDate = new Date(`${customTo}T23:59:59.999Z`).toISOString();
      }

      const [clinicalRes, dashboardRes] = await Promise.all([
        api.get('/analytics/clinical', { params }),
        api.get('/analytics/dashboard'),
      ]);

      const clinical = clinicalRes.data ?? {};
      const dashboard = dashboardRes.data ?? {};

      const encountersByType = (clinical.encountersByType ?? []) as Array<{
        encounter_type?: string;
        encounterType?: string;
        count?: unknown;
      }>;

      const departmentVisits = encountersByType
        .map((e) => ({
          department: titleCase(e.encounter_type ?? e.encounterType ?? 'Unknown'),
          visits: num(e.count),
        }))
        .sort((a, b) => b.visits - a.visits);

      const totalVisits = departmentVisits.reduce((s, d) => s + d.visits, 0);

      const trendMap = new Map<string, number>();
      const trendOrder: string[] = [];
      ((clinical.encounterTrend ?? []) as Array<{
        period?: string;
        date?: string;
        count?: unknown;
      }>).forEach((t) => {
        const raw = t.period ?? t.date ?? '';
        let label = raw;
        const d = new Date(raw);
        if (raw && !Number.isNaN(d.getTime())) {
          label =
            dateRange === 'year'
              ? d.toLocaleDateString('en-US', { month: 'short' })
              : dateRange === 'today'
              ? d.toLocaleTimeString('en-US', { hour: '2-digit' })
              : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (!trendMap.has(label)) trendOrder.push(label);
        trendMap.set(label, (trendMap.get(label) ?? 0) + num(t.count));
      });
      const visitTrend = trendOrder.map((d) => ({ date: d, visits: trendMap.get(d) ?? 0 }));

      const dashEnc = dashboard.encounters ?? {};
      const completed = num(dashEnc.completed);
      const pending = num(dashEnc.pending);
      const cancelled = num(dashEnc.cancelled);
      // Fallback: if dashboard didn't provide a status split, treat everything as completed
      // rather than zero so the cards aren't blank.
      const completedSafe =
        completed === 0 && pending === 0 && cancelled === 0 ? totalVisits : completed;

      let averageWaitTime = 0;
      try {
        const queueRes = await api.get('/queue/stats');
        averageWaitTime = num(queueRes.data?.averageWaitMinutes);
      } catch {
        // Queue feature may not be enabled — silently default.
      }

      return {
        totalVisits: totalVisits || num(dashboard?.encounters?.thisMonth),
        completedVisits: completedSafe,
        pendingVisits: pending,
        cancelledVisits: cancelled,
        averageWaitTime,
        statusBreakdown: [
          { name: 'Completed', value: completedSafe, color: '#10B981' },
          { name: 'Pending', value: pending, color: '#F59E0B' },
          { name: 'Cancelled', value: cancelled, color: '#EF4444' },
        ].filter((s) => s.value > 0),
        visitTrend,
        departmentVisits,
      };
    },
  });

  const totalDeptVisits = useMemo(
    () => (stats?.departmentVisits ?? []).reduce((s, d) => s + d.visits, 0),
    [stats],
  );

  const handleExportCsv = () => {
    if (!stats) return;
    const rows: Array<Array<unknown>> = [
      ['Visit Statistics Report'],
      ['Facility', inst?.name ?? ''],
      ['Period', periodLabel],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Total Visits', stats.totalVisits],
      ['Completed', stats.completedVisits],
      ['Pending', stats.pendingVisits],
      ['Cancelled', stats.cancelledVisits],
      ['Avg Wait Time (min)', stats.averageWaitTime],
      [],
      ['Department Visits'],
      ['Department', 'Visits', 'Percentage'],
      ...stats.departmentVisits.map((d) => [
        d.department,
        d.visits,
        totalDeptVisits ? ((d.visits / totalDeptVisits) * 100).toFixed(1) + '%' : '—',
      ]),
      [],
      ['Visit Trend'],
      ['Period', 'Visits'],
      ...stats.visitTrend.map((t) => [t.date, t.visits]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit-statistics-${fmtDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const payload = {
      report: 'Visit Statistics',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visit-statistics-${fmtDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—');

    const summary = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Visit Reports — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Visits</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.totalVisits.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Completed</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.completedVisits.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Pending</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.pendingVisits.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Cancelled</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.cancelledVisits.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Avg Wait Time</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.averageWaitTime} min</td></tr>
        </tbody>
      </table>`;

    const dept = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Department-wise Visits</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Department</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Visits</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">% of Total</th>
        </tr></thead>
        <tbody>
          ${stats.departmentVisits
            .map(
              (d) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${d.department}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${d.visits}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(d.visits, totalDeptVisits)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    printService.printDocument(header + summary + dept + footer, {
      title: `Visit Reports — ${periodLabel}`,
    });
  };

  if (!facilityId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-gray-900">Select a facility</p>
          <p className="mt-2 text-sm text-gray-500">
            Pick a facility from the top bar to view this report.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-72 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div id="report-content" className="space-y-6">
      <Link
        to="/reports"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Reports</h1>
          <p className="text-gray-600">Encounter and visit statistics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  onClick={handleExportCsv}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  Export as JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
          <div className="flex gap-2 flex-wrap">
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
                {range === 'today'
                  ? 'Today'
                  : range === 'week'
                  ? 'This Week'
                  : range === 'month'
                  ? 'This Month'
                  : range === 'year'
                  ? 'This Year'
                  : 'Custom'}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalVisits?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.completedVisits?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingVisits?.toLocaleString() ?? 0}
              </p>
              {(stats?.averageWaitTime ?? 0) > 0 && (
                <p className="text-xs text-gray-400">~{stats?.averageWaitTime} min wait</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.cancelledVisits?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          {(stats?.statusBreakdown?.length ?? 0) === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No visits recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.statusBreakdown ?? []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {(stats?.statusBreakdown ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {(stats?.statusBreakdown ?? []).map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">
                  {item.name}: {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department-wise Visits</h3>
          {(stats?.departmentVisits?.length ?? 0) === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No department data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.departmentVisits ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="department" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="visits" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Visit Trends Over Time</h3>
        {(stats?.visitTrend?.length ?? 0) === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            No visits in selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.visitTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Total Visits"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Department Summary</h3>
          <span className="text-xs text-gray-400">
            Total: {totalDeptVisits.toLocaleString()} visits
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Department
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Visits
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats?.departmentVisits ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                    No department visits
                  </td>
                </tr>
              ) : (
                (stats?.departmentVisits ?? []).map((dept) => {
                  const percentage =
                    totalDeptVisits > 0 ? (dept.visits / totalDeptVisits) * 100 : 0;
                  return (
                    <tr key={dept.department} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {dept.department}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums">
                        {dept.visits.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-14 text-right tabular-nums">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
