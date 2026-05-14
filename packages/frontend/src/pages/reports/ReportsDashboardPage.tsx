import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  FileText,
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Banknote,
  Calendar,
  ArrowRight,
  Download,
  Printer,
  Clock,
  ExternalLink,
  Search,
  Star,
  StarOff,
  ChevronDown,
  Building2,
  Stethoscope,
  Briefcase,
  ShoppingCart,
  ClipboardCheck,
  RefreshCcw,
} from 'lucide-react';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

interface DateRange {
  from: string;
  to: string;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function getPresetRange(period: Exclude<Period, 'custom'>): DateRange {
  const now = new Date();
  const to = endOfDay(now).toISOString();
  let from: Date;
  switch (period) {
    case 'today':
      from = startOfDay(now);
      break;
    case 'week':
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      from = startOfDay(from);
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      break;
  }
  return { from: from.toISOString(), to };
}

/** Compute a comparable "previous" range of equal length immediately preceding `range`. */
function getPreviousRange(range: DateRange): DateRange {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();
  const span = Math.max(toMs - fromMs, 1);
  const prevTo = new Date(fromMs - 1);
  const prevFrom = new Date(fromMs - 1 - span);
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'This Month',
  year: 'This Year',
  custom: 'Custom',
};

// ---------------------------------------------------------------------------
// LocalStorage: recently visited + pinned reports
// ---------------------------------------------------------------------------

const RECENT_KEY = 'glide-hims-recent-reports';
const PINNED_KEY = 'glide-hims-pinned-reports';

interface RecentReport {
  name: string;
  href: string;
  visitedAt: string;
  category: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getRecentReports(): RecentReport[] {
  return readJson<RecentReport[]>(RECENT_KEY, []);
}
function getPinnedReports(): string[] {
  return readJson<string[]>(PINNED_KEY, []);
}
function trackReportVisit(name: string, href: string, category: string) {
  const recent = getRecentReports().filter((r) => r.href !== href);
  recent.unshift({ name, href, visitedAt: new Date().toISOString(), category });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function rowsToCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}
function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SummaryStats {
  totalPatients: number;
  totalEncounters: number;
  totalInvoices: number;
  totalRevenue: number;
  collectionRate: number;
}

interface SummaryWithComparison extends SummaryStats {
  prev?: SummaryStats;
}

async function fetchSummary(range: DateRange): Promise<SummaryStats> {
  const params = `&startDate=${encodeURIComponent(range.from)}&endDate=${encodeURIComponent(range.to)}`;
  const [patients, encounters, billing, revenue] = await Promise.all([
    api.get(`/patients?limit=1${params}`).catch(() => ({ data: { meta: { total: 0 }, total: 0 } })),
    api.get(`/encounters?limit=1${params}`).catch(() => ({ data: { total: 0 } })),
    api.get(`/billing/invoices?limit=1${params}`).catch(() => ({ data: { total: 0, totalAmount: 0 } })),
    api
      .get(`/analytics/financial?startDate=${encodeURIComponent(range.from)}&endDate=${encodeURIComponent(range.to)}`)
      .catch(() => ({ data: { totalRevenue: 0, collectionsTotal: 0 } })),
  ]);
  const totalRevenue =
    revenue.data?.revenueTrend?.reduce(
      (sum: number, t: { revenue: string | number }) => sum + Number(t.revenue || 0),
      0,
    ) || Number(revenue.data?.totalRevenue || 0);
  const totalCollections = Number(revenue.data?.collectionsTotal || 0);
  return {
    totalPatients: patients.data?.meta?.total ?? patients.data?.total ?? 0,
    totalEncounters: encounters.data?.total ?? 0,
    totalInvoices: billing.data?.total ?? 0,
    totalRevenue,
    collectionRate: totalRevenue > 0 ? parseFloat(((totalCollections / totalRevenue) * 100).toFixed(1)) : 0,
  };
}

interface ReportLink {
  name: string;
  href: string;
  icon: typeof FileText;
  description: string;
}

interface ReportCategory {
  title: string;
  icon: typeof FileText;
  color: string;
  reports: ReportLink[];
}

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: 'Clinical Reports',
    icon: Activity,
    color: 'bg-blue-500',
    reports: [
      { name: 'Patient Statistics', href: '/reports/patients', icon: Users, description: 'Demographics, registrations, and patient trends' },
      { name: 'Visit Reports', href: '/reports/visits', icon: ClipboardList, description: 'Encounter history and visit patterns' },
      { name: 'Disease Statistics', href: '/reports/diseases', icon: Activity, description: 'Diagnosis trends and disease prevalence' },
      { name: 'Mortality Reports', href: '/reports/mortality', icon: FileText, description: 'Mortality statistics and causes' },
    ],
  },
  {
    title: 'Financial Reports',
    icon: DollarSign,
    color: 'bg-green-500',
    reports: [
      { name: 'Revenue Reports', href: '/reports/revenue', icon: TrendingUp, description: 'Income analysis and revenue trends' },
      { name: 'Collection Reports', href: '/reports/collections', icon: Banknote, description: 'Payment collections and cash flow' },
      { name: 'Outstanding Reports', href: '/reports/outstanding', icon: AlertTriangle, description: 'Unpaid invoices and aging analysis' },
      { name: 'Finance Reports', href: '/finance/reports', icon: Briefcase, description: 'P&L, trial balance, custom finance reports' },
    ],
  },
  {
    title: 'Inventory Reports',
    icon: Package,
    color: 'bg-purple-500',
    reports: [
      { name: 'Stock Reports', href: '/reports/stock', icon: Boxes, description: 'Current stock levels and valuation' },
      { name: 'Expiry Reports', href: '/reports/expiry', icon: AlertTriangle, description: 'Items nearing or past expiry date' },
      { name: 'Consumption Reports', href: '/reports/consumption', icon: BarChart3, description: 'Usage patterns and consumption trends' },
    ],
  },
  {
    title: 'Operational & Statutory',
    icon: ClipboardCheck,
    color: 'bg-amber-500',
    reports: [
      { name: 'HMIS 105', href: '/reports/hmis-105', icon: FileText, description: 'Monthly Ministry of Health HMIS-105 report' },
      { name: 'Statutory Reports', href: '/reports/statutory', icon: FileText, description: 'Tax, regulatory and compliance reports' },
      { name: 'Lab Reports', href: '/lab/reports', icon: Stethoscope, description: 'Laboratory turnaround and test analytics' },
      { name: 'Asset Reports', href: '/assets/reports', icon: Building2, description: 'Fixed asset register, depreciation, disposal' },
      { name: 'POS Reports', href: '/pharmacy/pos/reports', icon: ShoppingCart, description: 'Pharmacy retail point-of-sale analytics' },
    ],
  },
];

const ALL_REPORTS: { name: string; href: string; category: string; description: string; icon: typeof FileText }[] =
  REPORT_CATEGORIES.flatMap((c) => c.reports.map((r) => ({ ...r, category: c.title })));

export default function ReportsDashboardPage() {
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState<string[]>(() => getPinnedReports());
  const [recentReports, setRecentReports] = useState<RecentReport[]>(() => getRecentReports());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Resolve active date range
  const dateRange = useMemo<DateRange>(() => {
    if (period === 'custom') {
      if (!customFrom || !customTo) {
        return getPresetRange('month');
      }
      return {
        from: startOfDay(new Date(customFrom)).toISOString(),
        to: endOfDay(new Date(customTo)).toISOString(),
      };
    }
    return getPresetRange(period);
  }, [period, customFrom, customTo]);

  const previousRange = useMemo(() => getPreviousRange(dateRange), [dateRange]);

  // Current period summary
  const summaryQuery = useQuery({
    queryKey: ['reports-dashboard-stats', dateRange.from, dateRange.to, facilityId],
    enabled: !!facilityId,
    queryFn: () => fetchSummary(dateRange),
  });

  // Previous period summary (for trend deltas)
  const prevSummaryQuery = useQuery({
    queryKey: ['reports-dashboard-stats-prev', previousRange.from, previousRange.to, facilityId],
    enabled: !!facilityId && !!summaryQuery.data,
    queryFn: () => fetchSummary(previousRange),
  });

  const stats: SummaryWithComparison | undefined = summaryQuery.data
    ? { ...summaryQuery.data, prev: prevSummaryQuery.data }
    : undefined;

  const handleReportClick = useCallback((name: string, href: string, category: string) => {
    trackReportVisit(name, href, category);
    setRecentReports(getRecentReports());
  }, []);

  const togglePin = useCallback((href: string) => {
    setPinned((curr) => {
      const next = curr.includes(href) ? curr.filter((h) => h !== href) : [...curr, href];
      localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Filtered reports for search
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REPORT_CATEGORIES;
    return REPORT_CATEGORIES.map((cat) => ({
      ...cat,
      reports: cat.reports.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.reports.length > 0);
  }, [search]);

  const pinnedReports = useMemo(
    () => ALL_REPORTS.filter((r) => pinned.includes(r.href)),
    [pinned],
  );

  // -------------------------------------------------------------------------
  // Print: build a properly formatted, branded print document
  // -------------------------------------------------------------------------

  const buildPrintBody = useCallback(() => {
    const header = printService.buildHeader(inst, 'document');
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

    const periodLabel = period === 'custom'
      ? `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`
      : PERIOD_LABELS[period];

    const meta = stats?.prev;
    const pct = (curr: number, prev?: number) => {
      if (prev === undefined || prev === 0) return '—';
      const change = ((curr - prev) / prev) * 100;
      const sign = change >= 0 ? '+' : '';
      return `${sign}${change.toFixed(1)}%`;
    };

    const rows = [
      ['Total Patients', String(stats?.totalPatients ?? 0), pct(stats?.totalPatients ?? 0, meta?.totalPatients)],
      ['Total Encounters', String(stats?.totalEncounters ?? 0), pct(stats?.totalEncounters ?? 0, meta?.totalEncounters)],
      ['Total Invoices', String(stats?.totalInvoices ?? 0), pct(stats?.totalInvoices ?? 0, meta?.totalInvoices)],
      ['Total Revenue', formatCurrency(stats?.totalRevenue ?? 0), pct(stats?.totalRevenue ?? 0, meta?.totalRevenue)],
      ['Collection Rate', `${stats?.collectionRate ?? 0}%`, pct(stats?.collectionRate ?? 0, meta?.collectionRate)],
    ];

    const statsTable = `
      <table style="width:100%; border-collapse:collapse; margin: 12px 0 24px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left; padding:8px; border:1px solid #e5e7eb; font-size:11px;">Metric</th>
            <th style="text-align:right; padding:8px; border:1px solid #e5e7eb; font-size:11px;">Value</th>
            <th style="text-align:right; padding:8px; border:1px solid #e5e7eb; font-size:11px;">vs Previous</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([m, v, p]) => `
            <tr>
              <td style="padding:8px; border:1px solid #e5e7eb; font-size:11px;">${m}</td>
              <td style="padding:8px; border:1px solid #e5e7eb; font-size:11px; text-align:right; font-weight:600;">${v}</td>
              <td style="padding:8px; border:1px solid #e5e7eb; font-size:11px; text-align:right; color:#6b7280;">${p}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    const categoryBlocks = REPORT_CATEGORIES.map(
      (c) => `
      <div style="margin-top:16px;">
        <div style="font-weight:700; color:#111827; font-size:12px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin-bottom:6px;">${c.title}</div>
        <ul style="margin:0; padding-left:18px; font-size:11px; color:#374151;">
          ${c.reports.map((r) => `<li><strong>${r.name}</strong> — ${r.description}</li>`).join('')}
        </ul>
      </div>`,
    ).join('');

    const subtitle = `
      <div style="margin-bottom:8px;">
        <div style="font-size:18px; font-weight:700;">Reports Dashboard Summary</div>
        <div style="font-size:11px; color:#6b7280;">Period: ${periodLabel} (${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)})</div>
        <div style="font-size:11px; color:#6b7280;">Generated: ${new Date().toLocaleString()}</div>
      </div>`;

    const footer = printService.buildFooter(inst, 'document');
    return header + subtitle + statsTable + '<h3 style="font-size:13px; margin:0 0 4px;">Available Reports</h3>' + categoryBlocks + footer;
  }, [inst, period, dateRange, stats]);

  const handlePrint = useCallback(() => {
    printService.printDocument(buildPrintBody(), { title: 'Reports Dashboard Summary' });
  }, [buildPrintBody]);

  // -------------------------------------------------------------------------
  // Export: CSV, JSON, Print-to-PDF
  // -------------------------------------------------------------------------

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
  const periodLabelForFile = period === 'custom' ? 'custom' : period;

  const handleExportCsv = useCallback(() => {
    setExportMenuOpen(false);
    const meta = stats?.prev;
    const pct = (curr: number, prev?: number) => {
      if (prev === undefined || prev === 0) return '';
      return `${(((curr - prev) / prev) * 100).toFixed(1)}%`;
    };
    const rows: unknown[][] = [
      ['Reports Dashboard Summary'],
      ['Facility', inst?.name || ''],
      ['Period', PERIOD_LABELS[period]],
      ['From', fmtDate(dateRange.from)],
      ['To', fmtDate(dateRange.to)],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Metric', 'Value', 'Previous', 'Change'],
      ['Total Patients', stats?.totalPatients ?? 0, meta?.totalPatients ?? '', pct(stats?.totalPatients ?? 0, meta?.totalPatients)],
      ['Total Encounters', stats?.totalEncounters ?? 0, meta?.totalEncounters ?? '', pct(stats?.totalEncounters ?? 0, meta?.totalEncounters)],
      ['Total Invoices', stats?.totalInvoices ?? 0, meta?.totalInvoices ?? '', pct(stats?.totalInvoices ?? 0, meta?.totalInvoices)],
      ['Total Revenue', stats?.totalRevenue ?? 0, meta?.totalRevenue ?? '', pct(stats?.totalRevenue ?? 0, meta?.totalRevenue)],
      ['Collection Rate (%)', stats?.collectionRate ?? 0, meta?.collectionRate ?? '', pct(stats?.collectionRate ?? 0, meta?.collectionRate)],
      [],
      ['Available Reports'],
      ['Category', 'Report', 'Description', 'Path'],
      ...ALL_REPORTS.map((r) => [r.category, r.name, r.description, r.href]),
    ];
    downloadBlob(
      rowsToCsv(rows),
      'text/csv;charset=utf-8',
      `reports-summary-${periodLabelForFile}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }, [stats, period, dateRange, inst, periodLabelForFile]);

  const handleExportJson = useCallback(() => {
    setExportMenuOpen(false);
    const payload = {
      facility: inst?.name || null,
      period: PERIOD_LABELS[period],
      range: { from: dateRange.from, to: dateRange.to },
      generatedAt: new Date().toISOString(),
      summary: stats
        ? {
            totalPatients: stats.totalPatients,
            totalEncounters: stats.totalEncounters,
            totalInvoices: stats.totalInvoices,
            totalRevenue: stats.totalRevenue,
            collectionRate: stats.collectionRate,
            previous: stats.prev || null,
          }
        : null,
      reports: REPORT_CATEGORIES.map((c) => ({
        category: c.title,
        items: c.reports.map((r) => ({ name: r.name, description: r.description, path: r.href })),
      })),
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      'application/json',
      `reports-summary-${periodLabelForFile}-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }, [stats, period, dateRange, inst, periodLabelForFile]);

  const handleExportPdf = useCallback(() => {
    setExportMenuOpen(false);
    handlePrint();
  }, [handlePrint]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

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

  const isLoading = summaryQuery.isLoading || (summaryQuery.isFetching && !summaryQuery.data);

  const quickStats: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    color: string;
    bg: string;
    href: string;
    isCurrency?: boolean;
    prev?: number;
  }> = [
    { label: 'Total Patients', value: stats?.totalPatients ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', href: '/reports/patients', prev: stats?.prev?.totalPatients },
    { label: 'Total Encounters', value: stats?.totalEncounters ?? 0, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-100', href: '/reports/visits', prev: stats?.prev?.totalEncounters },
    { label: 'Total Invoices', value: stats?.totalInvoices ?? 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100', href: '/reports/revenue', prev: stats?.prev?.totalInvoices },
    { label: 'Total Revenue', value: stats?.totalRevenue ?? 0, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100', href: '/reports/revenue', isCurrency: true, prev: stats?.prev?.totalRevenue },
  ];

  return (
    <div id="report-content" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
          <p className="text-gray-600">Access all hospital reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              summaryQuery.refetch();
              prevSummaryQuery.refetch();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            title="Refresh data"
          >
            <RefreshCcw className={`h-4 w-4 ${summaryQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>

          <div ref={exportMenuRef} className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                <button onClick={handleExportCsv} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" /> CSV
                </button>
                <button onClick={handleExportJson} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" /> JSON
                </button>
                <button onClick={handleExportPdf} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                  <Printer className="h-4 w-4 text-gray-500" /> PDF (via print)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range + Search */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  period === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          )}
          <span className="text-xs text-gray-500 ml-auto">
            {fmtDate(dateRange.from)} — {fmtDate(dateRange.to)}
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports by name or description..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const change =
            stat.prev !== undefined && stat.prev !== 0
              ? ((stat.value - stat.prev) / stat.prev) * 100
              : null;
          const positive = (change ?? 0) >= 0;
          return (
            <Link
              key={stat.label}
              to={`${stat.href}?startDate=${dateRange.from}&endDate=${dateRange.to}`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  {isLoading ? (
                    <div className="h-7 w-24 bg-gray-100 animate-pulse rounded mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 truncate">
                      {stat.isCurrency ? formatCurrency(stat.value) : stat.value.toLocaleString()}
                    </p>
                  )}
                  {change !== null && !isLoading && (
                    <div className={`mt-1 flex items-center gap-1 text-xs ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>
                        {positive ? '+' : ''}
                        {change.toFixed(1)}% vs previous
                      </span>
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pinned Reports */}
      {pinnedReports.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Pinned</h2>
            <span className="text-xs text-gray-500">({pinnedReports.length})</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedReports.map((report) => (
              <ReportCard
                key={report.href}
                report={report}
                category={report.category}
                pinned
                onClick={() => handleReportClick(report.name, report.href, report.category)}
                onTogglePin={() => togglePin(report.href)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Report Categories */}
      <div className="space-y-6">
        {filteredCategories.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No reports match "{search}"</p>
            <button onClick={() => setSearch('')} className="text-sm text-blue-600 hover:underline mt-2">
              Clear search
            </button>
          </div>
        )}
        {filteredCategories.map((category) => (
          <div key={category.title} className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center gap-3">
              <div className={`p-2 rounded-lg ${category.color}`}>
                <category.icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
              <span className="text-xs text-gray-500">({category.reports.length})</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.reports.map((report) => (
                  <ReportCard
                    key={report.href}
                    report={report}
                    category={category.title}
                    pinned={pinned.includes(report.href)}
                    onClick={() => handleReportClick(report.name, report.href, category.title)}
                    onTogglePin={() => togglePin(report.href)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recently Visited */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recently Visited Reports</h2>
          {recentReports.length > 0 && (
            <button
              onClick={() => {
                localStorage.removeItem(RECENT_KEY);
                setRecentReports([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear history
            </button>
          )}
        </div>
        <div className="p-4">
          {recentReports.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No recently visited reports</p>
              <p className="text-sm">Select a report category above to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentReports.slice(0, 5).map((report) => (
                <Link
                  key={report.href + report.visitedAt}
                  to={report.href}
                  className="flex items-center gap-3 py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100">
                    <FileText className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">{report.name}</p>
                    <p className="text-xs text-gray-500">{report.category}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {new Date(report.visitedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-blue-500" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportCard subcomponent
// ---------------------------------------------------------------------------

interface ReportCardProps {
  report: ReportLink;
  category: string;
  pinned: boolean;
  onClick: () => void;
  onTogglePin: () => void;
}

function ReportCard({ report, pinned, onClick, onTogglePin }: ReportCardProps) {
  return (
    <div className="relative block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin();
        }}
        className="absolute top-2 right-2 p-1 rounded hover:bg-white/80"
        title={pinned ? 'Unpin' : 'Pin to top'}
      >
        {pinned ? (
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        ) : (
          <StarOff className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
        )}
      </button>
      <Link to={report.href} onClick={onClick} className="block">
        <div className="flex items-start gap-3 pr-6">
          <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-blue-100">
            <report.icon className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 group-hover:text-blue-600">{report.name}</h3>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
            </div>
            <p className="text-sm text-gray-500 mt-1">{report.description}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
