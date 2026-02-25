import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Users,
  DollarSign,
  Package,
  TrendingUp,
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
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

type Period = 'today' | 'week' | 'month' | 'year';

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  switch (period) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      from = new Date(now);
      from.setDate(from.getDate() - 7);
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

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

// Track recently visited reports in localStorage
const RECENT_KEY = 'glide-hims-recent-reports';
interface RecentReport {
  name: string;
  href: string;
  visitedAt: string;
  category: string;
}

function getRecentReports(): RecentReport[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function trackReportVisit(name: string, href: string, category: string) {
  const recent = getRecentReports().filter((r) => r.href !== href);
  recent.unshift({ name, href, visitedAt: new Date().toISOString(), category });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
}

export default function ReportsDashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const dateRange = useMemo(() => getDateRange(period), [period]);

  // Fetch summary statistics
  const { data: stats } = useQuery({
    queryKey: ['reports-dashboard-stats', period],
    queryFn: async () => {
      const [patients, encounters, billing, revenue] = await Promise.all([
        api.get('/patients?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/encounters?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/billing/invoices?limit=1').catch(() => ({ data: { total: 0, totalAmount: 0 } })),
        api.get(`/analytics/financial?period=${period}`).catch(() => ({ data: { totalRevenue: 0, collectionRate: 0 } })),
      ]);
      const totalRevenue = revenue.data?.revenueTrend?.reduce(
        (sum: number, t: { revenue: string | number }) => sum + Number(t.revenue || 0), 0
      ) || revenue.data?.totalRevenue || 0;
      const totalCollections = Number(revenue.data?.collectionsTotal || 0);
      return {
        totalPatients: patients.data?.meta?.total || patients.data?.total || 0,
        totalEncounters: encounters.data?.total || 0,
        totalInvoices: billing.data?.total || 0,
        totalRevenue,
        collectionRate: totalRevenue > 0 ? parseFloat((totalCollections / totalRevenue * 100).toFixed(1)) : 0,
      };
    },
  });

  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  useEffect(() => {
    setRecentReports(getRecentReports());
  }, []);

  const handleReportClick = useCallback((name: string, href: string, category: string) => {
    trackReportVisit(name, href, category);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExport = useCallback(() => {
    const rows = [
      ['Reports Dashboard Summary'],
      [`Period: ${PERIOD_LABELS[period]}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Metric', 'Value'],
      ['Total Patients', String(stats?.totalPatients || 0)],
      ['Total Encounters', String(stats?.totalEncounters || 0)],
      ['Total Invoices', String(stats?.totalInvoices || 0)],
      ['Total Revenue', formatCurrency(stats?.totalRevenue || 0)],
      ['Collection Rate', `${stats?.collectionRate || 0}%`],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-summary-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [period, stats]);

  const reportCategories = [
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
  ];

  const quickStats = [
    { label: 'Total Patients', value: stats?.totalPatients || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', href: '/reports/patients' },
    { label: 'Total Encounters', value: stats?.totalEncounters || 0, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-100', href: '/reports/visits' },
    { label: 'Total Invoices', value: stats?.totalInvoices || 0, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100', href: '/reports/revenue' },
    { label: 'Total Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100', href: '/reports/revenue', isFormatted: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
          <p className="text-gray-600">Access all hospital reports and analytics</p>
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
            Export Summary
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Report Period:</span>
          </div>
          <div className="flex gap-2">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  period === key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">
            {new Date(dateRange.from).toLocaleDateString()} — {new Date(dateRange.to).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Link key={stat.label} to={stat.href} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 truncate">
                  {stat.isFormatted ? stat.value : (stat.value as number).toLocaleString()}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Report Categories */}
      <div className="space-y-6">
        {reportCategories.map((category) => (
          <div key={category.title} className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center gap-3">
              <div className={`p-2 rounded-lg ${category.color}`}>
                <category.icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.reports.map((report) => (
                  <Link
                    key={report.href}
                    to={report.href}
                    onClick={() => handleReportClick(report.name, report.href, category.title)}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
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
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recently Visited Reports */}
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
