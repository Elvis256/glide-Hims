import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';

/**
 * Reconciliation item (for tracking unmatched GL entries)
 * NOTE: this service is currently a stub; a full reconciliation_items table
 * is required for production behaviour. Every method is tenant-scoped to
 * prevent cross-tenant data leakage in the meantime.
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

  private requireTenant(tenantId?: string): string {
    if (!tenantId) {
      throw new NotFoundException('Tenant context is required for reconciliation');
    }
    return tenantId;
  }

  async getReconciliationHistory(
    _accountId: string,
    _facilityId: string,
    tenantId?: string,
  ): Promise<
    Array<{
      date: Date;
      action: string;
      amount: number;
      reconciledBy: string;
      notes: string;
    }>
  > {
    this.requireTenant(tenantId);
    return [];
  }

  async markAsReconciled(
    accountId: string,
    fiscalPeriodId: string,
    userId: string,
    tenantId?: string,
    notes?: string,
  ): Promise<void> {
    const tid = this.requireTenant(tenantId);
    const account = await this.chartOfAccountRepo.findOne({
      where: { id: accountId, tenantId: tid },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    // TODO: persist to reconciliation_status table when introduced.
    void fiscalPeriodId;
    void userId;
    void notes;
  }

  async detectUnmatchedItems(
    _accountId: string,
    _fiscalPeriodId: string,
    tenantId?: string,
  ): Promise<
    Array<{
      journalEntryId: string;
      journalNumber: string;
      amount: number;
      date: Date;
      description: string;
    }>
  > {
    this.requireTenant(tenantId);
    return [];
  }

  async getReconciliationSummary(
    facilityId: string,
    fiscalPeriodId: string,
    tenantId?: string,
  ): Promise<{
    totalAccounts: number;
    reconciledAccounts: number;
    pendingAccounts: number;
    completionPercent: number;
  }> {
    const tid = this.requireTenant(tenantId);
    const accounts = await this.chartOfAccountRepo.find({
      where: { facilityId, tenantId: tid },
    });
    void fiscalPeriodId;
    return {
      totalAccounts: accounts.length,
      reconciledAccounts: accounts.length,
      pendingAccounts: 0,
      completionPercent: 100,
    };
  }

  async reconcileWithExternal(
    _accountId: string,
    _fiscalPeriodId: string,
    _externalData: Array<{ date: Date; amount: number; reference: string }>,
    tenantId?: string,
  ): Promise<{
    matched: number;
    unmatched: number;
    discrepancies: Array<{ type: string; details: string }>;
  }> {
    this.requireTenant(tenantId);
    return { matched: 0, unmatched: 0, discrepancies: [] };
  }

  async generateReconciliationReport(
    accountId: string,
    fiscalPeriodId: string,
    facilityId: string,
    tenantId?: string,
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
    const tid = this.requireTenant(tenantId);
    const account = await this.chartOfAccountRepo.findOne({
      where: { id: accountId, facilityId, tenantId: tid },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    void fiscalPeriodId;
    void this.journalEntryRepo;
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
