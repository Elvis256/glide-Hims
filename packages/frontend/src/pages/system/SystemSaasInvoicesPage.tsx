import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { SaasInvoice, INVOICE_STATUS_STYLES, fmtMoney, fmtDate, unwrap } from './saas/_shared';

const STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'];

export default function SystemSaasInvoicesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [items, setItems] = useState<SaasInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/saas-revenue/invoices', { params: status ? { status } : {} }); setItems(unwrap<SaasInvoice[]>(r) || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const totalOutstanding = items.filter((i) => i.status === 'open').reduce((a, i) => a + (i.totalMinor - i.amountPaidMinor), 0);
  const totalPaid = items.filter((i) => i.status === 'paid').reduce((a, i) => a + i.totalMinor, 0);
  const overdueCount = items.filter((i) => i.status === 'open' && new Date(i.dueAt) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SaaS Invoices</h1>
          <p className="text-sm text-gray-500">Vendor invoices issued to tenants for their subscriptions</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Outstanding" value={fmtMoney(totalOutstanding)} sub={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'} accent={overdueCount > 0 ? 'amber' : undefined} />
        <Stat label="Paid in view" value={fmtMoney(totalPaid)} sub={`${items.filter((i) => i.status === 'paid').length} invoices`} />
        <Stat label="Total invoices" value={String(items.length)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setParams({})} className={`px-3 py-1 text-xs rounded-full border ${!status ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1 text-xs rounded-full border capitalize ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>{s}</button>
        ))}
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Invoice #</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Tenant</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-right px-4 py-2">Paid</th>
                <th className="text-left px-4 py-2">Issued</th>
                <th className="text-left px-4 py-2">Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => {
                const overdue = inv.status === 'open' && new Date(inv.dueAt) < new Date();
                return (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${INVOICE_STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                      {overdue && <span className="ml-1 inline-flex items-center text-xs text-amber-700"><AlertTriangle className="w-3 h-3 mr-0.5" />overdue</span>}
                    </td>
                    <td className="px-4 py-2">
                      {inv.tenant ? (
                        <div>
                          <div className="font-medium text-gray-900">{inv.tenant.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{inv.tenant.slug}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-gray-500" title={inv.tenantId}>{inv.tenantId.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtMoney(inv.totalMinor, inv.currency)}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(inv.amountPaidMinor, inv.currency)}</td>
                    <td className="px-4 py-2">{fmtDate(inv.issuedAt)}</td>
                    <td className="px-4 py-2">{fmtDate(inv.dueAt)}</td>
                    <td className="px-4 py-2"><Link to={`/system/subscriptions/${inv.subscriptionId}`} className="text-blue-600 inline-flex items-center gap-1 text-xs hover:underline"><ExternalLink className="w-3 h-3" /> Subscription</Link></td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No invoices match this filter</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'amber' | 'red' }) {
  const cls = accent === 'amber' ? 'border-amber-300 bg-amber-50' : accent === 'red' ? 'border-red-300 bg-red-50' : 'bg-white';
  return (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
