import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { toast } from 'sonner';

interface PIP {
  id: string;
  employeeId: string;
  managerId?: string;
  reason: string;
  goals: string;
  supportProvided?: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'extended' | 'terminated' | 'closed';
  outcomeNotes?: string;
  facilityId: string;
}

interface Employee {
  id: string;
  fullName: string;
}

const facilityId = () => localStorage.getItem('glide_facility_id') || '';

export default function PIPManagementPage() {
  const [items, setItems] = useState<PIP[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Partial<PIP> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        api.get<PIP[]>('/hr/pips', { params: { facilityId: facilityId() } }),
        api.get<Employee[]>('/hr/employees', { params: { facilityId: facilityId() } }),
      ]);
      setItems(p.data);
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
      const payload = { ...editing, facilityId: facilityId() };
      if (editing.id) {
        await api.patch(`/hr/pips/${editing.id}`, payload);
      } else {
        await api.post('/hr/pips', payload);
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
    await api.delete(`/hr/pips/${id}`);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Performance Improvement Plans</h1>
        <button
          onClick={() =>
            setEditing({
              status: 'active',
              startDate: new Date().toISOString().substring(0, 10),
              endDate: new Date(Date.now() + 90 * 86400_000).toISOString().substring(0, 10),
            })
          }
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New PIP
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-left p-3">Period</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No active PIPs.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-3">
                      {employees.find((e) => e.id === p.employeeId)?.fullName || p.employeeId}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={p.reason}>
                      {p.reason}
                    </td>
                    <td className="p-3">
                      {new Date(p.startDate).toLocaleDateString()} →{' '}
                      {new Date(p.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded">{p.status}</span>
                    </td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => setEditing(p)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => remove(p.id)} className="text-red-600 hover:underline">
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
            <h2 className="text-xl font-bold mb-4">{editing.id ? 'Edit' : 'New'} PIP</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm">Employee</span>
                <select
                  className="w-full border rounded p-2"
                  value={editing.employeeId || ''}
                  onChange={(e) => setEditing({ ...editing, employeeId: e.target.value })}
                >
                  <option value="">— select —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className="w-full border rounded p-2"
                rows={3}
                placeholder="Reason for PIP"
                value={editing.reason || ''}
                onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2"
                rows={4}
                placeholder="Goals & expectations"
                value={editing.goals || ''}
                onChange={(e) => setEditing({ ...editing, goals: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2"
                rows={3}
                placeholder="Support being provided"
                value={editing.supportProvided || ''}
                onChange={(e) => setEditing({ ...editing, supportProvided: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-sm">Start</span>
                  <input
                    type="date"
                    className="w-full border rounded p-2"
                    value={editing.startDate ? editing.startDate.substring(0, 10) : ''}
                    onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm">End</span>
                  <input
                    type="date"
                    className="w-full border rounded p-2"
                    value={editing.endDate ? editing.endDate.substring(0, 10) : ''}
                    onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm">Status</span>
                <select
                  className="w-full border rounded p-2"
                  value={editing.status || 'active'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed (successful)</option>
                  <option value="extended">Extended</option>
                  <option value="terminated">Terminated</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <textarea
                className="w-full border rounded p-2"
                rows={2}
                placeholder="Outcome notes"
                value={editing.outcomeNotes || ''}
                onChange={(e) => setEditing({ ...editing, outcomeNotes: e.target.value })}
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
