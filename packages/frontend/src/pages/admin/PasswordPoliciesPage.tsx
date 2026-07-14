import { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';

interface PasswordPolicy {
  id: string;
  name?: string;
  facilityId?: string;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAgeDays?: number;
  preventReuse?: number;
  lockoutThreshold?: number;
  isActive: boolean;
}

const empty: Partial<PasswordPolicy> = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  maxAgeDays: 90,
  preventReuse: 5,
  lockoutThreshold: 5,
  isActive: true,
};

export default function PasswordPoliciesPage() {
  const [policies, setPolicies] = useState<PasswordPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PasswordPolicy> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<PasswordPolicy[]>('/admin/password-policies');
      setPolicies(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load policies');
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
      if ((editing as any).id) {
        await api.patch(`/admin/password-policies/${(editing as any).id}`, editing);
      } else {
        await api.post('/admin/password-policies', editing);
      }
      toast.success('Saved');
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this password policy?')) return;
    try {
      await api.delete(`/admin/password-policies/${id}`);
      toast.success('Deleted');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Password Policies</h1>
        <button
          onClick={() => setEditing({ ...empty })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New Policy
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
                <th className="text-left p-3">Min Length</th>
                <th className="text-left p-3">Requirements</th>
                <th className="text-left p-3">Max Age</th>
                <th className="text-left p-3">Reuse Block</th>
                <th className="text-left p-3">Lockout</th>
                <th className="text-left p-3">Active</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No password policies configured. Default rules apply.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-3">{p.name || p.facilityId || 'Default'}</td>
                    <td className="p-3">{p.minLength}</td>
                    <td className="p-3">
                      {p.requireUppercase && 'A '}
                      {p.requireLowercase && 'a '}
                      {p.requireNumbers && '1 '}
                      {p.requireSpecialChars && '@ '}
                    </td>
                    <td className="p-3">{p.maxAgeDays} days</td>
                    <td className="p-3">{p.preventReuse}</td>
                    <td className="p-3">{p.lockoutThreshold}</td>
                    <td className="p-3">{p.isActive ? '✅' : '❌'}</td>
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
          <div className="bg-white rounded p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {(editing as any).id ? 'Edit' : 'New'} Password Policy
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm">Name (optional)</span>
                <input
                  className="w-full border rounded p-2"
                  value={(editing as any).name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm">Facility (UUID, blank = global)</span>
                <input
                  className="w-full border rounded p-2"
                  value={editing.facilityId || ''}
                  onChange={(e) => setEditing({ ...editing, facilityId: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm">Minimum Length</span>
                <input
                  type="number"
                  className="w-full border rounded p-2"
                  value={editing.minLength}
                  onChange={(e) =>
                    setEditing({ ...editing, minLength: parseInt(e.target.value) || 8 })
                  }
                />
              </label>
              {[
                ['requireUppercase', 'Require uppercase (A–Z)'],
                ['requireLowercase', 'Require lowercase (a–z)'],
                ['requireNumbers', 'Require numbers (0–9)'],
                ['requireSpecialChars', 'Require special characters (!@#$…)'],
                ['isActive', 'Active'],
              ].map(([k, label]) => (
                <label key={k as string} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!(editing as any)[k as string]}
                    onChange={(e) =>
                      setEditing({ ...editing, [k as string]: e.target.checked } as any)
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
              <label className="block">
                <span className="text-sm">Max age (days)</span>
                <input
                  type="number"
                  className="w-full border rounded p-2"
                  value={editing.maxAgeDays || 0}
                  onChange={(e) =>
                    setEditing({ ...editing, maxAgeDays: parseInt(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm">Prevent reuse of last N passwords</span>
                <input
                  type="number"
                  className="w-full border rounded p-2"
                  value={editing.preventReuse || 0}
                  onChange={(e) =>
                    setEditing({ ...editing, preventReuse: parseInt(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm">Lockout threshold (failed attempts)</span>
                <input
                  type="number"
                  className="w-full border rounded p-2"
                  value={editing.lockoutThreshold || 0}
                  onChange={(e) =>
                    setEditing({ ...editing, lockoutThreshold: parseInt(e.target.value) || 0 })
                  }
                />
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
