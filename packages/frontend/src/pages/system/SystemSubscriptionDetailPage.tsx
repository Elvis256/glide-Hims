import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Pause, Play, Ban, KeyRound, RefreshCw, FileText, DollarSign, Calendar, Tag, AlertTriangle, TrendingUp, Settings, Save, Coins } from 'lucide-react';
import api from '../../services/api';
import { Plan, Subscription, SaasInvoice, SaasPayment, INVOICE_STATUS_STYLES, SUB_STATUS_STYLES, fmtMoney, fmtDate, fmtDateTime, unwrap } from './saas/_shared';

interface SubDetail extends Subscription {
  invoices: SaasInvoice[];
  events: Array<{ id: string; type: string; message: string | null; createdAt: string; payload: any }>;
  payments: SaasPayment[];
  currentPlanUnitPriceMinor?: number;
  isPriceLockedBelow?: boolean;
  isPriceLockedAbove?: boolean;
}

export default function SystemSubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SubDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paymentInv, setPaymentInv] = useState<SaasInvoice | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.get(`/saas-revenue/subscriptions/${id}`),
        api.get('/saas-revenue/plans', { params: { includeInactive: 'true' } }),
      ]);
      setData(unwrap<SubDetail>(s));
      setPlans(unwrap<Plan[]>(p) || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const action = async (path: string, body: any = {}) => {
    if (!id) return;
    setBusy(true);
    try { await api.post(`/saas-revenue/subscriptions/${id}/${path}`, body); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  if (loading || !data) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const totalAmount = data.unitPriceMinor * data.seats;
  const isOverdue = data.invoices.some((i) => i.status === 'open' && new Date(i.dueAt) < new Date());

  return (
    <div className="space-y-6">
      <Link to="/system/subscriptions" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to subscriptions</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{data.plan?.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLES[data.status]}`}>{data.status.replace('_', ' ')}</span>
            {data.cancelAtPeriodEnd && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Cancels at period end</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Tenant {data.tenant ? (
              <><span className="font-medium text-gray-700">{data.tenant.name}</span> <span className="font-mono text-xs">({data.tenant.slug})</span></>
            ) : (
              <span className="font-mono">{data.tenantId}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => setChangePlanOpen(true)} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 inline-flex items-center gap-1"><Tag className="w-4 h-4" /> Change plan</button>
          {data.status === 'paused' ? (
            <button disabled={busy} onClick={() => action('resume')} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 inline-flex items-center gap-1"><Play className="w-4 h-4" /> Resume</button>
          ) : (
            <button disabled={busy} onClick={() => action('pause')} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 inline-flex items-center gap-1"><Pause className="w-4 h-4" /> Pause</button>
          )}
          <button disabled={busy} onClick={() => action('sync-license')} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 inline-flex items-center gap-1"><KeyRound className="w-4 h-4" /> Sync license</button>
          {data.currentPlanUnitPriceMinor !== undefined && data.currentPlanUnitPriceMinor !== data.unitPriceMinor && (
            <button disabled={busy} onClick={async () => {
              const cur = fmtMoney(data.unitPriceMinor, data.currency);
              const next = fmtMoney(data.currentPlanUnitPriceMinor!, data.currency);
              if (!confirm(`Sync this subscription's locked price from ${cur} to current plan price ${next}? Existing invoices are unaffected; future renewals will use the new price.`)) return;
              setBusy(true);
              try { await api.post(`/saas-revenue/subscriptions/${id}/sync-price`, {}); await load(); }
              catch (e: any) { alert(e?.response?.data?.message || 'Sync failed'); }
              finally { setBusy(false); }
            }} className="px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded hover:bg-blue-50 inline-flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Sync price</button>
          )}
          {data.status !== 'cancelled' && data.status !== 'churned' && (
            <button disabled={busy} onClick={() => {
              const reason = prompt('Cancellation reason?') ?? undefined;
              const eop = confirm('Cancel at period end? (Cancel = OK, Immediately = Cancel)');
              action('cancel', { atPeriodEnd: eop, reason });
            }} className="px-3 py-2 text-sm border rounded hover:bg-red-50 text-red-600 inline-flex items-center gap-1"><Ban className="w-4 h-4" /> Cancel</button>
          )}
          <button onClick={load} className="px-3 py-2 text-sm border rounded hover:bg-gray-50 inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {isOverdue && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>This subscription has overdue invoices. Auto-churn happens 30 days after due date if unpaid.</div>
        </div>
      )}

      {data.currentPlanUnitPriceMinor !== undefined && data.currentPlanUnitPriceMinor !== data.unitPriceMinor && (
        <div className={`border rounded p-3 text-sm flex items-start gap-2 ${data.isPriceLockedBelow ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">{data.isPriceLockedBelow ? 'Price grandfathered' : 'Tenant overpaying current plan'}</div>
            <div className="text-xs mt-0.5">
              Locked at <b>{fmtMoney(data.unitPriceMinor, data.currency)}</b> · Current plan price is <b>{fmtMoney(data.currentPlanUnitPriceMinor, data.currency)}</b> ({data.billingInterval}).
              {data.isPriceLockedBelow ? ' Renewals continue at the locked price until you Sync.' : ' Use Sync price to bring this subscription down to the new lower price.'}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Recurring amount" value={fmtMoney(totalAmount, data.currency)} sub={`${data.billingInterval} · ${data.seats} seat(s)`} />
        <Stat label="Current period ends" value={fmtDate(data.currentPeriodEnd)} sub={data.autoRenew ? 'Auto-renew on' : 'Manual renewal'} />
        <Stat label="Lifetime paid" value={fmtMoney(data.payments.reduce((a, p) => a + p.amountMinor, 0), data.currency)} sub={`${data.payments.length} payment(s)`} />
      </div>

      <BillingSettingsCard sub={data} onSaved={load} />

      <Section title="Invoices" icon={<FileText className="w-4 h-4" />}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Number</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Paid</th>
              <th className="text-left px-3 py-2">Issued</th>
              <th className="text-left px-3 py-2">Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${INVOICE_STATUS_STYLES[inv.status]}`}>{inv.status}</span></td>
                <td className="px-3 py-2 text-right">{fmtMoney(inv.totalMinor, inv.currency)}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(inv.amountPaidMinor, inv.currency)}</td>
                <td className="px-3 py-2">{fmtDate(inv.issuedAt)}</td>
                <td className="px-3 py-2">{fmtDate(inv.dueAt)}</td>
                <td className="px-3 py-2 text-right">
                  {inv.status === 'open' && <button onClick={() => setPaymentInv(inv)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> Record payment</button>}
                </td>
              </tr>
            ))}
            {data.invoices.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No invoices yet</td></tr>}
          </tbody>
        </table>
      </Section>

      <Section title="Recent payments" icon={<DollarSign className="w-4 h-4" />}>
        {data.payments.length === 0 ? <div className="text-sm text-gray-500">No payments recorded</div> :
          <ul className="divide-y text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmtMoney(p.amountMinor, p.currency)} · {p.gateway}{p.method ? ` (${p.method})` : ''}</div>
                  <div className="text-xs text-gray-500">{fmtDateTime(p.paidAt)} · {p.gatewayRef ?? 'no ref'}</div>
                  {p.notes && <div className="text-xs text-gray-600 mt-0.5">{p.notes}</div>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{p.status}</span>
              </li>
            ))}
          </ul>}
      </Section>

      <Section title="Activity" icon={<Calendar className="w-4 h-4" />}>
        <ul className="divide-y text-sm">
          {data.events.map((e) => (
            <li key={e.id} className="py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{e.type}</span>
                <span className="text-gray-700">{e.message}</span>
              </div>
              <div className="text-xs text-gray-500">{fmtDateTime(e.createdAt)}</div>
            </li>
          ))}
        </ul>
      </Section>

      {paymentInv && <RecordPaymentModal invoice={paymentInv} onClose={() => setPaymentInv(null)} onSaved={() => { setPaymentInv(null); load(); }} />}
      {changePlanOpen && <ChangePlanModal sub={data} plans={plans} onClose={() => setChangePlanOpen(false)} onSaved={() => { setChangePlanOpen(false); load(); }} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-gray-700">{icon}{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function RecordPaymentModal({ invoice, onClose, onSaved }: { invoice: SaasInvoice; onClose: () => void; onSaved: () => void }) {
  const due = invoice.totalMinor - invoice.amountPaidMinor;
  const [amountMinor, setAmount] = useState(due);
  const [gateway, setGateway] = useState('manual');
  const [method, setMethod] = useState('bank');
  const [gatewayRef, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/saas-revenue/invoices/${invoice.id}/payments`, { amountMinor, gateway, method, gatewayRef: gatewayRef || undefined, notes: notes || undefined });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">Record payment</h2>
        <p className="text-sm text-gray-500 mb-4">Invoice {invoice.invoiceNumber} · {fmtMoney(due, invoice.currency)} due</p>
        <div className="space-y-3 text-sm">
          <div><div className="text-xs text-gray-500 mb-1">Amount (minor units)</div><input type="number" className="input w-full" value={amountMinor} onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-gray-500 mb-1">Gateway</div>
              <select className="input w-full" value={gateway} onChange={(e) => setGateway(e.target.value)}>
                <option value="manual">Manual</option>
                <option value="bank">Bank transfer</option>
                <option value="momo">MTN MoMo</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="stripe">Stripe</option>
                <option value="paystack">Paystack</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div><div className="text-xs text-gray-500 mb-1">Method</div><input className="input w-full" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="bank / card / momo / cash" /></div>
          </div>
          <div><div className="text-xs text-gray-500 mb-1">Gateway reference</div><input className="input w-full" value={gatewayRef} onChange={(e) => setRef(e.target.value)} placeholder="Bank ref / transaction ID" /></div>
          <div><div className="text-xs text-gray-500 mb-1">Notes</div><textarea className="input w-full min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 text-sm bg-emerald-600 text-white rounded inline-flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Record</button>
        </div>
        <style>{`.input{border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px}`}</style>
      </div>
    </div>
  );
}

function ChangePlanModal({ sub, plans, onClose, onSaved }: { sub: Subscription; plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const [planId, setPlanId] = useState(sub.planId);
  const [billingInterval, setInterval] = useState<'monthly' | 'annual'>(sub.billingInterval);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.post(`/saas-revenue/subscriptions/${sub.id}/change-plan`, { planId, billingInterval }); onSaved(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Change plan</h2>
        <div className="space-y-3 text-sm">
          <div><div className="text-xs text-gray-500 mb-1">New plan</div>
            <select className="input w-full" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.tier}) — {fmtMoney(p.priceMonthlyMinor, p.currency)}/mo</option>)}
            </select>
          </div>
          <div><div className="text-xs text-gray-500 mb-1">Billing interval</div>
            <select className="input w-full" value={billingInterval} onChange={(e) => setInterval(e.target.value as any)}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </div>
        <style>{`.input{border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px}`}</style>
      </div>
    </div>
  );
}

function BillingSettingsCard({ sub, onSaved }: { sub: Subscription; onSaved: () => void }) {
  const [email, setEmail] = useState(sub.billingEmail || '');
  const [billingCcy, setBillingCcy] = useState<string>(sub.billingCurrency || '');
  const [autoRenew, setAutoRenew] = useState<boolean>(sub.autoRenew);
  const [available, setAvailable] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get('/saas-revenue/public/currency-rates')
      .then((r) => {
        const fx: any = unwrap(r);
        const list = Array.from(new Set([fx.base, ...Object.keys(fx.rates || {})])) as string[];
        setAvailable(list.sort());
      })
      .catch(() => setAvailable([]));
  }, []);

  const dirty = (email || '') !== (sub.billingEmail || '') || (billingCcy || '') !== (sub.billingCurrency || '') || autoRenew !== sub.autoRenew;

  const save = async () => {
    setErr(null); setSaving(true);
    try {
      await api.put(`/saas-revenue/subscriptions/${sub.id}`, {
        billingEmail: email.trim() || null,
        billingCurrency: billingCcy ? billingCcy.toUpperCase() : null,
        autoRenew,
      });
      setSavedAt(Date.now()); setTimeout(() => setSavedAt(null), 2500);
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const fxOverride = !!billingCcy && billingCcy.toUpperCase() !== sub.currency.toUpperCase();
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium inline-flex items-center gap-2"><Settings className="w-4 h-4" /> Billing settings</h2>
        {savedAt && <span className="text-xs text-emerald-700">Saved</span>}
      </div>
      {err && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{err}</div>}
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Billing email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@tenant.example" className="w-full px-2 py-1.5 border rounded" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1 inline-flex items-center gap-1"><Coins className="w-3 h-3" /> Billing currency</label>
          <select value={billingCcy} onChange={(e) => setBillingCcy(e.target.value)} className="w-full px-2 py-1.5 border rounded">
            <option value="">Plan default ({sub.currency})</option>
            {available.filter((c) => c !== sub.currency).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {fxOverride && (
            <div className="text-[11px] text-amber-700 mt-1">
              Renewals will be converted from {sub.currency} → {billingCcy.toUpperCase()} at issue time using current FX rates.
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Auto-renew</label>
          <label className="inline-flex items-center gap-2 mt-1">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
            <span className="text-sm">Renew automatically</span>
          </label>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button disabled={!dirty || saving} onClick={save} className="px-3 py-2 text-sm bg-emerald-600 text-white rounded inline-flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </div>
    </div>
  );
}
