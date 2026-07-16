import api from './api';

// Mirrors MasterDataEntityType in master-data-version.entity.ts
export type MasterDataEntityType =
  | 'service'
  | 'service_category'
  | 'item'
  | 'lab_test'
  | 'imaging_modality'
  | 'diagnosis'
  | 'supplier'
  | 'insurance_provider'
  | 'chart_of_account'
  | 'membership_scheme'
  | 'role'
  | 'department'
  | 'unit'
  | 'provider';

export type VersionAction = 'create' | 'update' | 'delete' | 'restore' | 'approve' | 'reject';

// auto_approved is what a version gets when no approval rule requires review,
// so it is the common case — not an edge case.
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';

export const MASTER_DATA_ENTITY_TYPES: MasterDataEntityType[] = [
  'service',
  'service_category',
  'item',
  'lab_test',
  'imaging_modality',
  'diagnosis',
  'supplier',
  'insurance_provider',
  'chart_of_account',
  'membership_scheme',
  'role',
  'department',
  'unit',
  'provider',
];

export const ENTITY_TYPE_LABELS: Record<MasterDataEntityType, string> = {
  service: 'Service',
  service_category: 'Service Category',
  item: 'Item',
  lab_test: 'Lab Test',
  imaging_modality: 'Imaging Modality',
  diagnosis: 'Diagnosis',
  supplier: 'Supplier',
  insurance_provider: 'Insurance Provider',
  chart_of_account: 'Chart of Account',
  membership_scheme: 'Membership Scheme',
  role: 'Role',
  department: 'Department',
  unit: 'Unit',
  provider: 'Provider',
};

export const VERSION_ACTIONS: VersionAction[] = [
  'create',
  'update',
  'delete',
  'restore',
  'approve',
  'reject',
];

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'auto_approved',
];

export interface VersionUserRef {
  id: string;
  fullName?: string;
  username?: string;
}

export interface DataVersion {
  id: string;
  facilityId?: string;
  entityType: MasterDataEntityType;
  entityId: string;
  versionNumber: number;
  action: VersionAction;
  previousData?: Record<string, any>;
  currentData: Record<string, any>;
  changedFields?: string[];
  changeReason?: string;
  changedBy: string;
  changedByUser?: VersionUserRef;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedByUser?: VersionUserRef;
  approvedAt?: string;
  approvalNotes?: string;
  createdAt: string;
}

// /mdm/pending-approvals returns the same rows as /mdm/versions, but only the
// changedByUser relation is joined (an unapproved version has no approver).
export type PendingApproval = Omit<DataVersion, 'approvedByUser'>;

// Mirrors MasterDataVersionQueryDto. The endpoint has no filter for `action`
// — that one has to be applied client-side.
export interface VersionQuery {
  facilityId?: string;
  entityType?: MasterDataEntityType;
  entityId?: string;
  approvalStatus?: ApprovalStatus;
  fromDate?: string;
  toDate?: string;
}

export interface VersionComparison {
  version1: DataVersion;
  version2: DataVersion;
  differences: { field: string; value1: any; value2: any }[];
}

export interface ChangeStatistics {
  totalChanges: number;
  byEntityType: Record<string, number>;
  byAction: Record<string, number>;
  pendingApprovals: number;
}

export interface ApprovalRule {
  id: string;
  facilityId?: string;
  entityType: MasterDataEntityType;
  requiresApproval: boolean;
  approverRoleId?: string;
  minApprovers: number;
  notifyOnChange: boolean;
  notificationEmails?: string[];
  isActive: boolean;
  createdAt: string;
}

// Mirrors CreateApprovalRuleDto. `requiresApproval` now carries @IsOptional()
// @IsBoolean() (migration-free DTO fix), so it is accepted by the pipe again —
// and it is the ONLY field the approval engine reads, so a rule with
// requiresApproval:false gates nothing.
export interface CreateApprovalRuleInput {
  facilityId?: string;
  entityType: MasterDataEntityType;
  requiresApproval?: boolean;
  approverRoleId?: string;
  minApprovers?: number;
  notifyOnChange?: boolean;
  notificationEmails?: string[];
}

// PUT /mdm/approval-rules/:id takes Partial<CreateApprovalRuleDto>, which
// erases to Object, so ValidationPipe skips it and the body is Object.assign'd
// onto the rule. isActive:false is the only deactivation path — there is no
// DELETE route.
export type UpdateApprovalRuleInput = Partial<CreateApprovalRuleInput> & { isActive?: boolean };

export const mdmService = {
  versions: {
    list: async (params?: VersionQuery): Promise<DataVersion[]> => {
      const response = await api.get('/mdm/versions', { params });
      const data = response.data;
      return Array.isArray(data) ? data : (data?.data || []);
    },
    getById: async (id: string): Promise<DataVersion> => {
      const response = await api.get(`/mdm/versions/${id}`);
      return response.data;
    },
    getEntityVersions: async (
      entityType: MasterDataEntityType,
      entityId: string,
    ): Promise<DataVersion[]> => {
      const response = await api.get(`/mdm/entity/${entityType}/${entityId}/versions`);
      const data = response.data;
      return Array.isArray(data) ? data : (data?.data || []);
    },
    compare: async (versionId1: string, versionId2: string): Promise<VersionComparison> => {
      const response = await api.get(`/mdm/compare/${versionId1}/${versionId2}`);
      return response.data;
    },
  },
  approvals: {
    list: async (): Promise<PendingApproval[]> => {
      const response = await api.get('/mdm/pending-approvals');
      const data = response.data;
      return Array.isArray(data) ? data : (data?.data || []);
    },
    approve: async (id: string, approvalNotes?: string): Promise<void> => {
      await api.put(`/mdm/versions/${id}/approve`, { approvalNotes });
    },
    reject: async (id: string, reason: string): Promise<void> => {
      await api.put(`/mdm/versions/${id}/reject`, { reason });
    },
  },
  rules: {
    list: async (facilityId?: string): Promise<ApprovalRule[]> => {
      const response = await api.get('/mdm/approval-rules', {
        params: facilityId ? { facilityId } : undefined,
      });
      const data = response.data;
      return Array.isArray(data) ? data : (data?.data || []);
    },
    create: async (data: CreateApprovalRuleInput): Promise<ApprovalRule> => {
      const response = await api.post<{ message: string; data: ApprovalRule }>(
        '/mdm/approval-rules',
        data,
      );
      return response.data.data;
    },
    update: async (id: string, data: UpdateApprovalRuleInput): Promise<ApprovalRule> => {
      const response = await api.put<{ message: string; data: ApprovalRule }>(
        `/mdm/approval-rules/${id}`,
        data,
      );
      return response.data.data;
    },
  },
  getStatistics: async (params?: { facilityId?: string; days?: number }): Promise<ChangeStatistics> => {
    const response = await api.get('/mdm/statistics', { params });
    return response.data;
  },
};
