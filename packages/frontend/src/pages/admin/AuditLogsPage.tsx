import { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';

type AuditEntry = {
  id: string;
  createdAt: string;
  actorType?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestMethod?: string;
  requestUrl?: string;
  statusCode?: number;
  reason?: string;
  ipAddress?: string;
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ userId: '', action: '', entityType: '', from: '', to: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const r = await api.get('/admin/audit-logs', { params });
      setRows(r.data?.data || []);
      setTotal(r.data?.meta?.total || 0);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const downloadCsv = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
      const r = await api.get(`/admin/audit-logs/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Export failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-500" /> Audit Logs
        </h1>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={downloadCsv} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <input placeholder="User ID" value={filters.userId} onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Action (e.g. CREATE)" value={filters.action} onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
        <input placeholder="Entity Type" value={filters.entityType} onChange={(e) => setFilters(f => ({ ...f, entityType: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
        <input type="date" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
        <input type="date" value={filters.to} onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))} className="border rounded px-3 py-2 text-sm" />
      </div>
      <button onClick={load} className="mb-4 px-3 py-1.5 bg-gray-100 rounded text-sm">Apply Filters</button>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">Actor</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Entity</th>
              <th className="text-left px-3 py-2">Method/URL</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Reason</th>
              <th className="text-left px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No entries</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.actorType || '—'}<br/><span className="text-gray-400">{r.userId?.slice(0, 8)}</span></td>
                <td className="px-3 py-2"><span className="font-medium">{r.action}</span></td>
                <td className="px-3 py-2">{r.entityType}<br/><span className="text-gray-400">{r.entityId?.slice(0, 8)}</span></td>
                <td className="px-3 py-2 max-w-xs truncate"><span className="text-gray-500">{r.requestMethod}</span> {r.requestUrl}</td>
                <td className="px-3 py-2">{r.statusCode}</td>
                <td className="px-3 py-2 max-w-xs truncate">{r.reason || '—'}</td>
                <td className="px-3 py-2">{r.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 mt-2">Showing {rows.length} of {total} entries</div>
    </div>
  );
}
