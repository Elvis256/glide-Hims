import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, ExternalLink, Pause, Play, Ban, KeyRound, FileText } from 'lucide-react';
import api from '../../services/api';
import { Plan, Subscription, SubStatus, SUB_STATUS_STYLES, fmtMoney, fmtDate, unwrap } from './saas/_shared';

const STATUSES: SubStatus[] = ['trial', 'active', 'past_due', 'paused', 'cancelled', 'churned'];

export default function SystemSubscriptionsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/subscriptions', { params: status ? { status } : {} });
      setItems(unwrap<Subscription[]>(r) || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { api.get('/saas-revenue/plans').then((r) => setPlans(unwrap<Plan[]>(r) || [])); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500">All tenant SaaS subscriptions and their lifecycle state</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> New subscription</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setParams({})} className={`px-3 py-1 text-xs rounded-full border ${!status ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>All ({items.length})</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1 text-xs rounded-full border capitalize ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Plan</th>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Cycle</th>
                <th className="text-left px-4 py-2">Next renewal</th>
                <th className="text-left px-4 py-2">Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{s.plan?.name ?? '?'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.tenantId.slice(0, 8)}…</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLES[s.status]}`}>{s.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-2 text-right">{fmtMoney(s.unitPriceMinor * s.seats, s.currency)}</td>
                  <td className="px-4 py-2 capitalize">{s.billingInterval}</td>
                  <td className="px-4 py-2">{fmtDate(s.nextRenewalAt)} {!s.autoRenew && <span className="text-xs text-amber-600">(no auto)</span>}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(s.createdAt)}</td>
                  <td className="px-4 py-2"><Link to={`/system/subscriptions/${s.id}`} className="text-blue-600 inline-flex items-center gap-1 text-xs hover:underline"><ExternalLink className="w-3 h-3" /> Open</Link></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No subscriptions in this filter</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewSubModal plans={plans} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function NewSubModal({ plans, onClose, onSaved }: { plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const [tenantId, setTenantId] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [billingInterval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [seats, setSeats] = useState(1);
  const [couponCode, setCoupon] = useState('');
  const [startTrial, setStartTrial] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!tenantId || !planId) return alert('Tenant and plan are required');
    setSaving(true);
    try {
      await api.post('/saas-revenue/subscriptions', {
        tenantId, planId, billingInterval, seats,
        couponCode: couponCode || undefined,
        startTrial, autoRenew, notes: notes || undefined,
      });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message || 'Create failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New subscription</h2>
        <div className="space-y-3 text-sm">
          <div><div className="text-xs text-gray-500 mb-1">Tenant ID *</div><input className="input w-full" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="UUID of tenant" /></div>
          <div><div className="text-xs text-gray-500 mb-1">Plan *</div>
            <select className="input w-full" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-gray-500 mb-1">Billing interval</div>
              <select className="input w-full" value={billingInterval} onChange={(e) => setInterval(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div><div className="text-xs text-gray-500 mb-1">Seats</div><input type="number" min={1} className="input w-full" value={seats} onChange={(e) => setSeats(parseInt(e.target.value || '1', 10))} /></div>
          </div>
          <div><div className="text-xs text-gray-500 mb-1">Coupon code (optional)</div><input className="input w-full" value={couponCode} onChange={(e) => setCoupon(e.target.value)} /></div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={startTrial} onChange={(e) => setStartTrial(e.target.checked)} /> Start with trial</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} /> Auto-renew</label>
          </div>
          <div><div className="text-xs text-gray-500 mb-1">Notes</div><textarea className="input w-full min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
        <style>{`.input{border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px}`}</style>
      </div>
    </div>
  );
}
