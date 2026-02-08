import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useFacilityId } from '../lib/facility';
import { toast } from 'sonner';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  X,
  Loader2,
} from 'lucide-react';

// Staff member (user with HR fields)
interface StaffMember {
  id: string;
  employeeNumber: string;
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle: string;
  department?: string;
  departmentId?: string;
  staffCategory?: string;
  employmentType: string;
  status: string;
  hireDate?: string;
  dateOfBirth?: string;
  gender?: string;
  basicSalary?: number;
  annualLeaveBalance?: number;
  sickLeaveBalance?: number;
  facilityId?: string;
}

interface LeaveRequest {
  id: string;
  staffId: string;
  staff: StaffMember;
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
  staffId: string;
  staff: StaffMember;
  date: string;
  clockIn?: string;
  clockOut?: string;
  hoursWorked?: number;
  status: string;
}

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  resigned: number;
  pendingLeaveRequests: number;
  presentToday: number;
  absentToday: number;
}

export default function HRPage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'attendance' | 'leave' | 'payroll'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Staff Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [departments, setDepartments] = useState<Array<{id: string; name: string; code: string}>>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await api.get('/facilities/departments');
        setDepartments(res.data || []);
      } catch (e) {
        console.error('Failed to load departments:', e);
      }
    };
    loadDepartments();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get('/hr/dashboard');
        setDashboard(res.data);
      } else if (activeTab === 'employees') {
        const res = await api.get('/hr/staff');
        setStaff(res.data.data || []);
      } else if (activeTab === 'leave') {
        const res = await api.get(`/hr/leave?facilityId=${facilityId}`);
        setLeaveRequests(res.data || []);
      } else if (activeTab === 'attendance') {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const res = await api.get(`/hr/attendance?facilityId=${facilityId}&startDate=${weekAgo}&endDate=${today}`);
        setAttendance(res.data || []);
      }
    } catch (error) {
      console.error('Error loading HR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setShowEditModal(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    setSaving(true);
    try {
      await api.patch(`/hr/staff/${editingStaff.id}`, {
        jobTitle: editingStaff.jobTitle,
        staffCategory: editingStaff.staffCategory,
        employmentType: editingStaff.employmentType,
        departmentId: editingStaff.departmentId,
        dateOfBirth: editingStaff.dateOfBirth,
        gender: editingStaff.gender,
        hireDate: editingStaff.hireDate,
        basicSalary: editingStaff.basicSalary,
      });
      toast.success('Staff updated successfully');
      setShowEditModal(false);
      setEditingStaff(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update staff');
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = staff.filter(
    (member) =>
      member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleApproveLeave = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/hr/leave/${id}/approve`, { approved });
      loadData();
    } catch (error) {
      console.error('Error approving leave:', error);
    }
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
      on_leave: 'bg-blue-100 text-blue-800',
      terminated: 'bg-gray-100 text-gray-800',
      resigned: 'bg-gray-100 text-gray-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Users },
    { id: 'employees', label: 'Staff Directory', icon: User },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR & Payroll</h1>
          <p className="text-gray-500">Manage staff, attendance, leave and payroll</p>
        </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Staff</p>
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
                    <p className="text-sm text-gray-500">Active</p>
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
                    <p className="text-sm text-gray-500">On Leave</p>
                    <p className="text-2xl font-bold text-blue-600">{dashboard.onLeave || 0}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Calendar className="h-6 w-6 text-blue-600" />
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

          {/* Staff Directory Tab */}
          {activeTab === 'employees' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search staff by name, ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <span className="text-sm text-gray-500 ml-4">{filteredStaff.length} staff members</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Member</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No staff found. Create users to see them here.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium">
                                  {member.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{member.fullName}</div>
                                <div className="text-sm text-gray-500">{member.staffCategory || 'Staff'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{member.employeeNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.department || 'Unassigned'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.jobTitle || 'Not Set'}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm">
                              {member.email && <div className="text-gray-500">{member.email}</div>}
                              {member.phone && <div className="text-gray-400">{member.phone}</div>}
                            </div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(member.status)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleEditStaff(member)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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

      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Edit Staff: {editingStaff.fullName}</h2>
              <button onClick={() => { setShowEditModal(false); setEditingStaff(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Job Information */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={editingStaff.jobTitle || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, jobTitle: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Senior Doctor, Nurse"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select
                      value={editingStaff.departmentId || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, departmentId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">-- Select Department --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Staff Category</label>
                    <select
                      value={editingStaff.staffCategory || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, staffCategory: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">-- Select --</option>
                      <option value="doctor">Doctor</option>
                      <option value="nurse">Nurse</option>
                      <option value="lab_technician">Lab Technician</option>
                      <option value="pharmacist">Pharmacist</option>
                      <option value="radiologist">Radiologist</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="cashier">Cashier</option>
                      <option value="administrator">Administrator</option>
                      <option value="hr_manager">HR Manager</option>
                      <option value="store_keeper">Store Keeper</option>
                      <option value="accountant">Accountant</option>
                      <option value="it_support">IT Support</option>
                      <option value="consultant">Consultant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                    <select
                      value={editingStaff.employmentType || 'permanent'}
                      onChange={(e) => setEditingStaff({ ...editingStaff, employmentType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="intern">Intern</option>
                      <option value="consultant">Consultant</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editingStaff.dateOfBirth ? new Date(editingStaff.dateOfBirth).toISOString().slice(0, 10) : ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={editingStaff.gender || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, gender: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">-- Select --</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                    <input
                      type="date"
                      value={editingStaff.hireDate ? new Date(editingStaff.hireDate).toISOString().slice(0, 10) : ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, hireDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Salary */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Compensation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                    <input
                      type="number"
                      value={editingStaff.basicSalary || ''}
                      onChange={(e) => setEditingStaff({ ...editingStaff, basicSalary: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      placeholder="Monthly salary"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => { setShowEditModal(false); setEditingStaff(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStaff}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Update Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
