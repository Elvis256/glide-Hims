import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Loader2, Eye, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { Quotation, QuotationStatus, QUOTATION_STATUS_STYLES, fmtMoney, fmtDate, unwrap } from './saas/_shared';

const STATUSES: QuotationStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'superseded'];

export default function SystemQuotationsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [items, setItems] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/quotations', { params: status ? { status } : {} });
      const d = unwrap<any>(r);
      setItems(d?.items ?? d ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load quotations');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { setPage(1); }, [status]);

  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500">Create, manage and track client quotations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <Link to="/system/quotations/new" className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> New Quotation</Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <button onClick={() => setParams({})} className={`px-3 py-1.5 rounded-t text-sm font-medium ${!status ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1.5 rounded-t text-sm font-medium capitalize ${status === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rev</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issued</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedItems.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{q.quotationNumber}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{q.clientName}</div>
                    {q.clientOrganization && <div className="text-xs text-gray-500">{q.clientOrganization}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${QUOTATION_STATUS_STYLES[q.status] || 'bg-gray-100 text-gray-700'}`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">v{q.currentRevisionNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(q.validUntil)}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Link to={`/system/quotations/${q.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"><Eye className="w-3.5 h-3.5" /> View</Link>
                    <a href={`/api/v1/saas-revenue/quotations/${q.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm ml-2"><FileText className="w-3.5 h-3.5" /> PDF</a>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No quotations found</td></tr>}
            </tbody>
          </table>
          <SystemPagination page={page} pageSize={pageSize} total={items.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}
    </div>
  );
}
