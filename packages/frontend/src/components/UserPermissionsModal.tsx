import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Shield, Search, Plus, Trash2, Loader2, Check, AlertCircle, Key } from 'lucide-react';
import { usersService, type User, type UserPermission } from '../services/users';
import { rolesService, type Permission } from '../services/roles';

interface UserPermissionsModalProps {
  user: User;
  onClose: () => void;
}

export default function UserPermissionsModal({ user, onClose }: UserPermissionsModalProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [addingPermissionId, setAddingPermissionId] = useState<string | null>(null);

  // Fetch user's direct permissions
  const { data: userPermissions, isLoading: loadingUserPerms } = useQuery({
    queryKey: ['user-permissions', user.id],
    queryFn: () => usersService.permissions.get(user.id),
  });

  // Fetch all available permissions
  const { data: allPermissions, isLoading: loadingPerms } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesService.listPermissions(),
  });

  // Get unique modules for filtering
  const modules = useMemo(() => {
    if (!allPermissions) return [];
    const mods = [...new Set(allPermissions.map((p: Permission) => p.module || 'other'))];
    return mods.sort();
  }, [allPermissions]);

  // Filter permissions not already assigned
  const availablePermissions = useMemo(() => {
    if (!allPermissions || !userPermissions) return [];
    const assignedIds = new Set(userPermissions.map((up: UserPermission) => up.permissionId));
    return allPermissions
      .filter((p: Permission) => !assignedIds.has(p.id))
      .filter((p: Permission) => {
        if (selectedModule !== 'all' && p.module !== selectedModule) return false;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return p.code.toLowerCase().includes(term) || 
                 p.name.toLowerCase().includes(term);
        }
        return true;
      });
  }, [allPermissions, userPermissions, searchTerm, selectedModule]);

  // Assign permission mutation
  const assignMutation = useMutation({
    mutationFn: ({ permissionId }: { permissionId: string }) => 
      usersService.permissions.assign(user.id, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
      setAddingPermissionId(null);
    },
  });

  // Remove permission mutation
  const removeMutation = useMutation({
    mutationFn: (permissionId: string) => 
      usersService.permissions.remove(user.id, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
    },
  });

  // Remove all permissions mutation
  const removeAllMutation = useMutation({
    mutationFn: () => usersService.permissions.removeAll(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Manage Direct Permissions</h2>
              <p className="text-sm text-gray-500">
                {user.fullName} (@{user.username})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Current permissions panel */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="p-3 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-700">
                  Direct Permissions ({userPermissions?.length || 0})
                </h3>
                {userPermissions && userPermissions.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Remove all direct permissions from this user?')) {
                        removeAllMutation.mutate();
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                    disabled={removeAllMutation.isPending}
                  >
                    Remove All
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                These permissions are in addition to role-based permissions
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loadingUserPerms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : !userPermissions || userPermissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Shield className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm">No direct permissions assigned</p>
                  <p className="text-xs">Add permissions from the right panel</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userPermissions.map((up: UserPermission) => (
                    <div
                      key={up.id}
                      className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {up.permission.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs text-gray-500 bg-white px-1 rounded">
                            {up.permission.code}
                          </code>
                          <span className="text-xs text-gray-400">
                            {up.permission.module}
                          </span>
                        </div>
                        {up.notes && (
                          <p className="text-xs text-gray-500 mt-1 truncate" title={up.notes}>
                            Note: {up.notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeMutation.mutate(up.permissionId)}
                        disabled={removeMutation.isPending}
                        className="p-1 text-red-500 hover:bg-red-100 rounded flex-shrink-0"
                        title="Remove permission"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available permissions panel */}
          <div className="w-1/2 flex flex-col">
            <div className="p-3 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-700 mb-2">Available Permissions</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Modules</option>
                  {modules.map((mod: string) => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {loadingPerms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : availablePermissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm">No matching permissions</p>
                  <p className="text-xs">Try a different search or module</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availablePermissions.map((perm: Permission) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {perm.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-500">
                            {perm.code}
                          </code>
                          <span className="text-xs text-gray-400">
                            {perm.module}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setAddingPermissionId(perm.id);
                          assignMutation.mutate({ permissionId: perm.id });
                        }}
                        disabled={assignMutation.isPending && addingPermissionId === perm.id}
                        className="p-1.5 text-purple-600 hover:bg-purple-100 rounded flex-shrink-0"
                        title="Add permission"
                      >
                        {assignMutation.isPending && addingPermissionId === perm.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500">
            Direct permissions allow fine-grained access control beyond roles
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
