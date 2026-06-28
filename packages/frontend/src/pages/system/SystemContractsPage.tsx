import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Loader2, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { Contract, ContractStatus, CONTRACT_STATUS_STYLES, fmtMoney, fmtDate, unwrap } from './saas/_shared';

const STATUSES: ContractStatus[] = ['draft', 'pending_signature', 'active', 'expired', 'terminated'];

export default function SystemContractsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((c) =>
      c.contractNumber.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      (c.clientOrganization && c.clientOrganization.toLowerCase().includes(q)) ||
      c.status.toLowerCase().includes(q)
    );
  }, [items, debouncedSearch]);

  useEffect(() => { setPage(1); }, [status]);

  const paginatedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  );

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/contracts', { params: status ? { status } : {} });
      const d = unwrap<any>(r);
      setItems(d?.items ?? d ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load contracts');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-500">Manage client SaaS contracts and agreements. Contracts are auto-generated when quotations are accepted.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        <button onClick={() => setParams({})} className={`px-3 py-1.5 rounded-t text-sm font-medium ${!status ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          All ({items.length})
        </button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1.5 rounded-t text-sm font-medium capitalize ${status === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {s.replaceAll('_', ' ')}{statusCounts[s] ? ` (${statusCounts[s]})` : ''}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search by contract number, client name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

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
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedItems.map((c) => {
                const meta = (c.metadata || {}) as any;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-mono font-medium text-gray-900">{c.contractNumber}</div>
                      {meta.quotationNumber && <div className="text-[11px] text-gray-400">from {meta.quotationNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{c.clientOrganization || c.clientName}</div>
                      {c.clientOrganization && c.clientName !== c.clientOrganization && <div className="text-xs text-gray-500">{c.clientName}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${CONTRACT_STATUS_STYLES[c.status] || 'bg-gray-100 text-gray-700'}`}>{c.status.replaceAll('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="font-semibold">{fmtMoney(c.totalValueMinor, c.currency)}</div>
                      {meta.billingInterval && <div className="text-[11px] text-gray-400 capitalize">{meta.billingInterval}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{fmtDate(c.startDate)}</div>
                      <div className="text-xs text-gray-400">to {fmtDate(c.endDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/system/contracts/${c.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"><Eye className="w-3.5 h-3.5" /> View</Link>
                        <a href={`/api/v1/saas-revenue/contracts/${c.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-700 text-sm" title="View PDF"><FileText className="w-3.5 h-3.5" /></a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <p className="font-medium">No contracts found</p>
                    <p className="text-xs mt-1">Contracts are automatically created when quotations are accepted.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <SystemPagination page={page} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}
    </div>
  );
}
