import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { ChartOfAccount } from '../../database/entities/chart-of-account.entity';

function requireTenant(tenantId?: string): string {
  if (!tenantId) throw new ForbiddenException('Tenant context required');
  return tenantId;
}

@Injectable()
export class DataIntegrityService {
  private readonly logger = new Logger('DataIntegrityService');

  constructor(
    @InjectRepository(JournalEntryLine)
    private journalEntryLineRepo: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private coaRepo: Repository<ChartOfAccount>,
  ) {}

  async validateGLBalance(
    tenantId: string | undefined,
    periodStart?: Date,
    periodEnd?: Date,
  ): Promise<{
    isBalanced: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    status: string;
  }> {
    const tid = requireTenant(tenantId);

    let query = this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoin('jel.journalEntry', 'je')
      .where('je.tenant_id = :tid', { tid });

    if (periodStart && periodEnd) {
      query = query
        .andWhere('je.journal_date >= :start', { start: periodStart })
        .andWhere('je.journal_date <= :end', { end: periodEnd });
    }

    const totals = await query
      .select('SUM(jel.debit) as totalDebits, SUM(jel.credit) as totalCredits')
      .getRawOne();

    const totalDebits = parseFloat(totals?.totalDebits) || 0;
    const totalCredits = parseFloat(totals?.totalCredits) || 0;
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01;

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      difference,
      status: isBalanced ? 'BALANCED' : 'IMBALANCED',
    };
  }

  async detectUnbalancedAccounts(tenantId: string | undefined): Promise<{
    unbalancedCount: number;
    accounts: Array<{
      accountCode: string;
      accountName: string;
      totalDebits: number;
      totalCredits: number;
      balance: number;
      variance: number;
    }>;
  }> {
    const tid = requireTenant(tenantId);

    const unbalanced = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoin('jel.journalEntry', 'je')
      .select('jel.account_id', 'account_id')
      .addSelect('SUM(jel.debit)', 'totalDebits')
      .addSelect('SUM(jel.credit)', 'totalCredits')
      .where('je.tenant_id = :tid', { tid })
      .groupBy('jel.account_id')
      .getRawMany();

    const results = [] as any[];

    for (const row of unbalanced) {
      const account = await this.coaRepo.findOne({
        where: { id: row.account_id, tenantId: tid },
      });
      if (!account) continue;

      const totalDebits = parseFloat(row.totalDebits) || 0;
      const totalCredits = parseFloat(row.totalCredits) || 0;
      const balance = totalDebits - totalCredits;
      const variance = Math.abs(balance);

      if (variance > 0.01) {
        results.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          totalDebits,
          totalCredits,
          balance,
          variance,
        });
      }
    }

    results.sort((a, b) => b.variance - a.variance);
    return { unbalancedCount: results.length, accounts: results };
  }

  async validateAccountMasterData(tenantId: string | undefined): Promise<{
    isValid: boolean;
    missingAccounts: string[];
    orphanedEntries: number;
    accountsWithoutType: number;
  }> {
    const tid = requireTenant(tenantId);

    const orphaned = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .leftJoin('jel.account', 'a')
      .innerJoin('jel.journalEntry', 'je')
      .where('a.id IS NULL')
      .andWhere('je.tenant_id = :tid', { tid })
      .getMany();

    const incomplete = await this.coaRepo
      .createQueryBuilder('coa')
      .where('coa.tenant_id = :tid', { tid })
      .andWhere('(coa.account_type IS NULL OR coa.account_type = :empty)', { empty: '' })
      .getMany();

    const missingAccounts = orphaned.map((e) => e.accountId!);
    const isValid = orphaned.length === 0 && incomplete.length === 0;

    return {
      isValid,
      missingAccounts,
      orphanedEntries: orphaned.length,
      accountsWithoutType: incomplete.length,
    };
  }

  async detectAnomalies(tenantId: string | undefined): Promise<{
    anomalyCount: number;
    rapidPostings: Array<{ accountCode: string; count: number }>;
    largeTransactions: Array<{ accountCode: string; amount: number; date: Date }>;
  }> {
    const tid = requireTenant(tenantId);

    // Use Postgres-compatible interval arithmetic (was MySQL DATE_SUB)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rapidPostings = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoin('jel.journalEntry', 'je')
      .select('jel.account_id', 'account_id')
      .addSelect('COUNT(*)', 'entryCount')
      .where('je.tenant_id = :tid', { tid })
      .andWhere('je.journal_date >= :oneDayAgo', { oneDayAgo })
      .groupBy('jel.account_id')
      .having('COUNT(*) > 50')
      .getRawMany();

    const largeTransactions = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .innerJoinAndSelect('jel.journalEntry', 'je')
      .where('je.tenant_id = :tid', { tid })
      .andWhere('(jel.debit > 1000000 OR jel.credit > 1000000)')
      .orderBy('je.journal_date', 'DESC')
      .limit(10)
      .getMany();

    const anomalyCount = rapidPostings.length + largeTransactions.length;

    return {
      anomalyCount,
      rapidPostings: rapidPostings.map((rp) => ({
        accountCode: rp.account_id,
        count: parseInt(rp.entryCount),
      })),
      largeTransactions: largeTransactions.map((lt) => ({
        accountCode: lt.accountId!,
        amount: (Number(lt.debit) || 0) + (Number(lt.credit) || 0),
        date: lt.journalEntry?.journalDate || new Date(),
      })),
    };
  }

  async verifyReferentialIntegrity(tenantId: string | undefined): Promise<{
    isValid: boolean;
    brokenReferences: Array<{ entityType: string; fieldName: string; invalidCount: number }>;
  }> {
    const tid = requireTenant(tenantId);
    const issues = [] as any[];

    const brokenAccountRefs = await this.journalEntryLineRepo
      .createQueryBuilder('jel')
      .leftJoin('jel.account', 'a')
      .innerJoin('jel.journalEntry', 'je')
      .where('a.id IS NULL')
      .andWhere('je.tenant_id = :tid', { tid })
      .getCount();

    if (brokenAccountRefs > 0) {
      issues.push({
        entityType: 'JournalEntryLine',
        fieldName: 'accountId',
        invalidCount: brokenAccountRefs,
      });
    }

    return { isValid: issues.length === 0, brokenReferences: issues };
  }

  async getIntegrityReport(tenantId: string | undefined): Promise<{
    timestamp: Date;
    overallStatus: string;
    sections: {
      glBalance: {
        isBalanced: boolean;
        totalDebits: number;
        totalCredits: number;
        difference: number;
      };
      unbalancedAccounts: { unbalancedCount: number };
      masterData: { isValid: boolean; orphanedEntries: number; accountsWithoutType: number };
      anomalies: { anomalyCount: number };
      referentialIntegrity: { isValid: boolean; brokenCount: number };
    };
  }> {
    const glBalance = await this.validateGLBalance(tenantId);
    const unbalanced = await this.detectUnbalancedAccounts(tenantId);
    const masterData = await this.validateAccountMasterData(tenantId);
    const anomalies = await this.detectAnomalies(tenantId);
    const referential = await this.verifyReferentialIntegrity(tenantId);

    const allValid =
      glBalance.isBalanced &&
      unbalanced.unbalancedCount === 0 &&
      masterData.isValid &&
      anomalies.anomalyCount === 0 &&
      referential.isValid;

    return {
      timestamp: new Date(),
      overallStatus: allValid ? 'HEALTHY' : 'ISSUES_DETECTED',
      sections: {
        glBalance: {
          isBalanced: glBalance.isBalanced,
          totalDebits: glBalance.totalDebits,
          totalCredits: glBalance.totalCredits,
          difference: glBalance.difference,
        },
        unbalancedAccounts: { unbalancedCount: unbalanced.unbalancedCount },
        masterData: {
          isValid: masterData.isValid,
          orphanedEntries: masterData.orphanedEntries,
          accountsWithoutType: masterData.accountsWithoutType,
        },
        anomalies: { anomalyCount: anomalies.anomalyCount },
        referentialIntegrity: {
          isValid: referential.isValid,
          brokenCount: referential.brokenReferences.length,
        },
      },
    };
  }
}
