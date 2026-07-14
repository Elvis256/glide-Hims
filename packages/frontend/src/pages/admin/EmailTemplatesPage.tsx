import { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  createdAt?: string;
}

export default function EmailTemplatesPage() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<EmailTemplate[]>('/admin/integrations/email-templates');
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
        await api.patch(`/admin/integrations/email-templates/${editing.id}`, editing);
      } else {
        await api.post('/admin/integrations/email-templates', editing);
      }
      toast.success('Saved');
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete?')) return;
    await api.delete(`/admin/integrations/email-templates/${id}`);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <button
          onClick={() => setEditing({ name: '', subject: '', body: '' })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New Template
        </button>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Variables</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    No templates yet.
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">{t.subject}</td>
                    <td className="p-3 text-xs">{(t.variables || []).join(', ')}</td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => setEditing(t)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => remove(t.id)} className="text-red-600 hover:underline">
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
          <div className="bg-white rounded p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editing.id ? 'Edit' : 'New'} Email Template</h2>
            <div className="space-y-3">
              <input
                className="w-full border rounded p-2"
                placeholder="Name"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="Subject (e.g. Welcome {{user.name}})"
                value={editing.subject || ''}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2 font-mono text-sm"
                rows={12}
                placeholder="Body (HTML or text). Use {{variable}} placeholders."
                value={editing.body || ''}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
              <input
                className="w-full border rounded p-2"
                placeholder="Variables (comma-separated, e.g. user.name, otp)"
                value={(editing.variables || []).join(', ')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    variables: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
              />
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
