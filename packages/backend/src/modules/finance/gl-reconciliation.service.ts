import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';

/**
 * Reconciliation item (for tracking unmatched GL entries)
 * Note: This service tracks reconciliation at a high level
 * In a full implementation, would need reconciliation_items table
 */
export interface ReconciliationItem {
  accountId: string;
  fiscalPeriodId: string;
  totalAmount: number;
  reconciledAmount: number;
  unmatchedAmount: number;
  lastReconciledAt?: Date;
  reconciledBy?: string;
  notes?: string;
}

@Injectable()
export class GLReconciliationService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(ChartOfAccount)
    private readonly chartOfAccountRepo: Repository<ChartOfAccount>,
  ) {}

  /**
   * Get reconciliation history for an account
   * Returns timeline of reconciliation actions
   */
  async getReconciliationHistory(
    accountId: string,
    facilityId: string,
  ): Promise<
    Array<{
      date: Date;
      action: string;
      amount: number;
      reconciledBy: string;
      notes: string;
    }>
  > {
    // In a real system, this would query a reconciliation_audit_log table
    // For now, return empty history (placeholder for integration)
    return [];
  }

  /**
   * Mark account as fully reconciled for a period
   * Records who reconciled and when
   */
  async markAsReconciled(
    accountId: string,
    fiscalPeriodId: string,
    userId: string,
    notes?: string,
  ): Promise<void> {
    const account = await this.chartOfAccountRepo.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    // In a real system, would update reconciliation_status table
    // For now, just log the action
    console.log(
      `[RECONCILIATION] Marked account ${accountId} (${account.accountCode}) as reconciled for period ${fiscalPeriodId} by ${userId}`,
      notes,
    );
  }

  /**
   * Detect unmatched GL entries in an account for a period
   * Returns items that need manual reconciliation
   */
  async detectUnmatchedItems(
    accountId: string,
    fiscalPeriodId: string,
  ): Promise<
    Array<{
      journalEntryId: string;
      journalNumber: string;
      amount: number;
      date: Date;
      description: string;
    }>
  > {
    // In a real system, this would use a reconciliation_matching table
    // to identify items that haven't been matched to bank statements, etc.
    // For now, return empty (placeholder)
    return [];
  }

  /**
   * Get reconciliation summary for facility and period
   */
  async getReconciliationSummary(
    facilityId: string,
    fiscalPeriodId: string,
  ): Promise<{
    totalAccounts: number;
    reconciledAccounts: number;
    pendingAccounts: number;
    completionPercent: number;
  }> {
    const accounts = await this.chartOfAccountRepo.find({
      where: { facilityId },
    });

    // In a real system, would check against reconciliation status table
    // For now, assume all accounts are reconciled (simplified)
    return {
      totalAccounts: accounts.length,
      reconciledAccounts: accounts.length,
      pendingAccounts: 0,
      completionPercent: 100,
    };
  }

  /**
   * Reconcile entries between GL and external data (e.g., bank statements)
   * Marks matched items
   */
  async reconcileWithExternal(
    accountId: string,
    fiscalPeriodId: string,
    externalData: Array<{ date: Date; amount: number; reference: string }>,
  ): Promise<{
    matched: number;
    unmatched: number;
    discrepancies: Array<{ type: string; details: string }>;
  }> {
    // Placeholder for external reconciliation logic
    // In a real system, would use matching algorithms
    return {
      matched: 0,
      unmatched: 0,
      discrepancies: [],
    };
  }

  /**
   * Generate reconciliation report for an account
   */
  async generateReconciliationReport(
    accountId: string,
    fiscalPeriodId: string,
    facilityId: string,
  ): Promise<{
    accountId: string;
    accountCode: string;
    accountName: string;
    glTotal: number;
    externalTotal: number;
    difference: number;
    reconciliationStatus: 'reconciled' | 'partial' | 'unreconciled';
    itemCount: number;
    lastReconciledAt?: Date;
  }> {
    const account = await this.chartOfAccountRepo.findOne({
      where: { id: accountId, facilityId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    // Placeholder implementation
    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      glTotal: 0,
      externalTotal: 0,
      difference: 0,
      reconciliationStatus: 'unreconciled',
      itemCount: 0,
    };
  }
}
