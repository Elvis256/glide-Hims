import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HrService } from './hr.service';

interface ApprovalCompletedEvent {
  documentRef: { module: string; documentType: string; documentId: string };
  tenantId?: string;
  actorUserId?: string;
  reason?: string;
}

/**
 * Bridges the cross-cutting Approvals engine to the HR LeaveRequest.
 * When the engine signals a leave approval is fully approved (or rejected),
 * we mark the LeaveRequest accordingly and apply balance side-effects.
 *
 * Approving a leave from the generic /approvals/inbox UI now Just Works
 * without HR needing its own approver UI.
 */
@Injectable()
export class HrApprovalListener {
  private readonly logger = new Logger(HrApprovalListener.name);
  constructor(private readonly hr: HrService) {}

  @OnEvent('approval.completed')
  async onCompleted(evt: ApprovalCompletedEvent) {
    if (!this.matches(evt)) return;
    try {
      await this.hr.finalizeLeaveFromApproval(
        evt.documentRef.documentId,
        evt.actorUserId,
        true,
      );
    } catch (e) {
      this.logger.warn(`Finalize leave failed: ${(e as Error).message}`);
    }
  }

  @OnEvent('approval.rejected')
  async onRejected(evt: ApprovalCompletedEvent) {
    if (!this.matches(evt)) return;
    try {
      await this.hr.finalizeLeaveFromApproval(
        evt.documentRef.documentId,
        evt.actorUserId,
        false,
        evt.reason,
      );
    } catch (e) {
      this.logger.warn(`Reject leave failed: ${(e as Error).message}`);
    }
  }

  private matches(evt: ApprovalCompletedEvent) {
    return (
      evt?.documentRef?.module === 'hr' &&
      evt?.documentRef?.documentType === 'leave' &&
      !!evt?.documentRef?.documentId
    );
  }
}
