import { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt?: string;
}

const ALL_EVENTS = [
  'patient.created',
  'patient.updated',
  'visit.completed',
  'invoice.paid',
  'lab.result_finalized',
  'pharmacy.dispensed',
  'employee.hired',
  'leave.approved',
];

export default function WebhooksPage() {
  const [items, setItems] = useState<Webhook[]>([]);
  const [editing, setEditing] = useState<Partial<Webhook> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Webhook[]>('/admin/integrations/webhooks');
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await api.patch(`/admin/integrations/webhooks/${editing.id}`, editing);
      } else {
        await api.post('/admin/integrations/webhooks', editing);
      }
      toast.success('Saved');
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await api.delete(`/admin/integrations/webhooks/${id}`);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <button
          onClick={() => setEditing({ url: '', events: [], active: true })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New Webhook
        </button>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">URL</th>
                <th className="text-left p-3">Events</th>
                <th className="text-left p-3">Active</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    No webhooks configured.
                  </td>
                </tr>
              ) : (
                items.map((w) => (
                  <tr key={w.id} className="border-b">
                    <td className="p-3 font-mono break-all">{w.url}</td>
                    <td className="p-3 text-xs">{(w.events || []).join(', ')}</td>
                    <td className="p-3">{w.active ? '✅' : '❌'}</td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => setEditing(w)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => remove(w.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{editing.id ? 'Edit' : 'New'} Webhook</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm">URL</span>
                <input
                  className="w-full border rounded p-2"
                  value={editing.url || ''}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm">Secret (HMAC signing)</span>
                <input
                  className="w-full border rounded p-2"
                  value={editing.secret || ''}
                  onChange={(e) => setEditing({ ...editing, secret: e.target.value })}
                />
              </label>
              <div>
                <p className="text-sm font-medium mb-2">Events</p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {ALL_EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(editing.events || []).includes(ev)}
                        onChange={(e) => {
                          const evs = new Set(editing.events || []);
                          if (e.target.checked) evs.add(ev);
                          else evs.delete(ev);
                          setEditing({ ...editing, events: Array.from(evs) });
                        }}
                      />
                      <code>{ev}</code>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
