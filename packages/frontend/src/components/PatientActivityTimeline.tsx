import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  FileEdit,
  FilePlus,
  FileX,
  Eye,
  Pill,
  FlaskConical,
  Image as ImageIcon,
  User as UserIcon,
} from 'lucide-react';
import { auditService, AuditLogEntry } from '../services/audit';

interface Props {
  patientId: string;
  limit?: number;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  READ: 'Viewed',
  CRITICAL_RESULT_FLAGGED: 'Critical result flagged',
  CRITICAL_RESULT_ACKNOWLEDGED: 'Critical result acknowledged',
  CRITICAL_RESULT_ESCALATED: 'Critical result escalated',
  CRITICAL_RESULT_CANCELLED: 'Critical result cancelled',
  RX_SAFETY_OVERRIDE: 'Prescription safety override',
};

function actionIcon(action: string) {
  if (action.startsWith('CRITICAL_RESULT'))
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  if (action === 'RX_SAFETY_OVERRIDE')
    return <ShieldAlert className="h-4 w-4 text-amber-600" />;
  if (action === 'CREATE') return <FilePlus className="h-4 w-4 text-green-600" />;
  if (action === 'UPDATE') return <FileEdit className="h-4 w-4 text-blue-600" />;
  if (action === 'DELETE') return <FileX className="h-4 w-4 text-red-500" />;
  if (action === 'READ') return <Eye className="h-4 w-4 text-gray-400" />;
  return <Activity className="h-4 w-4 text-gray-500" />;
}

function entityIcon(et: string) {
  if (/prescription|medication/i.test(et)) return <Pill className="h-3 w-3" />;
  if (/lab/i.test(et)) return <FlaskConical className="h-3 w-3" />;
  if (/imag|radiology/i.test(et)) return <ImageIcon className="h-3 w-3" />;
  return null;
}

function userLabel(e: AuditLogEntry): string {
  const u = e.user;
  if (u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.username || u.email || 'User';
  }
  if (e.actorType === 'system_admin') return 'System Admin';
  if (e.actorType === 'system_support') return 'Support';
  return 'System';
}

function summary(e: AuditLogEntry): string | null {
  const nv = e.newValue || {};
  if (e.action.startsWith('CRITICAL_RESULT')) {
    const sev = nv.severity ? String(nv.severity).replace('_', ' ').toUpperCase() : '';
    const note = nv.note ? ` — “${nv.note}”` : '';
    const action = nv.actionTaken ? ` · Action: ${nv.actionTaken}` : '';
    return [sev, note, action].filter(Boolean).join('').trim() || null;
  }
  if (e.action === 'RX_SAFETY_OVERRIDE') {
    const sevs = (nv.alertSeverities || []).join(', ');
    return `Override (${nv.alertCount ?? 0} alert${nv.alertCount === 1 ? '' : 's'}${sevs ? `: ${sevs}` : ''})${e.reason ? ` — ${e.reason}` : ''}`;
  }
  if (e.reason) return e.reason;
  return null;
}

export default function PatientActivityTimeline({ patientId, limit = 100 }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-audit', patientId, limit],
    queryFn: () => auditService.forPatient(patientId, { limit }),
    enabled: !!patientId,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading activity…</div>;
  }
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Failed to load activity timeline.
      </div>
    );
  }
  const rows = data?.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No audited activity for this patient yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">Activity Timeline</h3>
        <span className="text-xs text-gray-500">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
      </div>

      <ol className="relative space-y-3 border-l border-gray-200 pl-5">
        {rows.map((e) => {
          const isSafety =
            e.action.startsWith('CRITICAL_RESULT') || e.action === 'RX_SAFETY_OVERRIDE';
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
                {actionIcon(e.action)}
              </span>
              <div
                className={`rounded border p-3 text-sm ${
                  isSafety ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                    {entityIcon(e.entityType)}
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                      {e.entityType}
                    </span>
                    {e.action === 'CRITICAL_RESULT_ACKNOWLEDGED' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                  <UserIcon className="h-3 w-3" />
                  {userLabel(e)}
                  {e.requestMethod && (
                    <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                      {e.requestMethod}
                    </span>
                  )}
                </div>
                {summary(e) && (
                  <p className="mt-1 text-sm text-gray-700">{summary(e)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
