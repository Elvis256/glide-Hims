import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Users,
  Lock,
  Unlock,
  Copy,
  Search,
  Loader2,
  Package,
  Settings,
} from 'lucide-react';
import { rolesService, permissionsService, permissionGroupsService, type Role as APIRole, type Permission as APIPermission, type PermissionGroup as APIPermissionGroup } from '../../../services';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface Module {
  id: string;
  name: string;
  permissions: Permission[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  isSystem: boolean;
  permissions: Record<string, boolean>;
  parentRoleName: string | null;
  parentRoleId: string | null;
  directPermissionCodes: string[];
  inheritedPermissionCodes: string[];
  directPermissionCount: number;
  inheritedPermissionCount: number;
}

// Format module name from code like "patients" -> "Patient Management"
const formatModuleName = (module: string): string => {
  const moduleNames: Record<string, string> = {
    admin: 'Administration',
    analytics: 'Analytics & Dashboard',
    appointments: 'Appointments',
    assets: 'Asset Management',
    attendance: 'Attendance',
    audit: 'Audit & Logging',
    billing: 'Billing & Finance',
    chronic: 'Chronic Care',
    'clinical-notes': 'Clinical Notes',
    'clinical_notes': 'Clinical Notes',
    dashboard: 'Dashboard',
    diagnoses: 'Diagnoses',
    discharge: 'Discharge',
    disposal: 'Disposal',
    'doctor-duty': 'Doctor Duty Roster',
    emergency: 'Emergency',
    employees: 'Employees',
    encounters: 'Encounters',
    facilities: 'Facility Management',
    finance: 'Finance & Accounting',
    followups: 'Follow-ups',
    hr: 'Human Resources',
    insurance: 'Insurance',
    inventory: 'Inventory',
    ipd: 'In-Patient (IPD)',
    lab: 'Laboratory',
    leave: 'Leave Management',
    maternity: 'Maternity',
    mdm: 'Master Data',
    membership: 'Membership',
    notifications: 'Notifications',
    nursing: 'Nursing',
    orders: 'Orders',
    patients: 'Patient Management',
    payroll: 'Payroll',
    pharmacy: 'Pharmacy',
    prescriptions: 'Prescriptions',
    problems: 'Problem List',
    procurement: 'Procurement',
    providers: 'Providers',
    queue: 'Queue Management',
    radiology: 'Radiology',
    referrals: 'Referrals',
    reports: 'Reports & Analytics',
    roles: 'Role Management',
    schedules: 'Schedules',
    services: 'Services',
    settings: 'Settings',
    stores: 'Stores',
    'supplier-returns': 'Supplier Returns',
    suppliers: 'Suppliers',
    surgery: 'Surgery',
    sync: 'Data Sync',
    tenants: 'Tenant Management',
    theatre: 'Theatre/Operating Room',
    'treatment-plans': 'Treatment Plans',
    users: 'User Management',
    vitals: 'Vitals',
  };
  return moduleNames[module] || module.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};



export default function RolePermissionsPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'matrix' | 'groups'>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', parentRoleId: '' });
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupPermissionSearch, setGroupPermissionSearch] = useState('');

  // Fetch roles from API
  const { data: apiRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.list(),
    staleTime: 60000,
  });

  // Fetch permissions from API
  const { data: apiPermissions, isLoading: permsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsService.list(),
    staleTime: 60000,
  });

  // Fetch permission groups
  const { data: permissionGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => permissionGroupsService.list(),
    staleTime: 60000,
  });

  // Permission group mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => permissionGroupsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['permission-groups'] }); setShowCreateGroupModal(false); setNewGroup({ name: '', description: '' }); toast.success('Permission group created'); },
    onError: () => toast.error('Failed to create group'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => permissionGroupsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['permission-groups'] }); toast.success('Group deleted'); },
    onError: () => toast.error('Failed to delete group'),
  });

  const setGroupPermissionsMutation = useMutation({
    mutationFn: ({ groupId, permissionIds }: { groupId: string; permissionIds: string[] }) => permissionGroupsService.setPermissions(groupId, permissionIds),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['permission-groups'] }); toast.success('Group permissions updated'); },
    onError: () => toast.error('Failed to update group permissions'),
  });

  const assignGroupToRoleMutation = useMutation({
    mutationFn: ({ groupId, roleId }: { groupId: string; roleId: string }) => permissionGroupsService.assignToRole(groupId, roleId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['permission-groups'] }); queryClient.invalidateQueries({ queryKey: ['roles'] }); toast.success('Group assigned to role'); },
    onError: () => toast.error('Failed to assign group'),
  });

  const removeGroupFromRoleMutation = useMutation({
    mutationFn: ({ groupId, roleId }: { groupId: string; roleId: string }) => permissionGroupsService.removeFromRole(groupId, roleId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['permission-groups'] }); queryClient.invalidateQueries({ queryKey: ['roles'] }); toast.success('Group removed from role'); },
    onError: () => toast.error('Failed to remove group'),
  });

  // Group permissions by module
  const modules: Module[] = useMemo(() => {
    if (!apiPermissions) return [];
    const grouped: Record<string, Permission[]> = {};
    apiPermissions.forEach((p: APIPermission) => {
      const mod = p.module || 'other';
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description || '',
      });
    });
    return Object.entries(grouped).map(([id, permissions]) => ({
      id,
      name: formatModuleName(id),
      permissions,
    }));
  }, [apiPermissions]);

  // Flat permissions list for group editor
  const allPermissions: Permission[] = useMemo(() => {
    return modules.flatMap(m => m.permissions);
  }, [modules]);

  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  
  // Expand all modules when they load
  React.useEffect(() => {
    if (modules.length > 0 && expandedModules.length === 0) {
      setExpandedModules(modules.map(m => m.id));
    }
  }, [modules]);

  // Transform API data with fallback
  const roles: Role[] = useMemo(() => {
    if (!apiRoles) return [];
    return apiRoles.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      userCount: r.userCount || 0,
      isSystem: r.isSystemRole || false,
      permissions: r.permissions?.reduce((acc: Record<string, boolean>, p: any) => ({ ...acc, [p.code]: true }), {}) || {},
      parentRoleName: r.parentRoleName || null,
      parentRoleId: r.parentRoleId || null,
      directPermissionCodes: r.directPermissionCodes || [],
      inheritedPermissionCodes: r.inheritedPermissionCodes || [],
      directPermissionCount: r.directPermissionCount || 0,
      inheritedPermissionCount: r.inheritedPermissionCount || 0,
    }));
  }, [apiRoles]);

  const isLoading = rolesLoading || permsLoading;

  const selectedRole = useMemo(() => 
    roles.find(r => r.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId]
  );

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: ({ roleId, permissionCode, enabled }: { roleId: string; permissionCode: string; enabled: boolean }) =>
      rolesService.updatePermissions(roleId, { [permissionCode]: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      rolesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateModal(false);
      setNewRole({ name: '', description: '', parentRoleId: '' });
    },
  });

  const handleCreateRole = () => {
    if (!newRole.name.trim()) return;
    createRoleMutation.mutate(newRole);
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const togglePermission = (permissionCode: string) => {
    if (!selectedRole) return;
    const enabled = !selectedRole.permissions[permissionCode];
    updatePermissionMutation.mutate({ roleId: selectedRole.id, permissionCode, enabled });
  };

  const toggleAllModulePermissions = (moduleId: string) => {
    if (!selectedRole) return;
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    const allEnabled = module.permissions.every(p => selectedRole.permissions[p.code]);
    module.permissions.forEach(p => {
      updatePermissionMutation.mutate({ roleId: selectedRole.id, permissionCode: p.code, enabled: !allEnabled });
    });
  };

  const filteredModules = useMemo(() => {
    if (!searchTerm) return modules;
    return modules.map(module => ({
      ...module,
      permissions: module.permissions.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    })).filter(m => m.permissions.length > 0);
  }, [searchTerm, modules]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role & Permissions</h1>
            <p className="text-sm text-gray-500">Manage system roles and access control</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-4 py-2 text-sm ${viewMode === 'matrix' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Matrix View
            </button>
            <button
              onClick={() => setViewMode('groups')}
              className={`px-4 py-2 text-sm ${viewMode === 'groups' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <span className="flex items-center gap-1"><Package className="w-3 h-3" /> Groups</span>
            </button>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Roles List */}
        <div className="w-80 bg-white rounded-lg border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">System Roles</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedRole?.id === role.id ? 'bg-purple-50 border-l-4 border-l-purple-600' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {role.isSystem ? (
                      <Lock className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Unlock className="w-4 h-4 text-green-500" />
                    )}
                    <span className="font-medium text-gray-900">{role.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {role.userCount}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                {role.parentRoleName && (
                  <p className="text-xs text-purple-500 mt-1">
                    ↳ inherits from <span className="font-medium">{role.parentRoleName}</span>
                  </p>
                )}
                {role.inheritedPermissionCount > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {role.directPermissionCount} direct + {role.inheritedPermissionCount} inherited
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Panel */}
        {viewMode === 'list' ? (
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
            {selectedRole ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedRole.name} Permissions</h2>
                    <p className="text-sm text-gray-500">{selectedRole.description}</p>
                    {selectedRole.parentRoleName && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Inherits from {selectedRole.parentRoleName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {selectedRole.directPermissionCount} direct · {selectedRole.inheritedPermissionCount} inherited
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded" title="Duplicate Role">
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded" title="Edit Role">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    {!selectedRole.isSystem && (
                      <button className="p-2 hover:bg-gray-100 rounded" title="Delete Role">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search permissions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {filteredModules.map(module => (
                    <div key={module.id} className="mb-4">
                      <button
                        onClick={() => toggleModule(module.id)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {expandedModules.includes(module.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{module.name}</span>
                          <span className="text-xs text-gray-500">
                            ({module.permissions.filter(p => selectedRole.permissions[p.code]).length}/{module.permissions.length})
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAllModulePermissions(module.id); }}
                          className="text-xs text-purple-600 hover:text-purple-800"
                        >
                          Toggle All
                        </button>
                      </button>
                      {expandedModules.includes(module.id) && (
                        <div className="ml-6 mt-2 space-y-2">
                          {module.permissions.map(permission => {
                            const isInherited = selectedRole.inheritedPermissionCodes.includes(permission.code);
                            const isEnabled = selectedRole.permissions[permission.code];
                            return (
                            <label
                              key={permission.id}
                              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${isInherited ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{permission.name}</span>
                                  {isInherited && (
                                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">inherited</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{permission.description || permission.code}</p>
                              </div>
                              {isInherited && !selectedRole.directPermissionCodes.includes(permission.code) ? (
                                <div className="relative w-12 h-6 rounded-full bg-purple-400 cursor-not-allowed opacity-60" title="Inherited from parent role">
                                  <span className="absolute top-1 w-4 h-4 bg-white rounded-full translate-x-7" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => togglePermission(permission.code)}
                                  className={`relative w-12 h-6 rounded-full transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                                >
                                  <span
                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-7' : 'translate-x-1'}`}
                                  />
                                </button>
                              )}
                            </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a role to view permissions
              </div>
            )}
          </div>
        ) : viewMode === 'matrix' ? (
          /* Matrix View */
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50 z-10">Permission</th>
                  {roles.map(role => (
                    <th key={role.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[100px]">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modules.map(module => (
                  <React.Fragment key={module.id}>
                    <tr className="bg-gray-50">
                      <td colSpan={roles.length + 1} className="px-4 py-2 font-semibold text-gray-700">
                        {module.name}
                      </td>
                    </tr>
                    {module.permissions.map(permission => (
                      <tr key={permission.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white">
                          {permission.name}
                        </td>
                        {roles.map(role => (
                          <td key={role.id} className="px-4 py-2 text-center">
                            {role.permissions[permission.code] ? (
                              <Check className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-gray-300 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Groups View */
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Permission Groups</h2>
                <p className="text-sm text-gray-500">Bundle permissions into reusable groups and assign them to roles</p>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                New Group
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {groupsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : !permissionGroups?.length ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No permission groups yet</p>
                  <p className="text-sm text-gray-400">Create groups to bundle related permissions together</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {permissionGroups.map(group => (
                    <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{group.name}</h3>
                          {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="Edit permissions"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this group?')) deleteGroupMutation.mutate(group.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {group.permissionCount || group.permissions?.length || 0} permissions
                        </span>
                        {group.assignedRoles?.map(role => (
                          <span key={role.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            {role.name}
                            <button
                              onClick={() => removeGroupFromRoleMutation.mutate({ groupId: group.id, roleId: role.id })}
                              className="hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {/* Assign to role dropdown */}
                      <div className="flex items-center gap-2 mb-2">
                        <select
                          className="text-sm border border-gray-200 rounded px-2 py-1 flex-1"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignGroupToRoleMutation.mutate({ groupId: group.id, roleId: e.target.value });
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">Assign to role...</option>
                          {roles
                            .filter(r => !group.assignedRoles?.some(ar => ar.id === r.id))
                            .map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))
                          }
                        </select>
                      </div>
                      {/* Expandable permission editor */}
                      {editingGroup === group.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="mb-2">
                            <input
                              type="text"
                              placeholder="Search permissions..."
                              value={groupPermissionSearch}
                              onChange={(e) => setGroupPermissionSearch(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded px-3 py-1.5"
                            />
                          </div>
                          <div className="max-h-60 overflow-auto space-y-1">
                            {allPermissions
                              .filter(p => !groupPermissionSearch || p.name.toLowerCase().includes(groupPermissionSearch.toLowerCase()) || p.code.toLowerCase().includes(groupPermissionSearch.toLowerCase()))
                              .map(p => {
                                const isInGroup = group.permissions?.some(gp => gp.id === p.id);
                                return (
                                  <label key={p.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isInGroup}
                                      onChange={() => {
                                        const currentIds = (group.permissions || []).map(gp => gp.id);
                                        const newIds = isInGroup
                                          ? currentIds.filter(id => id !== p.id)
                                          : [...currentIds, p.id];
                                        setGroupPermissionsMutation.mutate({ groupId: group.id, permissionIds: newIds });
                                      }}
                                      className="rounded border-gray-300 text-purple-600"
                                    />
                                    <span className="text-sm text-gray-700">{p.name}</span>
                                    <span className="text-xs text-gray-400 ml-auto">{p.code}</span>
                                  </label>
                                );
                              })
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create New Role</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Lab Technician"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the role's responsibilities"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inherits From (optional)</label>
                <select
                  value={newRole.parentRoleId}
                  onChange={(e) => setNewRole(prev => ({ ...prev, parentRoleId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No parent role</option>
                  {roles.filter(r => r.name !== 'Super Admin').map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Child role will inherit all permissions from the parent role</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={!newRole.name.trim() || createRoleMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createRoleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Role
              </button>
            </div>
            {createRoleMutation.isError && (
              <p className="text-sm text-red-600 mt-2">Failed to create role. Please try again.</p>
            )}
          </div>
        </div>
      )}

      {/* Create Permission Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Permission Group</h2>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Reception Bundle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., All permissions needed for front desk"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateGroupModal(false)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => createGroupMutation.mutate({ name: newGroup.name, description: newGroup.description || undefined })}
                disabled={!newGroup.name.trim() || createGroupMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createGroupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
