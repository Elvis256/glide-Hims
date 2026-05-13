import { api } from './api';

export type ApprovalChainSource = 'policy' | 'default-manager-chain' | 'fallback';

export interface ApprovalChainStep {
  approvalLevel: number;
  approverId: string | null;
  approverName: string | null;
  requiredRole: string;
  groupId: string | null;
  groupName: string | null;
  quorumType: 'any' | 'all' | 'majority' | 'm_of_n' | null;
  quorumCount: number | null;
}

export interface ApprovalChainPreviewResponse {
  source: ApprovalChainSource;
  policyId: string | null;
  policyName: string | null;
  steps: ApprovalChainStep[];
}

export interface ResolvedApprovalChainRow {
  id: string;
  approvalLevel: number;
  requiredRole: string;
  approverId: string | null;
  approverName: string | null;
  groupId: string | null;
  groupName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  comments: string | null;
  createdAt: string;
}

export interface PreviewApprovalChainInput {
  documentType: 'PR' | 'PO';
  amount: number;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
}

export async function previewApprovalChain(
  input: PreviewApprovalChainInput,
): Promise<ApprovalChainPreviewResponse> {
  const { data } = await api.post('/org-admin/approval/preview', input);
  return data;
}

export async function getPurchaseOrderApprovalChain(
  poId: string,
): Promise<ResolvedApprovalChainRow[]> {
  const { data } = await api.get(`/procurement/purchase-orders/${poId}/approval-chain`);
  return data;
}

export async function getPurchaseRequestApprovalChain(
  prId: string,
): Promise<ResolvedApprovalChainRow[]> {
  const { data } = await api.get(`/procurement/purchase-requests/${prId}/approval-chain`);
  return data;
}
