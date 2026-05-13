import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Inbox, AlertCircle, CheckCircle, Eye, Building2, X } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface EmailLogRow {
  id: string;
  tenantId: string | null;
  templateKey: string;
  to: string | null;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  isTest: boolean;
  bodyPreview: string | null;
  createdAt: string;
}

interface ListResp { items: EmailLogRow[]; total: number; limit: number; offset: number }
interface StatsResp { total: number; last30d: { sent: number; failed: number; skipped: number } }
interface TenantOpt { id: string; name: string }

const TEMPLATE_KEYS = ['invoice_issued', 'payment_receipt', 'dunning', 'renewal_reminder', 'trial_ending', 'test', 'other'];
const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  skipped: 'bg-gray-100 text-gray-600',
};

export default function SystemEmailLogsPage() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [selected, setSelected] = useState<EmailLogRow | null>(null);

  const params = useMemo(() => {
    const p: any = { limit, offset };
    if (tenantId) p.tenantId = tenantId;
    if (templateKey) p.templateKey = templateKey;
    if (status) p.status = status;
    if (search.trim()) p.search = search.trim();
    return p;
  }, [tenantId, templateKey, status, search, offset, limit]);

  const tenantName = (id: string | null) => {
    if (!id) return '— global —';
    return tenants.find((t) => t.id === id)?.name || id.slice(0, 8) + '…';
  };

  const load = async () => {
    setLoading(true);
    try {
      const [listR, statsR] = await Promise.all([
        api.get('/saas-revenue/email-logs', { params }),
        api.get('/saas-revenue/email-logs/stats', { params: tenantId ? { tenantId } : {} }),
      ]);
      const data = unwrap<ListResp>(listR);
      if (data) { setRows(data.items || []); setTotal(data.total || 0); }
      setStats(unwrap<StatsResp>(statsR));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/tenants', { params: { perPage: 200 } });
        const arr = unwrap<any>(r);
        const list = Array.isArray(arr) ? arr : (arr?.items || arr?.data || []);
        setTenants(list.map((t: any) => ({ id: t.id, name: t.name || t.displayName || t.id })));
      } catch { /* optional */ }
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params]);
  // reset offset when filters change
  useEffect(() => { setOffset(0); /* eslint-disable-next-line */ }, [tenantId, templateKey, status, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="w-6 h-6" /> Email Send Log</h1>
          <p className="text-sm text-gray-500">Audit trail of every SaaS billing email — sent, failed, or skipped.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat title="Total (all-time)" value={stats.total} />
          <Stat title="Sent (30d)" value={stats.last30d.sent} tone="ok" />
          <Stat title="Failed (30d)" value={stats.last30d.failed} tone="err" />
          <Stat title="Skipped (30d)" value={stats.last30d.skipped} tone="muted" />
        </div>
      )}

      <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm">
          <Building2 className="w-4 h-4 text-gray-500" />
          <select className="border rounded px-2 py-1 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="">All tenants</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <select className="border rounded px-2 py-1 text-sm" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
          <option value="">All templates</option>
          {TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
          <option value="skipped">skipped</option>
        </select>
        <input
          placeholder="Search subject or recipient…"
          className="border rounded px-2 py-1 text-sm flex-1 min-w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">Template</th>
              <th className="text-left px-3 py-2">Tenant</th>
              <th className="text-left px-3 py-2">To</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No email records match these filters.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2"><span className="text-xs font-mono">{r.templateKey}</span>{r.isTest && <span className="ml-1 text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700">test</span>}</td>
                <td className="px-3 py-2 text-xs">{tenantName(r.tenantId)}</td>
                <td className="px-3 py-2 text-xs">{r.to || <span className="text-gray-400">—</span>}</td>
                <td className="px-3 py-2 max-w-[280px] truncate" title={r.subject}>{r.subject}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                    {r.status === 'sent' ? <CheckCircle className="w-3 h-3" /> : r.status === 'failed' ? <AlertCircle className="w-3 h-3" /> : null}
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setSelected(r)} className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-gray-500">
          <div>{total} total · showing {rows.length ? offset + 1 : 0}–{offset + rows.length}</div>
          <div className="flex gap-2">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
            <button disabled={offset + rows.length >= total} onClick={() => setOffset(offset + limit)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Email log details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <Row label="When">{new Date(selected.createdAt).toLocaleString()}</Row>
              <Row label="Template">{selected.templateKey}{selected.isTest && <span className="ml-1 text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700">test</span>}</Row>
              <Row label="Tenant">{tenantName(selected.tenantId)}</Row>
              <Row label="To">{selected.to || '—'}</Row>
              <Row label="Subject">{selected.subject}</Row>
              <Row label="Status">
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
              </Row>
              {selected.error && <Row label="Error"><code className="text-xs text-rose-700">{selected.error}</code></Row>}
              {selected.invoiceId && <Row label="Invoice"><a className="text-blue-600 hover:underline" href={`/system/saas-invoices/${selected.invoiceId}`}>{selected.invoiceId.slice(0, 8)}…</a></Row>}
              {selected.subscriptionId && <Row label="Subscription"><code className="text-xs">{selected.subscriptionId.slice(0, 8)}…</code></Row>}
              {selected.bodyPreview && (
                <div className="pt-2">
                  <div className="text-xs text-gray-500 mb-1">Body preview (text):</div>
                  <pre className="text-xs bg-gray-50 p-3 rounded whitespace-pre-wrap max-h-64 overflow-auto">{selected.bodyPreview}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: number; tone?: 'ok' | 'err' | 'muted' }) {
  const cls = tone === 'ok' ? 'text-emerald-700' : tone === 'err' ? 'text-rose-700' : tone === 'muted' ? 'text-gray-500' : 'text-gray-900';
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
