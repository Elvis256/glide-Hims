import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  ChevronDown,
  Check,
  Filter,
  MoreHorizontal,
  Mail,
  Shield,
  Building2,
  Loader2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Trash2,
  Key,
  UserCog,
  Lock,
  Unlock,
} from 'lucide-react';
import { usersService, type User, type CreateUserDto, type UpdateUserDto } from '../../../services/users';
import { rolesService, type Role } from '../../../services/roles';

// Fallback mock data when API is unavailable
const fallbackUsers: User[] = [
  { id: '1', username: 'admin', fullName: 'System Administrator', email: 'admin@hospital.com', roles: [{ id: '1', name: 'Admin', isSystemRole: true }], status: 'active', lastLoginAt: '2024-01-15T09:30:00Z', createdAt: '' },
  { id: '2', username: 'dr.smith', fullName: 'Dr. John Smith', email: 'j.smith@hospital.com', roles: [{ id: '2', name: 'Doctor', isSystemRole: false }], status: 'active', lastLoginAt: '2024-01-15T08:45:00Z', createdAt: '' },
  { id: '3', username: 'nurse.jane', fullName: 'Jane Williams', email: 'j.williams@hospital.com', roles: [{ id: '3', name: 'Nurse', isSystemRole: false }], status: 'active', lastLoginAt: '2024-01-15T07:00:00Z', createdAt: '' },
];

const departments = ['All Departments', 'IT', 'Cardiology', 'Emergency', 'Pharmacy', 'Front Desk', 'Laboratory', 'Pediatrics', 'ICU', 'Radiology', 'Finance'];

export default function UserListPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserDto>({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateUserDto & { newPassword?: string }>({
    fullName: '',
    email: '',
    phone: '',
  });
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Fetch users from API
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', searchTerm],
    queryFn: () => usersService.list({ search: searchTerm || undefined }),
    staleTime: 30000,
  });

  // Fetch roles for filter
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.list(),
    staleTime: 60000,
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: string }) => {
      if (currentStatus === 'active') {
        return usersService.deactivate(userId);
      }
      return usersService.activate(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserDto) => {
      const user = await usersService.create(data);
      // Assign role if selected
      if (selectedRoleId) {
        await usersService.assignRole(user.id, { roleId: selectedRoleId });
      }
      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddModal(false);
      setNewUser({ username: '', password: '', fullName: '', email: '', phone: '' });
      setSelectedRoleId('');
    },
  });

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.email) {
      alert('Please fill all required fields');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data, roleId }: { userId: string; data: UpdateUserDto; roleId?: string }) => {
      const updatedUser = await usersService.update(userId, data);
      // If role changed, update it
      if (roleId && editingUser) {
        const currentRoleId = editingUser.roles?.[0]?.id;
        if (currentRoleId !== roleId) {
          // Remove old role if exists
          if (currentRoleId) {
            try {
              await usersService.removeRole(userId, currentRoleId);
            } catch (e) {
              // Ignore if role removal fails
            }
          }
          // Assign new role
          await usersService.assignRole(userId, { roleId });
        }
      }
      return updatedUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowEditModal(false);
      setEditingUser(null);
      setEditFormData({ fullName: '', email: '', phone: '' });
      setEditRoleId('');
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
    });
    setEditRoleId(user.roles?.[0]?.id || '');
    setShowEditModal(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser || !editFormData.fullName || !editFormData.email) {
      alert('Please fill all required fields');
      return;
    }
    const updateData: UpdateUserDto = {
      fullName: editFormData.fullName,
      email: editFormData.email,
      phone: editFormData.phone,
    };
    if (editFormData.newPassword) {
      updateData.password = editFormData.newPassword;
    }
    updateUserMutation.mutate({ userId: editingUser.id, data: updateData, roleId: editRoleId });
  };

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await usersService.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      await usersService.update(userId, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setNewPassword('');
      alert('Password reset successfully');
    },
  });

  // Bulk actions
  const handleBulkActivate = async () => {
    for (const userId of selectedUsers) {
      await usersService.activate(userId);
    }
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setSelectedUsers([]);
  };

  const handleBulkDeactivate = async () => {
    for (const userId of selectedUsers) {
      await usersService.deactivate(userId);
    }
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setSelectedUsers([]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)?`)) return;
    for (const userId of selectedUsers) {
      await usersService.delete(userId);
    }
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setSelectedUsers([]);
  };

  const handleViewUser = (user: User) => {
    setViewingUser(user);
    setShowViewModal(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setShowResetPasswordModal(true);
  };

  const users = usersData?.data || fallbackUsers;
  const totalUsers = usersData?.total || users.length;
  const rolesList = ['All Roles', ...(rolesData?.map((r: Role) => r.name) || ['Admin', 'Doctor', 'Nurse', 'Pharmacist'])];

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const userRole = user.roles?.[0]?.name || '';
      const matchesRole = selectedRole === 'All Roles' || userRole === selectedRole;
      const matchesDept = selectedDepartment === 'All Departments'; // Department filtering would need department field
      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, searchTerm, selectedRole, selectedDepartment]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">
              {isLoading ? 'Loading...' : `${totalUsers} total users`}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Role Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowRoleDropdown(!showRoleDropdown); setShowDeptDropdown(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
          >
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{selectedRole}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showRoleDropdown && (
            <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {rolesList.map((role) => (
                <button
                  key={role}
                  onClick={() => { setSelectedRole(role); setShowRoleDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {role}
                  {selectedRole === role && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Department Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowDeptDropdown(!showDeptDropdown); setShowRoleDropdown(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
          >
            <Building2 className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{selectedDepartment}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {showDeptDropdown && (
            <div className="absolute top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {departments.map((dept) => (
                <button
                  key={dept}
                  onClick={() => { setSelectedDepartment(dept); setShowDeptDropdown(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {dept}
                  {selectedDepartment === dept && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm">More Filters</span>
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700 font-medium">{selectedUsers.length} user(s) selected</span>
          <button 
            onClick={handleBulkActivate}
            className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
          >
            <UserCheck className="w-4 h-4" />
            Activate
          </button>
          <button 
            onClick={handleBulkDeactivate}
            className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1"
          >
            <UserX className="w-4 h-4" />
            Deactivate
          </button>
          <button 
            onClick={handleBulkDelete}
            className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button 
            onClick={() => setSelectedUsers([])}
            className="text-sm text-gray-600 hover:text-gray-800 ml-auto"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleAllUsers}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Full Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500 mt-2">Loading users...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                    <p className="text-sm text-red-600 mt-2">Failed to load users. Using cached data.</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{user.username}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      <Shield className="w-3 h-3" />
                      {user.roles?.[0]?.name || 'No Role'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">—</span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{formatDate(user.lastLoginAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-1 hover:bg-gray-100 rounded" 
                        title="Edit"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button 
                        className="p-1 hover:bg-gray-100 rounded" 
                        title="View Details"
                        onClick={() => handleViewUser(user)}
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button 
                        className="p-1 hover:bg-gray-100 rounded" 
                        title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleStatusMutation.mutate({ userId: user.id, currentStatus: user.status })}
                      >
                        {user.status === 'active' ? (
                          <Lock className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Unlock className="w-4 h-4 text-green-500" />
                        )}
                      </button>
                      <div className="relative">
                        <button 
                          className="p-1 hover:bg-gray-100 rounded"
                          onClick={() => setShowActionsMenu(showActionsMenu === user.id ? null : user.id)}
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-500" />
                        </button>
                        {showActionsMenu === user.id && (
                          <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={() => { handleResetPassword(user); setShowActionsMenu(null); }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Key className="w-4 h-4 text-gray-500" />
                              Reset Password
                            </button>
                            <button
                              onClick={() => { handleEditUser(user); setShowActionsMenu(null); }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <UserCog className="w-4 h-4 text-gray-500" />
                              Change Role
                            </button>
                            <hr className="my-1" />
                            <button
                              onClick={() => { handleDeleteUser(user); setShowActionsMenu(null); }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {filteredUsers.length} of {totalUsers} users
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">Previous</button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded">1</button>
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">2</button>
            <button className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-100">Next</button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Add New User</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Dr. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., dr.john"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="john@hospital.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newUser.phone || ''}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+256..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a role</option>
                  {rolesData?.map((role: Role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              {createUserMutation.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {(createUserMutation.error as Error).message || 'Failed to create user'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editingUser.username}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editFormData.newPassword || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Role</option>
                  {rolesData?.map((role: Role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              {updateUserMutation.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {(updateUserMutation.error as Error).message || 'Failed to update user'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {updateUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {showViewModal && viewingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">User Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{viewingUser.fullName}</h3>
                  <p className="text-gray-500">@{viewingUser.username}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="text-sm text-gray-900">{viewingUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                    <p className="text-sm text-gray-900">{viewingUser.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Role</p>
                    <p className="text-sm text-gray-900">{viewingUser.roles?.[0]?.name || 'No Role'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                    {getStatusBadge(viewingUser.status)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Last Login</p>
                    <p className="text-sm text-gray-900">{formatDate(viewingUser.lastLoginAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
                    <p className="text-sm text-gray-900">{formatDate(viewingUser.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => { setShowViewModal(false); handleEditUser(viewingUser); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{userToDelete.fullName}</strong> (@{userToDelete.username})? 
                This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete User
                </button>
              </div>
              {deleteUserMutation.error && (
                <p className="text-sm text-red-600 mt-4">
                  {(deleteUserMutation.error as Error).message || 'Failed to delete user'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Reset Password</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-4">
                Set a new password for <strong>{resetPasswordUser.fullName}</strong> (@{resetPasswordUser.username})
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {resetPasswordMutation.error && (
                <p className="text-sm text-red-600 mt-4">
                  {(resetPasswordMutation.error as Error).message || 'Failed to reset password'}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPassword.length < 8) {
                    alert('Password must be at least 8 characters');
                    return;
                  }
                  resetPasswordMutation.mutate({ userId: resetPasswordUser.id, password: newPassword });
                }}
                disabled={resetPasswordMutation.isPending || !newPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
