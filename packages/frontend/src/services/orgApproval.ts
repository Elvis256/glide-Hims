/**
 * Backwards-compat shim. The cross-cutting Approvals client is now at
 * `services/approvals.ts`. New code should import from there. This shim
 * keeps existing call sites in components compiling during the rollout.
 */
import {
  previewApprovalChain as previewApprovalChainGeneric,
  getApprovalChain,
  PreviewApprovalChainInput,
  ApprovalChainPreviewResponse,
  ResolvedApprovalChainRow,
} from './approvals';

export type {
  ApprovalChainSource,
  ApprovalChainStep,
  ApprovalChainPreviewResponse,
  ResolvedApprovalChainRow,
} from './approvals';

export interface LegacyPreviewApprovalChainInput {
  documentType: 'PR' | 'PO';
  amount: number;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
}

export async function previewApprovalChain(
  input: LegacyPreviewApprovalChainInput,
): Promise<ApprovalChainPreviewResponse> {
  return previewApprovalChainGeneric({ module: 'procurement', ...input } as PreviewApprovalChainInput);
}

export async function getPurchaseOrderApprovalChain(
  poId: string,
): Promise<ResolvedApprovalChainRow[]> {
  return getApprovalChain({ module: 'procurement', documentType: 'PO', documentId: poId });
}

export async function getPurchaseRequestApprovalChain(
  prId: string,
): Promise<ResolvedApprovalChainRow[]> {
  return getApprovalChain({ module: 'procurement', documentType: 'PR', documentId: prId });
}
