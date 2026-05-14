import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Skull,
  TrendingDown,
  Users,
  Heart,
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
  ComposedChart,
  Line,
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { num, toCsv, downloadBlob, fmtDateISODay, pct } from './_reportUtils';

// BE only supports week | month | quarter | year here
type MortalityRange = 'week' | 'month' | 'quarter' | 'year';

interface CauseRow {
  cause: string;
  icdCode: string;
  count: number;
}

interface MortalityStats {
  totalDeaths: number;
  mortalityRate: number;
  maleDeaths: number;
  femaleDeaths: number;
  averageAge: number;
  causesOfDeath: CauseRow[];
  genderDistribution: Array<{ name: string; value: number; color: string }>;
  ageDistribution: Array<{ group: string; count: number }>;
  monthlyTrend: Array<{ month: string; deaths: number; rate: number }>;
}

const RANGE_LABELS: Record<MortalityRange, string> = {
  week: 'Past 7 Days',
  month: 'This Month',
  quarter: 'Past Quarter',
  year: 'This Year',
};

export default function MortalityReportsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [range, setRange] = useState<MortalityRange>('month');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { data: stats, isLoading, isFetching, refetch } = useQuery<MortalityStats>({
    queryKey: ['mortality-statistics', range, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const response = await api.get('/mortality/statistics', { params: { range } });
      const d = response.data ?? {};

      const causesOfDeath: CauseRow[] = ((d.causesOfDeath ?? []) as Array<{
        cause?: string;
        icdCode?: string;
        count?: unknown;
      }>).map((c) => ({
        cause: c.cause ?? 'Unknown',
        icdCode: c.icdCode ?? '',
        count: num(c.count),
      }));

      const genderRaw = (d.genderDistribution ?? []) as Array<{
        name?: string;
        value?: unknown;
      }>;
      const genderColors: Record<string, string> = {
        Male: '#3B82F6',
        Female: '#EC4899',
        Unknown: '#9CA3AF',
      };
      const genderDistribution = genderRaw
        .map((g) => ({
          name: g.name ?? 'Unknown',
          value: num(g.value),
          color: genderColors[g.name ?? ''] ?? '#9CA3AF',
        }))
        .filter((g) => g.value > 0);

      // BE returns { range, count } — page consumes { group, count }
      const ageDistribution = ((d.ageDistribution ?? []) as Array<{
        range?: string;
        group?: string;
        count?: unknown;
      }>).map((a) => ({
        group: a.range ?? a.group ?? '',
        count: num(a.count),
      }));

      const monthlyTrend = ((d.monthlyTrend ?? []) as Array<{
        month?: string;
        deaths?: unknown;
        rate?: unknown;
      }>).map((m) => ({
        month: m.month ?? '',
        deaths: num(m.deaths),
        rate: num(m.rate),
      }));

      return {
        totalDeaths: num(d.totalDeaths),
        mortalityRate: num(d.mortalityRate),
        maleDeaths: num(d.maleDeaths),
        femaleDeaths: num(d.femaleDeaths),
        averageAge: num(d.averageAge),
        causesOfDeath,
        genderDistribution,
        ageDistribution,
        monthlyTrend,
      };
    },
  });

  const totalCauses = useMemo(
    () => (stats?.causesOfDeath ?? []).reduce((s, c) => s + c.count, 0),
    [stats],
  );
  const periodLabel = RANGE_LABELS[range];

  const handleExportCsv = () => {
    if (!stats) return;
    const rows: Array<Array<unknown>> = [
      ['Mortality Statistics Report'],
      ['Facility', inst?.name ?? ''],
      ['Period', periodLabel],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Total Deaths', stats.totalDeaths],
      ['Mortality Rate (%)', stats.mortalityRate],
      ['Male Deaths', stats.maleDeaths],
      ['Female Deaths', stats.femaleDeaths],
      ['Average Age (years)', stats.averageAge],
      [],
      ['Age Distribution'],
      ['Age Group', 'Deaths'],
      ...stats.ageDistribution.map((a) => [`${a.group} years`, a.count]),
      [],
      ['Causes of Death'],
      ['Cause', 'ICD Code', 'Deaths', 'Percentage'],
      ...stats.causesOfDeath.map((c) => [
        c.cause,
        c.icdCode || '—',
        c.count,
        pct(c.count, totalCauses),
      ]),
      [],
      ['Monthly Trend'],
      ['Month', 'Deaths', 'Rate per 1000 admissions'],
      ...stats.monthlyTrend.map((m) => [m.month, m.deaths, m.rate]),
    ];
    downloadBlob(
      `mortality-statistics-${fmtDateISODay(new Date())}.csv`,
      'text/csv;charset=utf-8',
      toCsv(rows),
    );
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const payload = {
      report: 'Mortality Statistics',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(
      `mortality-statistics-${fmtDateISODay(new Date())}.json`,
      'application/json',
      JSON.stringify(payload, null, 2),
    );
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!stats) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');

    const summary = `
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Mortality Reports — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Deaths</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.totalDeaths.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Mortality Rate</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.mortalityRate}%</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Male / Female</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.maleDeaths} / ${stats.femaleDeaths}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Average Age</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.averageAge} years</td></tr>
        </tbody>
      </table>`;

    const ageTable = stats.ageDistribution.length
      ? `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Age Distribution</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Age Group</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Deaths</th>
        </tr></thead>
        <tbody>
          ${stats.ageDistribution
            .map(
              (a) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${a.group} years</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${a.count}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`
      : '';

    const causesTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Causes of Death</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Cause</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">ICD</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Deaths</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">%</th>
        </tr></thead>
        <tbody>
          ${stats.causesOfDeath
            .map(
              (c) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${c.cause}</td><td style="border:1px solid #e2e8f0;padding:6px;font-family:monospace;">${c.icdCode || '—'}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${c.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(c.count, totalCauses)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    printService.printDocument(header + summary + ageTable + causesTable + footer, {
      title: `Mortality Reports — ${periodLabel}`,
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
        <div className="h-72 rounded-lg bg-gray-100 animate-pulse" />
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
          <h1 className="text-2xl font-bold text-gray-900">Mortality Reports</h1>
          <p className="text-gray-600">Death statistics and analysis</p>
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
            {(['week', 'month', 'quarter', 'year'] as MortalityRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                  range === r
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Skull className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Deaths</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalDeaths?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mortality Rate</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats?.mortalityRate ?? 0}%
              </p>
              <p className="text-xs text-gray-400">Deaths / admissions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Age</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.averageAge ?? 0} <span className="text-base">yrs</span>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Heart className="h-6 w-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-600">Top Cause</p>
              <p className="text-lg font-bold text-gray-900 truncate" title={stats?.causesOfDeath?.[0]?.cause ?? ''}>
                {stats?.causesOfDeath?.[0]?.cause ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
          {(stats?.genderDistribution?.length ?? 0) === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No deaths recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.genderDistribution ?? []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {(stats?.genderDistribution ?? []).map((entry, i) => (
                    <Cell key={`g-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">Male: {stats?.maleDeaths ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-sm text-gray-600">Female: {stats?.femaleDeaths ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
          {(stats?.ageDistribution?.length ?? 0) === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No age data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.ageDistribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6B7280" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Causes of Death</h3>
        {(stats?.causesOfDeath?.length ?? 0) === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            No causes recorded
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.causesOfDeath ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="cause" type="category" width={160} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">12-Month Mortality Trend</h3>
        {(stats?.monthlyTrend?.length ?? 0) === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            No trend data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={stats?.monthlyTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" orientation="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="deaths"
                fill="#EF4444"
                name="Deaths"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate"
                stroke="#F59E0B"
                strokeWidth={2}
                name="Rate per 1000"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Causes of Death</h3>
          <span className="text-xs text-gray-400">
            Total: {totalCauses.toLocaleString()} deaths
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cause
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ICD Code
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Deaths
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats?.causesOfDeath ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                    No causes recorded
                  </td>
                </tr>
              ) : (
                (stats?.causesOfDeath ?? []).map((cause, i) => {
                  const percentage = totalCauses > 0 ? (cause.count / totalCauses) * 100 : 0;
                  return (
                    <tr key={`${cause.cause}-${i}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {cause.cause}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                          {cause.icdCode || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums">
                        {cause.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all"
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
