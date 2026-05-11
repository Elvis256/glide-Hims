import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import { fromCents, toCents } from '../../common/utils/money';

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
    void fiscalPeriodId;
    void userId;
    void notes;
    // Sprint-6: refuse silently-successful reconciliation. Until the
    // reconciliation_status table lands, this endpoint MUST NOT pretend
    // to have persisted anything — auditors and operators would walk
    // away with the false impression that the period was reconciled.
    throw new NotImplementedException(
      'GL reconciliation persistence is not yet implemented (no reconciliation_status table). The endpoint will become functional once the schema lands.',
    );
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
    // Sprint-6: report the truth. Until reconciliation_status is
    // persisted no account is reconciled — pretending 100% of accounts
    // are reconciled (the original stub) hides unreconciled GL drift
    // from operators and auditors.
    return {
      totalAccounts: accounts.length,
      reconciledAccounts: 0,
      pendingAccounts: accounts.length,
      completionPercent: 0,
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

    // Sprint-6: actually compute glTotal from posted journal lines for
    // the account in the period, in cents to avoid IEEE-754 drift. The
    // external total / status remain at safe defaults (no external feed
    // is hooked up yet) so the caller can see a real GL number side-
    // by-side with externalTotal=0 and learn the gap, instead of being
    // told everything is zero.
    const lines = await this.journalEntryRepo.manager
      .getRepository(JournalEntryLine)
      .createQueryBuilder('jel')
      .innerJoin(JournalEntry, 'je', 'je.id = jel.journal_entry_id')
      .where('jel.account_id = :accountId', { accountId })
      .andWhere('jel.tenant_id = :tid', { tid })
      .andWhere('je.fiscal_period_id = :fp', { fp: fiscalPeriodId })
      .andWhere('je.status = :posted', { posted: JournalStatus.POSTED })
      .andWhere('jel.deleted_at IS NULL')
      .getMany();

    const debitCents = lines.reduce(
      (acc, l) => acc + toCents(l.debit),
      0,
    );
    const creditCents = lines.reduce(
      (acc, l) => acc + toCents(l.credit),
      0,
    );
    const glTotal = fromCents(debitCents - creditCents);

    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      glTotal,
      externalTotal: 0,
      difference: glTotal,
      reconciliationStatus: 'unreconciled',
      itemCount: lines.length,
    };
  }
}
