import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { criticalResultsService, CriticalResultAlert } from '../services/critical-results';

interface Props {
  resourceType: 'lab' | 'radiology';
  /** When true, scopes to alerts the current user flagged. */
  flaggedByMe?: boolean;
  /** Days back for the stats card (default 30). */
  sinceDays?: number;
  /** Compact list size (default 5). */
  recentLimit?: number;
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

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function patientLabel(a: CriticalResultAlert): string {
  return a.patient?.fullName || a.patient?.mrn || a.patientId.slice(0, 8);
}

function severityLabel(s: string): string {
  return s.replace('_', ' ').toUpperCase();
}

export default function CriticalResultsOverviewWidget({
  resourceType,
  flaggedByMe = true,
  sinceDays = 30,
  recentLimit = 5,
}: Props) {
  const statsQ = useQuery({
    queryKey: ['cr-stats', resourceType, flaggedByMe, sinceDays],
    queryFn: () => criticalResultsService.stats({ resourceType, flaggedByMe, sinceDays }),
    refetchInterval: 60_000,
  });

  const recentQ = useQuery({
    queryKey: ['cr-recent', resourceType, flaggedByMe, recentLimit],
    queryFn: () =>
      criticalResultsService.list({
        resourceType,
        flaggedByMe,
        limit: recentLimit,
      }),
    refetchInterval: 60_000,
  });

  const stats = statsQ.data;
  const recent = recentQ.data ?? [];
  const title =
    resourceType === 'lab' ? 'Lab Critical Results' : 'Imaging Critical Findings';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {flaggedByMe && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
              Mine · last {sinceDays}d
            </span>
          )}
        </div>
        <Link
          to={resourceType === 'lab' ? '/lab/critical-results' : '/radiology/critical-results'}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          View all →
        </Link>
      </div>

      {/* Stats */}
      {statsQ.isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : statsQ.error ? (
        <div className="text-sm text-red-600">Failed to load stats.</div>
      ) : stats ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Flagged" value={stats.total} tone="gray" />
          <Stat icon={<Clock className="h-4 w-4" />} label="Pending" value={stats.pending} tone="amber" />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Ack'd" value={stats.acknowledged} tone="green" />
          <Stat icon={<ArrowUpRight className="h-4 w-4" />} label="Escalated" value={stats.escalated} tone="red" />
          <Stat icon={<XCircle className="h-4 w-4" />} label="SLA Breached" value={stats.slaBreached} tone={stats.slaBreached > 0 ? 'red' : 'gray'} />
        </div>
      ) : null}

      {/* Recent list */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Most recent
        </div>
        {recentQ.isLoading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="rounded border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
            No critical alerts yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((a) => {
              const breached =
                (a.status === 'pending' || a.status === 'escalated') &&
                a.slaDeadline &&
                new Date(a.slaDeadline).getTime() < Date.now();
              return (
                <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[a.severity] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {severityLabel(a.severity)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-700'}`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                      {breached && (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          SLA BREACH
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-sm text-gray-900">
                      <span className="font-medium">{patientLabel(a)}</span>
                      {a.summary ? <span className="text-gray-600"> — {a.summary}</span> : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      Flagged {fmtAge(a.flaggedAt)} ago
                      {a.acknowledgedAt && ` · ack'd ${fmtAge(a.acknowledgedAt)} ago`}
                      {a.escalationLevel > 0 && ` · escalation L${a.escalationLevel}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'gray' | 'amber' | 'green' | 'red';
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'green'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-gray-200 bg-gray-50 text-gray-700';
  return (
    <div className={`rounded border p-2 ${toneClass}`}>
      <div className="flex items-center gap-1 text-xs">{icon}<span>{label}</span></div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
