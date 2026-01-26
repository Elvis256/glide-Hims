import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Edit,
  Eye,
  Phone,
  Building2,
  Filter,
  Download,
  Upload,
  MoreVertical,
  UserCircle,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { hrService, type Employee } from '../../../services/hr';

const fallbackStaff: Employee[] = [
  { id: '1', employeeCode: 'EMP001', fullName: 'Dr. Sarah Johnson', email: 'sarah.j@hospital.com', phone: '+1-555-0101', departmentId: '1', department: { id: '1', name: 'Cardiology', code: 'CARD', facilityId: '', isActive: true, createdAt: '' }, jobTitle: 'Senior Cardiologist', status: 'active', dateOfJoining: '2020-03-15', createdAt: '' },
  { id: '2', employeeCode: 'EMP002', fullName: 'Dr. Michael Chen', email: 'michael.c@hospital.com', phone: '+1-555-0102', departmentId: '2', department: { id: '2', name: 'Neurology', code: 'NEURO', facilityId: '', isActive: true, createdAt: '' }, jobTitle: 'Neurologist', status: 'active', dateOfJoining: '2019-07-22', createdAt: '' },
];

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle }> = {
  active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'on-leave': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resigned: { color: 'bg-red-100 text-red-800', icon: XCircle },
  terminated: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function StaffDirectoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch employees from API
  const { data: employeesData, isLoading, error } = useQuery({
    queryKey: ['employees', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => hrService.employees.list({ status: statusFilter === 'all' ? undefined : statusFilter }),
    staleTime: 30000,
  });

  const staff = employeesData || fallbackStaff;
  const totalStaff = staff.length;
  
  const departments = useMemo(() => [...new Set(staff.map((s: Employee) => s.department?.name).filter(Boolean))] as string[], [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter((emp: Employee) => {
      const matchesSearch =
        emp.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
      const matchesDepartment = departmentFilter === 'all' || emp.department?.name === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [staff, searchTerm, statusFilter, departmentFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((s: Employee) => s.status === 'active').length,
    onLeave: staff.filter((s: Employee) => s.status === 'on-leave').length,
    resigned: staff.filter((s: Employee) => s.status === 'resigned' || s.status === 'terminated').length,
  }), [staff]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-7 w-7 text-blue-600" />
              Staff Directory
            </h1>
            <p className="text-gray-600 mt-1">Manage all staff members and their profiles</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Upload className="h-4 w-4" />
              Import
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Staff</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Active</span>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">On Leave</span>
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.onLeave}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Resigned</span>
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.resigned}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or email..."
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
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="resigned">Resigned</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employee</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employee ID</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Designation</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500 mt-2">Loading staff...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <AlertCircle className="h-6 w-6 mx-auto text-red-500" />
                    <p className="text-sm text-red-600 mt-2">Failed to load staff</p>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No staff found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((emp) => {
                const StatusIcon = statusConfig[emp.status]?.icon || CheckCircle;
                const statusColor = statusConfig[emp.status]?.color || 'bg-gray-100 text-gray-800';
                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserCircle className="h-6 w-6 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{emp.fullName}</p>
                          <p className="text-sm text-gray-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono">{emp.employeeCode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{emp.department?.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.jobTitle || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{emp.phone || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="h-4 w-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                          <Edit className="h-4 w-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="Documents">
                          <FileText className="h-4 w-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded" title="More">
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing {filteredStaff.length} of {totalStaff} staff members</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">Previous</button>
            <button className="px-3 py-1 border rounded bg-blue-600 text-white text-sm">1</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">2</button>
            <button className="px-3 py-1 border rounded hover:bg-gray-100 text-sm">Next</button>
          </div>
        </div>
      </div>

      {/* Add Staff Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Add New Staff Member</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="EMP000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2" placeholder="email@hospital.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" className="w-full border rounded-lg px-3 py-2" placeholder="+1-555-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Job title" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Staff</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
