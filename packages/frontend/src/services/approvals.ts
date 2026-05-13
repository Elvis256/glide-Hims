import { api } from './api';

export type ApprovalChainSource = 'policy' | 'default-manager-chain' | 'fallback';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

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
  quorumType?: string | null;
  quorumCount?: number | null;
  status: ApprovalStatus;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  comments: string | null;
  createdAt: string;
}

export interface DocumentRef {
  module: string;
  documentType: string;
  documentId: string;
}

export interface PreviewApprovalChainInput {
  module?: string;
  documentType: string;
  amount: number;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
  requesterId?: string;
}

export interface ApprovalActionRow {
  id: string;
  chainId: string;
  chainStepId: string | null;
  module: string;
  documentType: string;
  documentId: string;
  actorUserId: string | null;
  action: 'submit' | 'approve' | 'reject' | 'delegate' | 'escalate' | 'recall' | 'comment';
  comment: string | null;
  createdAt: string;
}

/** Preview an approval chain without persisting anything. */
export async function previewApprovalChain(
  input: PreviewApprovalChainInput,
): Promise<ApprovalChainPreviewResponse> {
  const { data } = await api.post('/approvals/preview', {
    module: 'procurement',
    ...input,
  });
  return data;
}

/** Read the persisted approval chain for any document. */
export async function getApprovalChain(ref: DocumentRef): Promise<ResolvedApprovalChainRow[]> {
  const { data } = await api.get('/approvals/chain', { params: ref });
  return data;
}

/** Approve a step. */
export async function approveStep(stepId: string, comment?: string) {
  const { data } = await api.post(`/approvals/steps/${stepId}/approve`, { comment });
  return data;
}

/** Reject a step (comment required). */
export async function rejectStep(stepId: string, comment: string) {
  const { data } = await api.post(`/approvals/steps/${stepId}/reject`, { comment });
  return data;
}

/** Recall the document (cancel all pending steps). */
export async function recallApproval(ref: DocumentRef) {
  const { data } = await api.post('/approvals/recall', ref);
  return data;
}

/** Audit trail. */
export async function listApprovalActions(ref: DocumentRef): Promise<ApprovalActionRow[]> {
  const { data } = await api.get('/approvals/actions', { params: ref });
  return data;
}
