import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  InAppNotification,
  InAppNotificationType,
} from '../../database/entities/in-app-notification.entity';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction } from '../../database/entities/approval-action.entity';
import { ApprovalsService } from './approvals.service';

interface ApprovalEvent {
  documentRef: { module: string; documentType: string; documentId: string };
  chainId?: string;
  chainStepId?: string;
  tenantId?: string;
  actorUserId?: string;
  escalateToUserId?: string | null;
  reason?: string;
}

/**
 * Cross-module notifier: turns approval lifecycle events into in-app
 * notifications for the affected users. Uses InAppNotificationType.GENERAL
 * with structured `metadata` so existing UIs render correctly without an
 * enum migration; longer-term we can add an APPROVAL_PENDING enum value.
 */
@Injectable()
export class ApprovalsNotifier {
  private readonly logger = new Logger(ApprovalsNotifier.name);

  constructor(
    @InjectRepository(InAppNotification)
    private readonly notifRepo: Repository<InAppNotification>,
    @InjectRepository(ProcurementApprovalChain)
    private readonly chainRepo: Repository<ProcurementApprovalChain>,
    @InjectRepository(ApprovalAction)
    private readonly actionRepo: Repository<ApprovalAction>,
    private readonly approvals: ApprovalsService,
  ) {}

  @OnEvent('approval.submitted')
  async onSubmitted(evt: ApprovalEvent) {
    try {
      const firstStep = await this.chainRepo.findOne({
        where: { id: evt.chainId } as any,
      });
      if (!firstStep) return;
      const userIds = await this.approvals.resolvePotentialApprovers(firstStep);
      await this.fanOut(userIds, {
        tenantId: evt.tenantId || firstStep.tenantId,
        title: this.titleFor(evt.documentRef, 'Approval needed'),
        message: `An approval has been requested on ${evt.documentRef.module}/${evt.documentRef.documentType}.`,
        ref: evt.documentRef,
        stepId: firstStep.id,
        kind: 'pending',
      });
    } catch (e) {
      this.logger.warn(`onSubmitted notify failed: ${(e as Error).message}`);
    }
  }

  @OnEvent('approval.step.escalated')
  async onEscalated(evt: ApprovalEvent) {
    try {
      if (!evt.chainStepId) return;
      const step = await this.chainRepo.findOne({ where: { id: evt.chainStepId } as any });
      if (!step) return;
      const targets = new Set<string>();
      const orig = await this.approvals.resolvePotentialApprovers(step);
      for (const u of orig) targets.add(u);
      if (evt.escalateToUserId) targets.add(evt.escalateToUserId);
      await this.fanOut([...targets], {
        tenantId: evt.tenantId || step.tenantId,
        title: this.titleFor(evt.documentRef, 'Approval escalated (SLA breached)'),
        message: `Step ${step.approvalLevel} on ${evt.documentRef.module}/${evt.documentRef.documentType} has breached its SLA.`,
        ref: evt.documentRef,
        stepId: step.id,
        kind: 'escalated',
      });
    } catch (e) {
      this.logger.warn(`onEscalated notify failed: ${(e as Error).message}`);
    }
  }

  @OnEvent('approval.completed')
  async onCompleted(evt: ApprovalEvent) {
    await this.notifyRequester(evt, 'Approval completed', 'Your request has been fully approved.');
  }

  @OnEvent('approval.rejected')
  async onRejected(evt: ApprovalEvent) {
    await this.notifyRequester(
      evt,
      'Approval rejected',
      `Your request was rejected${evt.reason ? `: ${evt.reason}` : '.'}`,
    );
  }

  private async notifyRequester(evt: ApprovalEvent, title: string, message: string) {
    try {
      const submitAction = await this.actionRepo.findOne({
        where: {
          module: evt.documentRef.module,
          documentType: evt.documentRef.documentType,
          documentId: evt.documentRef.documentId,
          action: 'submit',
        } as any,
      });
      const requesterId = submitAction?.actorUserId;
      if (!requesterId) return;
      await this.fanOut([requesterId], {
        tenantId: evt.tenantId,
        title: this.titleFor(evt.documentRef, title),
        message,
        ref: evt.documentRef,
        kind: title.toLowerCase().includes('reject') ? 'rejected' : 'completed',
      });
    } catch (e) {
      this.logger.warn(`notifyRequester failed: ${(e as Error).message}`);
    }
  }

  private titleFor(ref: ApprovalEvent['documentRef'], prefix: string) {
    return `${prefix} — ${ref.documentType} ${ref.documentId.slice(0, 8)}`;
  }

  private async fanOut(
    userIds: string[],
    args: {
      tenantId?: string;
      title: string;
      message: string;
      ref: ApprovalEvent['documentRef'];
      stepId?: string;
      kind: string;
    },
  ) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return;
    const rows = unique.map((uid) =>
      this.notifRepo.create({
        tenantId: args.tenantId,
        targetUserId: uid,
        type: InAppNotificationType.GENERAL,
        title: args.title,
        message: args.message,
        metadata: {
          approvalKind: args.kind,
          module: args.ref.module,
          documentType: args.ref.documentType,
          documentId: args.ref.documentId,
          chainStepId: args.stepId || null,
          link: `/approvals/inbox`,
        },
      }),
    );
    try {
      await this.notifRepo.save(rows);
    } catch (e) {
      this.logger.warn(`fanOut save failed: ${(e as Error).message}`);
    }
  }
}
