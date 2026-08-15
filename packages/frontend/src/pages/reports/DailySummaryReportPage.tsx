import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Banknote,
  BedDouble,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { num, fmtDateISODay, toCsv, downloadBlob } from './_reportUtils';

/**
 * Daily Summary — the registration desk's end-of-day sheet.
 *
 * Everything here comes from two existing endpoints; nothing is derived from
 * placeholder data:
 *   GET /encounters/stats/today  — today's visit funnel and where patients are
 *                                  currently stuck (lab, pharmacy, payment)
 *   GET /analytics/summary       — new registrations, billed/collected and
 *                                  admissions/discharges for the same day
 */

interface TodayStats {
  total: number;
  waiting: number;
  inConsultation: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  pendingPayment: number;
  pendingLab: number;
  pendingPharmacy: number;
  averageWaitMinutes: number | null;
  bouncedEncounters: number;
  totalBounces: number;
  bounceRate: number;
  departmentBreakdown: Array<{ department?: string; name?: string; count?: number | string }>;
}

interface SummaryReport {
  period: { startDate: string; endDate: string };
  patients: { new_patients: string | number };
  revenue: {
    total_billed: string | number | null;
    total_collected: string | number | null;
    invoice_count: string | number;
  };
  admissions: { total_admissions: string | number; discharges: string | number };
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

export default function DailySummaryReportPage() {
  const facilityId = useFacilityId();
  const today = fmtDateISODay(new Date());

  const todayQuery = useQuery({
    queryKey: ['daily-summary-encounters', today, facilityId],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/today', { params: { facilityId } });
      return unwrap<TodayStats>(res.data);
    },
  });

  const summaryQuery = useQuery({
    queryKey: ['daily-summary-analytics', today, facilityId],
    queryFn: async () => {
      const res = await api.get('/analytics/summary', {
        params: { startDate: today, endDate: today, facilityId },
      });
      return unwrap<SummaryReport>(res.data);
    },
  });

  const isLoading = todayQuery.isLoading || summaryQuery.isLoading;
  const isFetching = todayQuery.isFetching || summaryQuery.isFetching;
  const error = todayQuery.error || summaryQuery.error;

  const stats = todayQuery.data;
  const summary = summaryQuery.data;

  const billed = num(summary?.revenue?.total_billed);
  const collected = num(summary?.revenue?.total_collected);
  const outstanding = Math.max(billed - collected, 0);

  const csv = useMemo(() => {
    if (!stats) return '';
    const rows = [
      ['Metric', 'Value'],
      ['Date', today],
      ['Visits today', num(stats.total)],
      ['New registrations', num(summary?.patients?.new_patients)],
      ['Waiting', num(stats.waiting)],
      ['In consultation', num(stats.inConsultation)],
      ['Completed', num(stats.completed)],
      ['Cancelled', num(stats.cancelled)],
      ['Pending payment', num(stats.pendingPayment)],
      ['Pending lab', num(stats.pendingLab)],
      ['Pending pharmacy', num(stats.pendingPharmacy)],
      ['Average wait (minutes)', stats.averageWaitMinutes ?? ''],
      ['Admissions', num(summary?.admissions?.total_admissions)],
      ['Discharges', num(summary?.admissions?.discharges)],
      ['Invoices raised', num(summary?.revenue?.invoice_count)],
      ['Total billed', billed],
      ['Total collected', collected],
      ['Outstanding', outstanding],
    ];
    return toCsv(rows);
  }, [stats, summary, today, billed, collected, outstanding]);

  const funnel = stats
    ? [
        { label: 'Waiting', value: stats.waiting, icon: Clock, tone: 'text-amber-600 bg-amber-50' },
        { label: 'In consultation', value: stats.inConsultation, icon: Activity, tone: 'text-blue-600 bg-blue-50' },
        { label: 'Completed', value: stats.completed, icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
        { label: 'Cancelled', value: stats.cancelled, icon: AlertCircle, tone: 'text-gray-600 bg-gray-100' },
      ]
    : [];

  const pending = stats
    ? [
        { label: 'Awaiting payment', value: stats.pendingPayment },
        { label: 'Awaiting lab', value: stats.pendingLab },
        { label: 'Awaiting pharmacy', value: stats.pendingPharmacy },
      ]
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back to reports">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Summary</h1>
            <p className="text-sm text-gray-500">
              Registration and visit activity for {today}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              todayQuery.refetch();
              summaryQuery.refetch();
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => downloadBlob(`daily-summary-${today}.csv`, 'text/csv;charset=utf-8', csv)}
            disabled={!csv}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load today's summary. {(error as any)?.message || ''}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          Loading today's activity…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<UserPlus className="h-5 w-5" />}
              label="New registrations"
              value={num(summary?.patients?.new_patients).toLocaleString()}
              tone="bg-indigo-50 text-indigo-600"
            />
            <SummaryCard
              icon={<Users className="h-5 w-5" />}
              label="Visits today"
              value={num(stats?.total).toLocaleString()}
              tone="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              icon={<Banknote className="h-5 w-5" />}
              label="Collected"
              value={formatCurrency(collected)}
              sub={`${formatCurrency(outstanding)} outstanding`}
              tone="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              icon={<BedDouble className="h-5 w-5" />}
              label="Admissions / discharges"
              value={`${num(summary?.admissions?.total_admissions)} / ${num(summary?.admissions?.discharges)}`}
              tone="bg-purple-50 text-purple-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Visit funnel</h2>
              <div className="space-y-3">
                {funnel.map((f) => {
                  const Icon = f.icon;
                  const total = num(stats?.total) || 1;
                  return (
                    <div key={f.label} className="flex items-center gap-3">
                      <span className={`p-2 rounded-lg ${f.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm text-gray-700">{f.label}</span>
                      <span className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <span
                          className="block h-full bg-blue-500"
                          style={{ width: `${Math.min((num(f.value) / total) * 100, 100)}%` }}
                        />
                      </span>
                      <span className="w-10 text-right font-semibold text-gray-900">{num(f.value)}</span>
                    </div>
                  );
                })}
              </div>
              {stats?.averageWaitMinutes != null && (
                <p className="mt-4 text-sm text-gray-500">
                  Average wait: <strong>{Math.round(num(stats.averageWaitMinutes))} min</strong>
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Still open at close</h2>
              <p className="text-sm text-gray-500 mb-3">
                Visits that have not finished their journey — these carry over to tomorrow.
              </p>
              <div className="divide-y">
                {pending.map((p) => (
                  <div key={p.label} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{p.label}</span>
                    <span className="font-semibold text-gray-900">{num(p.value)}</span>
                  </div>
                ))}
              </div>
              {num(stats?.bouncedEncounters) > 0 && (
                <p className="mt-4 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  {num(stats?.bouncedEncounters)} visit(s) bounced back between departments
                  ({num(stats?.totalBounces)} bounces, {Math.round(num(stats?.bounceRate))}%).
                </p>
              )}
            </div>
          </div>

          {!!stats?.departmentBreakdown?.length && (
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold text-gray-900 mb-4">By department</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2">Department</th>
                    <th className="py-2 text-right">Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.departmentBreakdown.map((d, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 text-gray-800">{d.department || d.name || '—'}</td>
                      <td className="py-2 text-right font-medium">{num(d.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <span className={`p-2 rounded-lg ${tone}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
