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
  // HR fields (same record in users table)
  employeeNumber?: string;
  jobTitle?: string;
  staffCategory?: string;
  departmentId?: string;
  department?: { id: string; name: string } | null;
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

export interface EmployeeProfileDto {
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  jobTitle?: string;
  department?: string;
  staffCategory?: string;
  employmentType?: 'permanent' | 'contract' | 'temporary' | 'intern' | 'consultant';
  basicSalary?: number;
  licenseNumber?: string;
  specialization?: string;
  facilityId?: string;
  hireDate?: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone?: string;
  status?: 'active' | 'inactive';
  roleId?: string;
  facilityId?: string;
  employeeProfile?: EmployeeProfileDto;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'inactive' | 'suspended';
  departmentId?: string;
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

  // Employee link management
  backfillEmployees: async (): Promise<BackfillResult> => {
    const response = await api.post<{ message: string; data: BackfillResult } | BackfillResult>(
      '/users/backfill-employees'
    );
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as { message: string; data: BackfillResult }).data;
    }
    return response.data as BackfillResult;
  },

  listWithoutEmployee: async (
    params?: { search?: string; limit?: number; offset?: number }
  ): Promise<{ data: UnlinkedUser[]; meta: { total: number; limit: number; offset: number } }> => {
    const response = await api.get('/users/without-employee', { params });
    return response.data;
  },

  listUnlinkedEmployees: async (
    params?: { facilityId?: string; search?: string; limit?: number; offset?: number }
  ): Promise<{ data: UnlinkedEmployee[]; meta: { total: number; limit: number; offset: number } }> => {
    const response = await api.get('/users/employees/unlinked', { params });
    return response.data;
  },

  linkEmployee: async (userId: string, employeeId: string): Promise<UnlinkedEmployee> => {
    const response = await api.post<{ message: string; data: UnlinkedEmployee }>(
      `/users/${userId}/link-employee`,
      { employeeId }
    );
    return response.data?.data ?? (response.data as unknown as UnlinkedEmployee);
  },

  unlinkEmployee: async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}/unlink-employee`);
  },

  getLinkedEmployee: async (userId: string): Promise<UnlinkedEmployee | null> => {
    const response = await api.get<{ data: UnlinkedEmployee | null }>(`/users/${userId}/employee`);
    return response.data?.data ?? null;
  },

  // Activity logs
  activityLogs: {
    list: async (params?: { userId?: string; action?: string; module?: string; from?: string; to?: string }): Promise<ActivityLog[]> => {
      const response = await api.get<{ data: Array<{
        id: string;
        userId: string;
        user?: { username?: string; firstName?: string; lastName?: string };
        action: string;
        entityType: string;
        entityId?: string;
        ipAddress?: string;
        createdAt: string;
        oldValue?: Record<string, unknown>;
        newValue?: Record<string, unknown>;
      }>; total: number }>('/audit-logs', {
        params: {
          action: params?.action,
          entityType: params?.module,
          userId: params?.userId,
          startDate: params?.from,
          endDate: params?.to,
          limit: 200,
        },
      });
      const body = response.data as unknown as { data?: unknown[] } | unknown[];
      const logs = (Array.isArray(body) ? body : body?.data || []) as Array<{
        id: string; userId: string; user?: { username?: string; firstName?: string; lastName?: string };
        action: string; entityType: string; entityId?: string; ipAddress?: string; createdAt: string;
        oldValue?: Record<string, unknown>; newValue?: Record<string, unknown>;
      }>;
      return logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        userName: l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.username || 'System' : 'System',
        userRole: 'User',
        action: l.action.toLowerCase() as string,
        description: `${l.action} on ${l.entityType}${l.entityId ? ` (${l.entityId.substring(0, 8)}...)` : ''}`,
        module: l.entityType,
        ipAddress: l.ipAddress || 'N/A',
        timestamp: new Date(l.createdAt).toLocaleString(),
        details: l.newValue ? JSON.stringify(l.newValue).substring(0, 200) : undefined,
      }));
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

// Employee-link picker types
export interface UnlinkedUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface UnlinkedEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  departmentId?: string | null;
  facilityId?: string;
  status?: string;
}

export interface BackfillResult {
  created: number;
  skipped: number;
}

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
