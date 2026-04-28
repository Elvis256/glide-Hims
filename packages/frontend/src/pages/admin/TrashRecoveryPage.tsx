import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, Undo2 } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';

type TrashItem = {
  type: string;
  label: string;
  id: string;
  name: string;
  deletedAt: string;
};

export default function TrashRecoveryPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/trash', { params: filter ? { type: filter } : {} });
      setItems(r.data?.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const restore = async (it: TrashItem) => {
    if (!confirm(`Restore ${it.label.toLowerCase()} "${it.name}"?`)) return;
    try {
      await api.post(`/admin/trash/${it.type}/${it.id}/restore`);
      toast.success(`${it.label} restored`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Restore failed');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Trash2 className="w-6 h-6 text-red-500" /> Trash & Recovery
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="users">Users</option>
            <option value="patients">Patients</option>
            <option value="roles">Roles</option>
          </select>
          <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Deleted At</th>
              <th className="text-right px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No deleted items</td></tr>
            ) : items.map((it) => (
              <tr key={`${it.type}-${it.id}`} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{it.label}</td>
                <td className="px-4 py-2">{it.name}</td>
                <td className="px-4 py-2 text-gray-500">{it.deletedAt ? new Date(it.deletedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => restore(it)} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm">
                    <Undo2 className="w-4 h-4" /> Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
