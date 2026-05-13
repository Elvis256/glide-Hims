import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle, CreditCard, Printer } from 'lucide-react';
import api from '../services/api';
import { fmtMoney, fmtDate, INVOICE_STATUS_STYLES, SUB_STATUS_STYLES, unwrap, SaasInvoice, Subscription, SaasPayment } from './system/saas/_shared';

interface PortalData {
  subscriptions: Subscription[];
  invoices: SaasInvoice[];
  payments: SaasPayment[];
  outstandingMinor: number;
}

export default function BillingPortalPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const banner = params.get('status');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/saas-revenue/portal/me'); setData(unwrap<PortalData>(r)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const payInvoice = async (inv: SaasInvoice) => {
    setPaying(inv.id);
    try {
      const redirectUrl = `${window.location.origin}/billing-portal?status=return&inv=${inv.id}`;
      const res = await api.post('/saas-revenue/portal/checkout', { invoiceId: inv.id, redirectUrl });
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
                      {inv.status === 'open' && (
                        <button onClick={() => payInvoice(inv)} disabled={paying === inv.id} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">
                          {paying === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} Pay now
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
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
