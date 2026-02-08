import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Role, Facility } from '../types';
import type { User as ServiceUser } from '../services/users';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  UserPlus,
  X,
  CheckCircle,
  XCircle,
  Key,
  Shield,
} from 'lucide-react';
import UserPermissionsModal from '../components/UserPermissionsModal';

// Local User type that matches API response
interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  status: string;
  roles?: Array<{ roleId?: string; id?: string; role?: { name: string } }>;
  lastLoginAt?: string;
  createdAt?: string;
}

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roleId?: string;
  facilityId?: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await api.get(`/users?${params}`);
      return response.data as User[];
    },
  });

  // Fetch roles for assignment
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles');
      return response.data as Role[];
    },
  });

  // Fetch facilities for assignment
  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const response = await api.get('/facilities');
      return response.data as Facility[];
    },
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateUserData) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowModal(false);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Toggle user status
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      api.patch(`/users/${id}/${activate ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

        {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !users?.length ? (
          <div className="text-center py-12">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {user.fullName?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.username}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.roles && user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((ur: any) => (
                            <span
                              key={ur.roleId || ur.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                            >
                              <Shield className="w-3 h-3" />
                              {ur.role?.name || ur.name || 'Unknown'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No role</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : user.status === 'locked'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {user.status === 'active' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPermissionsUser(user)}
                          className="p-1 text-gray-400 hover:text-purple-600"
                          title="Manage Permissions"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            toggleStatusMutation.mutate({
                              id: user.id,
                              activate: user.status !== 'active',
                            });
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {user.status === 'active' ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this user?')) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          roles={roles || []}
          facilities={facilities || []}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editingUser) {
              api.patch(`/users/${editingUser.id}`, data).then(() => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowModal(false);
              });
            } else {
              createMutation.mutate(data as CreateUserData);
            }
          }}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Permissions Modal */}
      {permissionsUser && (
        <UserPermissionsModal
          user={permissionsUser as unknown as ServiceUser}
          onClose={() => setPermissionsUser(null)}
        />
      )}
    </div>
  );
}

interface UserModalProps {
  user: User | null;
  roles: Role[];
  facilities: Facility[];
  onClose: () => void;
  onSave: (data: Partial<CreateUserData>) => void;
  isLoading: boolean;
}

function UserModal({ user, roles, facilities, onClose, onSave, isLoading }: UserModalProps) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    password: '',
    roleId: (user?.roles && user.roles.length > 0) ? (user.roles[0]?.roleId || user.roles[0]?.id || '') : '',
    facilityId: '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {user ? 'Edit User' : 'Create User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user && (
          <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Users must be linked to an employee record. 
              Create the employee in <a href="/hr" className="text-blue-600 underline">HR &amp; Payroll</a> first, 
              then link the user account.
            </p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data: Partial<CreateUserData> = {
              username: formData.username,
              email: formData.email,
              fullName: formData.fullName,
              phone: formData.phone || undefined,
              roleId: formData.roleId || undefined,
              facilityId: formData.facilityId || undefined,
            };
            if (!user && formData.password) {
              (data as CreateUserData).password = formData.password;
            }
            onSave(data);
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input"
              required
              disabled={!!user}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="input"
              required={!user}
            >
              <option value="">Select a role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              The role determines base permissions
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facility <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.facilityId}
              onChange={(e) => setFormData({ ...formData, facilityId: e.target.value })}
              className="input"
              required={!user}
            >
              <option value="">Select a facility...</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Where this user will work
            </p>
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                required
                minLength={6}
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : user ? (
                'Update'
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
