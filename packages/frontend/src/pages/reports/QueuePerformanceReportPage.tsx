import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  RefreshCw,
  Timer,
  UserX,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { num, fmtDateISODay, toCsv, downloadBlob, titleCase } from './_reportUtils';

/**
 * Queue Performance — how long patients wait and where they pile up.
 *
 * Backed by endpoints that already exist:
 *   GET /queue/stats?servicePoint=  — waiting/in-service/completed/no-show plus
 *                                     average wait and service minutes, per
 *                                     service point
 *   GET /encounters/stats/today     — the same day's visit funnel, used for the
 *                                     department view and the carry-over counts
 *
 * The service points come from /queue/service-config so the list reflects how
 * the facility is actually set up rather than a hardcoded set.
 */

interface QueueStats {
  waiting: number;
  inService: number;
  completed: number;
  noShow: number;
  total: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
}

interface TodayStats {
  total: number;
  waiting: number;
  inConsultation: number;
  completed: number;
  pendingPayment: number;
  pendingLab: number;
  pendingPharmacy: number;
  averageWaitMinutes: number | null;
  bouncedEncounters: number;
  totalBounces: number;
  bounceRate: number;
  departmentBreakdown: Array<{ department?: string; name?: string; count?: number | string }>;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

/** Fallback list used only when the facility has no service-point config yet. */
const DEFAULT_SERVICE_POINTS = ['reception', 'triage', 'consultation', 'lab', 'pharmacy', 'billing'];

export default function QueuePerformanceReportPage() {
  const facilityId = useFacilityId();
  const today = fmtDateISODay(new Date());
  const [servicePoint, setServicePoint] = useState<string>('');

  const configQuery = useQuery({
    queryKey: ['queue-service-config', facilityId],
    queryFn: async () => {
      const res = await api.get('/queue/service-config');
      return unwrap<any>(res.data);
    },
    retry: false,
  });

  const servicePoints: string[] = useMemo(() => {
    const cfg = configQuery.data;
    const raw = Array.isArray(cfg) ? cfg : cfg?.servicePoints || cfg?.points || [];
    const names = (raw as any[])
      .map((p) => (typeof p === 'string' ? p : p?.code || p?.servicePoint || p?.name))
      .filter(Boolean);
    return names.length ? names : DEFAULT_SERVICE_POINTS;
  }, [configQuery.data]);

  const statsQuery = useQuery({
    queryKey: ['queue-stats', servicePoint, facilityId],
    queryFn: async () => {
      const res = await api.get('/queue/stats', {
        params: servicePoint ? { servicePoint } : undefined,
      });
      return unwrap<QueueStats>(res.data);
    },
  });

  const todayQuery = useQuery({
    queryKey: ['queue-today', today, facilityId],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/today', { params: { facilityId } });
      return unwrap<TodayStats>(res.data);
    },
  });

  const q = statsQuery.data;
  const t = todayQuery.data;
  const isFetching = statsQuery.isFetching || todayQuery.isFetching;
  const error = statsQuery.error || todayQuery.error;

  const throughput = num(q?.total)
    ? Math.round((num(q?.completed) / num(q?.total)) * 100)
    : 0;
  const noShowRate = num(q?.total)
    ? Math.round((num(q?.noShow) / num(q?.total)) * 100)
    : 0;

  const csv = useMemo(() => {
    if (!q) return '';
    const rows: Array<Array<unknown>> = [
      ['Metric', 'Value'],
      ['Date', today],
      ['Service point', servicePoint || 'All'],
      ['In queue', num(q.waiting)],
      ['In service', num(q.inService)],
      ['Completed', num(q.completed)],
      ['No-show', num(q.noShow)],
      ['Total tickets', num(q.total)],
      ['Average wait (minutes)', num(q.averageWaitMinutes)],
      ['Average service (minutes)', num(q.averageServiceMinutes)],
      ['Completion rate (%)', throughput],
      ['No-show rate (%)', noShowRate],
    ];
    if (t) {
      rows.push(
        ['Visits today', num(t.total)],
        ['Awaiting payment', num(t.pendingPayment)],
        ['Awaiting lab', num(t.pendingLab)],
        ['Awaiting pharmacy', num(t.pendingPharmacy)],
        ['Bounced visits', num(t.bouncedEncounters)],
      );
    }
    return toCsv(rows);
  }, [q, t, today, servicePoint, throughput, noShowRate]);

  const cards = [
    { label: 'In queue', value: num(q?.waiting), icon: Users, tone: 'bg-amber-50 text-amber-600' },
    { label: 'In service', value: num(q?.inService), icon: Activity, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Completed', value: num(q?.completed), icon: CheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'No-show', value: num(q?.noShow), icon: UserX, tone: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="p-2 rounded-lg hover:bg-gray-100" aria-label="Back to reports">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Queue Performance</h1>
            <p className="text-sm text-gray-500">Waiting times and throughput for {today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              statsQuery.refetch();
              todayQuery.refetch();
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => downloadBlob(`queue-performance-${today}.csv`, 'text/csv;charset=utf-8', csv)}
            disabled={!csv}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 mr-1">Service point:</span>
          <button
            onClick={() => setServicePoint('')}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              servicePoint === ''
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {servicePoints.map((sp) => (
            <button
              key={sp}
              onClick={() => setServicePoint(sp)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                servicePoint === sp
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {titleCase(String(sp).replace(/[_-]/g, ' '))}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load queue statistics. {(error as any)?.message || ''}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-lg ${c.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-xl font-bold text-gray-900">{c.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Timing</h2>
          <div className="space-y-4">
            <Metric
              icon={<Clock className="h-4 w-4" />}
              label="Average wait"
              value={`${Math.round(num(q?.averageWaitMinutes))} min`}
              hint="From ticket issued to being called"
            />
            <Metric
              icon={<Timer className="h-4 w-4" />}
              label="Average service"
              value={`${Math.round(num(q?.averageServiceMinutes))} min`}
              hint="From being called to completion"
            />
            <Metric
              icon={<CheckCircle className="h-4 w-4" />}
              label="Completion rate"
              value={`${throughput}%`}
              hint={`${num(q?.completed)} of ${num(q?.total)} tickets`}
            />
            <Metric
              icon={<UserX className="h-4 w-4" />}
              label="No-show rate"
              value={`${noShowRate}%`}
              hint={`${num(q?.noShow)} did not answer the call`}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Where visits are held up</h2>
          <p className="text-sm text-gray-500 mb-3">
            Open visits waiting on another department to finish.
          </p>
          <div className="divide-y">
            {[
              ['Awaiting payment', num(t?.pendingPayment)],
              ['Awaiting lab', num(t?.pendingLab)],
              ['Awaiting pharmacy', num(t?.pendingPharmacy)],
              ['In consultation', num(t?.inConsultation)],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{label}</span>
                <span className="font-semibold text-gray-900">{Number(value)}</span>
              </div>
            ))}
          </div>
          {num(t?.bouncedEncounters) > 0 && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
              {num(t?.bouncedEncounters)} visit(s) were sent back between departments
              ({num(t?.totalBounces)} bounces). Repeated bounces usually mean a step is being
              skipped upstream.
            </p>
          )}
        </div>
      </div>

      {!!t?.departmentBreakdown?.length && (
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Load by department</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Department</th>
                <th className="py-2 text-right">Visits</th>
              </tr>
            </thead>
            <tbody>
              {t.departmentBreakdown.map((d, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 text-gray-800">{d.department || d.name || '—'}</td>
                  <td className="py-2 text-right font-medium">{num(d.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="p-2 rounded-lg bg-gray-100 text-gray-600">{icon}</span>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-700">{label}</span>
          <span className="text-lg font-bold text-gray-900">{value}</span>
        </div>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}
