import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, CheckCircle, XCircle, Users, Loader2, LogIn, LogOut, Plus } from 'lucide-react';
import { hrService, type Attendance, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [clockInTime, setClockInTime] = useState('');
  const [clockOutTime, setClockOutTime] = useState('');
  const [status, setStatus] = useState<'present' | 'absent' | 'late' | 'half-day'>('present');
  const queryClient = useQueryClient();

  // Get facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as { data: Employee[] }).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees = employeesData || [];

  // Fetch attendance
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', facilityId, selectedDate],
    queryFn: async () => {
      try {
        return await hrService.attendance.list({ 
          facilityId, 
          startDate: selectedDate, 
          endDate: selectedDate 
        });
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const attendance: Attendance[] = attendanceData || [];

  // Stats
  const stats = useMemo(() => ({
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    total: employees.length,
  }), [attendance, employees]);

  // Record attendance mutation
  const recordMutation = useMutation({
    mutationFn: async (data: { employeeId: string; date: string; clockIn?: string; clockOut?: string; status: string }) => {
      return hrService.attendance.record({
        employeeId: data.employeeId,
        date: data.date,
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        status: data.status as 'present' | 'absent' | 'late' | 'half-day',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setShowRecordModal(false);
      setSelectedEmployee('');
      setClockInTime('');
      setClockOutTime('');
    },
  });

  // Clock in/out mutations
  const clockInMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return hrService.attendance.record({
        employeeId,
        date: selectedDate,
        clockIn: new Date().toTimeString().slice(0, 5),
        status: 'present',
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const clockOutMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return hrService.attendance.record({
        employeeId,
        date: selectedDate,
        clockOut: new Date().toTimeString().slice(0, 5),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const handleRecordAttendance = () => {
    if (!selectedEmployee) return;
    recordMutation.mutate({
      employeeId: selectedEmployee,
      date: selectedDate,
      clockIn: clockInTime || undefined,
      clockOut: clockOutTime || undefined,
      status,
    });
  };

  const getEmployeeAttendance = (empId: string) => attendance.find(a => a.employeeId === empId);

  if (!facilityId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please configure a facility first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-500">Track and manage staff attendance</p>
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <button 
            onClick={() => setShowRecordModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Attendance
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Late</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Staff</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Attendance Records - {new Date(selectedDate).toLocaleDateString()}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                <th className="text-left p-4 font-medium text-gray-600">Department</th>
                <th className="text-left p-4 font-medium text-gray-600">Check In</th>
                <th className="text-left p-4 font-medium text-gray-600">Check Out</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No staff members found</p>
                    <p className="text-sm">Add staff in Staff Directory first</p>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const record = getEmployeeAttendance(emp.id);
                  const statusColors: Record<string, string> = {
                    present: 'bg-green-100 text-green-800',
                    absent: 'bg-red-100 text-red-800',
                    late: 'bg-yellow-100 text-yellow-800',
                    'half-day': 'bg-orange-100 text-orange-800',
                  };
                  return (
                    <tr key={emp.id} className="border-t hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-medium">{emp.fullName}</p>
                        <p className="text-sm text-gray-500">{emp.employeeCode}</p>
                      </td>
                      <td className="p-4 text-gray-600">{emp.department?.name || '—'}</td>
                      <td className="p-4 text-gray-600">{record?.clockIn || '—'}</td>
                      <td className="p-4 text-gray-600">{record?.clockOut || '—'}</td>
                      <td className="p-4">
                        {record ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[record.status] || 'bg-gray-100'}`}>
                            {record.status}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Not recorded</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {!record?.clockIn && (
                            <button
                              onClick={() => clockInMutation.mutate(emp.id)}
                              disabled={clockInMutation.isPending}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Clock In"
                            >
                              <LogIn className="w-4 h-4" />
                            </button>
                          )}
                          {record?.clockIn && !record?.clockOut && (
                            <button
                              onClick={() => clockOutMutation.mutate(emp.id)}
                              disabled={clockOutMutation.isPending}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Clock Out"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Attendance Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Record Attendance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Employee *</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Clock In</label>
                  <input
                    type="time"
                    value={clockInTime}
                    onChange={(e) => setClockInTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Clock Out</label>
                  <input
                    type="time"
                    value={clockOutTime}
                    onChange={(e) => setClockOutTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'present' | 'absent' | 'late' | 'half-day')}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRecordModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleRecordAttendance}
                disabled={recordMutation.isPending || !selectedEmployee}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {recordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
