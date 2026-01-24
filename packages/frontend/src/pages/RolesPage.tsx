import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Role, Permission } from '../types';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Shield,
  X,
  Check,
} from 'lucide-react';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Fetch roles
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles');
      return response.data as Role[];
    },
  });

  // Fetch permissions
  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const response = await api.get('/roles/permissions');
      return response.data as Permission[];
    },
  });

  // Fetch role permissions
  const { data: rolePermissions } = useQuery({
    queryKey: ['role-permissions', selectedRole?.id],
    queryFn: async () => {
      const response = await api.get(`/roles/${selectedRole?.id}/permissions`);
      return response.data as Permission[];
    },
    enabled: !!selectedRole,
  });

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => api.post('/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
    },
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (selectedRole?.id === editingRole?.id) {
        setSelectedRole(null);
      }
    },
  });

  // Toggle permission mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ roleId, permissionId, add }: { roleId: string; permissionId: string; add: boolean }) => {
      if (add) {
        return api.post(`/roles/${roleId}/permissions`, { permissionId });
      } else {
        return api.delete(`/roles/${roleId}/permissions/${permissionId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', selectedRole?.id] });
    },
  });

  const filteredRoles = roles?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const permissionsByModule = permissions?.reduce((acc, perm) => {
    const module = perm.code.split('.')[0];
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-gray-500 mt-1">Manage access control for your organization</p>
        </div>
        <button
          onClick={() => {
            setEditingRole(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roles List */}
        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : !filteredRoles?.length ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No roles found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRoles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRole?.id === role.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-gray-500">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRole(role);
                        setShowModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {role.name !== 'Super Admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this role?')) {
                            deleteMutation.mutate(role.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions Panel */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedRole ? `${selectedRole.name} - Permissions` : 'Select a Role'}
          </h3>

          {selectedRole ? (
            permissionsByModule && Object.keys(permissionsByModule).length ? (
              <div className="space-y-6">
                {Object.entries(permissionsByModule).map(([module, perms]) => (
                  <div key={module}>
                    <h4 className="text-sm font-medium text-gray-700 uppercase mb-2">
                      {module}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const hasPermission = rolePermissions?.some((p) => p.id === perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              hasPermission ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={hasPermission}
                              onChange={() => {
                                togglePermissionMutation.mutate({
                                  roleId: selectedRole.id,
                                  permissionId: perm.id,
                                  add: !hasPermission,
                                });
                              }}
                              className="sr-only"
                            />
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center ${
                                hasPermission ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              {hasPermission && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{perm.code}</p>
                              {perm.description && (
                                <p className="text-xs text-gray-500 truncate">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No permissions available</p>
            )
          ) : (
            <p className="text-gray-500 text-center py-8">
              Click on a role to manage its permissions
            </p>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <RoleModal
          role={editingRole}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editingRole) {
              api.patch(`/roles/${editingRole.id}`, data).then(() => {
                queryClient.invalidateQueries({ queryKey: ['roles'] });
                setShowModal(false);
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

interface RoleModalProps {
  role: Role | null;
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => void;
  isLoading: boolean;
}

function RoleModal({ role, onClose, onSave, isLoading }: RoleModalProps) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{role ? 'Edit Role' : 'Create Role'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : role ? (
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
