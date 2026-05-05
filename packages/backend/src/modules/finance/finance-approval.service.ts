import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceApprovalChain, FinanceApprovalStatus } from '../../database/entities/finance-approval-chain.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';

/**
 * Finance approval thresholds by amount
 * Determines which roles must approve for a given entry amount
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
    maxAmount: Infinity,
    description: 'CFO approval required + justification',
  },
];

@Injectable()
export class FinanceApprovalService {
  constructor(
    @InjectRepository(FinanceApprovalChain)
    private readonly financeApprovalChainRepo: Repository<FinanceApprovalChain>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
  ) {}

  /**
   * Get required approvals for a given amount
   * Returns array of approval levels needed
   */
  async getRequiredApprovalsForAmount(
    amount: number,
  ): Promise<Array<{ level: number; role: string }>> {
    const approvals: Array<{ level: number; role: string }> = [];

    for (const threshold of FINANCE_APPROVAL_THRESHOLDS) {
      if (amount >= threshold.minAmount && amount < threshold.maxAmount) {
        // Include this level and all lower levels
        for (let i = 1; i <= threshold.level; i++) {
          const level = FINANCE_APPROVAL_THRESHOLDS[i - 1];
          if (!approvals.find((a) => a.level === level.level)) {
            approvals.push({
              level: level.level,
              role: level.role,
            });
          }
        }
        break;
      }
    }

    // Fallback: if amount exceeds all thresholds, include all levels
    if (approvals.length === 0) {
      return FINANCE_APPROVAL_THRESHOLDS.map((t) => ({
        level: t.level,
        role: t.role,
      }));
    }

    return approvals;
  }

  /**
   * Submit entry for approval
   * Creates approval chain entries based on amount
   * Updates entry status to SUBMITTED
   */
  async submitForApproval(
    journalEntryId: string,
    userId: string,
    tenantId: string,
    facilityId: string,
    comments?: string,
  ): Promise<FinanceApprovalChain[]> {
    // Fetch journal entry
    const entry = await this.journalEntryRepo.findOne({
      where: { id: journalEntryId },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${journalEntryId} not found`);
    }

    if (entry.status !== JournalStatus.DRAFT) {
      throw new BadRequestException(
        `Entry must be in DRAFT status to submit (current: ${entry.status})`,
      );
    }

    // Calculate total amount (absolute value of debits and credits)
    const amount = Math.max(entry.totalDebit, entry.totalCredit);

    // Get required approval levels for this amount
    const requiredLevels = await this.getRequiredApprovalsForAmount(amount);

    // Create approval chain entries (one per required level)
    const approvalChainEntries: FinanceApprovalChain[] = [];

    for (const levelRequired of requiredLevels) {
      const chainEntry = this.financeApprovalChainRepo.create({
        journalEntryId,
        tenantId,
        facilityId,
        approvalLevel: levelRequired.level,
        requiredRole: levelRequired.role,
        status: FinanceApprovalStatus.PENDING,
      });

      approvalChainEntries.push(chainEntry);
    }

    // Save all approval chain entries
    const savedChain = await this.financeApprovalChainRepo.save(approvalChainEntries);

    // Update journal entry status to SUBMITTED
    entry.status = JournalStatus.SUBMITTED;
    entry.submittedByUserId = userId;
    entry.submittedAt = new Date();
    entry.approvalRequired = requiredLevels.length > 0;
    entry.approvalAmountThreshold = amount;

    await this.journalEntryRepo.save(entry);

    // Audit log (async, non-blocking)
    this.logAudit('JOURNAL_ENTRY_SUBMITTED', journalEntryId, userId, tenantId, {
      amount,
      requiredLevels: requiredLevels.length,
      comments,
    });

    // Send notifications to first level approvers (async, non-blocking)
    this.notifyFirstLevelApprovers(entry, requiredLevels[0], facilityId);

    return savedChain;
  }

  /**
   * Get pending approvals for a specific role and facility
   */
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
    // Find all approval chain entries for this role that are pending
    const pendingChains = await this.financeApprovalChainRepo.find({
      where: {
        facilityId,
        requiredRole: role,
        status: FinanceApprovalStatus.PENDING,
      },
      relations: ['journalEntry'],
      order: { createdAt: 'ASC' },
    });

    if (pendingChains.length === 0) {
      return [];
    }

    // Get unique journal entry IDs
    const entryIds = [...new Set(pendingChains.map((c) => c.journalEntryId))];

    // Fetch full entries with all their approval chains
    const entries = await this.journalEntryRepo.find({
      where: {
        id: Object.assign({}, ...entryIds.map((id) => ({ id }))),
      },
    });

    // Fetch all approval chains for these entries
    const allChains = await this.financeApprovalChainRepo.find({
      where: {
        journalEntryId: Object.assign({}, ...entryIds.map((id) => ({ journalEntryId: id }))),
      },
      order: { approvalLevel: 'ASC' },
    });

    // Map chains to entries
    return entries
      .map((entry) => ({
        ...entry,
        approvalChains: allChains.filter((c) => c.journalEntryId === entry.id),
        currentApprovalLevel: pendingChains.find((c) => c.journalEntryId === entry.id)?.approvalLevel || 0,
      }))
      .sort((a, b) => (a.submittedAt?.getTime() || 0) - (b.submittedAt?.getTime() || 0));
  }

  /**
   * Approve entry at current level
   * If all levels approved, updates entry to APPROVED
   * Otherwise, entry stays SUBMITTED
   */
  async approveAtLevel(
    journalEntryId: string,
    userId: string,
    userRole: string,
    tenantId: string,
    comments?: string,
  ): Promise<FinanceApprovalChain> {
    // Get the approval chain entry for this role
    const chainEntry = await this.financeApprovalChainRepo.findOne({
      where: {
        journalEntryId,
        requiredRole: userRole,
      },
      relations: ['journalEntry'],
    });

    if (!chainEntry) {
      throw new NotFoundException(
        `No approval chain found for entry ${journalEntryId} with role ${userRole}`,
      );
    }

    if (chainEntry.status !== FinanceApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Approval already processed (current status: ${chainEntry.status})`,
      );
    }

    // Mark this level as approved
    chainEntry.status = FinanceApprovalStatus.APPROVED;
    chainEntry.approvedById = userId;
    chainEntry.approvedAt = new Date();
    chainEntry.comments = comments;

    await this.financeApprovalChainRepo.save(chainEntry);

    // Check if all levels are approved
    const allChains = await this.financeApprovalChainRepo.find({
      where: { journalEntryId },
    });

    const allApproved = allChains.every((c) => c.status === FinanceApprovalStatus.APPROVED);

    // If all approved, update entry status
    const entry = await this.journalEntryRepo.findOne({ where: { id: journalEntryId } });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${journalEntryId} not found after approval`);
    }

    if (allApproved) {
      entry.status = JournalStatus.APPROVED;
    }

    await this.journalEntryRepo.save(entry);

    // Audit log (async, non-blocking)
    this.logAudit('JOURNAL_ENTRY_APPROVED', journalEntryId, userId, tenantId, {
      approvalLevel: chainEntry.approvalLevel,
      role: userRole,
      allApproved,
      comments,
    });

    // Notify next level approver if not all approved
    if (!allApproved) {
      const nextLevel = chainEntry.approvalLevel + 1;
      const nextChain = allChains.find((c) => c.approvalLevel === nextLevel);
      if (nextChain) {
        this.notifyNextLevelApprover(entry, nextChain);
      }
    } else {
      // All approved - entry is ready to post
      this.notifyEntryReadyToPost(entry, userId);
    }

    return chainEntry;
  }

  /**
   * Reject entry at any level
   * Marks all chains as REJECTED
   * Entry status becomes REJECTED and goes back to DRAFT
   */
  async rejectAtLevel(
    journalEntryId: string,
    userId: string,
    userRole: string,
    rejectionReason: string,
    tenantId: string,
  ): Promise<void> {
    // Get the approval chain entry for this role
    const chainEntry = await this.financeApprovalChainRepo.findOne({
      where: {
        journalEntryId,
        requiredRole: userRole,
      },
    });

    if (!chainEntry) {
      throw new NotFoundException(
        `No approval chain found for entry ${journalEntryId} with role ${userRole}`,
      );
    }

    if (chainEntry.status !== FinanceApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject - approval already processed (current status: ${chainEntry.status})`,
      );
    }

    // Mark this chain entry as rejected
    chainEntry.status = FinanceApprovalStatus.REJECTED;
    chainEntry.approvedById = userId;
    chainEntry.approvedAt = new Date();
    chainEntry.rejectionReason = rejectionReason;

    await this.financeApprovalChainRepo.save(chainEntry);

    // Mark ALL chains as rejected
    await this.financeApprovalChainRepo.update(
      { journalEntryId },
      { status: FinanceApprovalStatus.REJECTED },
    );

    // Update entry status to REJECTED (which means it goes back to DRAFT)
    const entry = await this.journalEntryRepo.findOne({ where: { id: journalEntryId } });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${journalEntryId} not found after rejection`);
    }

    entry.status = JournalStatus.DRAFT;

    await this.journalEntryRepo.save(entry);

    // Audit log (async, non-blocking)
    this.logAudit('JOURNAL_ENTRY_REJECTED', journalEntryId, userId, tenantId, {
      approvalLevel: chainEntry.approvalLevel,
      role: userRole,
      rejectionReason,
    });

    // Notify original submitter
    this.notifyEntryRejected(entry, userRole, rejectionReason);
  }

  /**
   * Check if entry is ready to post
   */
  async isReadyToPost(journalEntryId: string): Promise<boolean> {
    const entry = await this.journalEntryRepo.findOne({
      where: { id: journalEntryId },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry ${journalEntryId} not found`);
    }

    return entry.status === JournalStatus.APPROVED;
  }

  /**
   * Get full approval history for entry
   */
  async getApprovalHistory(journalEntryId: string): Promise<FinanceApprovalChain[]> {
    return await this.financeApprovalChainRepo.find({
      where: { journalEntryId },
      relations: ['approvedBy'],
      order: { approvalLevel: 'ASC' },
    });
  }

  /**
   * Get escalation candidates (entries pending > N days)
   */
  async getEscalationCandidates(
    facilityId: string,
    daysPending: number = 5,
  ): Promise<JournalEntry[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysPending);

    return await this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.facility_id = :facilityId', { facilityId })
      .andWhere('je.status = :status', { status: JournalStatus.SUBMITTED })
      .andWhere('je.submitted_at <= :cutoffDate', { cutoffDate })
      .orderBy('je.submitted_at', 'ASC')
      .getMany();
  }

  /**
   * Private helper: Log audit event (async, non-blocking)
   */
  private logAudit(
    action: string,
    entityId: string,
    userId: string,
    tenantId: string,
    details: any,
  ): void {
    console.log(
      `[AUDIT] ${action}: entity=${entityId}, user=${userId}, tenant=${tenantId}`,
      details,
    );
  }

  /**
   * Private helper: Notify first level approvers
   */
  private notifyFirstLevelApprovers(
    entry: JournalEntry,
    firstLevel: { level: number; role: string },
    facilityId: string,
  ): void {
    try {
      console.log(
        `[NOTIFY] First level approvers for entry ${entry.id}: role=${firstLevel.role}`,
      );
    } catch (error) {
      console.error(`[ERROR] Failed to notify first level approvers: ${error.message}`);
    }
  }

  /**
   * Private helper: Notify next level approver
   */
  private notifyNextLevelApprover(
    entry: JournalEntry,
    chainEntry: FinanceApprovalChain,
  ): void {
    try {
      console.log(
        `[NOTIFY] Next level approvers for entry ${entry.id}: level=${chainEntry.approvalLevel}, role=${chainEntry.requiredRole}`,
      );
    } catch (error) {
      console.error(`[ERROR] Failed to notify next level approver: ${error.message}`);
    }
  }

  /**
   * Private helper: Notify entry is ready to post
   */
  private notifyEntryReadyToPost(entry: JournalEntry, approverUserId: string): void {
    try {
      console.log(`[NOTIFY] Entry ${entry.id} ready to post`);
    } catch (error) {
      console.error(`[ERROR] Failed to notify entry ready to post: ${error.message}`);
    }
  }

  /**
   * Private helper: Notify entry was rejected
   */
  private notifyEntryRejected(
    entry: JournalEntry,
    rejectorRole: string,
    rejectionReason: string,
  ): void {
    try {
      console.log(
        `[NOTIFY] Entry ${entry.id} rejected by ${rejectorRole}: ${rejectionReason}`,
      );
    } catch (error) {
      console.error(`[ERROR] Failed to notify entry rejected: ${error.message}`);
    }
  }
}
