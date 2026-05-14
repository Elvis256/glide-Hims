import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Activity,
  Users,
  Filter,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';

type AuditUser = { id?: string; username?: string; fullName?: string; email?: string };
type AuditEntry = {
  id: string;
  createdAt: string;
  actorType?: string;
  userId?: string;
  user?: AuditUser;
  action: string;
  entityType: string;
  entityId?: string;
  requestMethod?: string;
  requestUrl?: string;
  statusCode?: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  attemptedIdentifier?: string;
  errorMessage?: string;
  oldValue?: any;
  newValue?: any;
};

type Stats = {
  total: number;
  recent24h: number;
  errorCount: number;
  actions: { action: string; count: number }[];
  entityTypes: { entityType: string; count: number }[];
  topUsers: { userId: string; username?: string; fullName?: string; count: number }[];
};

type Filters = {
  userId: string;
  action: string;
  entityType: string;
  from: string;
  to: string;
  q: string;
  excludeReads: boolean;
  onlyErrors: boolean;
};

const PAGE_SIZE = 50;

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
  READ: 'bg-gray-100 text-gray-600 border-gray-200',
  LOGIN_SUCCESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LOGIN_FAILED: 'bg-red-100 text-red-800 border-red-200',
  TOKEN_REFRESHED: 'bg-gray-100 text-gray-500 border-gray-200',
};

function actionClass(a: string) {
  if (ACTION_STYLES[a]) return ACTION_STYLES[a];
  if (/FAIL|ERROR|DENIED/i.test(a)) return 'bg-red-100 text-red-800 border-red-200';
  if (/CREATE|STARTED|SUBMITTED|CALLED/i.test(a)) return 'bg-green-100 text-green-800 border-green-200';
  if (/UPDATE|TRANSFER|RECALL/i.test(a)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (/DELETE/i.test(a)) return 'bg-red-100 text-red-800 border-red-200';
  if (/CRITICAL/i.test(a)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function statusClass(code?: number) {
  if (!code) return 'bg-gray-100 text-gray-500';
  if (code >= 500) return 'bg-red-100 text-red-800';
  if (code >= 400) return 'bg-amber-100 text-amber-800';
  if (code >= 300) return 'bg-gray-100 text-gray-700';
  return 'bg-green-100 text-green-800';
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function actorName(r: AuditEntry) {
  const u = r.user;
  if (u?.fullName || u?.username) {
    return u.fullName || u.username || '';
  }
  if (r.attemptedIdentifier) return r.attemptedIdentifier;
  return '—';
}

function actorSub(r: AuditEntry) {
  const u = r.user;
  const parts: string[] = [];
  if (u?.username && u.username !== u.fullName) parts.push('@' + u.username);
  if (u?.email) parts.push(u.email);
  if (!u?.username && r.actorType) parts.push(r.actorType);
  return parts.join(' · ');
}

function readFiltersFromUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return {
    userId: p.get('userId') || '',
    action: p.get('action') || '',
    entityType: p.get('entityType') || '',
    from: p.get('from') || '',
    to: p.get('to') || '',
    q: p.get('q') || '',
    excludeReads: p.get('excludeReads') === '1',
    onlyErrors: p.get('onlyErrors') === '1',
  };
}

function writeFiltersToUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.userId) p.set('userId', f.userId);
  if (f.action) p.set('action', f.action);
  if (f.entityType) p.set('entityType', f.entityType);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.q) p.set('q', f.q);
  if (f.excludeReads) p.set('excludeReads', '1');
  if (f.onlyErrors) p.set('onlyErrors', '1');
  const qs = p.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<Filters>(readFiltersFromUrl());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  const buildParams = (extra?: Partial<Filters & { limit: number; offset: number }>) => {
    const f = { ...filters, ...extra } as any;
    const p: any = {};
    if (f.userId) p.userId = f.userId;
    if (f.action) p.action = f.action;
    if (f.entityType) p.entityType = f.entityType;
    if (f.from) p.from = f.from;
    if (f.to) p.to = f.to;
    if (f.q) p.q = f.q;
    if (f.excludeReads) p.excludeReads = '1';
    if (f.onlyErrors) p.onlyErrors = '1';
    p.limit = f.limit ?? PAGE_SIZE;
    p.offset = f.offset ?? page * PAGE_SIZE;
    return p;
  };

  const load = async (toPage = page) => {
    setLoading(true);
    try {
      const r = await api.get('/admin/audit-logs', {
        params: buildParams({ offset: toPage * PAGE_SIZE }),
      });
      setRows((r.data as any) || []);
      setTotal(((r as any).meta?.total as number) || 0);
      setPage(toPage);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const r = await api.get('/admin/audit-logs/stats');
      setStats(r.data as Stats);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    writeFiltersToUrl(filters);
    load(0);
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.userId,
    filters.action,
    filters.entityType,
    filters.from,
    filters.to,
    filters.q,
    filters.excludeReads,
    filters.onlyErrors,
  ]);

  useEffect(() => {
    if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    if (autoRefresh) {
      refreshTimer.current = window.setInterval(() => {
        load(0);
        loadStats();
      }, 10000);
    }
    return () => {
      if (refreshTimer.current) window.clearInterval(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(buildParams()).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && k !== 'limit' && k !== 'offset') {
          params.append(k, String(v));
        }
      });
      const r = await api.get(`/admin/audit-logs/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Export failed');
    }
  };

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const clearFilters = () =>
    setFilters({
      userId: '',
      action: '',
      entityType: '',
      from: '',
      to: '',
      q: '',
      excludeReads: false,
      onlyErrors: false,
    });

  const quickToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    update({ from: today.toISOString(), to: '' });
  };
  const quickLastHour = () =>
    update({ from: new Date(Date.now() - 60 * 60 * 1000).toISOString(), to: '' });
  const quickLast24h = () =>
    update({ from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), to: '' });

  const activeFilterCount = useMemo(
    () =>
      [
        filters.userId,
        filters.action,
        filters.entityType,
        filters.from,
        filters.to,
        filters.q,
        filters.excludeReads ? '1' : '',
        filters.onlyErrors ? '1' : '',
      ].filter(Boolean).length,
    [filters],
  );

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-500" /> Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Every authenticated request and security-relevant event recorded in this tenant.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="inline-flex items-center gap-1 text-xs text-gray-600 mr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            onClick={() => {
              load(page);
              loadStats();
            }}
            className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={downloadCsv}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Total events"
            value={stats.total.toLocaleString()}
          />
          <StatCard
            icon={<RefreshCw className="w-4 h-4" />}
            label="Last 24h"
            value={stats.recent24h.toLocaleString()}
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            label="Errors / failures"
            value={stats.errorCount.toLocaleString()}
            highlight={stats.errorCount > 0}
            onClick={() => update({ onlyErrors: !filters.onlyErrors })}
            active={filters.onlyErrors}
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Top user"
            value={
              stats.topUsers[0]
                ? `${stats.topUsers[0].fullName || stats.topUsers[0].username || '—'} (${stats.topUsers[0].count})`
                : '—'
            }
          />
        </div>
      )}

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <span className="text-gray-500 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Quick:
        </span>
        <button
          onClick={quickLastHour}
          className="px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          Last hour
        </button>
        <button onClick={quickToday} className="px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200">
          Today
        </button>
        <button
          onClick={quickLast24h}
          className="px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          Last 24h
        </button>
        <button
          onClick={() => update({ onlyErrors: !filters.onlyErrors })}
          className={`px-2 py-1 rounded-full ${
            filters.onlyErrors
              ? 'bg-red-100 text-red-800 ring-1 ring-red-300'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Errors only
        </button>
        <button
          onClick={() => update({ action: 'LOGIN_FAILED' })}
          className="px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200"
        >
          Failed logins
        </button>
        <button
          onClick={() => update({ excludeReads: !filters.excludeReads })}
          className={`px-2 py-1 rounded-full ${
            filters.excludeReads
              ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Hide reads
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-2 py-1 rounded-full text-red-600 hover:bg-red-50 ml-auto flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5" />
          <input
            placeholder="Search URL, IP, reason, user…"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            className="border rounded px-8 py-2 text-sm w-full"
          />
        </div>
        <select
          value={filters.userId}
          onChange={(e) => update({ userId: e.target.value })}
          className="border rounded px-2 py-2 text-sm"
        >
          <option value="">All users</option>
          {stats?.topUsers.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.fullName || u.username || u.userId.slice(0, 8)} ({u.count})
            </option>
          ))}
        </select>
        <select
          value={filters.action}
          onChange={(e) => update({ action: e.target.value })}
          className="border rounded px-2 py-2 text-sm"
        >
          <option value="">All actions</option>
          {stats?.actions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action} ({a.count})
            </option>
          ))}
        </select>
        <select
          value={filters.entityType}
          onChange={(e) => update({ entityType: e.target.value })}
          className="border rounded px-2 py-2 text-sm"
        >
          <option value="">All entities</option>
          {stats?.entityTypes.map((e) => (
            <option key={e.entityType} value={e.entityType}>
              {e.entityType} ({e.count})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            title="From"
            value={filters.from ? filters.from.slice(0, 10) : ''}
            onChange={(e) =>
              update({ from: e.target.value ? new Date(e.target.value).toISOString() : '' })
            }
            className="border rounded px-2 py-2 text-sm"
          />
          <input
            type="date"
            title="To"
            value={filters.to ? filters.to.slice(0, 10) : ''}
            onChange={(e) =>
              update({ to: e.target.value ? new Date(e.target.value).toISOString() : '' })
            }
            className="border rounded px-2 py-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="w-6"></th>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Actor</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Entity</th>
              <th className="text-left px-3 py-2">Method / URL</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  <div className="font-medium text-gray-500">No entries match these filters.</div>
                  {stats && stats.total > 0 ? (
                    <div className="mt-1">
                      This tenant has {stats.total.toLocaleString()} total entries.
                      <button
                        onClick={clearFilters}
                        className="ml-2 text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1">No audit events have been recorded yet.</div>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(r.id)}
                    >
                      <td className="px-2 text-gray-400">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        <div title={new Date(r.createdAt).toLocaleString()}>
                          {relativeTime(r.createdAt)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800">{actorName(r)}</div>
                        <div className="text-[10px] text-gray-400">{actorSub(r)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block border rounded px-1.5 py-0.5 text-[10px] font-medium ${actionClass(r.action)}`}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-gray-700">{r.entityType}</div>
                        {r.entityId && (
                          <div className="text-[10px] text-gray-400 font-mono">
                            {r.entityId.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-mono uppercase">
                            {r.requestMethod}
                          </span>
                          <span className="truncate text-gray-700" title={r.requestUrl}>
                            {r.requestUrl}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.statusCode ? (
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono ${statusClass(r.statusCode)}`}
                          >
                            {r.statusCode}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-600">
                        {r.ipAddress || '—'}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t bg-gray-50/50">
                        <td></td>
                        <td colSpan={7} className="px-3 py-3 text-[11px]">
                          <DetailGrid r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
        <div>
          Showing {rows.length === 0 ? 0 : page * PAGE_SIZE + 1}–
          {page * PAGE_SIZE + rows.length} of {total.toLocaleString()} entries
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0 || loading}
            onClick={() => load(page - 1)}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} / {pageCount}
          </span>
          <button
            disabled={page + 1 >= pageCount || loading}
            onClick={() => load(page + 1)}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
  onClick,
  active,
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg px-3 py-2 ${
        clickable ? 'cursor-pointer hover:bg-gray-50' : ''
      } ${active ? 'ring-2 ring-red-300 border-red-300' : ''} ${
        highlight && !active ? 'border-amber-200' : ''
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="text-lg font-semibold text-gray-800 mt-1 truncate">{value}</div>
    </div>
  );
}

function DetailGrid({ r }: { r: AuditEntry }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <KV label="Audit ID" value={r.id} mono />
      <KV label="Actor type" value={r.actorType} />
      <KV label="User ID" value={r.userId} mono />
      <KV label="Entity ID" value={r.entityId} mono />
      <KV label="Reason" value={r.reason} />
      <KV label="Error message" value={r.errorMessage} />
      <KV label="Attempted identifier" value={r.attemptedIdentifier} />
      <KV label="User agent" value={r.userAgent} wrap />
      {(r.oldValue || r.newValue) && (
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <JsonBlock title="Old value" value={r.oldValue} />
          <JsonBlock title="New value" value={r.newValue} />
        </div>
      )}
    </div>
  );
}

function KV({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value?: any;
  mono?: boolean;
  wrap?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div
        className={`${mono ? 'font-mono' : ''} ${wrap ? 'break-all' : 'truncate'} text-gray-800`}
      >
        {String(value)}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: any }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{title}</div>
      <pre className="bg-gray-900 text-gray-100 rounded p-2 text-[10px] overflow-auto max-h-60">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
