import api from './api';

export interface DataVersion {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  changeType: 'create' | 'update' | 'delete';
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  changedBy: string;
  changedAt: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface PendingApproval {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  changeType: string;
  changedBy: string;
  changedAt: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  notes?: string;
}

export interface ApprovalRule {
  id: string;
  entityType: string;
  requiresApproval: boolean;
  minApprovers: number;
  approverRoles: string[];
  autoApproveMinorChanges: boolean;
  isActive: boolean;
  createdAt?: string;
}

export const mdmService = {
  versions: {
    list: async (params?: Record<string, any>): Promise<DataVersion[]> => {
      const response = await api.get('/mdm/versions', { params });
      return response.data?.data || response.data || [];
    },
    getById: async (id: string): Promise<DataVersion> => {
      const response = await api.get(`/mdm/versions/${id}`);
      return response.data;
    },
    getEntityVersions: async (entityType: string, entityId: string): Promise<DataVersion[]> => {
      const response = await api.get(`/mdm/entity/${entityType}/${entityId}/versions`);
      return response.data?.data || response.data || [];
    },
    compare: async (versionId1: string, versionId2: string): Promise<any> => {
      const response = await api.get(`/mdm/compare/${versionId1}/${versionId2}`);
      return response.data;
    },
  },
  approvals: {
    list: async (): Promise<PendingApproval[]> => {
      const response = await api.get('/mdm/pending-approvals');
      return response.data?.data || response.data || [];
    },
    approve: async (id: string, notes?: string): Promise<void> => {
      await api.put(`/mdm/versions/${id}/approve`, { notes });
    },
    reject: async (id: string, reason: string): Promise<void> => {
      await api.put(`/mdm/versions/${id}/reject`, { reason });
    },
  },
  rules: {
    list: async (): Promise<ApprovalRule[]> => {
      const response = await api.get('/mdm/approval-rules');
      return response.data?.data || response.data || [];
    },
    create: async (data: Partial<ApprovalRule>): Promise<ApprovalRule> => {
      const response = await api.post('/mdm/approval-rules', data);
      return response.data;
    },
    update: async (id: string, data: Partial<ApprovalRule>): Promise<ApprovalRule> => {
      const response = await api.put(`/mdm/approval-rules/${id}`, data);
      return response.data;
    },
  },
  getStatistics: async (): Promise<any> => {
    const response = await api.get('/mdm/statistics');
    return response.data;
  },
};
