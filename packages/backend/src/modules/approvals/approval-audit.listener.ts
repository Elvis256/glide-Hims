import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from '../compliance/audit.service';

interface ApprovalEventPayload {
  documentRef: { module: string; documentType: string; documentId: string };
  chainStepId?: string;
  approvalLevel?: number;
  actorUserId?: string;
  reason?: string;
  tenantId?: string;
  source?: string;
  stepCount?: number;
}

/**
 * Streams approval lifecycle events into the compliance AuditService so the
 * existing audit_log timeline keeps showing approval activity even though
 * the workflow now lives in the cross-cutting ApprovalsService.
 *
 * For now only procurement (PR/PO) entity types are written, since
 * AuditService.entityType is currently constrained to those. Other modules
 * already have a complete audit trail via the polymorphic
 * `approval_actions` table.
 */
@Injectable()
export class ApprovalAuditListener {
  private readonly logger = new Logger(ApprovalAuditListener.name);

  constructor(private readonly audit: AuditService) {}

  private entityTypeFor(ref: ApprovalEventPayload['documentRef']) {
    if (ref.module !== 'procurement') return null;
    if (ref.documentType === 'PR') return 'PURCHASE_REQUEST' as const;
    if (ref.documentType === 'PO') return 'PURCHASE_ORDER' as const;
    if (ref.documentType === 'GRN') return 'GOODS_RECEIPT' as const;
    return null;
  }

  @OnEvent('approval.submitted')
  async onSubmitted(p: ApprovalEventPayload) {
    const entityType = this.entityTypeFor(p.documentRef);
    if (!entityType || !p.actorUserId) return;
    await this.safe(() =>
      this.audit.logAction({
        action: 'SUBMIT',
        entityType,
        entityId: p.documentRef.documentId,
        userId: p.actorUserId!,
        tenantId: p.tenantId,
        metadata: { approvalLevel: p.stepCount, comments: `chain source=${p.source}` },
      }),
    );
  }

  @OnEvent('approval.step.approved')
  async onStepApproved(p: ApprovalEventPayload) {
    const entityType = this.entityTypeFor(p.documentRef);
    if (!entityType || !p.actorUserId) return;
    await this.safe(() =>
      this.audit.logAction({
        action: 'APPROVE',
        entityType,
        entityId: p.documentRef.documentId,
        userId: p.actorUserId!,
        tenantId: p.tenantId,
        metadata: { approvalLevel: p.approvalLevel },
      }),
    );
  }

  @OnEvent('approval.step.rejected')
  async onStepRejected(p: ApprovalEventPayload) {
    const entityType = this.entityTypeFor(p.documentRef);
    if (!entityType || !p.actorUserId) return;
    await this.safe(() =>
      this.audit.logAction({
        action: 'REJECT',
        entityType,
        entityId: p.documentRef.documentId,
        userId: p.actorUserId!,
        tenantId: p.tenantId,
        metadata: { approvalLevel: p.approvalLevel, comments: p.reason },
      }),
    );
  }

  private async safe(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e: any) {
      this.logger.warn(`Approval audit listener failed: ${e?.message || e}`);
    }
  }
}
