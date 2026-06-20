import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { Onboarding, OnboardingStatus, ONBOARDING_STATUS_STYLES, fmtDate, unwrap } from './saas/_shared';

const STATUSES: OnboardingStatus[] = ['not_started', 'in_progress', 'completed', 'blocked'];

export default function SystemOnboardingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [items, setItems] = useState<Onboarding[]>([]);
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
    return items.filter((o) =>
      (o.tenantId && o.tenantId.toLowerCase().includes(q)) ||
      (o.assignedTo && o.assignedTo.toLowerCase().includes(q)) ||
      o.status.toLowerCase().includes(q)
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
      const r = await api.get('/saas-revenue/onboardings', { params: status ? { status } : {} });
      const d = unwrap<any>(r);
      setItems(d?.items ?? d ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load onboardings');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Onboarding</h1>
          <p className="text-sm text-gray-500">Track onboarding progress for new clients</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="flex flex-wrap gap-1 border-b pb-2">
        <button onClick={() => setParams({})} className={`px-3 py-1.5 rounded-t text-sm font-medium ${!status ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setParams({ status: s })} className={`px-3 py-1.5 rounded-t text-sm font-medium capitalize ${status === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid gap-4">
          {paginatedItems.map((o) => (
            <Link key={o.id} to={`/system/onboardings/${o.id}`} className="bg-white rounded-lg border p-5 hover:border-blue-300 transition block">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ONBOARDING_STATUS_STYLES[o.status]}`}>{o.status.replace('_', ' ')}</span>
                  <span className="ml-2 text-xs text-gray-500">ID: {o.id.slice(0, 8)}</span>
                </div>
                <div className="text-sm text-gray-500">Target: {fmtDate(o.targetGoLiveDate)}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${o.progressPercent}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700">{o.progressPercent}%</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {o.items?.length || 0} checklist items &middot; Created {fmtDate(o.createdAt)}
                {o.actualGoLiveDate && <span className="ml-2 text-emerald-600">Go-live: {fmtDate(o.actualGoLiveDate)}</span>}
              </div>
            </Link>
          ))}
          {filteredItems.length === 0 && <div className="text-center py-12 text-gray-500">No onboardings found</div>}
        </div>
      )}
      {!loading && (
        <SystemPagination page={page} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
}
