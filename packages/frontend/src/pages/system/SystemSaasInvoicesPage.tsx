import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, ExternalLink, RefreshCw, AlertTriangle, ShieldAlert, Download } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { exportToCsv } from '../../utils/csvExport';
import { SaasInvoice, SaasPayment, INVOICE_STATUS_STYLES, VERIFICATION_STATUS_STYLES, VERIFICATION_STATUS_LABELS, fmtMoney, fmtDate, unwrap, PaymentVerificationStatus } from './saas/_shared';

const STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'];

export default function SystemSaasInvoicesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const showPending = params.get('verification') === 'pending';
  const [items, setItems] = useState<SaasInvoice[]>([]);
  const [pendingPayments, setPendingPayments] = useState<SaasPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const load = async () => {
    setLoading(true);
    try {
      const [invRes, pendingRes] = await Promise.all([
        api.get('/saas-revenue/invoices', { params: status ? { status } : {} }),
        api.get('/saas-revenue/payments/pending-verification'),
      ]);
      setItems(unwrap<SaasInvoice[]>(invRes) || []);
      setPendingPayments(unwrap<SaasPayment[]>(pendingRes) || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load invoices');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { setPage(1); }, [status, showPending]);

  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const totalOutstanding = items.filter((i) => i.status === 'open').reduce((a, i) => a + (i.totalMinor - i.amountPaidMinor), 0);
  const totalPaid = items.filter((i) => i.status === 'paid').reduce((a, i) => a + i.totalMinor, 0);
  const overdueCount = items.filter((i) => i.status === 'open' && new Date(i.dueAt) < new Date()).length;
  const pendingCount = pendingPayments.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SaaS Invoices</h1>
          <p className="text-sm text-gray-500">Vendor invoices issued to tenants for their subscriptions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportToCsv('saas-invoices', items, [
              { header: 'Invoice Number', accessor: (i) => i.invoiceNumber },
              { header: 'Tenant', accessor: (i) => i.tenant?.name || i.tenantId },
              { header: 'Amount', accessor: (i) => i.totalMinor },
              { header: 'Currency', accessor: (i) => i.currency },
              { header: 'Status', accessor: (i) => i.status },
              { header: 'Issued Date', accessor: (i) => i.issuedAt },
              { header: 'Due Date', accessor: (i) => i.dueAt },
            ])}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Outstanding" value={fmtMoney(totalOutstanding)} sub={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'} accent={overdueCount > 0 ? 'amber' : undefined} />
        <Stat label="Paid in view" value={fmtMoney(totalPaid)} sub={`${items.filter((i) => i.status === 'paid').length} invoices`} />
        <Stat label="Total invoices" value={String(items.length)} />
        <button onClick={() => setParams(pendingCount > 0 ? { verification: 'pending' } : {})} className="text-left">
          <Stat label="Pending Verification" value={String(pendingCount)} sub={pendingCount > 0 ? 'Payments need review' : 'All verified'} accent={pendingCount > 0 ? 'amber' : undefined} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setParams({})} className={`px-3 py-1 text-xs rounded-full border ${!status && !showPending ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1 text-xs rounded-full border capitalize ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>{s}</button>
        ))}
        <button onClick={() => setParams({ verification: 'pending' })} className={`px-3 py-1 text-xs rounded-full border ${showPending ? 'bg-amber-600 text-white' : 'bg-white text-gray-700'}`}>
          Pending Verification {pendingCount > 0 && <span className="ml-1 bg-amber-200 text-amber-800 px-1.5 rounded-full text-[10px]">{pendingCount}</span>}
        </button>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : showPending ? (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800"><ShieldAlert className="w-4 h-4" /> Payments pending verification</div>
            <p className="text-xs text-amber-600 mt-1">These manual payments need a second admin to verify with proof of payment.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2">Invoice</th>
                <th className="text-left px-4 py-2">Gateway</th>
                <th className="text-left px-4 py-2">Method</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Paid at</th>
                <th className="text-left px-4 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs"><Link to={`/system/saas-invoices/${p.invoiceId}`} className="text-blue-600 hover:underline">{p.invoiceId.slice(0, 8)}...</Link></td>
                  <td className="px-4 py-2 capitalize">{p.gateway}</td>
                  <td className="px-4 py-2">{p.method || '-'}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(p.amountMinor, p.currency)}</td>
                  <td className="px-4 py-2">{fmtDate(p.paidAt)}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${VERIFICATION_STATUS_STYLES[p.verificationStatus]}`}>{VERIFICATION_STATUS_LABELS[p.verificationStatus]}</span></td>
                  <td className="px-4 py-2"><Link to={`/system/saas-invoices/${p.invoiceId}`} className="text-blue-600 inline-flex items-center gap-1 text-xs hover:underline"><ExternalLink className="w-3 h-3" /> Review</Link></td>
                </tr>
              ))}
              {pendingPayments.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No payments pending verification</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
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
              {paginatedItems.map((inv) => {
                const overdue = inv.status === 'open' && new Date(inv.dueAt) < new Date();
                return (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs"><Link to={`/system/saas-invoices/${inv.id}`} className="text-blue-600 hover:underline">{inv.invoiceNumber}</Link></td>
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
                        <span className="font-mono text-xs text-gray-500" title={inv.tenantId}>{inv.tenantId.slice(0, 8)}...</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtMoney(inv.totalMinor, inv.currency)}</td>
                    <td className="px-4 py-2 text-right">{fmtMoney(inv.amountPaidMinor, inv.currency)}</td>
                    <td className="px-4 py-2">{fmtDate(inv.issuedAt)}</td>
                    <td className="px-4 py-2">{fmtDate(inv.dueAt)}</td>
                    <td className="px-4 py-2 flex items-center gap-3">
                      <Link to={`/system/saas-invoices/${inv.id}`} className="text-blue-600 inline-flex items-center gap-1 text-xs hover:underline"><ExternalLink className="w-3 h-3" /> Open</Link>
                      <Link to={`/system/subscriptions/${inv.subscriptionId}`} className="text-blue-600 inline-flex items-center gap-1 text-xs hover:underline">Subscription</Link>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No invoices match this filter</td></tr>}
            </tbody>
          </table>
          <SystemPagination page={page} pageSize={pageSize} total={items.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
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
