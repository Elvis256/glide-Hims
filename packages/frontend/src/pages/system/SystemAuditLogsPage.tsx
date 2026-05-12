import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import {
  ScrollText, RefreshCw, Loader2, AlertTriangle, Search,
  ChevronLeft, ChevronRight, Filter, X, ShieldCheck, User as UserIcon,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  user?: { id: string; username?: string; firstName?: string; lastName?: string; email?: string };
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  actorType?: string;
  supportAccessTier?: number;
  reason?: string;
  attemptedIdentifier?: string;
  errorMessage?: string;
  requestMethod?: string;
  requestUrl?: string;
  statusCode?: number;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  createdAt: string;
}

interface PageResp {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTOR_BADGE: Record<string, string> = {
  system_admin: 'bg-purple-100 text-purple-800',
  system_support: 'bg-amber-100 text-amber-800',
  tenant_user: 'bg-blue-100 text-blue-800',
};

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-gray-600',
  POST: 'text-green-700',
  PUT: 'text-blue-700',
  PATCH: 'text-blue-700',
  DELETE: 'text-red-700',
};

export default function SystemAuditLogsPage() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const limit = 50;

  const load = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    const targetPage = resetPage ? 1 : page;
    try {
      const params: Record<string, string> = { page: String(targetPage), limit: String(limit) };
      if (search.trim()) params.search = search.trim();
      if (action.trim()) params.action = action.trim();
      if (entityType.trim()) params.entityType = entityType.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<PageResp>('/audit-logs', { params });
      const body: any = res.data;
      const meta: any = (res as any).meta || {};
      // Tolerate both shapes: unwrapped (array via interceptor) or raw envelope
      const list = Array.isArray(body) ? body : (body?.data || []);
      const total = meta.total ?? body?.total ?? list.length;
      const totalPages = meta.totalPages ?? body?.totalPages ?? 1;
      setData(list);
      setTotal(total);
      setTotalPages(totalPages);
      if (resetPage) setPage(1);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, action, entityType, startDate, endDate]);

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const onApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    load(true);
  };

  const clearFilters = () => {
    setSearch(''); setAction(''); setEntityType(''); setStartDate(''); setEndDate('');
    setTimeout(() => load(true), 0);
  };

  const userLabel = (log: AuditLog) => {
    const u = log.user;
    if (!u) return log.userId.slice(0, 8) + '…';
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.username || u.email || u.id.slice(0, 8) + '…';
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-600" />
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            All admin and tenant actions across the platform. Use filters to narrow scope.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showFilters && (
        <form onSubmit={onApplyFilters} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search (user / action / entity)</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. login, tenant, admin@example.com"
                className="pl-9 pr-3 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="CREATE, UPDATE, LOGIN…"
              className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Entity type</label>
            <input
              type="text"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="tenant, deployment, user…"
              className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="md:col-span-3 flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
              <X className="w-4 h-4 inline mr-1" /> Clear
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Apply
            </button>
          </div>
        </form>
      )}

      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Could not load audit logs</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => load()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No audit log entries match your filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Request</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((log) => {
                  const isOpen = expanded === log.id;
                  const actorClass = ACTOR_BADGE[log.actorType || 'tenant_user'] || 'bg-gray-100 text-gray-700';
                  const methodClass = METHOD_COLOR[log.requestMethod || ''] || 'text-gray-500';
                  const sc = log.statusCode;
                  const scClass = !sc ? 'text-gray-400' : sc < 300 ? 'text-green-700' : sc < 400 ? 'text-blue-700' : sc < 500 ? 'text-yellow-700' : 'text-red-700';
                  return (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {log.actorType?.startsWith('system') ? (
                              <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate">{userLabel(log)}</p>
                              {log.actorType && (
                                <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${actorClass}`}>
                                  {log.actorType.replace('_', ' ')}
                                  {log.supportAccessTier ? ` · T${log.supportAccessTier}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-800">{log.action}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{log.entityType}</p>
                          {log.entityId && (
                            <p className="text-xs text-gray-400 font-mono truncate max-w-[140px]">{log.entityId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.requestMethod && (
                            <span className={`font-mono font-semibold ${methodClass}`}>{log.requestMethod}</span>
                          )}
                          {log.requestUrl && (
                            <p className="text-gray-500 truncate max-w-[220px]">{log.requestUrl}</p>
                          )}
                          {log.ipAddress && (
                            <p className="text-gray-400 text-xs">{log.ipAddress}</p>
                          )}
                        </td>
                        <td className={`px-4 py-3 font-mono text-xs ${scClass}`}>
                          {sc || '—'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={log.id + '-d'} className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {log.reason && (
                                <div className="md:col-span-2">
                                  <p className="text-gray-500 mb-1">Reason</p>
                                  <p className="text-gray-800 italic">{log.reason}</p>
                                </div>
                              )}
                              {log.attemptedIdentifier && (
                                <div>
                                  <p className="text-gray-500 mb-1">Attempted identifier</p>
                                  <p className="text-gray-800 font-mono">{log.attemptedIdentifier}</p>
                                </div>
                              )}
                              {log.errorMessage && (
                                <div className="md:col-span-2">
                                  <p className="text-gray-500 mb-1">Error</p>
                                  <p className="text-red-700">{log.errorMessage}</p>
                                </div>
                              )}
                              {log.userAgent && (
                                <div className="md:col-span-2">
                                  <p className="text-gray-500 mb-1">User agent</p>
                                  <p className="text-gray-700 font-mono text-xs break-all">{log.userAgent}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-500 mb-1">Old value</p>
                                <pre className="bg-white border border-gray-200 rounded p-2 text-xs overflow-auto max-h-48">
                                  {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : '—'}
                                </pre>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">New value</p>
                                <pre className="bg-white border border-gray-200 rounded p-2 text-xs overflow-auto max-h-48">
                                  {log.newValue ? JSON.stringify(log.newValue, null, 2) : '—'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <p className="text-gray-500">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> · {total.toLocaleString()} total entries
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center px-2.5 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center px-2.5 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
