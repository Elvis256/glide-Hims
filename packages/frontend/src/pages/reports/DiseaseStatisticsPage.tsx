import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Activity,
  TrendingUp,
  AlertCircle,
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import {
  num,
  toCsv,
  downloadBlob,
  fmtDateISODay,
  periodLabelFor,
  pct,
  type DateRange,
} from './_reportUtils';

interface DiagnosisRow {
  diagnosis: string;
  count: number;
  icdCode: string;
}

interface DiseaseStats {
  totalDiagnoses: number;
  chronicCases: number;
  acuteCases: number;
  topDiagnoses: DiagnosisRow[];
  chronicVsAcute: Array<{ name: string; value: number; color: string }>;
  icdGroupings: Array<{ group: string; count: number }>;
}

const CHRONIC_ICD_PATTERNS = [
  /^E1[0-4]/, // Diabetes
  /^I1[0-5]/, // Hypertension
  /^J4[4-5]/, // COPD, Asthma
  /^N18/, // Chronic kidney disease
  /^M0[5-6]/, // Rheumatoid/Osteoarthritis
  /^J41|^J42|^J43/, // Chronic bronchitis, emphysema
];
const CHRONIC_KEYWORDS = [
  'hypertension',
  'diabetes',
  'asthma',
  'copd',
  'heart',
  'kidney',
  'arthritis',
  'chronic',
];

const ICD_GROUP_DEFS: Array<{ group: string; firstChars: string[] }> = [
  { group: 'Infectious (A00-B99)', firstChars: ['A', 'B'] },
  { group: 'Respiratory (J00-J99)', firstChars: ['J'] },
  { group: 'Circulatory (I00-I99)', firstChars: ['I'] },
  { group: 'Endocrine (E00-E89)', firstChars: ['E'] },
  { group: 'Digestive (K00-K95)', firstChars: ['K'] },
  { group: 'Genitourinary (N00-N99)', firstChars: ['N'] },
];

export default function DiseaseStatisticsPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [customFrom, setCustomFrom] = useState<string>(fmtDateISODay(monthStart));
  const [customTo, setCustomTo] = useState<string>(fmtDateISODay(today));
  const [showExportMenu, setShowExportMenu] = useState(false);

  const periodParam = dateRange === 'custom' ? 'month' : dateRange;
  const periodLabel = periodLabelFor(dateRange, customFrom, customTo);

  const { data: stats, isLoading, isFetching, refetch } = useQuery<DiseaseStats>({
    queryKey: ['disease-statistics', dateRange, customFrom, customTo, facilityId],
    enabled: !!facilityId,
    queryFn: async () => {
      const params: Record<string, string> = { period: periodParam };
      if (dateRange === 'custom') {
        params.startDate = new Date(customFrom).toISOString();
        params.endDate = new Date(`${customTo}T23:59:59.999Z`).toISOString();
      }

      const response = await api.get('/analytics/clinical', { params });
      const clinical = response.data ?? {};

      const topDiagnoses: DiagnosisRow[] = (
        (clinical.topDiagnoses ?? []) as Array<{
          diagnosis?: string;
          count?: unknown;
          code?: string;
          icd_code?: string;
          icdCode?: string;
        }>
      ).map((d) => ({
        diagnosis: d.diagnosis || 'Unknown',
        count: num(d.count),
        icdCode: d.code || d.icd_code || d.icdCode || '-',
      }));

      const totalDiagnoses = topDiagnoses.reduce((s, d) => s + d.count, 0);

      let chronicCases = 0;
      topDiagnoses.forEach((d) => {
        const code = d.icdCode.toUpperCase();
        const byCode = code !== '-' && CHRONIC_ICD_PATTERNS.some((p) => p.test(code));
        const byKeyword =
          (code === '-' || code === '') &&
          CHRONIC_KEYWORDS.some((k) => d.diagnosis.toLowerCase().includes(k));
        if (byCode || byKeyword) chronicCases += d.count;
      });
      const acuteCases = Math.max(totalDiagnoses - chronicCases, 0);

      const groupBuckets = ICD_GROUP_DEFS.map((g) => ({ group: g.group, count: 0 }));
      const otherBucket = { group: 'Other', count: 0 };

      topDiagnoses.forEach((d) => {
        const code = d.icdCode.toUpperCase();
        const firstChar = code.charAt(0);
        if (code !== '-' && code !== '') {
          const idx = ICD_GROUP_DEFS.findIndex((g) => g.firstChars.includes(firstChar));
          if (idx >= 0) {
            groupBuckets[idx].count += d.count;
            return;
          }
        }
        // keyword fallback
        const name = d.diagnosis.toLowerCase();
        if (
          name.includes('malaria') ||
          name.includes('typhoid') ||
          name.includes('infection') ||
          name.includes('hiv')
        ) {
          groupBuckets[0].count += d.count;
        } else if (
          name.includes('respiratory') ||
          name.includes('pneumonia') ||
          name.includes('asthma') ||
          name.includes('bronchitis')
        ) {
          groupBuckets[1].count += d.count;
        } else if (
          name.includes('hypertension') ||
          name.includes('heart') ||
          name.includes('cardiac')
        ) {
          groupBuckets[2].count += d.count;
        } else if (name.includes('diabetes') || name.includes('thyroid')) {
          groupBuckets[3].count += d.count;
        } else if (
          name.includes('gastro') ||
          name.includes('ulcer') ||
          name.includes('diarrhea')
        ) {
          groupBuckets[4].count += d.count;
        } else if (name.includes('urinary') || name.includes('kidney') || name.includes('uti')) {
          groupBuckets[5].count += d.count;
        } else {
          otherBucket.count += d.count;
        }
      });

      const icdGroupings = [...groupBuckets, otherBucket].filter((g) => g.count > 0);

      return {
        totalDiagnoses,
        chronicCases,
        acuteCases,
        topDiagnoses,
        chronicVsAcute: [
          { name: 'Chronic', value: chronicCases, color: '#8B5CF6' },
          { name: 'Acute', value: acuteCases, color: '#10B981' },
        ].filter((s) => s.value > 0),
        icdGroupings,
      };
    },
  });

  const totalTopDx = useMemo(
    () => (stats?.topDiagnoses ?? []).reduce((s, d) => s + d.count, 0),
    [stats],
  );

  const handleExportCsv = () => {
    if (!stats) return;
    const rows: Array<Array<unknown>> = [
      ['Disease Statistics Report'],
      ['Facility', inst?.name ?? ''],
      ['Period', periodLabel],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Metric', 'Value'],
      ['Total Diagnoses', stats.totalDiagnoses],
      ['Chronic Cases', stats.chronicCases],
      ['Acute Cases', stats.acuteCases],
      [
        'Chronic Rate',
        stats.totalDiagnoses
          ? ((stats.chronicCases / stats.totalDiagnoses) * 100).toFixed(1) + '%'
          : '—',
      ],
      [],
      ['ICD Code Groupings'],
      ['Group', 'Count', 'Percentage'],
      ...stats.icdGroupings.map((g) => [
        g.group,
        g.count,
        pct(g.count, stats.totalDiagnoses),
      ]),
      [],
      ['Top Diagnoses'],
      ['Rank', 'Diagnosis', 'ICD Code', 'Cases', 'Percentage'],
      ...stats.topDiagnoses.map((d, i) => [
        i + 1,
        d.diagnosis,
        d.icdCode,
        d.count,
        pct(d.count, totalTopDx),
      ]),
    ];
    downloadBlob(
      `disease-statistics-${fmtDateISODay(new Date())}.csv`,
      'text/csv;charset=utf-8',
      toCsv(rows),
    );
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!stats) return;
    const payload = {
      report: 'Disease Statistics',
      facility: inst?.name ?? null,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      ...stats,
    };
    downloadBlob(
      `disease-statistics-${fmtDateISODay(new Date())}.json`,
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
      <h2 style="font-size:16px;margin:16px 0 8px;color:#1e293b;">Disease Statistics — ${periodLabel}</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <tbody>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;width:40%;">Total Diagnoses</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.totalDiagnoses.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Chronic Cases</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.chronicCases.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Acute Cases</td><td style="border:1px solid #e2e8f0;padding:6px;">${stats.acuteCases.toLocaleString()}</td></tr>
          <tr><td style="border:1px solid #e2e8f0;padding:6px;font-weight:600;">Chronic Rate</td><td style="border:1px solid #e2e8f0;padding:6px;">${pct(stats.chronicCases, stats.totalDiagnoses)}</td></tr>
        </tbody>
      </table>`;

    const groupTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">ICD Code Groupings</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Group</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Cases</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">% of Total</th>
        </tr></thead>
        <tbody>
          ${stats.icdGroupings
            .map(
              (g) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${g.group}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${g.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(g.count, stats.totalDiagnoses)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    const dxTable = `
      <h3 style="font-size:13px;margin:12px 0 6px;color:#334155;">Top Diagnoses</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">#</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">Diagnosis</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:left;">ICD</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">Cases</th>
          <th style="border:1px solid #e2e8f0;padding:6px;text-align:right;">%</th>
        </tr></thead>
        <tbody>
          ${stats.topDiagnoses
            .map(
              (d, i) =>
                `<tr><td style="border:1px solid #e2e8f0;padding:6px;">${i + 1}</td><td style="border:1px solid #e2e8f0;padding:6px;">${d.diagnosis}</td><td style="border:1px solid #e2e8f0;padding:6px;font-family:monospace;">${d.icdCode}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${d.count}</td><td style="border:1px solid #e2e8f0;padding:6px;text-align:right;">${pct(d.count, totalTopDx)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    printService.printDocument(header + summary + groupTable + dxTable + footer, {
      title: `Disease Statistics — ${periodLabel}`,
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
          <h1 className="text-2xl font-bold text-gray-900">Disease Statistics</h1>
          <p className="text-gray-600">Diagnosis trends and ICD code analysis</p>
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
              <p className="text-sm text-gray-600">Total Diagnoses</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalDiagnoses?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Heart className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Chronic Cases</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.chronicCases?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Acute Cases</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.acuteCases?.toLocaleString() ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Chronic Rate</p>
              <p className="text-2xl font-bold text-purple-600">
                {pct(stats?.chronicCases ?? 0, stats?.totalDiagnoses ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Diagnoses</h3>
          {(stats?.topDiagnoses?.length ?? 0) === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
              No diagnoses recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(stats?.topDiagnoses ?? []).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="diagnosis" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Chronic vs Acute Breakdown</h3>
          {(stats?.chronicVsAcute?.length ?? 0) === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.chronicVsAcute ?? []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {(stats?.chronicVsAcute ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {(stats?.chronicVsAcute ?? []).map((item) => (
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
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ICD Code Groupings</h3>
        {(stats?.icdGroupings?.length ?? 0) === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
            No coded diagnoses
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.icdGroupings ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="group"
                tick={{ fontSize: 10 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Diagnosis Breakdown</h3>
          <span className="text-xs text-gray-400">
            Total: {totalTopDx.toLocaleString()} cases
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Diagnosis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ICD Code
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cases
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Percentage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(stats?.topDiagnoses ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    No diagnoses
                  </td>
                </tr>
              ) : (
                (stats?.topDiagnoses ?? []).map((diagnosis, index) => {
                  const percentage = totalTopDx > 0 ? (diagnosis.count / totalTopDx) * 100 : 0;
                  return (
                    <tr key={`${diagnosis.diagnosis}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-500">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {diagnosis.diagnosis}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                          {diagnosis.icdCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right tabular-nums">
                        {diagnosis.count.toLocaleString()}
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
