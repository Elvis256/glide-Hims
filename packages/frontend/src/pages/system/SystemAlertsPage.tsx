import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, RefreshCw, BellRing, AlertCircle, AlertTriangle, Info,
  CheckCircle2, Building2, Server, X, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { unwrap } from './saas/_shared';
import { getApiErrorMessage } from '../../services/api';

/**
 * Platform-wide alerts inbox (Phase 2-4 epic, surface 4).
 *
 * GET /deployments/alerts takes no query parameters — it returns the whole set
 * and the controller decides the scope: every tenant for a system admin, only
 * their own for anyone else. So the filters below are client-side over the
 * loaded rows, not server round-trips.
 */

type AlertSeverity = 'info' | 'warning' | 'critical' | 'resolved';
type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated' | 'false_positive';

interface AlertDeployment {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  currentVersion: string;
}

interface DeploymentAlertRow {
  id: string;
  deploymentId: string;
  alertType: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  occurrenceCount: number;
  escalated: boolean;
  escalationReason: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  triggerCondition: string | null;
  threshold: string | null;
  actualValue: string | null;
  createdAt: string;
  // present because the API joins the owning deployment; tenancy is only
  // reachable through it, the alert row carries no tenant of its own
  deployment?: AlertDeployment;
}

interface TenantOpt { id: string; name: string }

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  critical: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  resolved: 'bg-gray-100 text-gray-600',
};

const STATUS_STYLES: Record<AlertStatus, string> = {
  open: 'bg-rose-50 text-rose-700 border-rose-200',
  escalated: 'bg-orange-50 text-orange-700 border-orange-200',
  acknowledged: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  false_positive: 'bg-gray-50 text-gray-500 border-gray-200',
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0, warning: 1, info: 2, resolved: 3,
};

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  if (severity === 'critical') return <AlertCircle className="w-3 h-3" />;
  if (severity === 'warning') return <AlertTriangle className="w-3 h-3" />;
  if (severity === 'info') return <Info className="w-3 h-3" />;
  return <CheckCircle2 className="w-3 h-3" />;
}

export default function SystemAlertsPage() {
  const [rows, setRows] = useState<DeploymentAlertRow[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeploymentAlertRow | null>(null);

  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('open');
  const [tenantId, setTenantId] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/deployments/alerts');
      const data = unwrap<DeploymentAlertRow[]>(res);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load alerts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/tenants', { params: { perPage: 200 } });
        const arr = unwrap<any>(r);
        const list = Array.isArray(arr) ? arr : (arr?.items || arr?.data || []);
        setTenants(list.map((t: any) => ({ id: t.id, name: t.name || t.displayName || t.id })));
      } catch { /* names are a nicety; ids still render */ }
    })();
  }, []);

  const tenantName = (id?: string | null) => {
    if (!id) return '—';
    return tenants.find((t) => t.id === id)?.name || id.slice(0, 8) + '…';
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (severity ? r.severity === severity : true))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => (tenantId ? r.deployment?.tenantId === tenantId : true))
      .filter((r) =>
        q
          ? r.title.toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q) ||
            (r.deployment?.name || '').toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => {
        const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (s !== 0) return s;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [rows, severity, status, tenantId, search]);

  const counts = useMemo(() => ({
    open: rows.filter((r) => r.status === 'open').length,
    critical: rows.filter((r) => r.severity === 'critical' && r.status !== 'resolved').length,
    escalated: rows.filter((r) => r.escalated && r.status !== 'resolved').length,
    total: rows.length,
  }), [rows]);

  const resolve = async (row: DeploymentAlertRow) => {
    setResolvingId(row.id);
    try {
      await api.put(`/deployments/alerts/${row.id}/resolve`);
      toast.success(`Resolved “${row.title}”`);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not resolve this alert'));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BellRing className="w-6 h-6" /> Alerts Inbox
          </h1>
          <p className="text-sm text-gray-500">
            Deployment alerts across every hospital you administer, newest and most severe first.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat title="Open" value={counts.open} tone={counts.open ? 'err' : 'muted'} />
        <Stat title="Critical (unresolved)" value={counts.critical} tone={counts.critical ? 'err' : 'muted'} />
        <Stat title="Escalated" value={counts.escalated} tone={counts.escalated ? 'warn' : 'muted'} />
        <Stat title="All alerts" value={counts.total} />
      </div>

      <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2">
        <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="open">open</option>
          <option value="escalated">escalated</option>
          <option value="acknowledged">acknowledged</option>
          <option value="resolved">resolved</option>
          <option value="false_positive">false positive</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Any severity</option>
          <option value="critical">critical</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
        <div className="flex items-center gap-1 text-sm">
          <Building2 className="w-4 h-4 text-gray-500" />
          <select className="border rounded px-2 py-1 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="">All hospitals</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <input
          placeholder="Search title, detail or deployment…"
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Severity</th>
              <th className="text-left px-3 py-2">Alert</th>
              <th className="text-left px-3 py-2">Deployment</th>
              <th className="text-left px-3 py-2">Hospital</th>
              <th className="text-left px-3 py-2">Raised</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                <Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                {rows.length === 0 ? 'No alerts have been raised.' : 'No alerts match these filters.'}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${SEVERITY_STYLES[r.severity]}`}>
                    <SeverityIcon severity={r.severity} />{r.severity}
                  </span>
                </td>
                <td className="px-3 py-2 max-w-[300px]">
                  <div className="truncate font-medium" title={r.title}>{r.title}</div>
                  <div className="text-xs text-gray-500 font-mono">{r.alertType}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.deployment ? (
                    <Link to={`/system/deployments/${r.deploymentId}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      <Server className="w-3 h-3" />{r.deployment.name}
                    </Link>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-xs">{tenantName(r.deployment?.tenantId)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleString()}
                  {r.occurrenceCount > 1 && <span className="ml-1 text-gray-400">×{r.occurrenceCount}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${STATUS_STYLES[r.status]}`}>
                    {r.escalated && <ShieldAlert className="w-3 h-3" />}{r.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setSelected(r)} className="text-blue-600 hover:underline text-xs">Details</button>
                  {r.status !== 'resolved' && (
                    <button
                      onClick={() => resolve(r)}
                      disabled={resolvingId === r.id}
                      className="ml-3 text-xs text-emerald-700 hover:underline disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      {resolvingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 border-t text-xs text-gray-500">
          Showing {filtered.length} of {rows.length}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Alert details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <Row label="Title">{selected.title}</Row>
              <Row label="Type"><code className="text-xs">{selected.alertType}</code></Row>
              <Row label="Severity">
                <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_STYLES[selected.severity]}`}>{selected.severity}</span>
              </Row>
              <Row label="Status">
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
              </Row>
              <Row label="Deployment">
                {selected.deployment ? (
                  <Link to={`/system/deployments/${selected.deploymentId}`} className="text-blue-600 hover:underline">
                    {selected.deployment.name}
                  </Link>
                ) : '—'}
              </Row>
              <Row label="Hospital">{tenantName(selected.deployment?.tenantId)}</Row>
              <Row label="Raised">{new Date(selected.createdAt).toLocaleString()}</Row>
              {selected.occurrenceCount > 1 && <Row label="Occurrences">{selected.occurrenceCount}</Row>}
              {selected.description && (
                <div className="pt-2">
                  <div className="text-xs text-gray-500 mb-1">Detail</div>
                  <pre className="text-xs bg-gray-50 p-3 rounded whitespace-pre-wrap max-h-64 overflow-auto">{selected.description}</pre>
                </div>
              )}
              {selected.triggerCondition && <Row label="Trigger"><code className="text-xs">{selected.triggerCondition}</code></Row>}
              {(selected.threshold || selected.actualValue) && (
                <Row label="Measured">
                  <span className="text-xs">{selected.actualValue ?? '?'} against threshold {selected.threshold ?? '?'}</span>
                </Row>
              )}
              {selected.escalated && (
                <Row label="Escalated">
                  <span className="text-xs text-orange-700">{selected.escalationReason || 'yes'}</span>
                </Row>
              )}
              {selected.resolvedAt && <Row label="Resolved">{new Date(selected.resolvedAt).toLocaleString()}</Row>}
              {selected.resolutionNotes && <Row label="Resolution">{selected.resolutionNotes}</Row>}
            </div>
            {selected.status !== 'resolved' && (
              <div className="p-4 border-t flex justify-end">
                <button
                  onClick={() => resolve(selected)}
                  disabled={resolvingId === selected.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {resolvingId === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark resolved
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: number; tone?: 'err' | 'warn' | 'muted' }) {
  const cls = tone === 'err' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : tone === 'muted' ? 'text-gray-400' : 'text-gray-900';
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
