import { useEffect, useState, useMemo } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  email?: string;
  status?: string;
}

const facilityId = () => localStorage.getItem('glide_facility_id') || '';

export default function OrgChartPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/hr/employees', { params: { facilityId: facilityId() } });
        const list: Employee[] = Array.isArray(res.data)
          ? res.data
          : ((res.data as any)?.data ?? []);
        setEmployees(
          list.map((e: any) => ({
            ...e,
            fullName:
              e.fullName || `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.employeeNumber,
          })),
        );
      } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const filt = employees.filter(
      (e) =>
        !search ||
        e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        e.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase()),
    );
    const map = new Map<string, Employee[]>();
    for (const e of filt) {
      const key = e.department || '— Unassigned —';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [employees, search]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Organisation Chart</h1>
          <p className="text-sm text-gray-600">
            Staff grouped by department. {employees.length} total employees.
          </p>
        </div>
        <input
          className="border rounded p-2 w-64"
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded shadow p-8 text-center text-gray-500">
          No employees match.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dept, members]) => (
            <div key={dept} className="bg-white rounded shadow">
              <div className="border-b p-4 flex justify-between items-center">
                <h2 className="font-semibold text-lg">{dept}</h2>
                <span className="text-sm text-gray-500">{members.length} staff</span>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="border rounded p-3 hover:shadow transition bg-gray-50"
                    title={m.email || ''}
                  >
                    <div className="font-medium">{m.fullName}</div>
                    <div className="text-xs text-gray-600">{m.jobTitle || '—'}</div>
                    {m.email && (
                      <div className="text-xs text-blue-600 truncate mt-1">{m.email}</div>
                    )}
                    {m.status && m.status !== 'active' && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                        {m.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
