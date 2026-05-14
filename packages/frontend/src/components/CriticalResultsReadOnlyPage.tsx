import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { criticalResultsService } from '../services/critical-results';
import CriticalResultsOverviewWidget from './CriticalResultsOverviewWidget';

interface Props {
  resourceType: 'lab' | 'radiology';
}

const SEVERITY_BADGE: Record<string, string> = {
  critical_low: 'bg-blue-100 text-blue-700',
  critical_high: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  abnormal: 'bg-amber-100 text-amber-700',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  acknowledged: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

function fmtAge(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Read-only critical-results worklist for Lab Manager / Radiologist roles.
 * No acknowledge button — that's the receiving clinician's loop. This view
 * shows what *they* flagged, ack progress, and SLA breaches for QA.
 */
export default function CriticalResultsReadOnlyPage({ resourceType }: Props) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending' | 'breached'>('mine');

  const params = useMemo(() => {
    const base: any = { resourceType, limit: 200 };
    if (filter === 'mine') base.flaggedByMe = true;
    if (filter === 'pending') base.status = 'pending';
    return base;
  }, [filter, resourceType]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['cr-readonly', resourceType, filter],
    queryFn: () => criticalResultsService.list(params),
    refetchInterval: 60_000,
  });

  const rowsAll = data ?? [];
  const now = Date.now();
  const rows =
    filter === 'breached'
      ? rowsAll.filter(
          (a) =>
            (a.status === 'pending' || a.status === 'escalated') &&
            a.slaDeadline &&
            new Date(a.slaDeadline).getTime() < now,
        )
      : rowsAll;

  const title =
    resourceType === 'lab'
      ? 'Lab Critical Results — QA View'
      : 'Imaging Critical Findings — QA View';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldAlert className="h-7 w-7 text-red-600" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Read-only view of critical alerts you flagged, acknowledgement status, and SLA breaches.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <CriticalResultsOverviewWidget
        resourceType={resourceType}
        flaggedByMe={filter === 'mine' || filter === 'breached'}
        sinceDays={30}
        recentLimit={5}
      />

      <div className="flex gap-2">
        {([
          ['mine', 'Mine'],
          ['pending', 'Pending'],
          ['breached', 'SLA breached'],
          ['all', 'All'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === k
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Flagged</th>
              <th className="px-3 py-2">Acknowledged</th>
              <th className="px-3 py-2">Acknowledged by</th>
              <th className="px-3 py-2">Action taken</th>
              <th className="px-3 py-2">Esc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No alerts match this filter.
                </td>
              </tr>
            ) : (
              rows.map((a) => {
                const breached =
                  (a.status === 'pending' || a.status === 'escalated') &&
                  a.slaDeadline &&
                  new Date(a.slaDeadline).getTime() < now;
                return (
                  <tr key={a.id} className={breached ? 'bg-red-50/40' : undefined}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {a.patient?.fullName || a.patientId.slice(0, 8)}
                      </div>
                      {a.patient?.mrn && (
                        <div className="text-xs text-gray-500">{a.patient.mrn}</div>
                      )}
                      {a.summary && (
                        <div className="mt-0.5 text-xs text-gray-600">{a.summary}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[a.severity] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {a.severity.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                      {breached && (
                        <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          BREACH
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{fmtAge(a.flaggedAt)} ago</td>
                    <td className="px-3 py-2 text-gray-600">
                      {a.acknowledgedAt ? `${fmtAge(a.acknowledgedAt)} ago` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {a.acknowledgedBy
                        ? `${a.acknowledgedBy.firstName ?? ''} ${a.acknowledgedBy.lastName ?? ''}`.trim() || '—'
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{a.actionTaken || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {a.escalationLevel > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3 w-3" />L{a.escalationLevel}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
