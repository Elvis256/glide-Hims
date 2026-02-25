import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Check,
  X,
  ChevronDown,
  Users,
  Star,
  UserCheck,
  Crown,
  ArrowRight,
  Trash2,
  Loader2,
  FolderTree,
} from 'lucide-react';
import { toast } from 'sonner';
import { facilitiesService, usersService } from '../../../services';
import api from '../../../services/api';

interface DepartmentView {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  headId: string | null;
  headName: string | null;
  userCount: number;
}

interface UserDepartment {
  id: string;
  name: string;
  role: string;
  email: string;
  departments: { id: string; name: string; isPrimary: boolean }[];
}

interface DeptStaffMember {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
}

export default function DepartmentAccessPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentView | null>(null);
  const [viewMode, setViewMode] = useState<'departments' | 'users'>('departments');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch departments from API
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
    staleTime: 30000,
  });

  // Fetch users from API
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.list(),
    staleTime: 30000,
  });

  // Transform API departments to match component's expected interface
  const departments: DepartmentView[] = useMemo(() => {
    if (!departmentsData) return [];
    return departmentsData.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      status: dept.status || 'active',
      headId: null,
      headName: null,
      userCount: 0,
    }));
  }, [departmentsData]);

  // Fetch staff for selected department
  const { data: deptStaff } = useQuery({
    queryKey: ['department-staff', selectedDepartment?.id],
    queryFn: async () => {
      if (!selectedDepartment) return [];
      try {
        const res = await api.get(`/facilities/departments/${selectedDepartment.id}/staff`);
        return (res.data || []) as DeptStaffMember[];
      } catch {
        return [];
      }
    },
    enabled: !!selectedDepartment,
    staleTime: 15000,
  });

  // Transform API users for "By User" view
  const allUsers = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.map((user) => ({
      id: user.id,
      name: user.fullName,
      role: user.roles?.[0]?.name || 'Staff',
      email: user.email,
      departments: [] as { id: string; name: string; isPrimary: boolean }[],
    }));
  }, [usersData]);

  // Select first department by default when data loads
  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0]);
    }
  }, [departments, selectedDepartment]);

  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, departments]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allUsers]);

  const isLoading = departmentsLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-gray-500">Loading department data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Building2 className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Access</h1>
            <p className="text-sm text-gray-500">Manage user department assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('departments')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${viewMode === 'departments' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Building2 className="w-4 h-4" />
              By Department
            </button>
            <button
              onClick={() => setViewMode('users')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${viewMode === 'users' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Users className="w-4 h-4" />
              By User
            </button>
          </div>
          <Link
            to="/admin/hr/departments"
            className="flex items-center gap-2 px-3 py-2 text-sm border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            <FolderTree className="w-4 h-4" />
            Manage Departments
          </Link>
          <button
            onClick={() => setShowAddDepartmentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={viewMode === 'departments' ? 'Search departments...' : 'Search users...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {viewMode === 'departments' ? (
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Departments List */}
          <div className="w-96 bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Departments ({filteredDepartments.length})</h2>
            </div>
            <div className="flex-1 overflow-auto">
              {filteredDepartments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedDepartment?.id === dept.id ? 'bg-teal-50 border-l-4 border-l-teal-600' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{dept.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{dept.code}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{dept.description || 'No description'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {dept.userCount}
                      </span>
                    </div>
                  </div>
                  {dept.headName && (
                    <div className="flex items-center gap-2 mt-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-gray-600">{dept.headName}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Department Details */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
            {selectedDepartment ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{selectedDepartment.name}</h2>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{selectedDepartment.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedDepartment.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedDepartment.status}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedDepartment.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHeadModal(true)}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      <Crown className="w-4 h-4 text-yellow-500" />
                      {selectedDepartment.headName ? 'Change Head' : 'Assign Head'}
                    </button>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Assign Users
                    </button>
                  </div>
                </div>

                {/* Department Head */}
                {selectedDepartment.headName && (
                  <div className="p-4 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                          <Crown className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-yellow-700">Department Head</p>
                          <p className="font-medium text-gray-900">{selectedDepartment.headName}</p>
                        </div>
                      </div>
                      <button className="text-sm text-yellow-700 hover:text-yellow-800">Remove</button>
                    </div>
                  </div>
                )}

                {/* Users List */}
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Staff Members ({deptStaff?.length || 0})
                  </h3>
                  {deptStaff && deptStaff.length > 0 ? (
                  <div className="space-y-2">
                    {deptStaff.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                              <span className="text-teal-700 font-semibold text-sm">{(user.fullName || user.username || '?')[0].toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.fullName || user.username}</p>
                              <p className="text-sm text-gray-500">{user.role || 'Staff'} • {user.email || 'No email'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No staff assigned to this department yet</p>
                      <p className="text-xs mt-1">Use the "Assign Users" button above to add staff</p>
                    </div>
                  )}

                  {/* Delete Department */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        if (!selectedDepartment) return;
                        if (!confirm(`Delete "${selectedDepartment.name}"? This cannot be undone.`)) return;
                        setDeleting(selectedDepartment.id);
                        try {
                          await facilitiesService.departments.delete(selectedDepartment.id);
                          toast.success(`${selectedDepartment.name} deleted`);
                          setSelectedDepartment(null);
                          queryClient.invalidateQueries({ queryKey: ['departments'] });
                        } catch {
                          toast.error('Failed to delete department');
                        } finally {
                          setDeleting(null);
                        }
                      }}
                      disabled={deleting === selectedDepartment.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                    >
                      {deleting === selectedDepartment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete Department
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a department to view details
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Users View */
        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Primary Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Additional Departments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                  const primaryDept = user.departments.find((d) => d.isPrimary);
                  const additionalDepts = user.departments.filter((d) => !d.isPrimary);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{user.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        {primaryDept && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-sm rounded-full">
                            <Star className="w-3 h-3" />
                            {primaryDept.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {additionalDepts.map((dept) => (
                            <span
                              key={dept.id}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {dept.name}
                            </span>
                          ))}
                          {additionalDepts.length === 0 && (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded" title="Edit Departments">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Add Department">
                            <Plus className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Users to {selectedDepartment?.name}</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users to assign..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="max-h-60 overflow-auto space-y-2">
              {allUsers.slice(0, 10).map((user) => (
                <label
                  key={user.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" />
                      Primary
                    </label>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Assign Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Head Modal */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHeadModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Department Head</h3>
              <button onClick={() => setShowHeadModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select a user to be the head of {selectedDepartment?.name}</p>
            <div className="max-h-60 overflow-auto space-y-2">
              {(deptStaff || []).length > 0 ? (deptStaff || []).map((user) => (
                <button
                  key={user.id}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{user.fullName || user.username}</p>
                      <p className="text-sm text-gray-500">{user.role || 'Staff'}</p>
                    </div>
                  </div>
                  <Crown className="w-5 h-5 text-gray-300 hover:text-yellow-500" />
                </button>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">No staff in this department yet</p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowHeadModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDepartmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddDepartmentModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Department</h3>
              <button onClick={() => setShowAddDepartmentModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Emergency Department"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value, code: newDept.code || e.target.value.replace(/[^A-Z]/gi, '').substring(0, 5).toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Code *</label>
                <input
                  type="text"
                  placeholder="e.g., EMERG"
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Enter department description..."
                  value={newDept.description}
                  onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddDepartmentModal(false); setNewDept({ name: '', code: '', description: '' }); }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!newDept.name || !newDept.code || creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const facilityId = localStorage.getItem('glide_active_facility_id') || '';
                    await facilitiesService.departments.create(facilityId, {
                      name: newDept.name,
                      code: newDept.code,
                      description: newDept.description,
                    });
                    toast.success(`Department "${newDept.name}" created`);
                    setNewDept({ name: '', code: '', description: '' });
                    setShowAddDepartmentModal(false);
                    queryClient.invalidateQueries({ queryKey: ['departments'] });
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Failed to create department';
                    toast.error(msg);
                  } finally {
                    setCreating(false);
                  }
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}