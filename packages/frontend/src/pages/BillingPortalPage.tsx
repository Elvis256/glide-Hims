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
