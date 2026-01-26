import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { rolesService, permissionsService, type Role as APIRole } from '../../../services';

interface Permission {
  id: string;
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
}

const modules: Module[] = [
  {
    id: 'patients',
    name: 'Patient Management',
    permissions: [
      { id: 'patients.view', name: 'View Patients', description: 'View patient list and details' },
      { id: 'patients.create', name: 'Create Patients', description: 'Register new patients' },
      { id: 'patients.edit', name: 'Edit Patients', description: 'Modify patient information' },
      { id: 'patients.delete', name: 'Delete Patients', description: 'Remove patient records' },
    ],
  },
  {
    id: 'appointments',
    name: 'Appointments',
    permissions: [
      { id: 'appointments.view', name: 'View Appointments', description: 'View appointment schedule' },
      { id: 'appointments.create', name: 'Create Appointments', description: 'Book new appointments' },
      { id: 'appointments.manage', name: 'Manage Appointments', description: 'Reschedule or cancel appointments' },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Finance',
    permissions: [
      { id: 'billing.view', name: 'View Bills', description: 'View billing information' },
      { id: 'billing.create', name: 'Create Bills', description: 'Generate new bills' },
      { id: 'billing.collect', name: 'Collect Payments', description: 'Process payments' },
      { id: 'billing.refund', name: 'Issue Refunds', description: 'Process refunds' },
    ],
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    permissions: [
      { id: 'pharmacy.view', name: 'View Inventory', description: 'View pharmacy stock' },
      { id: 'pharmacy.dispense', name: 'Dispense Medications', description: 'Dispense prescribed medications' },
      { id: 'pharmacy.manage', name: 'Manage Inventory', description: 'Add or modify stock' },
    ],
  },
  {
    id: 'lab',
    name: 'Laboratory',
    permissions: [
      { id: 'lab.view', name: 'View Tests', description: 'View lab test orders' },
      { id: 'lab.results', name: 'Enter Results', description: 'Enter test results' },
      { id: 'lab.validate', name: 'Validate Results', description: 'Approve lab results' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    permissions: [
      { id: 'reports.view', name: 'View Reports', description: 'Access standard reports' },
      { id: 'reports.export', name: 'Export Data', description: 'Export report data' },
      { id: 'reports.admin', name: 'Admin Reports', description: 'Access administrative reports' },
    ],
  },
];

const mockRoles: Role[] = [
  { id: '1', name: 'Admin', description: 'Full system access', userCount: 3, isSystem: true, permissions: Object.fromEntries(modules.flatMap(m => m.permissions.map(p => [p.id, true]))) },
  { id: '2', name: 'Doctor', description: 'Medical staff with clinical access', userCount: 25, isSystem: true, permissions: { 'patients.view': true, 'patients.edit': true, 'appointments.view': true, 'appointments.manage': true, 'lab.view': true, 'lab.validate': true, 'pharmacy.view': true, 'reports.view': true } },
  { id: '3', name: 'Nurse', description: 'Nursing staff access', userCount: 40, isSystem: true, permissions: { 'patients.view': true, 'patients.edit': true, 'appointments.view': true, 'lab.view': true, 'pharmacy.view': true } },
  { id: '4', name: 'Receptionist', description: 'Front desk operations', userCount: 10, isSystem: true, permissions: { 'patients.view': true, 'patients.create': true, 'patients.edit': true, 'appointments.view': true, 'appointments.create': true, 'appointments.manage': true, 'billing.view': true, 'billing.create': true } },
  { id: '5', name: 'Pharmacist', description: 'Pharmacy operations', userCount: 8, isSystem: true, permissions: { 'patients.view': true, 'pharmacy.view': true, 'pharmacy.dispense': true, 'pharmacy.manage': true, 'billing.view': true } },
  { id: '6', name: 'Lab Tech', description: 'Laboratory technician', userCount: 12, isSystem: false, permissions: { 'patients.view': true, 'lab.view': true, 'lab.results': true } },
];

export default function RolePermissionsPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('1');
  const [expandedModules, setExpandedModules] = useState<string[]>(modules.map(m => m.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');

  // Fetch roles from API
  const { data: apiRoles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.list(),
    staleTime: 60000,
  });

  // Transform API data with fallback
  const roles: Role[] = useMemo(() => {
    if (!apiRoles) return [];
    return apiRoles.map((r: APIRole) => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      userCount: 0,
      isSystem: r.isSystemRole || false,
      permissions: r.permissions?.reduce((acc, p) => ({ ...acc, [p.name]: true }), {}) || {},
    }));
  }, [apiRoles]);

  const selectedRole = useMemo(() => 
    roles.find(r => r.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId]
  );

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: ({ roleId, permissionId, enabled }: { roleId: string; permissionId: string; enabled: boolean }) =>
      rolesService.updatePermissions(roleId, { [permissionId]: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const togglePermission = (permissionId: string) => {
    if (!selectedRole) return;
    const enabled = !selectedRole.permissions[permissionId];
    updatePermissionMutation.mutate({ roleId: selectedRole.id, permissionId, enabled });
  };

  const toggleAllModulePermissions = (moduleId: string) => {
    if (!selectedRole) return;
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    const allEnabled = module.permissions.every(p => selectedRole.permissions[p.id]);
    module.permissions.forEach(p => {
      updatePermissionMutation.mutate({ roleId: selectedRole.id, permissionId: p.id, enabled: !allEnabled });
    });
  };

  const filteredModules = useMemo(() => {
    if (!searchTerm) return modules;
    return modules.map(module => ({
      ...module,
      permissions: module.permissions.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    })).filter(m => m.permissions.length > 0);
  }, [searchTerm]);

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
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
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
                            ({module.permissions.filter(p => selectedRole.permissions[p.id]).length}/{module.permissions.length})
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
                          {module.permissions.map(permission => (
                            <label
                              key={permission.id}
                              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <div>
                                <span className="text-sm font-medium text-gray-900">{permission.name}</span>
                                <p className="text-xs text-gray-500">{permission.description}</p>
                              </div>
                              <button
                                onClick={() => togglePermission(permission.id)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${selectedRole.permissions[permission.id] ? 'bg-purple-600' : 'bg-gray-300'}`}
                              >
                                <span
                                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedRole.permissions[permission.id] ? 'translate-x-7' : 'translate-x-1'}`}
                                />
                              </button>
                            </label>
                          ))}
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
        ) : (
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
                            {role.permissions[permission.id] ? (
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
        )}
      </div>
    </div>
  );
}
