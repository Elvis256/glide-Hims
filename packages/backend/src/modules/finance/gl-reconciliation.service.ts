import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';
import {
  GlReconciliation,
  GlReconciliationItem,
  GlReconciliationStatus,
  GlReconciliationItemType,
  GlReconciliationItemMatchStatus,
} from '../../database/entities/finance-extended.entity';
import { fromCents, toCents } from '../../common/utils/money';

@Injectable()
export class GLReconciliationService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(ChartOfAccount)
    private readonly chartOfAccountRepo: Repository<ChartOfAccount>,
    @InjectRepository(GlReconciliation)
    private readonly glReconRepo: Repository<GlReconciliation>,
    @InjectRepository(GlReconciliationItem)
    private readonly glReconItemRepo: Repository<GlReconciliationItem>,
    private readonly dataSource: DataSource,
  ) {}

  private requireTenant(tenantId?: string): string {
    if (!tenantId) {
      throw new NotFoundException('Tenant context is required for reconciliation');
    }
    return tenantId;
  }

  async getReconciliationHistory(
    accountId: string,
    facilityId: string,
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
    const tid = this.requireTenant(tenantId);

    const recons = await this.glReconRepo.find({
      where: { accountId, facilityId, tenantId: tid },
      order: { reconciledAt: 'DESC' },
    });

    return recons
      .filter((r) => r.reconciledAt)
      .map((r) => ({
        date: r.reconciledAt,
        action: r.status === GlReconciliationStatus.RECONCILED ? 'reconciled' : 'partial',
        amount: Number(r.glTotal),
        reconciledBy: r.reconciledBy || '',
        notes: r.notes || '',
      }));
  }

  async markAsReconciled(
    accountId: string,
    fiscalPeriodId: string,
    userId: string,
    tenantId?: string,
    notes?: string,
  ): Promise<void> {
    const tid = this.requireTenant(tenantId);

    await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(ChartOfAccount, {
        where: { id: accountId, tenantId: tid },
      });
      if (!account) throw new NotFoundException(`Account ${accountId} not found`);

      let recon = await manager.findOne(GlReconciliation, {
        where: { accountId, fiscalPeriodId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });

      // Compute current GL total
      const lines = await manager
        .getRepository(JournalEntryLine)
        .createQueryBuilder('jel')
        .innerJoin(JournalEntry, 'je', 'je.id = jel.journal_entry_id')
        .where('jel.account_id = :accountId', { accountId })
        .andWhere('jel.tenant_id = :tid', { tid })
        .andWhere('je.fiscal_period_id = :fp', { fp: fiscalPeriodId })
        .andWhere('je.status = :posted', { posted: JournalStatus.POSTED })
        .andWhere('jel.deleted_at IS NULL')
        .getMany();

      const debitCents = lines.reduce((acc, l) => acc + toCents(l.debit), 0);
      const creditCents = lines.reduce((acc, l) => acc + toCents(l.credit), 0);
      const glTotal = fromCents(debitCents - creditCents);

      if (recon) {
        recon.glTotal = glTotal;
        recon.difference = glTotal - Number(recon.externalTotal);
        recon.status = GlReconciliationStatus.RECONCILED;
        recon.reconciledBy = userId;
        recon.reconciledAt = new Date();
        recon.itemCount = lines.length;
        if (notes) recon.notes = notes;
      } else {
        recon = manager.create(GlReconciliation, {
          facilityId: account.facilityId,
          accountId,
          fiscalPeriodId,
          tenantId: tid,
          glTotal,
          externalTotal: 0,
          difference: glTotal,
          status: GlReconciliationStatus.RECONCILED,
          reconciledBy: userId,
          reconciledAt: new Date(),
          itemCount: lines.length,
          notes: notes || undefined,
        });
      }

      await manager.save(GlReconciliation, recon);
    });
  }

  async detectUnmatchedItems(
    accountId: string,
    fiscalPeriodId: string,
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
    const tid = this.requireTenant(tenantId);

    // Find posted journal lines for this account/period
    const lines = await this.journalEntryRepo.manager
      .getRepository(JournalEntryLine)
      .createQueryBuilder('jel')
      .innerJoinAndSelect(JournalEntry, 'je', 'je.id = jel.journal_entry_id')
      .where('jel.account_id = :accountId', { accountId })
      .andWhere('jel.tenant_id = :tid', { tid })
      .andWhere('je.fiscal_period_id = :fp', { fp: fiscalPeriodId })
      .andWhere('je.status = :posted', { posted: JournalStatus.POSTED })
      .andWhere('jel.deleted_at IS NULL')
      .getRawMany();

    // Check which ones are not matched in reconciliation items
    const recon = await this.glReconRepo.findOne({
      where: { accountId, fiscalPeriodId, tenantId: tid },
    });

    const matchedIds = new Set<string>();
    if (recon) {
      const matchedItems = await this.glReconItemRepo.find({
        where: {
          reconciliationId: recon.id,
          matchStatus: GlReconciliationItemMatchStatus.MATCHED,
        },
      });
      for (const item of matchedItems) {
        if (item.journalEntryId) matchedIds.add(item.journalEntryId);
      }
    }

    return lines
      .filter((l) => !matchedIds.has(l.je_id))
      .map((l) => ({
        journalEntryId: l.je_id,
        journalNumber: l.je_journal_number || '',
        amount: fromCents(toCents(l.jel_debit) - toCents(l.jel_credit)),
        date: l.je_journal_date,
        description: l.jel_description || l.je_description || '',
      }));
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

    const reconciledRecons = await this.glReconRepo.count({
      where: {
        facilityId,
        fiscalPeriodId,
        tenantId: tid,
        status: GlReconciliationStatus.RECONCILED,
      },
    });

    const totalAccounts = accounts.length;
    const reconciledAccounts = reconciledRecons;
    const pendingAccounts = totalAccounts - reconciledAccounts;
    const completionPercent =
      totalAccounts > 0 ? Math.round((reconciledAccounts / totalAccounts) * 100) : 0;

    return { totalAccounts, reconciledAccounts, pendingAccounts, completionPercent };
  }

  async reconcileWithExternal(
    accountId: string,
    fiscalPeriodId: string,
    externalData: Array<{ date: Date; amount: number; reference: string }>,
    tenantId?: string,
  ): Promise<{
    matched: number;
    unmatched: number;
    discrepancies: Array<{ type: string; details: string }>;
  }> {
    const tid = this.requireTenant(tenantId);

    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(ChartOfAccount, {
        where: { id: accountId, tenantId: tid },
      });
      if (!account) throw new NotFoundException(`Account ${accountId} not found`);

      // Get or create reconciliation record
      let recon = await manager.findOne(GlReconciliation, {
        where: { accountId, fiscalPeriodId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });

      if (!recon) {
        recon = manager.create(GlReconciliation, {
          facilityId: account.facilityId,
          accountId,
          fiscalPeriodId,
          tenantId: tid,
          glTotal: 0,
          externalTotal: 0,
          difference: 0,
          status: GlReconciliationStatus.IN_PROGRESS,
          itemCount: 0,
        });
        recon = await manager.save(GlReconciliation, recon);
      }

      // Get GL lines for this period
      const glLines = await manager
        .getRepository(JournalEntryLine)
        .createQueryBuilder('jel')
        .innerJoinAndSelect(JournalEntry, 'je', 'je.id = jel.journal_entry_id')
        .where('jel.account_id = :accountId', { accountId })
        .andWhere('jel.tenant_id = :tid', { tid })
        .andWhere('je.fiscal_period_id = :fp', { fp: fiscalPeriodId })
        .andWhere('je.status = :posted', { posted: JournalStatus.POSTED })
        .andWhere('jel.deleted_at IS NULL')
        .getRawMany();

      // Compute GL total
      const debitCents = glLines.reduce((acc, l) => acc + toCents(l.jel_debit), 0);
      const creditCents = glLines.reduce((acc, l) => acc + toCents(l.jel_credit), 0);
      const glTotal = fromCents(debitCents - creditCents);

      // Compute external total
      const externalTotalCents = externalData.reduce((acc, e) => acc + toCents(e.amount), 0);
      const externalTotal = fromCents(externalTotalCents);

      // Simple amount-based matching: for each external entry, find
      // the first unmatched GL line with the same amount (in cents).
      let matched = 0;
      let unmatched = 0;
      const discrepancies: Array<{ type: string; details: string }> = [];

      const usedGlIndices = new Set<number>();
      const glAmounts = glLines.map((l) => toCents(l.jel_debit) - toCents(l.jel_credit));

      for (const ext of externalData) {
        const extCents = toCents(ext.amount);
        let found = false;

        for (let i = 0; i < glAmounts.length; i++) {
          if (!usedGlIndices.has(i) && glAmounts[i] === extCents) {
            usedGlIndices.add(i);
            found = true;

            // Save matched GL item
            await manager.save(
              GlReconciliationItem,
              manager.create(GlReconciliationItem, {
                reconciliationId: recon.id,
                tenantId: tid,
                itemType: GlReconciliationItemType.GL_ENTRY,
                journalEntryId: glLines[i].je_id,
                amount: ext.amount,
                entryDate: ext.date,
                description: ext.reference,
                matchStatus: GlReconciliationItemMatchStatus.MATCHED,
              }),
            );

            matched++;
            break;
          }
        }

        if (!found) {
          // Save unmatched external item
          await manager.save(
            GlReconciliationItem,
            manager.create(GlReconciliationItem, {
              reconciliationId: recon.id,
              tenantId: tid,
              itemType: GlReconciliationItemType.EXTERNAL_ENTRY,
              externalReference: ext.reference,
              amount: ext.amount,
              entryDate: ext.date,
              description: `External: ${ext.reference}`,
              matchStatus: GlReconciliationItemMatchStatus.UNMATCHED,
            }),
          );

          unmatched++;
          discrepancies.push({
            type: 'unmatched_external',
            details: `External entry ${ext.reference} (${ext.amount}) has no matching GL entry`,
          });
        }
      }

      // Check for unmatched GL entries
      for (let i = 0; i < glLines.length; i++) {
        if (!usedGlIndices.has(i)) {
          discrepancies.push({
            type: 'unmatched_gl',
            details: `GL entry ${glLines[i].je_journal_number || glLines[i].je_id} (${fromCents(glAmounts[i])}) has no matching external entry`,
          });
        }
      }

      // Update reconciliation record
      recon.glTotal = glTotal;
      recon.externalTotal = externalTotal;
      recon.difference = fromCents(debitCents - creditCents - externalTotalCents);
      recon.itemCount = matched + unmatched;
      recon.status =
        unmatched === 0 && discrepancies.length === 0
          ? GlReconciliationStatus.RECONCILED
          : GlReconciliationStatus.PARTIAL;
      await manager.save(GlReconciliation, recon);

      return { matched, unmatched, discrepancies };
    });
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

    // Compute GL total from posted journal lines
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

    const debitCents = lines.reduce((acc, l) => acc + toCents(l.debit), 0);
    const creditCents = lines.reduce((acc, l) => acc + toCents(l.credit), 0);
    const glTotal = fromCents(debitCents - creditCents);

    // Check persisted reconciliation status
    const recon = await this.glReconRepo.findOne({
      where: { accountId, fiscalPeriodId, tenantId: tid },
    });

    const externalTotal = recon ? Number(recon.externalTotal) : 0;
    let reconciliationStatus: 'reconciled' | 'partial' | 'unreconciled' = 'unreconciled';
    if (recon) {
      if (recon.status === GlReconciliationStatus.RECONCILED) reconciliationStatus = 'reconciled';
      else if (recon.status === GlReconciliationStatus.PARTIAL) reconciliationStatus = 'partial';
    }

    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      glTotal,
      externalTotal,
      difference: fromCents(debitCents - creditCents - toCents(externalTotal)),
      reconciliationStatus,
      itemCount: lines.length,
      lastReconciledAt: recon?.reconciledAt || undefined,
    };
  }
}
