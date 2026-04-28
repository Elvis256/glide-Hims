import { useEffect, useState } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface LetterTemplate {
  id: string;
  name: string;
  type:
    | 'offer'
    | 'contract'
    | 'promotion'
    | 'termination'
    | 'warning'
    | 'commendation'
    | 'reference'
    | 'generic';
  subject: string;
  body: string;
  isActive: boolean;
}

interface Employee {
  id: string;
  fullName: string;
}

const facilityId = () => localStorage.getItem('glide_facility_id') || '';

export default function LetterTemplatesPage() {
  const [items, setItems] = useState<LetterTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<LetterTemplate> | null>(null);
  const [renderTpl, setRenderTpl] = useState<LetterTemplate | null>(null);
  const [renderEmpId, setRenderEmpId] = useState('');
  const [renderResult, setRenderResult] = useState<{ subject: string; body: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [t, e] = await Promise.all([
        api.get<LetterTemplate[]>('/hr/letter-templates'),
        api.get<Employee[]>('/hr/employees', { params: { facilityId: facilityId() } }),
      ]);
      setItems(t.data);
      setEmployees(Array.isArray(e.data) ? e.data : ((e.data as any)?.data ?? []));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load');
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
        await api.patch(`/hr/letter-templates/${editing.id}`, editing);
      } else {
        await api.post('/hr/letter-templates', editing);
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
    await api.delete(`/hr/letter-templates/${id}`);
    load();
  };

  const render = async () => {
    if (!renderTpl) return;
    try {
      const res = await api.post(`/hr/letter-templates/${renderTpl.id}/render`, {
        employeeId: renderEmpId || undefined,
      });
      setRenderResult(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Render failed');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Letter Templates</h1>
        <button
          onClick={() =>
            setEditing({ name: '', type: 'generic', subject: '', body: '', isActive: true })
          }
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
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Active</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No templates defined.
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded">{t.type}</span>
                    </td>
                    <td className="p-3">{t.subject}</td>
                    <td className="p-3">{t.isActive ? '✅' : '❌'}</td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => {
                          setRenderTpl(t);
                          setRenderResult(null);
                        }}
                        className="text-purple-600 hover:underline"
                      >
                        Render
                      </button>
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
          <div className="bg-white rounded p-6 w-full max-w-3xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editing.id ? 'Edit' : 'New'} Letter Template
            </h2>
            <div className="space-y-3">
              <input
                className="w-full border rounded p-2"
                placeholder="Name"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <select
                className="w-full border rounded p-2"
                value={editing.type || 'generic'}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as any })}
              >
                {[
                  'offer',
                  'contract',
                  'promotion',
                  'termination',
                  'warning',
                  'commendation',
                  'reference',
                  'generic',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                className="w-full border rounded p-2"
                placeholder="Subject (use {{employee.fullName}})"
                value={editing.subject || ''}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2 font-mono text-sm"
                rows={14}
                placeholder="Body. Use {{employee.fullName}}, {{employee.position}}, {{variables.xxx}}…"
                value={editing.body || ''}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isActive !== false}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
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

      {renderTpl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-3xl max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Render: {renderTpl.name}</h2>
            <select
              className="w-full border rounded p-2 mb-3"
              value={renderEmpId}
              onChange={(e) => setRenderEmpId(e.target.value)}
            >
              <option value="">— select employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <button onClick={render} className="px-4 py-2 bg-blue-600 text-white rounded">
              Render
            </button>
            {renderResult && (
              <div className="mt-4 border-t pt-4">
                <p className="font-semibold mb-2">Subject: {renderResult.subject}</p>
                <pre className="bg-gray-50 p-3 rounded whitespace-pre-wrap text-sm">
                  {renderResult.body}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(renderResult.body);
                    toast.success('Copied to clipboard');
                  }}
                  className="mt-2 px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Copy
                </button>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setRenderTpl(null);
                  setRenderResult(null);
                  setRenderEmpId('');
                }}
                className="px-4 py-2 border rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
