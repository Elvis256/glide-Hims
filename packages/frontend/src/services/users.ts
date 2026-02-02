import api from './api';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  roles?: Role[];
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface AssignRoleDto {
  roleId: string;
  facilityId?: string;
  departmentId?: string;
}

export interface UserPermission {
  id: string;
  userId: string;
  permissionId: string;
  grantedBy: string;
  grantedAt: string;
  notes?: string;
  permission: Permission;
}

export const usersService = {
  // List users
  list: async (params?: UserListParams): Promise<{ data: User[]; total: number }> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get user by ID
  getById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  // Create user
  create: async (data: CreateUserDto): Promise<User> => {
    const response = await api.post<{ message: string; data: User } | User>('/users', data);
    // Handle both { message, data } and direct User response formats
    if (response.data && 'data' in response.data) {
      return (response.data as { message: string; data: User }).data;
    }
    return response.data as User;
  },

  // Update user
  update: async (id: string, data: UpdateUserDto): Promise<User> => {
    const response = await api.patch<{ message: string; data: User } | User>(`/users/${id}`, data);
    // Handle both { message, data } and direct User response formats
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as { message: string; data: User }).data;
    }
    return response.data as User;
  },

  // Delete user (soft delete)
  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Assign role to user
  assignRole: async (userId: string, data: AssignRoleDto): Promise<void> => {
    await api.post(`/users/${userId}/roles`, data);
  },

  // Remove role from user
  removeRole: async (userId: string, roleId: string): Promise<void> => {
    await api.delete(`/users/${userId}/roles/${roleId}`);
  },

  // Activate user
  activate: async (id: string): Promise<User> => {
    const response = await api.post<User>(`/users/${id}/activate`);
    return response.data;
  },

  // Deactivate user
  deactivate: async (id: string): Promise<User> => {
    const response = await api.post<User>(`/users/${id}/deactivate`);
    return response.data;
  },

  // Activity logs
  activityLogs: {
    list: async (params?: { userId?: string; action?: string; module?: string; from?: string; to?: string }): Promise<ActivityLog[]> => {
      const response = await api.get<ActivityLog[]>('/users/activity-logs', { params });
      return response.data;
    },
  },

  // Direct user permissions
  permissions: {
    // Get direct permissions for a user
    get: async (userId: string): Promise<UserPermission[]> => {
      const response = await api.get<{ data: UserPermission[] }>(`/users/${userId}/permissions`);
      return response.data.data;
    },

    // Assign a permission directly to a user
    assign: async (userId: string, permissionId: string, notes?: string): Promise<UserPermission> => {
      const response = await api.post<{ data: UserPermission }>(`/users/${userId}/permissions`, {
        permissionId,
        notes,
      });
      return response.data.data;
    },

    // Remove a direct permission from a user
    remove: async (userId: string, permissionId: string): Promise<void> => {
      await api.delete(`/users/${userId}/permissions/${permissionId}`);
    },

    // Assign multiple permissions at once
    assignBulk: async (userId: string, permissionIds: string[]): Promise<UserPermission[]> => {
      const response = await api.post<{ data: UserPermission[] }>(`/users/${userId}/permissions/bulk`, {
        permissionIds,
      });
      return response.data.data;
    },

    // Remove all direct permissions from a user
    removeAll: async (userId: string): Promise<void> => {
      await api.delete(`/users/${userId}/permissions`);
    },
  },
};

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  action: string;
  description: string;
  module: string;
  ipAddress?: string;
  timestamp: string;
  details?: string;
}

export default usersService;
