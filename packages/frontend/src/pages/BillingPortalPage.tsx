import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, CreditCard, Printer, Download, Plus, Trash2, Star } from 'lucide-react';
import api from '../services/api';
import { fmtMoney, fmtDate, INVOICE_STATUS_STYLES, SUB_STATUS_STYLES, unwrap, SaasInvoice, Subscription, SaasPayment } from './system/saas/_shared';

interface PaymentMethod {
  id: string;
  kind: 'card' | 'mobile_money' | 'bank' | 'other';
  label: string;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  holderName?: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface PortalData {
  subscriptions: Subscription[];
  activeSubscription?: Subscription | null;
  invoices: SaasInvoice[];
  payments: SaasPayment[];
  paymentMethods: PaymentMethod[];
  outstandingMinor: number;
  summary?: { outstandingMinor: number; lifetimeMinor: number; currency: string; outstandingCount: number; nextRenewal: string | null };
}

export default function BillingPortalPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [gateways, setGateways] = useState<{ flutterwave?: { configured: boolean }; pesapal?: { configured: boolean } }>({});
  const banner = params.get('status');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/saas-revenue/portal/me'); setData(unwrap<PortalData>(r)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    api.get('/saas-revenue/public/gateways').then((r) => setGateways(unwrap<any>(r) || {})).catch(() => {});
  }, []);

  const payInvoice = async (inv: SaasInvoice, gateway?: 'flutterwave' | 'pesapal') => {
    setPaying(inv.id);
    try {
      const redirectUrl = `${window.location.origin}/billing-portal?status=return&inv=${inv.id}`;
      const res = await api.post('/saas-revenue/portal/checkout', { invoiceId: inv.id, redirectUrl, gateway });
      const link = unwrap<any>(res)?.link;
      if (link) window.location.href = link;
      else alert('Could not create checkout link');
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setPaying(null); }
  };

  const printInvoice = (inv: SaasInvoice) => {
    const baseURL = (api.defaults.baseURL || '').replace(/\/$/, '');
    fetch(`${baseURL}/saas-revenue/portal/invoices/${inv.id}/print`, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((html) => {
        const w = window.open('', '_blank');
        if (!w) { alert('Pop-up blocked. Allow pop-ups to view invoices.'); return; }
        w.document.open(); w.document.write(html); w.document.close();
      })
      .catch((e) => alert(`Could not open invoice: ${e.message}`));
  };

  const downloadPdf = async (inv: SaasInvoice) => {
    try {
      const r = await api.get(`/saas-revenue/portal/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { alert(`Could not download PDF: ${e?.response?.data?.message || e.message}`); }
  };

  const [showAddPm, setShowAddPm] = useState(false);
  const [newPm, setNewPm] = useState<{ kind: PaymentMethod['kind']; label: string; brand: string; last4: string; expMonth: string; expYear: string; holderName: string; isDefault: boolean }>({
    kind: 'card', label: '', brand: '', last4: '', expMonth: '', expYear: '', holderName: '', isDefault: false,
  });
  const [pmBusy, setPmBusy] = useState(false);

  const submitPm = async () => {
    setPmBusy(true);
    try {
      await api.post('/saas-revenue/portal/payment-methods', {
        kind: newPm.kind,
        label: newPm.label.trim() || undefined,
        brand: newPm.brand.trim() || undefined,
        last4: newPm.last4.trim() || undefined,
        expMonth: newPm.expMonth ? parseInt(newPm.expMonth, 10) : undefined,
        expYear: newPm.expYear ? parseInt(newPm.expYear, 10) : undefined,
        holderName: newPm.holderName.trim() || undefined,
        isDefault: newPm.isDefault,
      });
      setShowAddPm(false);
      setNewPm({ kind: 'card', label: '', brand: '', last4: '', expMonth: '', expYear: '', holderName: '', isDefault: false });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed to add payment method'); }
    finally { setPmBusy(false); }
  };

  const setDefaultPm = async (id: string) => {
    try { await api.put(`/saas-revenue/portal/payment-methods/${id}/default`); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };

  const deletePm = async (id: string) => {
    if (!confirm('Remove this payment method?')) return;
    try { await api.delete(`/saas-revenue/portal/payment-methods/${id}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };

  if (loading || !data) return <div className="p-8 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const activeSub = data.subscriptions.find((s) => s.status === 'active' || s.status === 'trial' || s.status === 'past_due') ?? data.subscriptions[0];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-gray-500">Manage your subscription, invoices, and payment history</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {banner === 'return' && (
        <div className="border border-blue-200 bg-blue-50 rounded p-3 text-sm text-blue-800 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Thanks — your payment is being processed. The status will update once we receive confirmation from the gateway.
        </div>
      )}

      {data.outstandingMinor > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded p-4 flex items-center justify-between">
          <div className="flex items-start gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <div className="font-medium">You have an outstanding balance</div>
              <div className="text-sm">{fmtMoney(data.outstandingMinor, activeSub?.currency || 'UGX')} due — pay now to keep your subscription active.</div>
            </div>
          </div>
        </div>
      )}

      {activeSub && (
        <div className="bg-white border rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Current plan</div>
              <h2 className="text-xl font-semibold">{activeSub.plan?.name ?? 'Subscription'}</h2>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs ${SUB_STATUS_STYLES[activeSub.status]}`}>{activeSub.status.replace('_', ' ')}</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
            <div><div className="text-gray-500 text-xs">Recurring</div>{fmtMoney(activeSub.unitPriceMinor * activeSub.seats, activeSub.currency)} / {activeSub.billingInterval}</div>
            <div><div className="text-gray-500 text-xs">Renews</div>{fmtDate(activeSub.nextRenewalAt)}</div>
            <div><div className="text-gray-500 text-xs">Auto-renew</div>{activeSub.autoRenew ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      <Card title="Invoices">
        {data.invoices.length === 0 ? <div className="text-sm text-gray-500">No invoices yet</div> :
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs"><tr>
              <th className="text-left">Number</th><th className="text-left">Status</th>
              <th className="text-right">Total</th><th className="text-right">Paid</th>
              <th className="text-left">Due</th><th></th>
            </tr></thead>
            <tbody>
              {data.invoices.map((inv) => {
                const hasBreakdown = inv.taxMinor > 0 || inv.discountMinor > 0;
                const taxBase = inv.subtotalMinor - inv.discountMinor;
                const taxRate = inv.taxMinor > 0 && taxBase > 0
                  ? Math.round((inv.taxMinor / taxBase) * 1000) / 10
                  : 0;
                return (
                  <tr key={inv.id} className="border-t align-top">
                    <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${INVOICE_STATUS_STYLES[inv.status]}`}>{inv.status}</span></td>
                    <td className="py-2 text-right">
                      <div>{fmtMoney(inv.totalMinor, inv.currency)}</div>
                      {hasBreakdown && (
                        <div className="text-[10px] text-gray-500 leading-tight mt-1 space-y-0.5">
                          <div>Subtotal {fmtMoney(inv.subtotalMinor, inv.currency)}</div>
                          {inv.discountMinor > 0 && <div>− Discount {fmtMoney(inv.discountMinor, inv.currency)}</div>}
                          {inv.taxMinor > 0 && <div>+ Tax{taxRate > 0 ? ` (${taxRate}%)` : ''} {fmtMoney(inv.taxMinor, inv.currency)}</div>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right">{fmtMoney(inv.amountPaidMinor, inv.currency)}</td>
                    <td className="py-2">{fmtDate(inv.dueAt)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => printInvoice(inv)} className="inline-flex items-center gap-1 px-2 py-1 border text-xs rounded hover:bg-gray-50 mr-1" title="View / print invoice"><Printer className="w-3 h-3" /> View</button>
                      <button onClick={() => downloadPdf(inv)} className="inline-flex items-center gap-1 px-2 py-1 border text-xs rounded hover:bg-gray-50 mr-1" title="Download PDF"><Download className="w-3 h-3" /> PDF</button>
                      {inv.status === 'open' && (
                        <>
                          <button onClick={() => payInvoice(inv)} disabled={paying === inv.id} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">
                            {paying === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} Pay{gateways.pesapal?.configured ? ' (Card)' : ' now'}
                          </button>
                          {gateways.pesapal?.configured && (
                            <button onClick={() => payInvoice(inv, 'pesapal')} disabled={paying === inv.id} className="inline-flex items-center gap-1 px-3 py-1 ml-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50" title="Pay with Pesapal (mobile money / card)">
                              {paying === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} Pesapal
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </Card>

      <StatementCard />

      <ManagedOrgsCard />

      <Card title="Payment methods">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">Saved methods are used for renewals and one-off payments. We never store full card numbers — only the last 4 digits and metadata for your reference.</p>
          <button onClick={() => setShowAddPm(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"><Plus className="w-3 h-3" /> Add method</button>
        </div>
        {(data.paymentMethods?.length ?? 0) === 0 ? (
          <div className="text-sm text-gray-500">No payment methods on file yet.</div>
        ) : (
          <ul className="divide-y">
            {data.paymentMethods.map((pm) => (
              <li key={pm.id} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {pm.label}
                      {pm.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">DEFAULT</span>}
                      <span className="text-[10px] uppercase text-gray-400">{pm.kind.replace('_', ' ')}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {pm.brand ? `${pm.brand} ` : ''}{pm.last4 ? `•••• ${pm.last4} ` : ''}
                      {pm.expMonth && pm.expYear ? `· exp ${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}` : ''}
                      {pm.holderName ? ` · ${pm.holderName}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!pm.isDefault && (
                    <button onClick={() => setDefaultPm(pm.id)} className="inline-flex items-center gap-1 px-2 py-1 border text-xs rounded hover:bg-gray-50" title="Make default"><Star className="w-3 h-3" /> Default</button>
                  )}
                  <button onClick={() => deletePm(pm.id)} className="inline-flex items-center gap-1 px-2 py-1 border text-xs rounded text-red-600 hover:bg-red-50" title="Remove"><Trash2 className="w-3 h-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Payment history">
        {data.payments.length === 0 ? <div className="text-sm text-gray-500">No payments yet</div> :
          <ul className="divide-y text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmtMoney(p.amountMinor, p.currency)} · {p.gateway}{p.method ? ` (${p.method})` : ''}</div>
                  <div className="text-xs text-gray-500">{new Date(p.paidAt).toLocaleString()}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{p.status}</span>
              </li>
            ))}
          </ul>}
      </Card>

      <WebhooksCard />

      {showAddPm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddPm(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Add payment method</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={newPm.kind} onChange={(e) => setNewPm({ ...newPm, kind: e.target.value as any })} className="w-full border rounded px-2 py-1.5">
                  <option value="card">Card</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Label (optional)</label>
                <input value={newPm.label} onChange={(e) => setNewPm({ ...newPm, label: e.target.value })} placeholder="e.g. Office Visa" className="w-full border rounded px-2 py-1.5" />
              </div>
              {newPm.kind === 'card' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
                    <input value={newPm.brand} onChange={(e) => setNewPm({ ...newPm, brand: e.target.value })} placeholder="Visa" className="w-full border rounded px-2 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last 4 digits</label>
                    <input value={newPm.last4} onChange={(e) => setNewPm({ ...newPm, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} maxLength={4} className="w-full border rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Exp month</label>
                    <input value={newPm.expMonth} onChange={(e) => setNewPm({ ...newPm, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="MM" className="w-full border rounded px-2 py-1.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Exp year</label>
                    <input value={newPm.expYear} onChange={(e) => setNewPm({ ...newPm, expYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="YYYY" className="w-full border rounded px-2 py-1.5" />
                  </div>
                </div>
              )}
              {newPm.kind === 'mobile_money' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone last 4</label>
                  <input value={newPm.last4} onChange={(e) => setNewPm({ ...newPm, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} maxLength={4} className="w-full border rounded px-2 py-1.5 font-mono" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Holder / account name</label>
                <input value={newPm.holderName} onChange={(e) => setNewPm({ ...newPm, holderName: e.target.value })} className="w-full border rounded px-2 py-1.5" />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={newPm.isDefault} onChange={(e) => setNewPm({ ...newPm, isDefault: e.target.checked })} />
                Set as default payment method
              </label>
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                We don't yet store full card details — when you next pay an invoice, we'll route it through our gateway. This entry only helps your team identify which method to use.
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAddPm(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={submitPm} disabled={pmBusy} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{pmBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b text-sm font-medium text-gray-700">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface WebhookEndpoint {
  id: string; url: string; events: string[]; description?: string | null;
  enabled: boolean; consecutiveFailures: number; secret: string;
  lastSuccessAt?: string | null; lastFailureAt?: string | null; disabledAt?: string | null; createdAt: string;
}
interface WebhookDelivery {
  id: string; endpointId: string; eventType: string; status: 'pending' | 'succeeded' | 'failed';
  attempts: number; responseCode?: number | null; errorMessage?: string | null;
  nextAttemptAt?: string | null; lastAttemptAt?: string | null; succeededAt?: string | null; createdAt: string;
}

function WebhooksCard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ url: string; events: string[]; description: string }>({ url: '', events: ['*'], description: '' });
  const [busy, setBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [epR, dlR, etR] = await Promise.all([
        api.get('/saas-revenue/portal/webhooks'),
        api.get('/saas-revenue/portal/webhook-deliveries?limit=20'),
        api.get('/saas-revenue/portal/webhook-event-types'),
      ]);
      setEndpoints(unwrap<WebhookEndpoint[]>(epR) || []);
      setDeliveries(unwrap<WebhookDelivery[]>(dlR) || []);
      setEventTypes(unwrap<string[]>(etR) || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.url.trim()) { alert('URL is required'); return; }
    setBusy(true);
    try {
      const r = await api.post('/saas-revenue/portal/webhooks', {
        url: form.url.trim(),
        events: form.events.length ? form.events : ['*'],
        description: form.description.trim() || undefined,
      });
      const created = unwrap<WebhookEndpoint & { secret: string; secretRevealed: boolean }>(r);
      setShowAdd(false);
      setForm({ url: '', events: ['*'], description: '' });
      if (created?.secretRevealed) setRevealedSecret({ id: created.id, secret: created.secret });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed to create endpoint'); }
    finally { setBusy(false); }
  };

  const toggle = async (ep: WebhookEndpoint) => {
    try { await api.put(`/saas-revenue/portal/webhooks/${ep.id}`, { enabled: !ep.enabled }); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };
  const remove = async (ep: WebhookEndpoint) => {
    if (!confirm(`Delete webhook ${ep.url}?`)) return;
    try { await api.delete(`/saas-revenue/portal/webhooks/${ep.id}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };
  const test = async (ep: WebhookEndpoint) => {
    try {
      const r = await api.post(`/saas-revenue/portal/webhooks/${ep.id}/test`);
      const d: any = unwrap<any>(r);
      alert(`Test ping: ${d?.ok ? 'OK' : 'FAILED'}${d?.statusCode ? ` (HTTP ${d.statusCode})` : ''}${d?.error ? `\n${d.error}` : ''}`);
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };
  const rotate = async (ep: WebhookEndpoint) => {
    if (!confirm('Rotate signing secret? Existing receivers will need the new secret.')) return;
    try {
      const r = await api.post(`/saas-revenue/portal/webhooks/${ep.id}/rotate-secret`);
      const d = unwrap<WebhookEndpoint & { secret: string }>(r);
      if (d) setRevealedSecret({ id: d.id, secret: d.secret });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };
  const retryDelivery = async (d: WebhookDelivery) => {
    try { await api.post(`/saas-revenue/portal/webhook-deliveries/${d.id}/retry`); setTimeout(load, 500); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
  };

  const toggleEvent = (ev: string) => {
    if (ev === '*') { setForm({ ...form, events: ['*'] }); return; }
    const next = form.events.filter((e) => e !== '*');
    if (next.includes(ev)) setForm({ ...form, events: next.filter((e) => e !== ev) });
    else setForm({ ...form, events: [...next, ev] });
  };

  return (
    <Card title="Webhooks">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-gray-600 max-w-2xl">
          Receive HTTP POSTs when invoices are issued/paid or payments are recorded/refunded. Each request includes
          an <code className="px-1 bg-gray-100 rounded">X-Glide-Signature: sha256=...</code> header — verify it with
          your endpoint's signing secret using HMAC-SHA256 over the raw JSON body.
        </div>
        <button onClick={() => setShowAdd(true)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add endpoint
        </button>
      </div>

      {revealedSecret && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs">
          <div className="font-medium text-amber-900 mb-1">⚠ Save this signing secret — it will only be shown once:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1 bg-white border rounded break-all">{revealedSecret.secret}</code>
            <button onClick={() => navigator.clipboard?.writeText(revealedSecret.secret)} className="px-2 py-1 border rounded">Copy</button>
            <button onClick={() => setRevealedSecret(null)} className="px-2 py-1 border rounded">Dismiss</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-gray-500">Loading…</div>
        : endpoints.length === 0 ? <div className="text-sm text-gray-500">No endpoints configured.</div>
        : <ul className="divide-y text-sm">
            {endpoints.map((ep) => (
              <li key={ep.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs break-all">{ep.url}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ep.events.map((e) => <span key={e} className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">{e}</span>)}
                    </div>
                    {ep.description && <div className="text-xs text-gray-500 mt-1">{ep.description}</div>}
                    <div className="text-[11px] text-gray-500 mt-1">
                      secret <code>{ep.secret}</code>
                      {ep.consecutiveFailures > 0 && <span className="ml-2 text-amber-700">{ep.consecutiveFailures} consecutive failures</span>}
                      {ep.lastSuccessAt && <span className="ml-2">last ok {new Date(ep.lastSuccessAt).toLocaleString()}</span>}
                      {ep.disabledAt && <span className="ml-2 text-rose-600">auto-disabled {new Date(ep.disabledAt).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ep.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{ep.enabled ? 'ON' : 'OFF'}</span>
                    <button onClick={() => test(ep)} className="px-2 py-1 text-xs border rounded">Test</button>
                    <button onClick={() => toggle(ep)} className="px-2 py-1 text-xs border rounded">{ep.enabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => rotate(ep)} className="px-2 py-1 text-xs border rounded">Rotate</button>
                    <button onClick={() => remove(ep)} className="px-2 py-1 text-xs border rounded text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>}

      <div className="mt-4 pt-3 border-t">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-gray-700">Recent deliveries</div>
          <button onClick={load} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        {deliveries.length === 0 ? <div className="text-xs text-gray-500">No deliveries yet.</div>
          : <ul className="divide-y text-xs">
              {deliveries.map((d) => (
                <li key={d.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{d.eventType}</div>
                    <div className="text-gray-500">
                      {new Date(d.createdAt).toLocaleString()}
                      {d.attempts > 0 && <> · attempt {d.attempts}</>}
                      {d.responseCode != null && <> · HTTP {d.responseCode}</>}
                      {d.errorMessage && <span className="text-rose-600"> · {d.errorMessage.slice(0, 80)}</span>}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${d.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : d.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{d.status}</span>
                  {d.status === 'failed' && <button onClick={() => retryDelivery(d)} className="px-1.5 py-0.5 border rounded">Retry</button>}
                </li>
              ))}
            </ul>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Add webhook endpoint</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://your-app.example.com/webhooks/glide" className="w-full border rounded px-2 py-1.5 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Events</label>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => toggleEvent('*')} className={`px-2 py-0.5 text-xs rounded border ${form.events.includes('*') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>* (all events)</button>
                  {eventTypes.map((ev) => (
                    <button key={ev} type="button" onClick={() => toggleEvent(ev)} disabled={form.events.includes('*')} className={`px-2 py-0.5 text-xs rounded border ${form.events.includes(ev) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'} ${form.events.includes('*') ? 'opacity-40' : ''}`}>{ev}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={submit} disabled={busy} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{busy ? 'Saving…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface StatementSummary {
  baseCurrency: string;
  byCurrency: Array<{ currency: string; invoiced: number; paid: number; outstanding: number }>;
  ledger: Array<{ date: string; type: 'invoice' | 'payment'; ref: string; description: string; currency: string; amountMinor: number; signedBaseMinor: number; runningBalanceBase: number }>;
  totals: { invoicedBase: number; paidBase: number; refundedBase: number; openingBalanceBase: number; closingBalanceBase: number };
  period: { from: string; to: string };
}

function StatementCard() {
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const fmtInput = (d: Date) => d.toISOString().slice(0, 10);
  const [from, setFrom] = useState(fmtInput(oneYearAgo));
  const [to, setTo] = useState(fmtInput(today));
  const [data, setData] = useState<StatementSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/portal/statement?from=${from}&to=${to}`);
      setData(unwrap<StatementSummary>(r));
    } catch (e: any) { alert(e?.response?.data?.message || 'Failed to load statement'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const downloadFile = async (kind: 'csv' | 'pdf') => {
    try {
      const r = await api.get(`/saas-revenue/portal/statement.${kind}?from=${from}&to=${to}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: kind === 'csv' ? 'text/csv' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `statement-${from}-to-${to}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { alert(`Could not download ${kind.toUpperCase()}: ${e?.response?.data?.message || e.message}`); }
  };

  const setPreset = (months: number) => {
    const t = new Date();
    const f = new Date(t.getFullYear(), t.getMonth() - months, t.getDate());
    setFrom(fmtInput(f)); setTo(fmtInput(t));
  };

  return (
    <Card title="Account statement">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div className="flex gap-1">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} onClick={() => setPreset(m)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">{m}m</button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => downloadFile('csv')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded hover:bg-gray-50"><Download className="w-3 h-3" /> CSV</button>
          <button onClick={() => downloadFile('pdf')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"><Download className="w-3 h-3" /> PDF</button>
        </div>
      </div>

      {!data ? <div className="text-sm text-gray-500">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mb-3">
            {[
              { label: 'Opening', value: data.totals.openingBalanceBase },
              { label: 'Invoiced', value: data.totals.invoicedBase },
              { label: 'Paid', value: data.totals.paidBase },
              { label: 'Refunded', value: data.totals.refundedBase },
              { label: 'Closing', value: data.totals.closingBalanceBase },
            ].map((b) => (
              <div key={b.label} className="bg-gray-50 border rounded p-2">
                <div className="text-gray-500 uppercase tracking-wide">{b.label}</div>
                <div className={`font-semibold mt-0.5 ${b.label === 'Closing' && b.value > 0 ? 'text-rose-700' : b.label === 'Closing' ? 'text-emerald-700' : ''}`}>
                  {fmtMoney(b.value, data.baseCurrency)}
                </div>
              </div>
            ))}
          </div>

          {data.byCurrency.length > 1 && (
            <div className="mb-3 text-xs">
              <div className="font-medium text-gray-600 mb-1">Per-currency breakdown</div>
              <table className="w-full">
                <thead className="text-gray-500"><tr>
                  <th className="text-left">Currency</th>
                  <th className="text-right">Invoiced</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                </tr></thead>
                <tbody>
                  {data.byCurrency.map((c) => (
                    <tr key={c.currency} className="border-t">
                      <td className="py-1">{c.currency}</td>
                      <td className="py-1 text-right">{fmtMoney(c.invoiced, c.currency)}</td>
                      <td className="py-1 text-right">{fmtMoney(c.paid, c.currency)}</td>
                      <td className="py-1 text-right">{fmtMoney(c.outstanding, c.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs">
            <div className="font-medium text-gray-600 mb-1">Ledger ({data.ledger.length} entries)</div>
            {data.ledger.length === 0 ? <div className="text-gray-500">No activity in this period.</div> : (
              <div className="max-h-72 overflow-auto border rounded">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0"><tr>
                    <th className="text-left px-2 py-1">Date</th>
                    <th className="text-left px-2 py-1">Type</th>
                    <th className="text-left px-2 py-1">Ref</th>
                    <th className="text-right px-2 py-1">Amount</th>
                    <th className="text-right px-2 py-1">Base ({data.baseCurrency})</th>
                    <th className="text-right px-2 py-1">Balance</th>
                  </tr></thead>
                  <tbody>
                    {data.ledger.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="px-2 py-1">{r.type}</td>
                        <td className="px-2 py-1 font-mono">{r.ref}</td>
                        <td className="px-2 py-1 text-right">{fmtMoney(r.amountMinor, r.currency)}</td>
                        <td className={`px-2 py-1 text-right ${r.signedBaseMinor < 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {r.signedBaseMinor < 0 ? '-' : ''}{fmtMoney(Math.abs(r.signedBaseMinor), data.baseCurrency)}
                        </td>
                        <td className="px-2 py-1 text-right">{fmtMoney(r.runningBalanceBase, data.baseCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function ManagedOrgsCard() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/saas-revenue/portal/managed-organizations');
      setItems(res.data ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Failed to load managed organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (!loading && items.length === 0 && !err) {
    return null;
  }

  const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format((n ?? 0) / 100);

  return (
    <Card title="Managed organizations (multi-org billing)">
      <p className="text-xs text-gray-500 mb-3">
        Subscriptions where this organization is the designated billing payer. Open invoices are
        rolled up here; pay them from the Invoices section above.
      </p>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-2 py-1">Organization</th>
                <th className="px-2 py-1">Plan</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Seats</th>
                <th className="px-2 py-1 text-right">Unit price</th>
                <th className="px-2 py-1">Next renewal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-2 py-1">
                    <div className="font-medium">{s.tenant?.name ?? s.tenantId}</div>
                    {s.tenant?.slug && <div className="text-xs text-gray-500">/{s.tenant.slug}</div>}
                  </td>
                  <td className="px-2 py-1">{s.plan?.name ?? '—'}</td>
                  <td className="px-2 py-1">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${s.status === 'active' ? 'bg-green-100 text-green-800' : s.status === 'past_due' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                  </td>
                  <td className="px-2 py-1">{s.seats}</td>
                  <td className="px-2 py-1 text-right">{fmt(s.unitPriceMinor, s.billingCurrency || s.currency)}</td>
                  <td className="px-2 py-1 text-xs text-gray-600">{s.nextRenewalAt ? new Date(s.nextRenewalAt).toISOString().slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
