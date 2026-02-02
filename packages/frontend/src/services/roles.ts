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

  // List all permissions
  listPermissions: async (module?: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>('/permissions', { params: module ? { module } : {} });
    return response.data;
  },
};

export const permissionsService = {
  // List all permissions
  list: async (module?: string): Promise<Permission[]> => {
    const response = await api.get<Permission[]>('/permissions', { params: module ? { module } : {} });
    return response.data;
  },

  // Create permission
  create: async (data: CreatePermissionDto): Promise<Permission> => {
    const response = await api.post<Permission>('/permissions', data);
    return response.data;
  },
};

export default { rolesService, permissionsService };
