import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  FinanceApprovalChain,
  FinanceApprovalStatus,
} from '../../database/entities/finance-approval-chain.entity';
import {
  JournalEntry,
  JournalStatus,
} from '../../database/entities/journal-entry.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { maxMoney } from '../../common/utils/money';

/**
 * Finance approval thresholds by amount.
 * Determines which roles must approve for a given entry amount.
 */
export const FINANCE_APPROVAL_THRESHOLDS = [
  {
    level: 1,
    role: 'Finance Officer',
    minAmount: 0,
    maxAmount: 10000,
    description: 'Finance Officer approval only',
  },
  {
    level: 2,
    role: 'Accounting Manager',
    minAmount: 10000,
    maxAmount: 50000,
    description: 'Accounting Manager must also approve',
  },
  {
    level: 3,
    role: 'Director',
    minAmount: 50000,
    maxAmount: 100000,
    description: 'Director must also approve',
  },
  {
    level: 4,
    role: 'CFO',
    minAmount: 100000,
    maxAmount: Number.POSITIVE_INFINITY,
    description: 'CFO approval required + justification',
  },
];

@Injectable()
export class FinanceApprovalService {
  private readonly logger = new Logger(FinanceApprovalService.name);

  constructor(
    @InjectRepository(FinanceApprovalChain)
    private readonly financeApprovalChainRepo: Repository<FinanceApprovalChain>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private requireTenant(tenantId: string | undefined | null): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }

  /**
   * Get required approvals for a given amount.
   */
  async getRequiredApprovalsForAmount(
    amount: number,
  ): Promise<Array<{ level: number; role: string }>> {
    const approvals: Array<{ level: number; role: string }> = [];

    // Compare in cents to avoid float-drift causing wrong-band routing.
    const amountCents = Math.round(amount * 100);
    for (const threshold of FINANCE_APPROVAL_THRESHOLDS) {
      const minCents = Math.round(threshold.minAmount * 100);
      const maxCents = Number.isFinite(threshold.maxAmount)
        ? Math.round(threshold.maxAmount * 100)
        : Number.POSITIVE_INFINITY;
      if (amountCents >= minCents && amountCents < maxCents) {
        for (let i = 1; i <= threshold.level; i++) {
          const level = FINANCE_APPROVAL_THRESHOLDS[i - 1];
          if (!approvals.find((a) => a.level === level.level)) {
            approvals.push({ level: level.level, role: level.role });
          }
        }
        break;
      }
    }

    if (approvals.length === 0) {
      // Amount exceeds all thresholds – all levels required.
      return FINANCE_APPROVAL_THRESHOLDS.map((t) => ({
        level: t.level,
        role: t.role,
      }));
    }

    return approvals;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────────────

  async submitForApproval(
    journalEntryId: string,
    userId: string,
    tenantId: string,
    facilityId: string,
    comments?: string,
  ): Promise<FinanceApprovalChain[]> {
    const tid = this.requireTenant(tenantId);
    if (!userId) {
      throw new ForbiddenException('User context required');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the JE row to prevent concurrent submit/approve/reject races.
      const entry = await manager
        .getRepository(JournalEntry)
        .createQueryBuilder('je')
        .setLock('pessimistic_write')
        .where('je.id = :id', { id: journalEntryId })
        .andWhere('je.tenant_id = :tid', { tid })
        .getOne();

      if (!entry) {
        throw new NotFoundException(
          `Journal entry ${journalEntryId} not found`,
        );
      }

      if (entry.status !== JournalStatus.DRAFT) {
        throw new BadRequestException(
          `Entry must be in DRAFT status to submit (current: ${entry.status})`,
        );
      }

      if (facilityId && entry.facilityId && entry.facilityId !== facilityId) {
        throw new ForbiddenException(
          'Journal entry belongs to a different facility',
        );
      }

      // Refuse to re-submit if a non-rejected approval chain already exists.
      const existingChain = await manager
        .getRepository(FinanceApprovalChain)
        .find({ where: { journalEntryId } });

      if (
        existingChain.some(
          (c) => c.status !== FinanceApprovalStatus.REJECTED,
        )
      ) {
        throw new BadRequestException(
          'Approval chain already exists for this entry',
        );
      }

      // Sprint-6: preserve the rejected chain as audit history. Instead
      // of deleting prior REJECTED rows, increment the attempt counter
      // so the new chain coexists with old ones under the
      // (journal_entry_id, approval_level, attempt) UNIQUE index.
      const nextAttempt = existingChain.length === 0
        ? 1
        : Math.max(...existingChain.map((c) => c.attempt ?? 1)) + 1;

      const amount = maxMoney(entry.totalDebit ?? 0, entry.totalCredit ?? 0);
      const requiredLevels = await this.getRequiredApprovalsForAmount(amount);

      const chainEntries = requiredLevels.map((lvl) =>
        manager.getRepository(FinanceApprovalChain).create({
          journalEntryId,
          tenantId: tid,
          facilityId: entry.facilityId,
          approvalLevel: lvl.level,
          attempt: nextAttempt,
          requiredRole: lvl.role,
          status: FinanceApprovalStatus.PENDING,
        }),
      );

      const savedChain = await manager
        .getRepository(FinanceApprovalChain)
        .save(chainEntries);

      entry.status = JournalStatus.SUBMITTED;
      entry.submittedByUserId = userId;
      entry.submittedAt = new Date();
      entry.approvalRequired = requiredLevels.length > 0;
      entry.approvalAmountThreshold = amount;

      await manager.getRepository(JournalEntry).save(entry);

      this.logAudit(
        'JOURNAL_ENTRY_SUBMITTED',
        journalEntryId,
        userId,
        tid,
        { amount, requiredLevels: requiredLevels.length, comments },
      );

      this.notifyFirstLevelApprovers(entry, requiredLevels[0], entry.facilityId);

      return savedChain;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pending lookup
  // ─────────────────────────────────────────────────────────────────────────

  async getPendingApprovalsForRole(
    role: string,
    facilityId: string,
    tenantId: string,
  ): Promise<
    Array<
      JournalEntry & {
        approvalChains: FinanceApprovalChain[];
        currentApprovalLevel: number;
      }
    >
  > {
    const tid = this.requireTenant(tenantId);
    if (!role) {
      return [];
    }

    const where: any = {
      tenantId: tid,
      requiredRole: role,
      status: FinanceApprovalStatus.PENDING,
    };
    if (facilityId) {
      where.facilityId = facilityId;
    }

    const pendingChains = await this.financeApprovalChainRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });

    if (pendingChains.length === 0) {
      return [];
    }

    const entryIds = Array.from(
      new Set(pendingChains.map((c) => c.journalEntryId)),
    );

    const entries = await this.journalEntryRepo.find({
      where: { id: In(entryIds), tenantId: tid },
    });

    const allChains = await this.financeApprovalChainRepo.find({
      where: { journalEntryId: In(entryIds), tenantId: tid },
      order: { approvalLevel: 'ASC' },
    });

    return entries
      .map((entry) => ({
        ...entry,
        approvalChains: allChains.filter((c) => c.journalEntryId === entry.id),
        currentApprovalLevel:
          pendingChains.find((c) => c.journalEntryId === entry.id)
            ?.approvalLevel || 0,
      }))
      .sort(
        (a, b) =>
          (a.submittedAt?.getTime() || 0) - (b.submittedAt?.getTime() || 0),
      );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approve
  // ─────────────────────────────────────────────────────────────────────────

  async approveAtLevel(
    journalEntryId: string,
    userId: string,
    userRole: string,
    tenantId: string,
    comments?: string,
  ): Promise<FinanceApprovalChain> {
    const tid = this.requireTenant(tenantId);
    if (!userId) {
      throw new ForbiddenException('User context required');
    }
    if (!userRole) {
      throw new ForbiddenException('Approver role required');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the journal entry first to serialise concurrent approvers.
      const entry = await manager
        .getRepository(JournalEntry)
        .createQueryBuilder('je')
        .setLock('pessimistic_write')
        .where('je.id = :id', { id: journalEntryId })
        .andWhere('je.tenant_id = :tid', { tid })
        .getOne();

      if (!entry) {
        throw new NotFoundException(
          `Journal entry ${journalEntryId} not found`,
        );
      }

      if (entry.status !== JournalStatus.SUBMITTED) {
        throw new BadRequestException(
          `Entry must be SUBMITTED to approve (current: ${entry.status})`,
        );
      }

      // Segregation of duties: preparer / submitter cannot approve their own entry.
      if (entry.submittedByUserId && entry.submittedByUserId === userId) {
        throw new ForbiddenException(
          'You cannot approve a journal entry you submitted',
        );
      }
      if (entry.createdById && entry.createdById === userId) {
        throw new ForbiddenException(
          'You cannot approve a journal entry you created',
        );
      }

      // Load the chain (also locked) for this role.
      // Versioned chain: filter to PENDING so we never pick up a row
      // from a rejected attempt (those are all REJECTED).
      const chainEntry = await manager
        .getRepository(FinanceApprovalChain)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.journal_entry_id = :id', { id: journalEntryId })
        .andWhere('c.tenant_id = :tid', { tid })
        .andWhere('c.required_role = :role', { role: userRole })
        .andWhere('c.status = :pending', {
          pending: FinanceApprovalStatus.PENDING,
        })
        .getOne();

      if (!chainEntry) {
        throw new NotFoundException(
          `No approval chain for entry ${journalEntryId} with role ${userRole}`,
        );
      }

      if (chainEntry.status !== FinanceApprovalStatus.PENDING) {
        throw new BadRequestException(
          `Approval already processed (status: ${chainEntry.status})`,
        );
      }

      // Out-of-order guard: every lower level must already be APPROVED.
      // Restrict to the CURRENT attempt — rejected attempts must not
      // bleed into the completeness evaluation of the new chain.
      const lowerLevels = await manager
        .getRepository(FinanceApprovalChain)
        .find({
          where: {
            journalEntryId,
            tenantId: tid,
            attempt: chainEntry.attempt,
          },
          order: { approvalLevel: 'ASC' },
        });

      const blocking = lowerLevels.find(
        (c) =>
          c.approvalLevel < chainEntry.approvalLevel &&
          c.status !== FinanceApprovalStatus.APPROVED,
      );
      if (blocking) {
        throw new BadRequestException(
          `Cannot approve level ${chainEntry.approvalLevel} while level ${blocking.approvalLevel} is ${blocking.status}`,
        );
      }

      // Reject duplicate approver across levels (one user shouldn't approve
      // multiple levels of the same entry).
      const alreadyApprovedByUser = lowerLevels.some(
        (c) =>
          c.id !== chainEntry.id &&
          c.status === FinanceApprovalStatus.APPROVED &&
          c.approvedById === userId,
      );
      if (alreadyApprovedByUser) {
        throw new ForbiddenException(
          'You have already approved a different level of this entry',
        );
      }

      chainEntry.status = FinanceApprovalStatus.APPROVED;
      chainEntry.approvedById = userId;
      chainEntry.approvedAt = new Date();
      chainEntry.comments = comments;

      await manager.getRepository(FinanceApprovalChain).save(chainEntry);

      // Recompute completeness — only consider the CURRENT attempt.
      const refreshed = await manager
        .getRepository(FinanceApprovalChain)
        .find({
          where: {
            journalEntryId,
            tenantId: tid,
            attempt: chainEntry.attempt,
          },
        });

      const allApproved = refreshed.every(
        (c) => c.status === FinanceApprovalStatus.APPROVED,
      );

      if (allApproved) {
        entry.status = JournalStatus.APPROVED;
        await manager.getRepository(JournalEntry).save(entry);
      }

      this.logAudit(
        'JOURNAL_ENTRY_APPROVED',
        journalEntryId,
        userId,
        tid,
        {
          approvalLevel: chainEntry.approvalLevel,
          role: userRole,
          allApproved,
          comments,
        },
      );

      if (!allApproved) {
        const nextChain = refreshed.find(
          (c) => c.approvalLevel === chainEntry.approvalLevel + 1,
        );
        if (nextChain) {
          this.notifyNextLevelApprover(entry, nextChain);
        }
      } else {
        this.notifyEntryReadyToPost(entry, userId);
      }

      return chainEntry;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reject
  // ─────────────────────────────────────────────────────────────────────────

  async rejectAtLevel(
    journalEntryId: string,
    userId: string,
    userRole: string,
    rejectionReason: string,
    tenantId: string,
  ): Promise<void> {
    const tid = this.requireTenant(tenantId);
    if (!userId) {
      throw new ForbiddenException('User context required');
    }
    if (!userRole) {
      throw new ForbiddenException('Approver role required');
    }
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      throw new BadRequestException('Rejection reason is required');
    }

    await this.dataSource.transaction(async (manager) => {
      const entry = await manager
        .getRepository(JournalEntry)
        .createQueryBuilder('je')
        .setLock('pessimistic_write')
        .where('je.id = :id', { id: journalEntryId })
        .andWhere('je.tenant_id = :tid', { tid })
        .getOne();

      if (!entry) {
        throw new NotFoundException(
          `Journal entry ${journalEntryId} not found`,
        );
      }

      if (entry.status !== JournalStatus.SUBMITTED) {
        throw new BadRequestException(
          `Entry must be SUBMITTED to reject (current: ${entry.status})`,
        );
      }

      if (entry.submittedByUserId && entry.submittedByUserId === userId) {
        throw new ForbiddenException(
          'You cannot reject a journal entry you submitted',
        );
      }

      const chainEntry = await manager
        .getRepository(FinanceApprovalChain)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.journal_entry_id = :id', { id: journalEntryId })
        .andWhere('c.tenant_id = :tid', { tid })
        .andWhere('c.required_role = :role', { role: userRole })
        .andWhere('c.status = :pending', {
          pending: FinanceApprovalStatus.PENDING,
        })
        .getOne();

      if (!chainEntry) {
        throw new NotFoundException(
          `No approval chain for entry ${journalEntryId} with role ${userRole}`,
        );
      }

      if (chainEntry.status !== FinanceApprovalStatus.PENDING) {
        throw new BadRequestException(
          `Cannot reject — already processed (status: ${chainEntry.status})`,
        );
      }

      chainEntry.status = FinanceApprovalStatus.REJECTED;
      chainEntry.approvedById = userId;
      chainEntry.approvedAt = new Date();
      chainEntry.rejectionReason = rejectionReason;
      await manager.getRepository(FinanceApprovalChain).save(chainEntry);

      // Mark all OTHER pending chains as REJECTED as well so the entry can
      // be re-submitted cleanly.
      await manager
        .getRepository(FinanceApprovalChain)
        .createQueryBuilder()
        .update()
        .set({
          status: FinanceApprovalStatus.REJECTED,
          rejectionReason,
        })
        .where('journal_entry_id = :id', { id: journalEntryId })
        .andWhere('tenant_id = :tid', { tid })
        .andWhere('status = :pending', {
          pending: FinanceApprovalStatus.PENDING,
        })
        .execute();

      entry.status = JournalStatus.DRAFT;
      await manager.getRepository(JournalEntry).save(entry);

      this.logAudit(
        'JOURNAL_ENTRY_REJECTED',
        journalEntryId,
        userId,
        tid,
        { approvalLevel: chainEntry.approvalLevel, role: userRole, rejectionReason },
      );

      this.notifyEntryRejected(entry, userRole, rejectionReason);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read-side helpers
  // ─────────────────────────────────────────────────────────────────────────

  async isReadyToPost(
    journalEntryId: string,
    tenantId: string,
  ): Promise<boolean> {
    const tid = this.requireTenant(tenantId);
    const entry = await this.journalEntryRepo.findOne({
      where: { id: journalEntryId, tenantId: tid },
    });
    if (!entry) {
      throw new NotFoundException(
        `Journal entry ${journalEntryId} not found`,
      );
    }
    return entry.status === JournalStatus.APPROVED;
  }

  async getApprovalHistory(
    journalEntryId: string,
    tenantId: string,
  ): Promise<FinanceApprovalChain[]> {
    const tid = this.requireTenant(tenantId);
    return this.financeApprovalChainRepo.find({
      where: { journalEntryId, tenantId: tid },
      relations: ['approvedBy'],
      order: { approvalLevel: 'ASC' },
    });
  }

  async getEscalationCandidates(
    facilityId: string,
    tenantId: string,
    daysPending: number = 5,
  ): Promise<JournalEntry[]> {
    const tid = this.requireTenant(tenantId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysPending);

    const qb = this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.tenant_id = :tid', { tid })
      .andWhere('je.status = :status', { status: JournalStatus.SUBMITTED })
      .andWhere('je.submitted_at <= :cutoffDate', { cutoffDate })
      .orderBy('je.submitted_at', 'ASC');

    if (facilityId) {
      qb.andWhere('je.facility_id = :facilityId', { facilityId });
    }
    return qb.getMany();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications / audit (placeholders kept for parity with prior callers)
  // ─────────────────────────────────────────────────────────────────────────

  private logAudit(
    action: string,
    entityId: string,
    userId: string,
    tenantId: string,
    details: any,
  ): void {
    this.logger.log(
      `[AUDIT] ${action} entity=${entityId} user=${userId} tenant=${tenantId}`,
    );
    // Fire-and-forget persistent audit row. Failure must not break the
    // business transaction (it has already committed by the time we get here).
    this.auditLogRepo
      .save(
        this.auditLogRepo.create({
          userId,
          tenantId,
          action,
          entityType: 'JournalEntry',
          entityId,
          newValue: details ?? null,
        }),
      )
      .catch((err) =>
        this.logger.warn(
          `Failed to persist audit row for ${action}/${entityId}: ${err?.message ?? err}`,
        ),
      );
  }

  private notifyFirstLevelApprovers(
    entry: JournalEntry,
    firstLevel: { level: number; role: string } | undefined,
    facilityId: string,
  ): void {
    if (!firstLevel) return;
    this.logger.debug(
      `[NOTIFY] L1 approvers for entry ${entry.id}: role=${firstLevel.role}, facility=${facilityId}`,
    );
  }

  private notifyNextLevelApprover(
    entry: JournalEntry,
    chainEntry: FinanceApprovalChain,
  ): void {
    this.logger.debug(
      `[NOTIFY] Next-level approver for entry ${entry.id}: level=${chainEntry.approvalLevel}, role=${chainEntry.requiredRole}`,
    );
  }

  private notifyEntryReadyToPost(
    entry: JournalEntry,
    approverUserId: string,
  ): void {
    this.logger.debug(
      `[NOTIFY] Entry ${entry.id} ready to post (final approver=${approverUserId})`,
    );
  }

  private notifyEntryRejected(
    entry: JournalEntry,
    rejectorRole: string,
    rejectionReason: string,
  ): void {
    this.logger.debug(
      `[NOTIFY] Entry ${entry.id} rejected by ${rejectorRole}: ${rejectionReason}`,
    );
  }
}
