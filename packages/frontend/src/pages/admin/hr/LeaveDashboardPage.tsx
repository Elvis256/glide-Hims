import { useEffect, useState, useMemo } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  reason?: string;
  approverId?: string;
  createdAt?: string;
}

interface Employee {
  id: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  annualLeaveBalance?: number;
  sickLeaveBalance?: number;
}

const facilityId = () => localStorage.getItem('glide_facility_id') || '';

export default function LeaveDashboardPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, e] = await Promise.all([
        api.get('/hr/leave', { params: { facilityId: facilityId() } }),
        api.get('/hr/employees', { params: { facilityId: facilityId() } }),
      ]);
      const lList = Array.isArray(l.data) ? l.data : ((l.data as any)?.data ?? []);
      const eList = Array.isArray(e.data) ? e.data : ((e.data as any)?.data ?? []);
      setLeaves(lList);
      setEmployees(
        eList.map((x: any) => ({
          ...x,
          fullName: x.fullName || `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim(),
        })),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onLeaveToday = leaves.filter(
      (l) => l.status === 'approved' && new Date(l.startDate) <= today && new Date(l.endDate) >= today,
    );
    const pending = leaves.filter((l) => l.status === 'pending');
    const upcoming = leaves.filter(
      (l) => l.status === 'approved' && new Date(l.startDate) > today,
    );
    const byType: Record<string, number> = {};
    for (const l of leaves) {
      byType[l.leaveType] = (byType[l.leaveType] || 0) + 1;
    }
    const lowBalance = employees.filter((e) => (e.annualLeaveBalance ?? 0) < 5);
    return { onLeaveToday, pending, upcoming, byType, lowBalance };
  }, [leaves, employees]);

  const empName = (id: string) =>
    employees.find((e) => e.id === id)?.fullName || id.substring(0, 8);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Leave Dashboard</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card label="On leave today" value={stats.onLeaveToday.length} color="blue" />
            <Card label="Pending approvals" value={stats.pending.length} color="yellow" />
            <Card label="Upcoming (approved)" value={stats.upcoming.length} color="green" />
            <Card label="Low balance (<5d)" value={stats.lowBalance.length} color="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Currently on leave">
              {stats.onLeaveToday.length === 0 ? (
                <p className="text-gray-500 text-sm">No one is on leave today.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {stats.onLeaveToday.map((l) => (
                    <li key={l.id} className="flex justify-between border-b pb-2">
                      <span>
                        <strong>{empName(l.employeeId)}</strong> — {l.leaveType}
                      </span>
                      <span className="text-gray-600">
                        until {new Date(l.endDate).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Pending approvals">
              {stats.pending.length === 0 ? (
                <p className="text-gray-500 text-sm">No pending requests.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {stats.pending.slice(0, 10).map((l) => (
                    <li key={l.id} className="flex justify-between border-b pb-2">
                      <span>
                        <strong>{empName(l.employeeId)}</strong> — {l.leaveType} ({l.daysRequested}d)
                      </span>
                      <span className="text-gray-600">
                        {new Date(l.startDate).toLocaleDateString()} →{' '}
                        {new Date(l.endDate).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Upcoming approved leave">
              {stats.upcoming.length === 0 ? (
                <p className="text-gray-500 text-sm">No upcoming leaves.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {stats.upcoming.slice(0, 10).map((l) => (
                    <li key={l.id} className="flex justify-between border-b pb-2">
                      <span>
                        <strong>{empName(l.employeeId)}</strong> — {l.leaveType}
                      </span>
                      <span className="text-gray-600">
                        {new Date(l.startDate).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Low balance employees">
              {stats.lowBalance.length === 0 ? (
                <p className="text-gray-500 text-sm">All employees have sufficient balance.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {stats.lowBalance.slice(0, 10).map((e) => (
                    <li key={e.id} className="flex justify-between border-b pb-2">
                      <span>
                        <strong>{e.fullName}</strong> — {e.jobTitle || '—'}
                      </span>
                      <span className="text-red-600">
                        {(e.annualLeaveBalance ?? 0).toFixed(1)} days
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title="Leave by type" className="mt-6">
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.byType).map(([t, c]) => (
                <div key={t} className="px-4 py-2 bg-gray-100 rounded">
                  <span className="font-mono text-sm">{t}</span>: <strong>{c}</strong>
                </div>
              ))}
              {Object.keys(stats.byType).length === 0 && (
                <p className="text-gray-500 text-sm">No leave data yet.</p>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: any = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded p-4 shadow ${bg[color] || 'bg-gray-50'}`}>
      <div className="text-sm">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: any;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded shadow ${className}`}>
      <h3 className="p-4 border-b font-semibold">{title}</h3>
      <div className="p-4">{children}</div>
    </div>
  );
}
