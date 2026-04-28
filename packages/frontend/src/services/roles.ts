import api from './api';

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions?: Permission[];
  createdAt: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  isSystemRole?: boolean;
  parentRoleId?: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
}

export interface CreatePermissionDto {
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export const rolesService = {
  // List all roles
  list: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/roles');
    return response.data;
  },

  // Get role by ID with permissions
  getById: async (id: string): Promise<Role> => {
    const response = await api.get<Role>(`/roles/${id}`);
    return response.data;
  },

  // Create role
  create: async (data: CreateRoleDto): Promise<Role> => {
    const response = await api.post<Role>('/roles', data);
    return response.data;
  },

  // Update role
  update: async (id: string, data: UpdateRoleDto): Promise<Role> => {
    const response = await api.patch<Role>(`/roles/${id}`, data);
    return response.data;
  },

  // Delete role
  delete: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },

  // Clone a role (copies all directly-assigned permissions)
  clone: async (id: string, name: string, description?: string): Promise<Role> => {
    const response = await api.post<Role>(`/roles/${id}/clone`, { name, description });
    return response.data;
  },

  // Assign permission to role
  assignPermission: async (roleId: string, permissionId: string): Promise<void> => {
    await api.post(`/roles/${roleId}/permissions`, { permissionId });
  },

  // Remove permission from role
  removePermission: async (roleId: string, permissionId: string): Promise<void> => {
    await api.delete(`/roles/${roleId}/permissions/${permissionId}`);
  },

  // Update permissions for role (bulk)
  updatePermissions: async (roleId: string, permissions: Record<string, boolean>): Promise<void> => {
    await api.put(`/roles/${roleId}/permissions`, { permissions });
  },

  // Set parent role for inheritance
  setParentRole: async (roleId: string, parentRoleId: string | null): Promise<Role> => {
    const response = await api.patch<Role>(`/roles/${roleId}/parent`, { parentRoleId });
    return response.data;
  },

  // List all permissions
  listPermissions: async (module?: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>('/permissions', { params: module ? { module } : {} });
    return response.data;
  },
};

export const permissionsService = {
  list: async (module?: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>('/permissions', { params: module ? { module } : {} });
    return response.data;
  },
  create: async (data: CreatePermissionDto): Promise<Permission> => {
    const response = await api.post<Permission>('/permissions', data);
    return response.data;
  },
};

export interface PermissionGroup {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  permissionCount: number;
  assignedRoles: { id: string; name: string }[];
}

export const permissionGroupsService = {
  list: async (): Promise<PermissionGroup[]> => {
    const response = await api.get<PermissionGroup[]>('/permission-groups');
    return response.data;
  },
  getById: async (id: string): Promise<PermissionGroup> => {
    const response = await api.get<PermissionGroup>(`/permission-groups/${id}`);
    return response.data;
  },
  create: async (data: { name: string; description?: string; permissionIds?: string[] }): Promise<PermissionGroup> => {
    const response = await api.post<PermissionGroup>('/permission-groups', data);
    return response.data;
  },
  update: async (id: string, data: { name?: string; description?: string }): Promise<PermissionGroup> => {
    const response = await api.put<PermissionGroup>(`/permission-groups/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/permission-groups/${id}`);
  },
  setPermissions: async (id: string, permissionIds: string[]): Promise<PermissionGroup> => {
    const response = await api.put<PermissionGroup>(`/permission-groups/${id}/permissions`, { permissionIds });
    return response.data;
  },
  assignToRole: async (groupId: string, roleId: string): Promise<void> => {
    await api.post(`/permission-groups/${groupId}/roles/${roleId}`);
  },
  removeFromRole: async (groupId: string, roleId: string): Promise<void> => {
    await api.delete(`/permission-groups/${groupId}/roles/${roleId}`);
  },
};

export default { rolesService, permissionsService, permissionGroupsService };
