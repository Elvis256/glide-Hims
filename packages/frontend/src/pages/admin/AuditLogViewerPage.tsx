import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Activity,
  Users as UsersIcon,
} from 'lucide-react';
import { auditService, AuditLogEntry, AuditLogListParams } from '../../services/audit';
import { toast } from 'sonner';

const ACTION_OPTIONS = [
  '',
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'CRITICAL_RESULT_FLAGGED',
  'CRITICAL_RESULT_ACKNOWLEDGED',
  'CRITICAL_RESULT_ESCALATED',
  'CRITICAL_RESULT_CANCELLED',
  'RX_SAFETY_OVERRIDE',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
];

const ENTITY_OPTIONS = [
  '',
  'encounter',
  'patient',
  'prescription',
  'dispensation',
  'critical_result',
  'invoice',
  'payment',
  'lab_result',
  'lab_order',
  'imaging_request',
  'user',
];

function userLabel(e: AuditLogEntry): string {
  const u = e.user;
  if (u) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.username || u.email || 'User';
  }
  if (e.actorType === 'system_admin') return 'System Admin';
  if (e.actorType === 'system_support') return 'Support';
  if (e.attemptedIdentifier) return e.attemptedIdentifier;
  return 'System';
}

function actorTypeBadge(t?: string): { label: string; cls: string } {
  switch (t) {
    case 'system_admin':
      return { label: 'SysAdmin', cls: 'bg-purple-100 text-purple-700' };
    case 'system_support':
      return { label: 'Support', cls: 'bg-indigo-100 text-indigo-700' };
    case 'user':
      return { label: 'User', cls: 'bg-blue-100 text-blue-700' };
    case 'anonymous':
      return { label: 'Anon', cls: 'bg-amber-100 text-amber-700' };
    default:
      return { label: t || 'system', cls: 'bg-gray-100 text-gray-600' };
  }
}

function actionTone(action: string): string {
  if (action.includes('FAILED') || action === 'DELETE')
    return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  if (action.includes('CRITICAL_RESULT') || action === 'RX_SAFETY_OVERRIDE')
    return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
  if (action === 'CREATE' || action === 'LOGIN_SUCCESS')
    return 'bg-green-50 text-green-700 ring-1 ring-green-200';
  if (action === 'UPDATE' || action === 'STATUS_CHANGE')
    return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200';
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function jsonPreview(v: any): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try {
    const s = JSON.stringify(v);
    return s.length > 140 ? s.slice(0, 137) + '…' : s;
  } catch {
    return String(v);
  }
}

export default function AuditLogViewerPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filters, setFilters] = useState<{
    action: string;
    entityType: string;
    userId: string;
    entityId: string;
    startDate: string;
    endDate: string;
    search: string;
  }>({
    action: '',
    entityType: '',
    userId: '',
    entityId: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const params: AuditLogListParams = useMemo(() => {
    const p: AuditLogListParams = { page, limit };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) (p as any)[k] = v;
    });
    return p;
  }, [page, limit, filters]);

  const listQuery = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditService.list(params),
    staleTime: 10_000,
  });

  const statsQuery = useQuery({
    queryKey: ['audit-logs-stats'],
    queryFn: () => auditService.stats(),
    staleTime: 60_000,
  });

  const handleExport = async () => {
    try {
      const { page: _p, limit: _l, ...rest } = params as any;
      const blob = await auditService.exportCsv(rest);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV export downloaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Export failed');
    }
  };

  const reset = () => {
    setFilters({
      action: '',
      entityType: '',
      userId: '',
      entityId: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPage(1);
  };

  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500">
            Compliance review — every clinical and admin mutation captured by the audit interceptor.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border rounded p-4 flex items-center gap-3">
          <Activity className="h-8 w-8 text-blue-500" />
          <div>
            <div className="text-xs text-gray-500">Total events</div>
            <div className="text-xl font-semibold">
              {statsQuery.isLoading ? '…' : (statsQuery.data?.totalLogs ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="bg-white border rounded p-4 flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-indigo-500" />
          <div>
            <div className="text-xs text-gray-500">Distinct actors</div>
            <div className="text-xl font-semibold">
              {statsQuery.isLoading ? '…' : (statsQuery.data?.uniqueUsers ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs text-gray-500 mb-1">Top actions</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(statsQuery.data?.actionBreakdown || {})
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 4)
              .map(([a, n]) => (
                <span key={a} className={`px-2 py-0.5 text-xs rounded ${actionTone(a)}`}>
                  {a} · {n as number}
                </span>
              ))}
            {!statsQuery.data && <span className="text-xs text-gray-400">…</span>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter className="h-4 w-4" /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Action</label>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters((f) => ({ ...f, action: e.target.value }));
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || '— Any —'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Entity type</label>
            <select
              value={filters.entityType}
              onChange={(e) => {
                setFilters((f) => ({ ...f, entityType: e.target.value }));
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              {ENTITY_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || '— Any —'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">User ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, userId: e.target.value }));
                setPage(1);
              }}
              placeholder="UUID"
              className="w-full border rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Entity ID</label>
            <input
              type="text"
              value={filters.entityId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, entityId: e.target.value }));
                setPage(1);
              }}
              placeholder="UUID"
              className="w-full border rounded px-2 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters((f) => ({ ...f, startDate: e.target.value }));
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters((f) => ({ ...f, endDate: e.target.value }));
                setPage(1);
              }}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Search (URL / reason)</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, search: e.target.value }));
                  setPage(1);
                }}
                placeholder="e.g. /critical-results, override reason…"
                className="w-full border rounded pl-7 pr-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-xs border rounded text-gray-600 hover:bg-gray-50"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Entity</th>
                <th className="px-3 py-2 text-left">Method/URL</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {listQuery.error && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-red-600">
                    {(listQuery.error as any)?.response?.data?.message || 'Failed to load audit logs'}
                  </td>
                </tr>
              )}
              {!listQuery.isLoading &&
                !listQuery.error &&
                (listQuery.data?.data || []).map((row) => {
                  const at = actorTypeBadge(row.actorType);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(row.createdAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${at.cls}`}>{at.label}</span>
                          <span>{userLabel(row)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${actionTone(row.action)}`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {row.entityType}
                        {row.entityId && (
                          <span className="ml-1 text-[10px] text-gray-400 font-mono">
                            {row.entityId.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono truncate max-w-xs">
                        {row.requestMethod} {row.requestUrl}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.statusCode && (
                          <span
                            className={
                              row.statusCode >= 500
                                ? 'text-red-700'
                                : row.statusCode >= 400
                                ? 'text-amber-700'
                                : 'text-gray-600'
                            }
                          >
                            {row.statusCode}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{row.ipAddress || ''}</td>
                    </tr>
                  );
                })}
              {!listQuery.isLoading && (listQuery.data?.data || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                    No audit events match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
          <span>
            Page {page} of {totalPages} · {total.toLocaleString()} events
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || listQuery.isFetching}
              className="p-1 border rounded disabled:opacity-40 hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || listQuery.isFetching}
              className="p-1 border rounded disabled:opacity-40 hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-xl h-full overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 text-xs rounded ${actionTone(selected.action)}`}>
                  {selected.action}
                </span>
                <h2 className="text-lg font-semibold mt-2">{selected.entityType}</h2>
                <p className="text-xs text-gray-500 font-mono">{selected.entityId}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-3 gap-y-2 text-xs">
              <dt className="text-gray-500">When</dt>
              <dd className="col-span-2">{fmtDate(selected.createdAt)}</dd>
              <dt className="text-gray-500">Actor</dt>
              <dd className="col-span-2">{userLabel(selected)}</dd>
              <dt className="text-gray-500">Actor type</dt>
              <dd className="col-span-2">{selected.actorType}</dd>
              <dt className="text-gray-500">User ID</dt>
              <dd className="col-span-2 font-mono">{selected.userId || '—'}</dd>
              <dt className="text-gray-500">Method</dt>
              <dd className="col-span-2 font-mono">
                {selected.requestMethod} {selected.requestUrl}
              </dd>
              <dt className="text-gray-500">Status</dt>
              <dd className="col-span-2">{selected.statusCode}</dd>
              <dt className="text-gray-500">IP</dt>
              <dd className="col-span-2 font-mono">{selected.ipAddress || '—'}</dd>
              <dt className="text-gray-500">User agent</dt>
              <dd className="col-span-2 break-all text-gray-600">{selected.userAgent || '—'}</dd>
              <dt className="text-gray-500">Reason</dt>
              <dd className="col-span-2">{selected.reason || '—'}</dd>
            </dl>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Old value</div>
              <pre className="bg-gray-50 border rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {selected.oldValue ? JSON.stringify(selected.oldValue, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">New value</div>
              <pre className="bg-gray-50 border rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {selected.newValue ? JSON.stringify(selected.newValue, null, 2) : '—'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Last refreshed indicator */}
      <div className="text-xs text-gray-400">
        {listQuery.dataUpdatedAt
          ? `Last refreshed ${new Date(listQuery.dataUpdatedAt).toLocaleTimeString()}`
          : ''}
        {listQuery.data && (
          <span className="ml-2 text-gray-300">· preview {jsonPreview(listQuery.data.data?.[0]?.newValue)}</span>
        )}
      </div>
    </div>
  );
}
