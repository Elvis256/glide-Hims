import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Building2, Globe, Loader2, RefreshCw, Sparkles, X, Check, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | 'spam';

interface Lead {
  id: string;
  fullName: string;
  organization: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  facilityType: string;
  estimatedUsers?: string | null;
  deploymentInterest?: string | null;
  message?: string | null;
  source?: string | null;
  utmCampaign?: string | null;
  status: LeadStatus;
  internalNotes?: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-gray-100 text-gray-600',
  spam: 'bg-red-100 text-red-700',
};

export default function SystemLeadsPage() {
  const [items, setItems] = useState<Lead[]>([]);
  const [stats, setStats] = useState<{ total: number; last30d: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/leads', { params: filter ? { status: filter } : {} }),
        api.get('/leads/stats'),
      ]);
      const listBody = listRes.data?.data ?? listRes.data;
      const statsBody = statsRes.data?.data ?? statsRes.data;
      setItems(listBody.items || []);
      setStats(statsBody);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (id: string, status: LeadStatus) => {
    try {
      await api.patch(`/leads/${id}/status`, { status });
      setItems((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (e) {
      // noop
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">Inbound enquiries from the marketing site contact form</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Last 30 days" value={stats.last30d} />
          <StatCard label="New (unread)" value={stats.byStatus.new || 0} />
          <StatCard label="Won" value={stats.byStatus.won || 0} accent="emerald" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['', 'new', 'contacted', 'qualified', 'won', 'lost', 'spam'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === s ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Mail className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No leads {filter ? `with status "${filter}"` : 'yet'}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {items.map((l) => (
              <div key={l.id} className="p-5 hover:bg-gray-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{l.fullName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                      {l.source && <span className="text-xs text-gray-400">via {l.source}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {l.organization}</span>
                      <a className="inline-flex items-center gap-1 hover:text-slate-900" href={`mailto:${l.email}`}><Mail className="w-3.5 h-3.5" /> {l.email}</a>
                      {l.phone && <a className="inline-flex items-center gap-1 hover:text-slate-900" href={`tel:${l.phone}`}><Phone className="w-3.5 h-3.5" /> {l.phone}</a>}
                      {l.country && <span className="inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {l.country}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">type: {l.facilityType}</span>
                      {l.estimatedUsers && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">users: {l.estimatedUsers}</span>}
                      {l.deploymentInterest && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">interest: {l.deploymentInterest}</span>}
                    </div>
                    {l.message && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">{l.message}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleString()}</span>
                    <select
                      value={l.status}
                      onChange={(e) => updateStatus(l.id, e.target.value as LeadStatus)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="qualified">qualified</option>
                      <option value="won">won</option>
                      <option value="lost">lost</option>
                      <option value="spam">spam</option>
                    </select>
                    {(l.status === 'qualified' || l.status === 'contacted' || l.status === 'new') && (
                      <CreateQuotationButton leadId={l.id} />
                    )}
                    {(l.status === 'qualified' || l.status === 'won') && (
                      <button onClick={() => setConverting(l)} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                        <Sparkles className="w-3 h-3" /> Convert to subscription
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {converting && <ConvertModal lead={converting} onClose={() => setConverting(null)} onDone={() => { setConverting(null); load(); }} />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'emerald' }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ConvertModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [planId, setPlanId] = useState('');
  const [billingInterval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [seats, setSeats] = useState(1);
  const [startTrial, setStartTrial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/tenants', { params: { perPage: 200 } }),
      api.get('/saas-revenue/plans'),
    ]).then(([t, p]) => {
      const tList = t.data?.data?.items ?? t.data?.data ?? t.data ?? [];
      const pList = p.data?.data ?? p.data ?? [];
      setTenants(tList);
      setPlans(pList);
      const matchByOrg = tList.find((x: any) => (x.name || '').toLowerCase() === lead.organization.toLowerCase());
      if (matchByOrg) setTenantId(matchByOrg.id);
      const pro = pList.find((p: any) => p.code === 'professional');
      if (pro) setPlanId(pro.id);
    });
  }, [lead.organization]);

  const submit = async () => {
    if (!tenantId || !planId) { setErr('Pick a tenant and a plan'); return; }
    setSaving(true); setErr(null);
    try {
      await api.post(`/saas-revenue/leads/${lead.id}/convert`, { tenantId, planId, billingInterval, seats, startTrial });
      onDone();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Conversion failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Convert lead → subscription</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">{lead.fullName} · {lead.organization}</p>
        <div className="space-y-3 text-sm">
          <div><div className="text-xs text-gray-500 mb-1">Tenant</div>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">— select tenant —</option>
              {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div><div className="text-xs text-gray-500 mb-1">Plan</div>
            <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">— select plan —</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.tier})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-gray-500 mb-1">Interval</div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={billingInterval} onChange={(e) => setInterval(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div><div className="text-xs text-gray-500 mb-1">Seats</div><input type="number" min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={seats} onChange={(e) => setSeats(parseInt(e.target.value || '1', 10))} /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={startTrial} onChange={(e) => setStartTrial(e.target.checked)} /> Start with trial period (per plan)</label>
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-2 text-sm bg-emerald-600 text-white rounded inline-flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Convert</button>
        </div>
      </div>
    </div>
  );
}

function CreateQuotationButton({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleClick = async () => {
    setCreating(true);
    try {
      const r = await api.post(`/saas-revenue/quotations/from-lead/${leadId}`);
      const q = (r as any)?.data?.data ?? (r as any)?.data;
      toast.success('Quotation created from lead');
      navigate(`/system/quotations/${q.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create quotation');
    } finally { setCreating(false); }
  };

  return (
    <button onClick={handleClick} disabled={creating} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
      {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Create Quotation
    </button>
  );
}
