import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Plus,
  Search,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Mail,
  Briefcase,
} from 'lucide-react';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: string;
  phone?: string;
  email?: string;
  jobTitle: string;
  department?: string;
  employmentType: string;
  hireDate: string;
  basicSalary: number;
  status: string;
  annualLeaveBalance?: number;
  sickLeaveBalance?: number;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employee: Employee;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string;
  status: string;
  approvedAt?: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee: Employee;
  date: string;
  clockIn?: string;
  clockOut?: string;
  hoursWorked?: number;
  status: string;
}

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  presentToday: number;
  absentToday: number;
}

const FACILITY_ID = 'b94b30c8-f98e-4a70-825e-253224a1cb91';

export default function HRPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'attendance' | 'leave' | 'payroll'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get(`/hr/dashboard?facilityId=${FACILITY_ID}`);
        setDashboard(res.data);
      } else if (activeTab === 'employees') {
        const res = await api.get(`/hr/employees?facilityId=${FACILITY_ID}`);
        setEmployees(res.data.data || []);
      } else if (activeTab === 'leave') {
        const res = await api.get(`/hr/leave?facilityId=${FACILITY_ID}`);
        setLeaveRequests(res.data || []);
      } else if (activeTab === 'attendance') {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const res = await api.get(`/hr/attendance?facilityId=${FACILITY_ID}&startDate=${weekAgo}&endDate=${today}`);
        setAttendance(res.data || []);
      }
    } catch (error) {
      console.error('Error loading HR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/hr/leave/${id}/approve`, { approved });
      loadData();
    } catch (error) {
      console.error('Error approving leave:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      terminated: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredEmployees = employees.filter(emp => {
    const name = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || 
           emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Users },
    { id: 'employees', label: 'Employees', icon: User },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR & Payroll</h1>
          <p className="text-gray-500">Manage employees, attendance, leave and payroll</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Employees</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboard.totalEmployees}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Active Employees</p>
                    <p className="text-2xl font-bold text-green-600">{dashboard.activeEmployees}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Present Today</p>
                    <p className="text-2xl font-bold text-green-600">{dashboard.presentToday}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Absent Today</p>
                    <p className="text-2xl font-bold text-red-600">{dashboard.absentToday}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending Leave</p>
                    <p className="text-2xl font-bold text-yellow-600">{dashboard.pendingLeaveRequests}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="flex gap-6">
              {/* Employee List */}
              <div className="flex-1 bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {filteredEmployees.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedEmployee?.id === emp.id ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                            <p className="text-sm text-gray-500">{emp.employeeNumber} • {emp.jobTitle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(emp.status)}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee Details */}
              {selectedEmployee && (
                <div className="w-96 bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedEmployee.firstName} {selectedEmployee.lastName}
                        </h3>
                        <p className="text-gray-500">{selectedEmployee.employeeNumber}</p>
                        {getStatusBadge(selectedEmployee.status)}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Job Title</p>
                      <p className="font-medium flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        {selectedEmployee.jobTitle}
                      </p>
                    </div>
                    {selectedEmployee.department && (
                      <div>
                        <p className="text-sm text-gray-500">Department</p>
                        <p className="font-medium">{selectedEmployee.department}</p>
                      </div>
                    )}
                    {selectedEmployee.phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {selectedEmployee.phone}
                        </p>
                      </div>
                    )}
                    {selectedEmployee.email && (
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {selectedEmployee.email}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Hire Date</p>
                      <p className="font-medium">
                        {new Date(selectedEmployee.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Basic Salary</p>
                      <p className="font-medium text-green-600">
                        {formatCurrency(selectedEmployee.basicSalary)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{selectedEmployee.annualLeaveBalance || 0}</p>
                        <p className="text-xs text-gray-500">Annual Leave</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-600">{selectedEmployee.sickLeaveBalance || 0}</p>
                        <p className="text-xs text-gray-500">Sick Leave</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Recent Attendance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No attendance records found
                        </td>
                      </tr>
                    ) : (
                      attendance.map(record => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="font-medium">{record.employee?.firstName} {record.employee?.lastName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{record.clockIn || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{record.clockOut || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{record.hoursWorked || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leave Tab */}
          {activeTab === 'leave' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Leave Requests</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  New Request
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          No leave requests found
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map(leave => (
                        <tr key={leave.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-600" />
                              </div>
                              <p className="font-medium">{leave.employee?.firstName} {leave.employee?.lastName}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{leave.leaveType}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(leave.startDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(leave.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{leave.daysRequested}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(leave.status)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {leave.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveLeave(leave.id, true)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleApproveLeave(leave.id, false)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Reject"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payroll Tab */}
          {activeTab === 'payroll' && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">Payroll Processing</h3>
              <p className="text-gray-500 mt-2">Create and process monthly payroll runs</p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Payroll Run
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
