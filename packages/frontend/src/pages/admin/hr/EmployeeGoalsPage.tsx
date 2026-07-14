import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { toast } from 'sonner';

interface Goal {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  keyResults?: { description: string; target: string; current?: string; achieved?: boolean }[];
  targetDate?: string;
  progressPercent: number;
  status: 'draft' | 'active' | 'at_risk' | 'achieved' | 'cancelled';
  facilityId: string;
}

interface Employee {
  id: string;
  fullName: string;
}

const facilityId = () => localStorage.getItem('glide_facility_id') || '';

export default function EmployeeGoalsPage() {
  const [items, setItems] = useState<Goal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Partial<Goal> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [g, e] = await Promise.all([
        api.get<Goal[]>('/hr/goals', { params: { facilityId: facilityId() } }),
        api.get<Employee[]>('/hr/employees', { params: { facilityId: facilityId() } }),
      ]);
      setItems(g.data);
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
        await api.patch(`/hr/goals/${editing.id}`, payload);
      } else {
        await api.post('/hr/goals', payload);
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
    await api.delete(`/hr/goals/${id}`);
    load();
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100',
    active: 'bg-blue-100 text-blue-800',
    at_risk: 'bg-yellow-100 text-yellow-800',
    achieved: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Employee Goals / OKRs</h1>
        <button
          onClick={() =>
            setEditing({ title: '', status: 'draft', progressPercent: 0, keyResults: [] })
          }
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New Goal
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
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Target Date</th>
                <th className="text-left p-3">Progress</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No goals defined yet.
                  </td>
                </tr>
              ) : (
                items.map((g) => (
                  <tr key={g.id} className="border-b">
                    <td className="p-3">
                      {employees.find((e) => e.id === g.employeeId)?.fullName || g.employeeId}
                    </td>
                    <td className="p-3">{g.title}</td>
                    <td className="p-3">
                      {g.targetDate ? new Date(g.targetDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-200 rounded-full w-24 h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${g.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs">{g.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${statusColor[g.status] || 'bg-gray-100'}`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => setEditing(g)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => remove(g.id)} className="text-red-600 hover:underline">
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
            <h2 className="text-xl font-bold mb-4">{editing.id ? 'Edit' : 'New'} Goal</h2>
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
              <input
                className="w-full border rounded p-2"
                placeholder="Title (e.g. Reduce avg consultation wait time)"
                value={editing.title || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <textarea
                className="w-full border rounded p-2"
                rows={3}
                placeholder="Description"
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
              <label className="block">
                <span className="text-sm">Target date</span>
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={editing.targetDate ? editing.targetDate.substring(0, 10) : ''}
                  onChange={(e) => setEditing({ ...editing, targetDate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm">Progress (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full border rounded p-2"
                  value={editing.progressPercent || 0}
                  onChange={(e) =>
                    setEditing({ ...editing, progressPercent: parseInt(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm">Status</span>
                <select
                  className="w-full border rounded p-2"
                  value={editing.status || 'draft'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="at_risk">At risk</option>
                  <option value="achieved">Achieved</option>
                  <option value="cancelled">Cancelled</option>
                </select>
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
