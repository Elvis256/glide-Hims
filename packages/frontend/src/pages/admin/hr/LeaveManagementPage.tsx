import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Search,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Clock,
  Filter,
  MoreVertical,
  CalendarDays,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { hrService } from '../../../services';
import type { LeaveRequest as ApiLeaveRequest } from '../../../services';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  paidLeave: boolean;
  status: 'Active' | 'Inactive';
}

interface LeaveBalance {
  staffName: string;
  staffId: string;
  department: string;
  annual: { entitled: number; used: number; balance: number };
  sick: { entitled: number; used: number; balance: number };
  casual: { entitled: number; used: number; balance: number };
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'Public' | 'Restricted' | 'Optional';
}

// Static leave types (no API yet)
const staticLeaveTypes: LeaveType[] = [
  { id: '1', name: 'Annual Leave', code: 'AL', defaultDays: 21, carryForward: true, maxCarryForward: 10, paidLeave: true, status: 'Active' },
  { id: '2', name: 'Sick Leave', code: 'SL', defaultDays: 14, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
  { id: '3', name: 'Casual Leave', code: 'CL', defaultDays: 7, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
  { id: '4', name: 'Maternity Leave', code: 'ML', defaultDays: 90, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
  { id: '5', name: 'Paternity Leave', code: 'PL', defaultDays: 14, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
  { id: '6', name: 'Unpaid Leave', code: 'UL', defaultDays: 30, carryForward: false, maxCarryForward: 0, paidLeave: false, status: 'Active' },
  { id: '7', name: 'Bereavement Leave', code: 'BL', defaultDays: 5, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
  { id: '8', name: 'Study Leave', code: 'STL', defaultDays: 10, carryForward: false, maxCarryForward: 0, paidLeave: true, status: 'Active' },
];

// Static balances (no API yet)
const staticBalances: LeaveBalance[] = [
  { staffName: 'Dr. Sarah Johnson', staffId: 'EMP001', department: 'Cardiology', annual: { entitled: 21, used: 5, balance: 16 }, sick: { entitled: 14, used: 2, balance: 12 }, casual: { entitled: 7, used: 3, balance: 4 } },
  { staffName: 'Dr. Michael Chen', staffId: 'EMP002', department: 'Neurology', annual: { entitled: 21, used: 10, balance: 11 }, sick: { entitled: 14, used: 0, balance: 14 }, casual: { entitled: 7, used: 5, balance: 2 } },
  { staffName: 'Nurse Emily Davis', staffId: 'EMP003', department: 'Emergency', annual: { entitled: 18, used: 8, balance: 10 }, sick: { entitled: 14, used: 4, balance: 10 }, casual: { entitled: 7, used: 2, balance: 5 } },
  { staffName: 'Dr. James Wilson', staffId: 'EMP004', department: 'Orthopedics', annual: { entitled: 21, used: 3, balance: 18 }, sick: { entitled: 14, used: 1, balance: 13 }, casual: { entitled: 7, used: 0, balance: 7 } },
];

// Static holidays (no API yet)
const staticHolidays: Holiday[] = [
  { id: '1', name: 'New Year\'s Day', date: '2024-01-01', type: 'Public' },
  { id: '2', name: 'Martin Luther King Jr. Day', date: '2024-01-15', type: 'Public' },
  { id: '3', name: 'Presidents\' Day', date: '2024-02-19', type: 'Public' },
  { id: '4', name: 'Memorial Day', date: '2024-05-27', type: 'Public' },
  { id: '5', name: 'Independence Day', date: '2024-07-04', type: 'Public' },
  { id: '6', name: 'Labor Day', date: '2024-09-02', type: 'Public' },
  { id: '7', name: 'Thanksgiving Day', date: '2024-11-28', type: 'Public' },
  { id: '8', name: 'Christmas Day', date: '2024-12-25', type: 'Public' },
];

// Map API status to display status
const mapApiStatus = (status: ApiLeaveRequest['status']): 'Pending' | 'Approved' | 'Rejected' => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'cancelled': return 'Rejected';
    default: return 'Pending';
  }
};

// Map API leave type to display name
const mapLeaveType = (leaveType: ApiLeaveRequest['leaveType']): string => {
  const typeMap: Record<string, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    maternity: 'Maternity Leave',
    paternity: 'Paternity Leave',
    compassionate: 'Compassionate Leave',
    unpaid: 'Unpaid Leave',
    study: 'Study Leave',
  };
  return typeMap[leaveType] || leaveType;
};

// Calculate days between two dates
const calculateDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const statusConfig = {
  Pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  Approved: { color: 'bg-green-100 text-green-800', icon: Check },
  Rejected: { color: 'bg-red-100 text-red-800', icon: X },
};

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState<'types' | 'requests' | 'balances' | 'calendar'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const queryClient = useQueryClient();

  // Fetch leave requests from API
  const { data: leaveRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => hrService.leave.list(),
  });

  // Mutation for approving/rejecting leave requests
  const approveMutation = useMutation({
    mutationFn: ({ id, approved, notes }: { id: string; approved: boolean; notes?: string }) =>
      hrService.leave.approve(id, { approved, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });

  // Transform API data to display format
  const transformedRequests = useMemo(() => {
    return leaveRequests.map((request) => ({
      id: request.id,
      staffName: request.employee?.fullName || 'Unknown',
      staffId: request.employee?.employeeCode || request.employeeId,
      department: request.employee?.department?.name || 'N/A',
      leaveType: mapLeaveType(request.leaveType),
      startDate: request.startDate,
      endDate: request.endDate,
      days: calculateDays(request.startDate, request.endDate),
      reason: request.reason || '',
      status: mapApiStatus(request.status),
      appliedOn: request.createdAt,
    }));
  }, [leaveRequests]);

  const filteredRequests = useMemo(() => {
    return transformedRequests.filter((request) => {
      const matchesSearch =
        request.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.staffId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [transformedRequests, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    pendingRequests: transformedRequests.filter((r) => r.status === 'Pending').length,
    approvedThisMonth: transformedRequests.filter((r) => r.status === 'Approved').length,
    onLeaveToday: 3,
    upcomingHolidays: staticHolidays.filter((h) => new Date(h.date) > new Date()).length,
  }), [transformedRequests]);

  const calendarDays = useMemo(() => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [selectedMonth]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="h-7 w-7 text-blue-600" />
              Leave Management
            </h1>
            <p className="text-gray-600 mt-1">Manage leave types, requests, and entitlements</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Leave Type
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Pending Requests</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.pendingRequests}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Approved (Month)</span>
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.approvedThisMonth}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">On Leave Today</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.onLeaveToday}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Upcoming Holidays</span>
              <CalendarDays className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.upcomingHolidays}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-1 mb-4 flex gap-1 w-fit">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Leave Requests
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'types' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Briefcase className="h-4 w-4 inline mr-2" />
          Leave Types
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'balances' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Leave Balances
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CalendarDays className="h-4 w-4 inline mr-2" />
          Holiday Calendar
        </button>
      </div>

      {/* Leave Requests Tab */}
      {activeTab === 'requests' && (
        <>
          <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
            {isLoadingRequests ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading leave requests...</span>
                </div>
              </div>
            ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Leave Type</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Duration</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Days</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Reason</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No leave requests found
                      </td>
                    </tr>
                  ) : (
                  filteredRequests.map((request) => {
                    const StatusIcon = statusConfig[request.status].icon;
                    return (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{request.staffName}</p>
                            <p className="text-sm text-gray-500">{request.department}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{request.leaveType}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{request.startDate} to {request.endDate}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{request.days}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600 truncate max-w-[200px] block">{request.reason}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[request.status].color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {request.status === 'Pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                className="p-1 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
                                title="Approve"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate({ id: request.id, approved: true })}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                className="p-1 hover:bg-red-100 rounded text-red-600 disabled:opacity-50"
                                title="Reject"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate({ id: request.id, approved: false })}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button className="p-1 hover:bg-gray-100 rounded" title="View">
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </>
      )}

      {/* Leave Types Tab */}
      {activeTab === 'types' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Leave Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Default Days</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Carry Forward</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Paid</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staticLeaveTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{type.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{type.code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{type.defaultDays} days</td>
                    <td className="px-4 py-3">
                      {type.carryForward ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Up to {type.maxCarryForward} days
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {type.paidLeave ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Paid</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        type.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {type.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                          <Edit className="h-4 w-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Delete">
                          <Trash2 className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Balances Tab */}
      {activeTab === 'balances' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600" colSpan={3}>Annual Leave</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600" colSpan={3}>Sick Leave</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600" colSpan={3}>Casual Leave</th>
                </tr>
                <tr className="bg-gray-50">
                  <th></th>
                  <th></th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Entitled</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Used</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Balance</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Entitled</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Used</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Balance</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Entitled</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Used</th>
                  <th className="text-center px-2 py-2 text-xs text-gray-500">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staticBalances.map((balance) => (
                  <tr key={balance.staffId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{balance.staffName}</p>
                        <p className="text-sm text-gray-500">{balance.staffId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{balance.department}</td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.annual.entitled}</td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.annual.used}</td>
                    <td className="text-center px-2 py-3">
                      <span className={`font-medium ${balance.annual.balance < 5 ? 'text-red-600' : 'text-green-600'}`}>
                        {balance.annual.balance}
                      </span>
                    </td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.sick.entitled}</td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.sick.used}</td>
                    <td className="text-center px-2 py-3">
                      <span className={`font-medium ${balance.sick.balance < 3 ? 'text-red-600' : 'text-green-600'}`}>
                        {balance.sick.balance}
                      </span>
                    </td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.casual.entitled}</td>
                    <td className="text-center px-2 py-3 text-gray-600">{balance.casual.used}</td>
                    <td className="text-center px-2 py-3">
                      <span className={`font-medium ${balance.casual.balance < 2 ? 'text-red-600' : 'text-green-600'}`}>
                        {balance.casual.balance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holiday Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const prev = new Date(selectedMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setSelectedMonth(prev);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="font-semibold text-lg">
                {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => {
                  const next = new Date(selectedMonth);
                  next.setMonth(next.getMonth() + 1);
                  setSelectedMonth(next);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Add Holiday
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((day, index) => {
                const holiday = day ? staticHolidays.find((h) => {
                  const hDate = new Date(h.date);
                  return hDate.getDate() === day.getDate() &&
                         hDate.getMonth() === day.getMonth() &&
                         hDate.getFullYear() === day.getFullYear();
                }) : null;
                const isToday = day && day.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] p-2 border rounded-lg ${
                      day ? 'bg-white' : 'bg-gray-50'
                    } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    {day && (
                      <>
                        <span className={`text-sm ${isToday ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                          {day.getDate()}
                        </span>
                        {holiday && (
                          <div className={`mt-1 p-1 rounded text-xs ${
                            holiday.type === 'Public' ? 'bg-red-100 text-red-800' :
                            holiday.type === 'Restricted' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {holiday.name}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Holiday List */}
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Upcoming Holidays</h4>
              <div className="space-y-2">
                {staticHolidays.filter((h) => new Date(h.date) > new Date()).slice(0, 5).map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{holiday.name}</p>
                        <p className="text-sm text-gray-500">{new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      holiday.type === 'Public' ? 'bg-red-100 text-red-800' :
                      holiday.type === 'Restricted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {holiday.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add Leave Type</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Name</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="e.g., Annual Leave" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="AL" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Days</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="21" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Paid Leave</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm text-gray-700">Allow Carry Forward</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Leave Type</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
