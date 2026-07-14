import { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../services/api';
import { getObjectDiff } from './saas/_shared';
import { toast } from 'sonner';
import {
  ScrollText, RefreshCw, Loader2, AlertTriangle, Search, Download,
  ChevronLeft, ChevronRight, X, ShieldCheck, User as UserIcon, Receipt,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userId?: string;
  user?: { id?: string; username?: string; firstName?: string; lastName?: string; email?: string };
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
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
interface PageResp { data: AuditLog[]; total: number; page: number; limit: number; totalPages: number; }
interface StatsResp {
  total: number;
  todayCount: number;
  actionCounts: { action: string; count: string | number }[];
  entityCounts: { entityType: string; count: string | number }[];
}

const PRESETS: { id: string; label: string; entityTypes: string }[] = [
  { id: 'all', label: 'All billing', entityTypes: 'saas-revenue,billing,license,tenants' },
  { id: 'sub', label: 'Subscriptions / plans', entityTypes: 'saas-revenue' },
  { id: 'invoices', label: 'Invoices & payments', entityTypes: 'saas-revenue,billing' },
  { id: 'license', label: 'Licenses', entityTypes: 'license' },
  { id: 'tenants', label: 'Tenants', entityTypes: 'tenants' },
];

const METHOD_COLOR: Record<string, string> = { GET: 'text-gray-600', POST: 'text-emerald-700', PUT: 'text-blue-700', PATCH: 'text-blue-700', DELETE: 'text-red-700' };
const ACTOR_BADGE: Record<string, string> = { system_admin: 'bg-purple-100 text-purple-800', system_support: 'bg-amber-100 text-amber-800', tenant_user: 'bg-blue-100 text-blue-800' };

export default function SystemSaasAuditPage() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResp | null>(null);

  const [preset, setPreset] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const limit = 50;
  const entityTypes = useMemo(() => PRESETS.find((p) => p.id === preset)?.entityTypes || 'saas-revenue,billing,license,tenants', [preset]);

  const buildParams = useCallback((overridePage?: number): Record<string, string> => {
    const params: Record<string, string> = { page: String(overridePage ?? page), limit: String(limit), entityType: entityTypes };
    if (search.trim()) params.search = search.trim();
    if (action.trim()) params.action = action.trim();
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [page, entityTypes, search, action, startDate, endDate]);

  const load = useCallback(async (resetPage = false) => {
    setLoading(true); setError(null);
    const targetPage = resetPage ? 1 : page;
    try {
      const res = await api.get<PageResp>('/audit-logs', { params: buildParams(targetPage) });
      const body: any = res.data;
      const meta: any = (res as any).meta || {};
      const list = Array.isArray(body) ? body : (body?.data || []);
      setData(list);
      setTotal(meta.total ?? body?.total ?? list.length);
      setTotalPages(meta.totalPages ?? body?.totalPages ?? 1);
      if (resetPage) setPage(1);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load audit logs');
    } finally { setLoading(false); }
  }, [page, buildParams]);

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get<StatsResp>('/audit-logs/stats');
      const body: any = r.data;
      const s = body?.data || body;
      setStats(s as StatsResp);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { load(true); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const onApplyFilters = (e: React.FormEvent) => { e.preventDefault(); load(true); };
  const clearFilters = () => { setSearch(''); setAction(''); setStartDate(''); setEndDate(''); setTimeout(() => load(true), 0); };

  const exportCsv = async () => {
    try {
      const res = await api.get('/audit-logs/export.csv', { params: buildParams(1), responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `saas-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Export failed'); }
  };

  const userLabel = (log: AuditLog) => {
    const u = log.user;
    if (!u) return log.attemptedIdentifier || (log.userId ? log.userId.slice(0, 8) + '…' : '—');
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.username || u.email || (u.id ? u.id.slice(0, 8) + '…' : '—');
  };

  const billingEntityCounts = useMemo(() => {
    if (!stats) return [];
    const billing = new Set(['saas-revenue', 'billing', 'license', 'tenants']);
    return stats.entityCounts.filter((e) => billing.has(e.entityType));
  }, [stats]);

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            SaaS billing audit log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Subscriptions, plans, invoices, payments, coupons, currencies, licenses and tenant lifecycle events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={loading || !data.length} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { load(); loadStats(); }} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total entries (all)" value={stats.total.toLocaleString()} accent="blue" />
          <StatCard label="Today" value={stats.todayCount.toLocaleString()} accent="emerald" />
          <StatCard label="Top action" value={stats.actionCounts[0]?.action || '—'} sub={stats.actionCounts[0] ? `${stats.actionCounts[0].count} events` : undefined} accent="amber" />
          <StatCard label="Billing-entity events" value={billingEntityCounts.reduce((s, e) => s + Number(e.count || 0), 0).toLocaleString()} sub={billingEntityCounts.map((e) => `${e.entityType} (${e.count})`).join(' · ') || '—'} accent="purple" />
        </div>
      )}

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${preset === p.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <form onSubmit={onApplyFilters} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search (user / action / entity)</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="invoice, refund, plan@example.com…" className="pl-9 pr-3 py-2 w-full border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <input type="text" value={action} onChange={(e) => setAction(e.target.value)} placeholder="CREATE, UPDATE…" className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 w-full border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div className="md:col-span-4 flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
            <X className="w-4 h-4 inline mr-1" /> Clear
          </button>
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Apply</button>
        </div>
      </form>

      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Could not load audit logs</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button onClick={() => load()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
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
                  const scClass = !sc ? 'text-gray-400' : sc < 300 ? 'text-emerald-700' : sc < 400 ? 'text-blue-700' : sc < 500 ? 'text-yellow-700' : 'text-red-700';
                  return (
                    <FragmentRow key={log.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(isOpen ? null : log.id)}>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {log.actorType?.startsWith('system') ? <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" /> : <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate">{userLabel(log)}</p>
                              {log.actorType && (
                                <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${actorClass}`}>
                                  {log.actorType.replace('_', ' ')}{log.supportAccessTier ? ` · T${log.supportAccessTier}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-800">{log.action}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{log.entityType}</p>
                          {log.entityId && <p className="text-xs text-gray-400 font-mono truncate max-w-[140px]">{log.entityId}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.requestMethod && <span className={`font-mono font-semibold ${methodClass}`}>{log.requestMethod}</span>}
                          {log.requestUrl && <p className="text-gray-500 truncate max-w-[260px]">{log.requestUrl}</p>}
                          {log.ipAddress && <p className="text-gray-400 text-xs">{log.ipAddress}</p>}
                        </td>
                        <td className={`px-4 py-3 font-mono text-xs ${scClass}`}>{sc || '—'}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {log.reason && <div className="md:col-span-2"><p className="text-gray-500 mb-1">Reason</p><p className="text-gray-800 italic">{log.reason}</p></div>}
                              {log.errorMessage && <div className="md:col-span-2"><p className="text-gray-500 mb-1">Error</p><p className="text-red-700">{log.errorMessage}</p></div>}
                              <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Changed Fields</p>
                                {(() => {
                                  const diffs = getObjectDiff(log.oldValue, log.newValue);
                                  if (diffs.length === 0) {
                                    return <p className="text-xs text-gray-500 italic">No field differences detected</p>;
                                  }
                                  return (
                                    <div className="divide-y divide-gray-100 font-mono text-xs">
                                      {diffs.map((d) => (
                                        <div key={d.key} className="py-2 grid grid-cols-1 sm:grid-cols-12 gap-1.5 first:pt-0 last:pb-0">
                                          <span className="sm:col-span-3 font-semibold text-gray-600 truncate" title={d.key}>{d.key}</span>
                                          <div className="sm:col-span-9 space-y-1">
                                            {d.oldValue !== null && (
                                              <div className="bg-red-50 text-red-700 px-2 py-0.5 rounded break-all border border-red-100">
                                                - {d.oldValue}
                                              </div>
                                            )}
                                            {d.newValue !== null && (
                                              <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded break-all border border-emerald-100">
                                                + {d.newValue}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm">
            <p className="text-gray-500">Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {total.toLocaleString()} entries</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center px-2.5 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center px-2.5 py-1.5 border border-gray-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: 'blue' | 'emerald' | 'amber' | 'purple' }) {
  const ring: Record<string, string> = { blue: 'border-blue-100', emerald: 'border-emerald-100', amber: 'border-amber-100', purple: 'border-purple-100' };
  const text: Record<string, string> = { blue: 'text-blue-700', emerald: 'text-emerald-700', amber: 'text-amber-700', purple: 'text-purple-700' };
  return (
    <div className={`bg-white border ${ring[accent]} rounded-xl p-4`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${text[accent]}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
