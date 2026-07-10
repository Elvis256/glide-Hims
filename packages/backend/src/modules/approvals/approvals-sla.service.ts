import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalsService } from './approvals.service';
import { ProcurementApprovalChain } from '../../database/entities/procurement-approval-chain.entity';
import { ProcurementApprovalPolicyStep } from '../../database/entities/org-approval.entities';

/**
 * Scans every minute for approval steps whose SLA has elapsed but have not
 * yet been escalated, and calls ApprovalsService.escalate() on them.
 *
 * The escalation target is taken from the policy step (`escalate_to_user_id`)
 * if a matching policy can be found by `module/documentType + approvalLevel`;
 * otherwise the step is just flagged as escalated and an event is emitted so
 * subscribers can route the notification on their own.
 *
 * Disable in environments without a scheduler by setting
 * APPROVALS_SLA_CRON=off.
 */
@Injectable()
export class ApprovalsSlaService {
  private readonly logger = new Logger(ApprovalsSlaService.name);
  private readonly enabled = (process.env.APPROVALS_SLA_CRON || '').toLowerCase() !== 'off';

  constructor(
    private readonly approvals: ApprovalsService,
    @InjectRepository(ProcurementApprovalPolicyStep)
    private readonly stepRepo: Repository<ProcurementApprovalPolicyStep>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'approvals-sla-scan' })
  async scanForBreaches(): Promise<void> {
    if (!this.enabled) return;
    let breached: ProcurementApprovalChain[] = [];
    try {
      breached = await this.approvals.findBreachedSteps(50);
    } catch (e) {
      this.logger.warn(`SLA scan query failed: ${(e as Error).message}`);
      return;
    }
    if (breached.length === 0) return;
    this.logger.log(`SLA breach: ${breached.length} step(s) to escalate`);
    for (const step of breached) {
      try {
        const target = await this.lookupEscalationTarget(step);
        await this.approvals.escalate(step, target);
      } catch (e) {
        this.logger.error(`Escalation failed for step ${step.id}: ${(e as Error).message}`);
      }
    }
  }

  private async lookupEscalationTarget(step: ProcurementApprovalChain): Promise<string | null> {
    try {
      const row = await this.stepRepo
        .createQueryBuilder('s')
        .leftJoin('s.policy', 'p')
        .where('s.tenantId = :t', { t: step.tenantId })
        .andWhere('s.stepOrder = :lvl', { lvl: step.approvalLevel })
        .andWhere('s.escalateToUserId IS NOT NULL')
        .andWhere('p.documentType = :dt', { dt: step.documentType })
        .getOne();
      return row?.escalateToUserId || null;
    } catch {
      return null;
    }
  }
}
