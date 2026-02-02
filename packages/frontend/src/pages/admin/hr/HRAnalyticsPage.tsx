import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, TrendingUp, Clock, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { hrService } from '../../../services/hr';
import { facilitiesService } from '../../../services';

export default function HRAnalyticsPage() {
  // Get facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  // Fetch dashboard stats
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['hr-dashboard', facilityId],
    queryFn: async () => {
      try {
        return await hrService.getDashboard(facilityId);
      } catch { 
        return { 
          totalEmployees: 0, 
          activeEmployees: 0, 
          pendingLeaveRequests: 0, 
          presentToday: 0,
          absentToday: 0,
        }; 
      }
    },
    enabled: !!facilityId,
  });

  // Fetch employees for department breakdown
  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as any).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees = employeesData || [];

  // Calculate department breakdown
  const departmentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const dept = emp.department?.name || 'Unassigned';
      breakdown[dept] = (breakdown[dept] || 0) + 1;
    });
    return Object.entries(breakdown).map(([name, count]) => ({ name, count }));
  }, [employees]);

  // Calculate attendance rate
  const attendanceRate = useMemo(() => {
    if (!dashboard || dashboard.activeEmployees === 0) return '--';
    return Math.round((dashboard.presentToday / dashboard.activeEmployees) * 100) + '%';
  }, [dashboard]);

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
          <h1 className="text-2xl font-bold text-gray-900">HR Analytics</h1>
          <p className="text-gray-500">Workforce insights and metrics</p>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 border rounded-lg">
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>This Year</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Export Report
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-500">Total Staff</span>
              </div>
              <p className="text-2xl font-bold">{dashboard?.totalEmployees || 0}</p>
              <p className="text-xs text-gray-400">All employees</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-500">Active</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.activeEmployees || 0}</p>
              <p className="text-xs text-gray-400">Currently employed</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-500">Present Today</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.presentToday || 0}</p>
              <p className="text-xs text-gray-400">Checked in</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-gray-500">Pending Leaves</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{dashboard?.pendingLeaveRequests || 0}</p>
              <p className="text-xs text-gray-400">Awaiting approval</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-500">Absent Today</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{dashboard?.absentToday || 0}</p>
              <p className="text-xs text-gray-400">Not present</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span className="text-sm text-gray-500">Attendance Rate</span>
              </div>
              <p className="text-2xl font-bold">{attendanceRate}</p>
              <p className="text-xs text-gray-400">Today</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="font-semibold mb-4">Staff by Department</h2>
              {departmentBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {departmentBreakdown.map((dept) => (
                    <div key={dept.name} className="flex items-center justify-between">
                      <span className="text-gray-700">{dept.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(dept.count / employees.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{dept.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="font-semibold mb-4">Workforce Overview</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-700">Active Employees</span>
                  <span className="font-bold text-green-600">{dashboard?.activeEmployees || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-gray-700">Present Today</span>
                  <span className="font-bold text-blue-600">{dashboard?.presentToday || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <span className="text-gray-700">Pending Leave Requests</span>
                  <span className="font-bold text-yellow-600">{dashboard?.pendingLeaveRequests || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-gray-700">Absent Today</span>
                  <span className="font-bold text-red-600">{dashboard?.absentToday || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Department Summary</h2>
              </div>
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th className="pb-2">Department</th>
                      <th className="pb-2 text-right">Staff</th>
                      <th className="pb-2 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentBreakdown.length > 0 ? (
                      departmentBreakdown.map((dept) => (
                        <tr key={dept.name} className="border-t">
                          <td className="py-2">{dept.name}</td>
                          <td className="py-2 text-right">{dept.count}</td>
                          <td className="py-2 text-right">{Math.round((dept.count / employees.length) * 100)}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-400">
                          No departments found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Quick Stats</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Employees</span>
                  <span className="font-medium">{dashboard?.totalEmployees || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Rate</span>
                  <span className="font-medium text-green-600">
                    {dashboard?.totalEmployees ? Math.round((dashboard.activeEmployees / dashboard.totalEmployees) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Today's Attendance</span>
                  <span className="font-medium">{attendanceRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Departments</span>
                  <span className="font-medium">{departmentBreakdown.length}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
