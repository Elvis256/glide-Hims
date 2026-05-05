import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { ChartOfAccounts } from '../../database/entities/chart-of-account.entity';

@Injectable()
export class DataIntegrityService {
  private readonly logger = new Logger('DataIntegrityService');

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepo: Repository<JournalEntry>,
    @InjectRepository(ChartOfAccounts)
    private coaRepo: Repository<ChartOfAccounts>,
  ) {}

  /**
   * Validate GL balance: sum of debits should equal sum of credits
   */
  async validateGLBalance(periodStart?: Date, periodEnd?: Date): Promise<{
    isBalanced: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    status: string;
  }> {
    this.logger.debug('Validating GL balance');

    let query = this.journalEntryRepo.createQueryBuilder('je');

    if (periodStart && periodEnd) {
      query = query.where('je.journalDate >= :start', { start: periodStart });
      query = query.andWhere('je.journalDate <= :end', { end: periodEnd });
    }

    const totals = await query
      .select('SUM(je.debit) as totalDebits, SUM(je.credit) as totalCredits')
      .getRawOne();

    const totalDebits = parseFloat(totals.totalDebits) || 0;
    const totalCredits = parseFloat(totals.totalCredits) || 0;
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01; // Allow 1 cent variance for rounding

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      difference,
      status: isBalanced ? 'BALANCED' : 'IMBALANCED',
    };
  }

  /**
   * Detect unbalanced GL accounts (accounts where debits != credits)
   */
  async detectUnbalancedAccounts(): Promise<{
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
    this.logger.debug('Detecting unbalanced accounts');

    const unbalanced = await this.journalEntryRepo
      .createQueryBuilder('je')
      .select('je.accountId')
      .addSelect('SUM(je.debit) as totalDebits')
      .addSelect('SUM(je.credit) as totalCredits')
      .groupBy('je.accountId')
      .getRawMany();

    const results = [];

    for (const row of unbalanced) {
      const account = await this.coaRepo.findOne({
        where: { id: row.je_accountId },
      });

      if (!account) continue;

      const totalDebits = parseFloat(row.totalDebits) || 0;
      const totalCredits = parseFloat(row.totalCredits) || 0;
      const balance = totalDebits - totalCredits;
      const variance = Math.abs(balance);

      // Only flag if variance > 0.01 (1 cent)
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

    return {
      unbalancedCount: results.length,
      accounts: results,
    };
  }

  /**
   * Check for missing required GL account master records
   */
  async validateAccountMasterData(): Promise<{
    isValid: boolean;
    missingAccounts: string[];
    orphanedEntries: number;
    accountsWithoutType: number;
  }> {
    this.logger.debug('Validating account master data');

    // Find entries with non-existent accounts
    const orphaned = await this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.account', 'a')
      .where('a.id IS NULL')
      .getMany();

    // Find accounts without required fields
    const incomplete = await this.coaRepo
      .createQueryBuilder('coa')
      .where('coa.accountType IS NULL OR coa.accountType = :empty', {
        empty: '',
      })
      .getMany();

    const missingAccounts = orphaned.map((e) => e.accountId!);
    const isValid =
      orphaned.length === 0 && incomplete.length === 0;

    return {
      isValid,
      missingAccounts,
      orphanedEntries: orphaned.length,
      accountsWithoutType: incomplete.length,
    };
  }

  /**
   * Detect potential fraud patterns (rapid posting, large amounts, unusual accounts)
   */
  async detectAnomalies(): Promise<{
    anomalyCount: number;
    rapidPostings: Array<{ accountCode: string; count: number }>;
    largeTransactions: Array<{
      accountCode: string;
      amount: number;
      date: Date;
    }>;
    unusualAccounts: Array<{ accountCode: string; description: string }>;
  }> {
    this.logger.debug('Detecting GL anomalies');

    // Find accounts with many entries in a short period
    const rapidPostings = await this.journalEntryRepo
      .createQueryBuilder('je')
      .select('je.accountId')
      .addSelect('COUNT(*) as entryCount')
      .where('je.journalDate >= DATE_SUB(NOW(), INTERVAL 1 DAY)')
      .groupBy('je.accountId')
      .having('COUNT(*) > 50')
      .getRawMany();

    // Find unusually large transactions (> 1M)
    const largeTransactions = await this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.debit > 1000000 OR je.credit > 1000000')
      .orderBy('je.journalDate', 'DESC')
      .limit(10)
      .getMany();

    // Find entries in non-standard accounts (not asset/liability/equity)
    const unusual = await this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.account', 'a')
      .where('a.accountType NOT IN (:...types)', {
        types: [
          'ASSET',
          'LIABILITY',
          'EQUITY',
          'REVENUE',
          'EXPENSE',
          'COST_OF_GOODS_SOLD',
        ],
      })
      .groupBy('a.id')
      .limit(5)
      .getMany();

    const anomalyCount =
      rapidPostings.length + largeTransactions.length + unusual.length;

    return {
      anomalyCount,
      rapidPostings: rapidPostings.map((rp) => ({
        accountCode: rp.je_accountId,
        count: parseInt(rp.entryCount),
      })),
      largeTransactions: largeTransactions.map((lt) => ({
        accountCode: lt.accountId!,
        amount: (lt.debit || 0) + (lt.credit || 0),
        date: lt.journalDate,
      })),
      unusualAccounts: unusual.map((u) => ({
        accountCode: u.account?.accountCode || 'UNKNOWN',
        description: u.account?.accountName || 'Unknown Account',
      })),
    };
  }

  /**
   * Verify referential integrity: all FK relationships are valid
   */
  async verifyReferentialIntegrity(): Promise<{
    isValid: boolean;
    brokenReferences: Array<{
      entityType: string;
      fieldName: string;
      invalidCount: number;
    }>;
  }> {
    this.logger.debug('Verifying referential integrity');

    const issues = [];

    // Check journalEntries → accounts
    const brokenAccountRefs = await this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.account', 'a')
      .where('a.id IS NULL')
      .getCount();

    if (brokenAccountRefs > 0) {
      issues.push({
        entityType: 'JournalEntry',
        fieldName: 'accountId',
        invalidCount: brokenAccountRefs,
      });
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      brokenReferences: issues,
    };
  }

  /**
   * Generate comprehensive integrity report
   */
  async getIntegrityReport(): Promise<{
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
      masterData: {
        isValid: boolean;
        orphanedEntries: number;
        accountsWithoutType: number;
      };
      anomalies: { anomalyCount: number };
      referentialIntegrity: { isValid: boolean; brokenCount: number };
    };
  }> {
    this.logger.debug('Generating integrity report');

    const glBalance = await this.validateGLBalance();
    const unbalanced = await this.detectUnbalancedAccounts();
    const masterData = await this.validateAccountMasterData();
    const anomalies = await this.detectAnomalies();
    const referential = await this.verifyReferentialIntegrity();

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
        unbalancedAccounts: {
          unbalancedCount: unbalanced.unbalancedCount,
        },
        masterData: {
          isValid: masterData.isValid,
          orphanedEntries: masterData.orphanedEntries,
          accountsWithoutType: masterData.accountsWithoutType,
        },
        anomalies: {
          anomalyCount: anomalies.anomalyCount,
        },
        referentialIntegrity: {
          isValid: referential.isValid,
          brokenCount: referential.brokenReferences.length,
        },
      },
    };
  }
}
