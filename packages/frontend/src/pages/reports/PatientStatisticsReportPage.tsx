import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserCheck,
  Baby,
  User,
  UserCircle,
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

interface AgeGroupRow {
  group: string;
  count: number;
  male?: number;
  female?: number;
}

interface PatientStats {
  total: number;
  newThisMonth: number;
  returningThisMonth: number;
  male: number;
  female: number;
  unknownGender: number;
  ageGroups: AgeGroupRow[];
  registrationTrend: Array<{ date: string; new: number }>;
  growthRate: number | null;
  previousPeriodNew: number | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ageOrder = (g: string): number => {
  const m = g.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 999;
};

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export default function PatientStatisticsReportPage() {
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

  const { data: stats, isLoading, isFetching, refetch } = useQuery<PatientStats>({
    queryKey: ['patient-statistics', dateRange, customFrom, customTo, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const params: Record<string, string> = { period: periodParam };
      if (dateRange === 'custom') {
        params.startDate = new Date(customFrom).toISOString();
        params.endDate = new Date(`${customTo}T23:59:59.999Z`).toISOString();
      }

      const [analyticsRes, dashboardRes] = await Promise.all([
        api.get('/analytics/patients', { params }),
        api.get('/analytics/dashboard'),
      ]);

      const analytics = analyticsRes.data ?? {};
      const dashboard = dashboardRes.data ?? {};

      const genderMap: Record<string, number> = {};
      (analytics.genderDistribution ?? []).forEach((g: { gender?: string; count?: unknown }) => {
        const key = (g.gender ?? '').toString().toLowerCase();
        genderMap[key] = (genderMap[key] ?? 0) + num(g.count);
      });

      const ageGroups: AgeGroupRow[] = ((analytics.ageDistribution ?? []) as Array<{
        age_group?: string;
        ageGroup?: string;
        group?: string;
        count?: unknown;
        male?: unknown;
        female?: unknown;
      }>)
        .map((a) => ({
          group: a.age_group ?? a.ageGroup ?? a.group ?? '',
          count: num(a.count),
          male: a.male !== undefined ? num(a.male) : undefined,
          female: a.female !== undefined ? num(a.female) : undefined,
        }))
        .filter((a) => a.group)
        .sort((a, b) => ageOrder(a.group) - ageOrder(b.group));

      const registrationTrend = ((analytics.registrationTrend ?? []) as Array<{
        period?: string;
        date?: string;
        count?: unknown;
      }>).map((t, idx) => {
        const raw = t.period ?? t.date ?? '';
        let label = `Pt ${idx + 1}`;
        if (raw) {
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime())) {
            label =
              dateRange === 'year'
                ? d.toLocaleDateString('en-US', { month: 'short' })
                : dateRange === 'today'
                ? d.toLocaleTimeString('en-US', { hour: '2-digit' })
                : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } else {
            label = raw;
          }
        }
        return { date: label, new: num(t.count) };
      });

      const newThisMonth = num(dashboard?.patients?.newThisMonth);
      const total = num(dashboard?.patients?.total);
      const encountersThisMonth = num(dashboard?.encounters?.thisMonth);
      const returningThisMonth = Math.max(encountersThisMonth - newThisMonth, 0);

      // Growth: current period new vs previous period new (best-effort from BE if present, else null).
      const previousPeriodNew =
        analytics.previousPeriodNew !== undefined ? num(analytics.previousPeriodNew) : null;
      const currentPeriodNew = num(analytics.currentPeriodNew ?? analytics.totalNew ?? newThisMonth);
      const growthRate =
        previousPeriodNew !== null && previousPeriodNew > 0
          ? ((currentPeriodNew - previousPeriodNew) / previousPeriodNew) * 100
          : null;

      return {
        total,
        newThisMonth,
        returningThisMonth,
        male: genderMap['male'] ?? genderMap['m'] ?? 0,
        female: genderMap['female'] ?? genderMap['f'] ?? 0,
        unknownGender:
          (genderMap['unknown'] ?? 0) + (genderMap['other'] ?? 0) + (genderMap[''] ?? 0),
        ageGroups,
        registrationTrend,
        growthRate,
        previousPeriodNew,
      };
    },
  });

  const totalAgeCount = useMemo(
    () => (stats?.ageGroups ?? []).reduce((s, g) => s + g.count, 0),
    [stats],
  );

  const genderTotal = (stats?.male ?? 0) + (stats?.female ?? 0) + (stats?.unknownGender ?? 0);

  const genderData = [
    { name: 'Male', value: stats?.male ?? 0, color: '#3B82F6' },
    { name: 'Female', value: stats?.female ?? 0, color: '#EC4899' },
    ...((stats?.unknownGender ?? 0) > 0
      ? [{ name: 'Unknown', value: stats!.unknownGender, color: '#9CA3AF' }]
      : []),
  ];

  const handleExportCsv = () => {
    if (!stats) return;
    const rows: Array<Array<unknown>> = [
      ['Patient Statistics Report'],
      ['Facility', inst?.name ?? ''],
      ['Period', periodLabel],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Total Patients (lifetime)', stats.total],
      ['New This Month', stats.newThisMonth],
      ['Est. Returning This Month', stats.returningThisMonth],
      ['Growth Rate (%)', stats.growthRate === null ? 'N/A' : stats.growthRate.toFixed(1)],
      [],
      ['Gender Breakdown'],
      ['Gender', 'Count', 'Percentage'],
      ['Male', stats.male, genderTotal ? ((stats.male / genderTotal) * 100).toFixed(1) + '%' : '—'],
      [
        'Female',
        stats.female,
        genderTotal ? ((stats.female / genderTotal) * 100).toFixed(1) + '%' : '—',
      ],
      ...(stats.unknownGender > 0
        ? [
            [
              'Unknown',
              stats.unknownGender,
              genderTotal ? ((stats.unknownGender / genderTotal) * 100).toFixed(1) + '%' : '—',
            ],
          ]
        : []),
      [],
      ['Age Group Distribution'],
      ['Age Group', 'Count', 'Percentage', 'Male', 'Female'],
      ...stats.ageGroups.map((g) => [
        `${g.group} years`,
        g.count,
        totalAgeCount ? ((g.count / totalAgeCount) * 100).toFixed(1) + '%' : '—',
        g.male ?? '',
        g.female ?? '',
      ]),
      [],
      ['Registration Trend'],
      ['Period', 'New Patients'],
      ...stats.registrationTrend.map((t) => [t.date, t.new]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-statistics-${fmtDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const payload = {
      report: 'Patient Statistics',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-statistics-${fmtDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—');

    const summaryTable = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Patient Statistics — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Patients (lifetime)</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.total.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">New This Month</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.newThisMonth.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Est. Returning This Month</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.returningThisMonth.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Growth vs previous period</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.growthRate === null ? 'N/A' : (stats.growthRate >= 0 ? '+' : '') + stats.growthRate.toFixed(1) + '%'}</td></tr>
        </tbody>
      </table>`;

    const genderTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Gender Distribution</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;"><th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Gender</th><th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Count</th><th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">%</th></tr></thead>
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Male</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.male}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(stats.male, genderTotal)}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;">Female</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.female}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(stats.female, genderTotal)}</td></tr>
          ${stats.unknownGender > 0 ? `<tr><td style="border:1px solid #e2e8f0;padding:6px;">Unknown</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${stats.unknownGender}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(stats.unknownGender, genderTotal)}</td></tr>` : ''}
        </tbody>
      </table>`;

    const ageTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Age Group Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Age Group</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Count</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">% of Total</th>
        </tr></thead>
        <tbody>
          ${stats.ageGroups
            .map(
              (g) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${g.group} years</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${g.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(g.count, totalAgeCount)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    printService.printDocument(header + summaryTable + genderTable + ageTable + footer, {
      title: `Patient Statistics — ${periodLabel}`,
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

  const growthDisplay =
    stats?.growthRate === null || stats?.growthRate === undefined
      ? '—'
      : `${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`;
  const growthIsUp = (stats?.growthRate ?? 0) >= 0;

  return (
    <div id="report-content" className="space-y-6">
      {/* Breadcrumb */}
      <Link
        to="/reports"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Statistics</h1>
          <p className="text-gray-600">Demographics, registrations, and patient trends</p>
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

      {/* Date Range Filter */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.total?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-gray-400">Lifetime</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">New This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.newThisMonth?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Est. Returning</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.returningThisMonth?.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-gray-400">Encounters − new registrations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              {growthIsUp ? (
                <TrendingUp className="h-6 w-6 text-orange-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-orange-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Growth vs prev. period</p>
              <p
                className={`text-2xl font-bold ${
                  stats?.growthRate === null
                    ? 'text-gray-400'
                    : growthIsUp
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {growthDisplay}
              </p>
              {stats?.growthRate === null && (
                <p className="text-xs text-gray-400">Needs prior period data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
          {genderTotal === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No gender data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">
                Male: {stats?.male?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500"></div>
              <span className="text-sm text-gray-600">
                Female: {stats?.female?.toLocaleString() ?? 0}
              </span>
            </div>
            {(stats?.unknownGender ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-sm text-gray-600">
                  Unknown: {stats?.unknownGender?.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Age Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
          {totalAgeCount === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No age data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.ageGroups ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Registration Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Trend</h3>
        {(stats?.registrationTrend?.length ?? 0) === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            No registrations in selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.registrationTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="new"
                stroke="#10B981"
                strokeWidth={2}
                name="New Patients"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-gray-400 mt-2">Returning-patient trend tracking coming soon</p>
      </div>

      {/* Age Group Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Age Group Breakdown</h3>
          <span className="text-xs text-gray-400">
            Total: {totalAgeCount.toLocaleString()} patients
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Age Group
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats?.ageGroups ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-400">
                    No age data
                  </td>
                </tr>
              ) : (
                (stats?.ageGroups ?? []).map((group, index) => {
                  const percentage = totalAgeCount > 0 ? (group.count / totalAgeCount) * 100 : 0;
                  const icons = [Baby, Baby, User, User, UserCircle, UserCircle];
                  const Icon = icons[index] ?? User;
                  return (
                    <tr key={group.group} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" />
                          {group.group} years
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums">
                        {group.count.toLocaleString()}
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
