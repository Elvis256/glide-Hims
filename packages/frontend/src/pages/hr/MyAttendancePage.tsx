import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import hrService from '../../services/hr';
import type { Attendance } from '../../services/hr';

export default function MyAttendancePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['my-attendance', user?.id, month],
    queryFn: () => hrService.attendance.list({ employeeId: user?.id }),
  });

  const clockInMutation = useMutation({
    mutationFn: () => hrService.attendance.clockIn(user?.facilityId || ''),
    onSuccess: () => {
      toast.success('Clocked in successfully');
      queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
    },
    onError: () => toast.error('Failed to clock in'),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => hrService.attendance.clockOut(user?.facilityId || ''),
    onSuccess: () => {
      toast.success('Clocked out successfully');
      queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
    },
    onError: () => toast.error('Failed to clock out'),
  });

  const todayRecord = records.find((r: Attendance) => {
    const d = new Date(r.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'half-day': return 'bg-orange-100 text-orange-800';
      case 'leave': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const presentDays = records.filter((r: Attendance) => r.status === 'present' || r.status === 'late').length;
  const absentDays = records.filter((r: Attendance) => r.status === 'absent').length;
  const lateDays = records.filter((r: Attendance) => r.status === 'late').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
          <p className="text-gray-500">Track your attendance and clock in/out</p>
        </div>
        <div className="flex gap-3">
          {!todayRecord?.clockIn ? (
            <button
              onClick={() => clockInMutation.mutate()}
              disabled={clockInMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {clockInMutation.isPending ? 'Clocking In...' : 'Clock In'}
            </button>
          ) : !todayRecord?.clockOut ? (
            <button
              onClick={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {clockOutMutation.isPending ? 'Clocking Out...' : 'Clock Out'}
            </button>
          ) : (
            <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              Done for today
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Records</p>
              <p className="text-xl font-bold">{records.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-xl font-bold">{presentDays}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-xl font-bold">{absentDays}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Late</p>
              <p className="text-xl font-bold">{lateDays}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Attendance Records</h3>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                No attendance records found
              </td></tr>
            ) : (
              records.map((record: Attendance) => {
                const hours = record.clockIn && record.clockOut
                  ? ((new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 3600000).toFixed(1)
                  : '-';
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium">{new Date(record.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{hours}h</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
